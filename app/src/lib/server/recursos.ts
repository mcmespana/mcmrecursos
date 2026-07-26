import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizarTags, partirTags, slugTag } from '$lib/catalogo/tags';
import { FORMATOS, type ClaveFormato } from '$lib/catalogo/formatos';
import { resolverFormato } from './formatos';

type Cliente = SupabaseClient<any, 'recursos'>;

/**
 * Escritura de un recurso desde el formulario compartido del panel (SPEC-008 §3).
 *
 * Lo usan las tres pantallas que crean o modifican recursos —alta manual, edición y
 * «catalogar y publicar» desde la cola de revisión— para que los tres caminos guarden
 * exactamente los mismos campos.
 */

/** Campos de la tabla `recurso` tal y como llegan del formulario. */
export async function camposDelFormulario(f: FormData) {
	const texto = (campo: string) => String(f.get(campo) ?? '').trim() || null;
	const bool = (campo: string) => f.get(campo) === 'on';
	const enlace = texto('enlace');
	const formato = await resolverFormato(enlace);

	return {
		nombre: String(f.get('nombre') ?? '').trim(),
		descripcion: texto('descripcion'),
		tipo: texto('tipo'),
		etapas: f.getAll('etapas').map(String),
		edades: f.getAll('edades').map(String),
		nivel: texto('nivel'),
		mcm_local_id: texto('mcm_local_id'),
		idioma: texto('idioma'),
		// si no se elige soporte a mano, se deduce del formato del enlace
		soporte: texto('soporte') ?? (formato ? (FORMATOS[formato as ClaveFormato]?.soporte ?? null) : null),
		ubicacion: texto('ubicacion'),
		enlace,
		formato,
		imagen: texto('imagen'),
		enlace_imagenes: texto('enlace_imagenes'),
		anyo_publicacion: texto('anyo_publicacion') ? Number(texto('anyo_publicacion')) : null,
		curso_usado: texto('curso_usado'),
		visibilidad: String(f.get('visibilidad') ?? 'publico'),
		estado: String(f.get('estado') ?? 'borrador'),
		datos_personales: bool('datos_personales'),
		creado_con_ia: bool('creado_con_ia'),
		fuera_del_banco: bool('fuera_del_banco'),
		pendiente_clasificar: bool('pendiente_clasificar'),
		notas_internas: texto('notas_internas')
	};
}

/**
 * Reemplaza las temáticas del recurso. Reutiliza las que ya existen comparando por slug, para
 * que «Adviento» escrito de tres formas distintas no se convierta en tres etiquetas.
 */
export async function guardarTags(supabase: Cliente, recursoId: string, crudo: string) {
	const { data: existentesRes } = await supabase.from('tag').select('nombre');
	const existentes = (existentesRes ?? []).map((t: any) => t.nombre as string);
	const tags = normalizarTags(partirTags(crudo), existentes);

	await supabase.from('recurso_tag').delete().eq('recurso_id', recursoId);
	for (const nombreTag of tags) {
		const slug = slugTag(nombreTag);
		if (!slug) continue;
		await supabase
			.from('tag')
			.upsert({ nombre: nombreTag, slug }, { onConflict: 'slug', ignoreDuplicates: true });
		const { data: tag } = await supabase.from('tag').select('id').eq('slug', slug).maybeSingle();
		if (tag) await supabase.from('recurso_tag').insert({ recurso_id: recursoId, tag_id: tag.id });
	}
}

/**
 * Reemplaza los formatos alternativos del recurso (SPEC-011). El formato de cada archivo se
 * resuelve en el servidor: por URL siempre, y consultando a Drive cuando la URL no basta.
 */
export async function guardarArchivos(
	supabase: Cliente,
	recursoId: string,
	enlaces: string[],
	etiquetas: string[]
) {
	await supabase.from('recurso_archivo').delete().eq('recurso_id', recursoId);

	const vistos = new Set<string>();
	const filas: {
		recurso_id: string;
		enlace: string;
		etiqueta: string | null;
		formato: string | null;
		orden: number;
	}[] = [];

	for (let i = 0; i < enlaces.length; i++) {
		const enlace = (enlaces[i] ?? '').trim();
		if (!enlace || vistos.has(enlace)) continue;
		vistos.add(enlace);
		filas.push({
			recurso_id: recursoId,
			enlace,
			etiqueta: (etiquetas[i] ?? '').trim() || null,
			formato: await resolverFormato(enlace),
			orden: filas.length
		});
	}
	if (filas.length) await supabase.from('recurso_archivo').insert(filas);
}

/** Temáticas y archivos en una sola llamada, que es como se usan siempre. */
export async function guardarRelacionados(supabase: Cliente, recursoId: string, f: FormData) {
	await guardarTags(supabase, recursoId, String(f.get('tags') ?? ''));
	await guardarArchivos(
		supabase,
		recursoId,
		f.getAll('archivo_enlace').map(String),
		f.getAll('archivo_etiqueta').map(String)
	);
}
