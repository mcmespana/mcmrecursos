import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clasificarRecurso, type VocabulariosIa } from '$lib/server/ia';
import { extraerTextoDrive } from '$lib/server/drive';
import { resolverFormato } from '$lib/server/formatos';
import { camposDelFormulario, guardarRelacionados } from '$lib/server/recursos';
import { slugTag } from '$lib/catalogo/tags';
import { embeddingsDisponibles, embeddingsDocumentos } from '$lib/server/embeddings';
import { exigirRol } from '$lib/server/permisos';
import type { SupabaseClient } from '@supabase/supabase-js';

const ESTADOS_PENDIENTES = ['borrador', 'subido_usuario', 'pendiente_revision', 'revisar_ia'];

/** Texto que representa a un recurso para el embedding semántico. */
function textoParaEmbedding(r: any): string {
	return [
		r.nombre,
		r.descripcion ?? '',
		r.tipo ?? '',
		(r.etapas ?? []).join(' '),
		(r.edades ?? []).join(' '),
		((r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean) as string[]).join(' ')
	]
		.filter(Boolean)
		.join('. ')
		.slice(0, 8000);
}

async function cargarVocab(supabase: SupabaseClient<any, 'recursos'>): Promise<VocabulariosIa> {
	const [listasRes, tagsRes] = await Promise.all([
		supabase.from('lista_valor').select('lista, valor').eq('activo', true),
		supabase.from('tag').select('nombre').order('nombre').limit(200)
	]);
	const deLista = (lista: string) =>
		(listasRes.data ?? []).filter((l: any) => l.lista === lista).map((l: any) => l.valor);
	return {
		tipos: deLista('tipo'),
		etapas: deLista('etapas'),
		edades: deLista('edades'),
		niveles: deLista('nivel'),
		idiomas: deLista('idioma'),
		soportes: deLista('soporte'),
		tags: (tagsRes.data ?? []).map((t: any) => t.nombre)
	};
}

/** Clasifica un recurso (leyendo Drive si se puede) y guarda la propuesta. */
async function clasificarUno(
	supabase: SupabaseClient<any, 'recursos'>,
	id: string,
	vocab: VocabulariosIa
): Promise<{ disponible: boolean; ok: boolean; propuesta?: any; error?: string }> {
	const { data: r } = await supabase
		.from('recurso')
		.select('nombre, descripcion, notas_internas, tipo, enlace, no_ia, recurso_tag (tag (nombre))')
		.eq('id', id)
		.maybeSingle();
	if (!r) return { disponible: true, ok: false, error: 'Recurso no encontrado' };
	if ((r as any).no_ia) return { disponible: true, ok: false, error: 'Excluido de la IA (no_ia)' };

	const textoDocumento = await extraerTextoDrive((r as any).enlace);
	const res = await clasificarRecurso(
		{
			nombre: (r as any).nombre,
			descripcion: (r as any).descripcion,
			notas: (r as any).notas_internas,
			tipoActual: (r as any).tipo,
			enlace: (r as any).enlace,
			tagsActuales: ((r as any).recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean),
			textoDocumento
		},
		vocab
	);
	if (!res.disponible) return { disponible: false, ok: false };
	if (!res.ok) {
		// si este registro de error no se puede guardar, da igual: no queremos tapar el error de verdad
		await supabase.from('clasificacion_ia').insert({ recurso_id: id, estado: 'error', error: res.error });
		return { disponible: true, ok: false, error: res.error };
	}
	const { error: errGuardar } = await supabase.from('clasificacion_ia').insert({
		recurso_id: id,
		estado: 'propuesta',
		modelo: res.modelo,
		propuesta: res.propuesta,
		avisos: res.propuesta.avisos,
		confianza: res.propuesta.confianza
	});
	if (errGuardar) {
		return {
			disponible: true,
			ok: false,
			error: `no se pudo guardar la propuesta: ${errGuardar.message}`
		};
	}
	return { disponible: true, ok: true, propuesta: res.propuesta };
}

/**
 * Id de una temática por su nombre, reutilizando la que ya existe.
 *
 * La comparación va por slug —no por el texto tal cual— para que «adviento», «Adviento» y
 * «ADVIENTO » sean la misma etiqueta y no tres gemelas, igual que en el formulario (SPEC-008 §2).
 */
async function idDeTag(
	supabase: SupabaseClient<any, 'recursos'>,
	nombre: string,
	crearSiFalta: boolean
): Promise<string | null> {
	const slug = slugTag(nombre);
	if (!slug) return null;
	const { data: existente } = await supabase
		.from('tag')
		.select('id')
		.eq('slug', slug)
		.maybeSingle();
	if (existente) return existente.id as string;
	if (!crearSiFalta) return null;
	await supabase.from('tag').upsert({ nombre, slug }, { onConflict: 'slug', ignoreDuplicates: true });
	const { data: creada } = await supabase.from('tag').select('id').eq('slug', slug).maybeSingle();
	return (creada?.id as string) ?? null;
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [recursosRes, listasRes, mcmRes, tagsRes] = await Promise.all([
		supabase
			.from('recurso')
			.select(
				`id, nombre, descripcion, tipo, etapas, nivel, edades, idioma, soporte, ubicacion,
				 enlace, formato, imagen, enlace_imagenes, anyo_publicacion, curso_usado, visibilidad, estado,
				 datos_personales, creado_con_ia, fuera_del_banco, pendiente_clasificar,
				 notas_internas, editado_web_at, updated_at, mcm_local_id, version_de,
				 mcm_local:mcm_local_id (nombre),
				 recurso_archivo (id, enlace, etiqueta, formato, orden),
				 recurso_tag (tag (nombre))`
			)
			.order('updated_at', { ascending: false }),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('mcm_local').select('id, nombre').eq('activo', true).order('nombre'),
		supabase.from('tag').select('nombre, recurso_tag (recurso_id)').limit(500)
	]);

	// última propuesta de IA por recurso (para badge + prellenado del formulario)
	const { data: clasRows } = await supabase
		.from('clasificacion_ia')
		.select('recurso_id, propuesta, created_at')
		.eq('estado', 'propuesta')
		.not('recurso_id', 'is', null)
		.order('created_at', { ascending: false });
	const sugerencias: Record<string, any> = {};
	for (const c of clasRows ?? []) {
		if (c.recurso_id && !sugerencias[c.recurso_id]) sugerencias[c.recurso_id] = c.propuesta;
	}

	// tem\u00e1ticas ordenadas por uso: son las sugerencias del selector de chips
	const tags = (tagsRes.data ?? [])
		.map((t: any) => ({ nombre: t.nombre as string, usos: (t.recurso_tag ?? []).length }))
		.sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, 'es'))
		.map((t) => t.nombre);

	return {
		recursos: (recursosRes.data ?? []).map((r: any) => ({
			...r,
			mcm_local: r.mcm_local?.nombre ?? null,
			archivos: [...((r.recurso_archivo ?? []) as any[])].sort(
				(a, b) => (a.orden ?? 0) - (b.orden ?? 0)
			),
			tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean)
		})),
		listas: listasRes.data ?? [],
		mcmLocales: mcmRes.data ?? [],
		tags,
		sugerencias
	};
};

export const actions: Actions = {
	guardar: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const campos = await camposDelFormulario(f);
		if (!id || !campos.nombre) return fail(400, { error: 'Faltan datos' });

		const versionDe = String(f.get('version_de') ?? '').trim() || null;

		const { error } = await supabase
			.from('recurso')
			.update({
				...campos,
				// una versión no puede apuntarse a sí misma (SPEC-009); vacío = sin predecesor
				version_de: versionDe === id ? null : versionDe,
				// al editar, se invalida el embedding para que se reindexe en la próxima pasada
				embedding: null,
				embedding_at: null
			})
			.eq('id', id);
		if (error) return fail(500, { error: error.message });

		const fallo = await guardarRelacionados(supabase, id, f);
		if (fallo) return fail(500, { error: fallo });

		return { ok: true, id };
	},

	// Alta manual de un recurso: mismo formulario y mismos campos que la edición (SPEC-008 §3).
	crear: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const campos = await camposDelFormulario(f);
		if (!campos.nombre) return fail(400, { error: 'El nombre es obligatorio' });

		const { data: nuevoId, error: errId } = await supabase.rpc('nuevo_id_recurso');
		if (errId || !nuevoId) return fail(500, { error: errId?.message ?? 'No se pudo generar el id' });

		const id = String(nuevoId);
		const { error } = await supabase.from('recurso').insert({ id, ...campos });
		if (error) return fail(500, { error: error.message });

		const fallo = await guardarRelacionados(supabase, id, f);
		if (fallo) return fail(500, { error: fallo });

		return { ok: true, id };
	},

	/**
	 * Acciones en lote (SPEC-008 §2): lo mismo aplicado a muchos recursos de una vez.
	 *
	 * Es lo que convierte una tarde de catalogación en diez minutos: cuando entran treinta
	 * sesiones del mismo campamento por el Sheet, todas quieren el mismo MCM local, la misma
	 * temática y el mismo estado.
	 *
	 * Cada operación es UNA sentencia con `in('id', ids)`, no un bucle: así o se aplica a todos o
	 * a ninguno, y no hay que preocuparse de a mitad de dónde se quedó. La excepción es la
	 * temática, que necesita buscar o crear la etiqueta antes.
	 */
	lote: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const ids = f.getAll('ids').map(String).filter(Boolean);
		const operacion = String(f.get('operacion') ?? '');
		const valor = String(f.get('valor') ?? '').trim();
		if (!ids.length) return fail(400, { error: 'No hay ningún recurso seleccionado' });

		const listo = (extra: Record<string, unknown> = {}) => ({
			ok: true,
			operacion,
			afectados: ids.length,
			...extra
		});

		if (operacion === 'estado') {
			if (!valor) return fail(400, { error: 'Falta el estado' });
			const { error } = await supabase.from('recurso').update({ estado: valor }).in('id', ids);
			if (error) return fail(500, { error: error.message });
			return listo({ valor });
		}

		// valor vacío = quitar el MCM local (es un campo opcional, y desasignar es legítimo)
		if (operacion === 'mcm_local') {
			const { error } = await supabase
				.from('recurso')
				.update({ mcm_local_id: valor || null })
				.in('id', ids);
			if (error) return fail(500, { error: error.message });
			return listo({ valor });
		}

		if (operacion === 'tag' || operacion === 'quitar_tag') {
			if (!valor) return fail(400, { error: 'Falta la temática' });
			const tagId = await idDeTag(supabase, valor, operacion === 'tag');
			if (!tagId) {
				return fail(operacion === 'tag' ? 500 : 400, {
					error:
						operacion === 'tag'
							? 'No se pudo crear la temática'
							: `«${valor}» no existe como temática`
				});
			}
			const { error } =
				operacion === 'tag'
					? await supabase
							.from('recurso_tag')
							.upsert(
								ids.map((recurso_id) => ({ recurso_id, tag_id: tagId })),
								{ onConflict: 'recurso_id,tag_id', ignoreDuplicates: true }
							)
					: await supabase.from('recurso_tag').delete().eq('tag_id', tagId).in('recurso_id', ids);
			if (error) return fail(500, { error: error.message });
			return listo({ valor });
		}

		if (operacion === 'eliminar') {
			// igual que al borrar de uno en uno: las versiones posteriores se desenlazan primero
			await supabase.from('recurso').update({ version_de: null }).in('version_de', ids);
			const { error } = await supabase.from('recurso').delete().in('id', ids);
			if (error) return fail(500, { error: error.message });
			return listo();
		}

		return fail(400, { error: `Operación desconocida: ${operacion}` });
	},

	// Borrado definitivo. Lo social, las temáticas y los archivos caen en cascada; los envíos
	// que apuntaban al recurso se conservan sin enlace (migración 00015).
	eliminar: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400, { error: 'Falta el id' });

		// una versión posterior dejaría de tener predecesor: se desenlaza antes de borrar
		const { error: errDesenlazar } = await supabase
			.from('recurso')
			.update({ version_de: null })
			.eq('version_de', id);
		if (errDesenlazar) return fail(500, { error: errDesenlazar.message });

		const { error } = await supabase.from('recurso').delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true, id };
	},

	// Rellena el formato de los recursos que aún no lo tienen (SPEC-011). Los enlaces genéricos
	// de Drive necesitan una consulta por archivo, así que va en tandas.
	detectarFormatos: async ({ locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;

		const { data: pendientes } = await supabase
			.from('recurso')
			.select('id, enlace')
			.is('formato', null)
			.not('enlace', 'is', null)
			.limit(60);
		const filas = pendientes ?? [];

		let procesados = 0;
		for (const r of filas as any[]) {
			const formato = await resolverFormato(r.enlace);
			if (!formato) continue;
			// vía RPC para no marcar `editado_web_at` y llenar Sincronización de falsos conflictos
			const { error } = await supabase.rpc('fijar_formato', { rid: r.id, formato_in: formato });
			if (!error) procesados++;
		}

		const { count } = await supabase
			.from('recurso')
			.select('id', { count: 'exact', head: true })
			.is('formato', null)
			.not('enlace', 'is', null);
		return { ok: true, procesados, restantes: count ?? 0 };
	},

	estado: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const estado = String(f.get('estado') ?? '');
		if (!id || !estado) return fail(400);
		const { error } = await supabase.from('recurso').update({ estado }).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// Crea una nueva versión (borrador) del recurso y devuelve su id (SPEC-009)
	crearVersion: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);
		const { data, error } = await supabase.rpc('crear_version', { origen_id: id });
		if (error) return fail(500, { error: error.message });
		return { ok: true, nuevoId: data as string };
	},

	// Autoclasificación con IA (SPEC-010): propone metadatos desde el texto (+ Drive); no publica.
	clasificar: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);

		const vocab = await cargarVocab(supabase);
		const res = await clasificarUno(supabase, id, vocab);
		if (!res.disponible) return { ok: false, disponible: false };
		if (!res.ok) return fail(502, { error: res.error });
		return { ok: true, disponible: true, propuesta: res.propuesta };
	},

	// Clasifica en lote los recursos pendientes que aún no tienen propuesta (SPEC-010).
	clasificarPendientes: async ({ locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;

		const [pendientesRes, yaRes] = await Promise.all([
			supabase
				.from('recurso')
				.select('id, estado, pendiente_clasificar')
				.eq('no_ia', false)
				.or(`estado.in.(${ESTADOS_PENDIENTES.join(',')}),pendiente_clasificar.eq.true`),
			supabase.from('clasificacion_ia').select('recurso_id').eq('estado', 'propuesta').not('recurso_id', 'is', null)
		]);
		const yaHechos = new Set((yaRes.data ?? []).map((c: any) => c.recurso_id));
		const ids = (pendientesRes.data ?? [])
			.map((r: any) => r.id)
			.filter((id: string) => !yaHechos.has(id))
			.slice(0, 12); // acotado por tiempo/coste; se puede repetir para seguir

		if (!ids.length) return { ok: true, disponible: true, procesados: 0, restantes: 0 };

		const vocab = await cargarVocab(supabase);
		let procesados = 0;
		for (const id of ids) {
			const res = await clasificarUno(supabase, id, vocab);
			if (!res.disponible) return { ok: false, disponible: false };
			if (res.ok) procesados++;
		}
		const totalPendientes = (pendientesRes.data ?? []).filter(
			(r: any) => !yaHechos.has(r.id)
		).length;
		return { ok: true, disponible: true, procesados, restantes: Math.max(0, totalPendientes - procesados) };
	},

	// Reindexa embeddings semánticos (Voyage) de recursos publicados sin vector (SPEC-010).
	reindexarSemantica: async ({ locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		if (!embeddingsDisponibles()) return { ok: false, disponible: false };

		const { data: pendientes } = await supabase
			.from('recurso')
			.select('id, nombre, descripcion, tipo, etapas, edades, recurso_tag (tag (nombre))')
			.eq('estado', 'publicado')
			.is('embedding', null)
			.limit(128);
		const filas = pendientes ?? [];
		if (!filas.length) return { ok: true, disponible: true, procesados: 0, restantes: 0 };

		let embeddings: number[][] | null;
		try {
			embeddings = await embeddingsDocumentos(filas.map(textoParaEmbedding));
		} catch (e) {
			return fail(502, { error: `Voyage: ${(e as Error).message}` });
		}
		if (!embeddings) return { ok: false, disponible: false };

		const ahora = new Date().toISOString();
		let procesados = 0;
		for (let i = 0; i < filas.length; i++) {
			const { error } = await supabase
				.from('recurso')
				.update({ embedding: embeddings[i], embedding_at: ahora })
				.eq('id', (filas[i] as any).id);
			if (!error) procesados++;
		}

		const { count } = await supabase
			.from('recurso')
			.select('id', { count: 'exact', head: true })
			.eq('estado', 'publicado')
			.is('embedding', null);
		return { ok: true, disponible: true, procesados, restantes: count ?? 0 };
	}
};
