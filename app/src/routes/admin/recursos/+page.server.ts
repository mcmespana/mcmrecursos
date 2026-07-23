import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { clasificarRecurso, type VocabulariosIa } from '$lib/server/ia';
import { extraerTextoDrive } from '$lib/server/drive';
import type { SupabaseClient } from '@supabase/supabase-js';

const ESTADOS_PENDIENTES = ['borrador', 'subido_usuario', 'pendiente_revision', 'revisar_ia'];

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
		await supabase.from('clasificacion_ia').insert({ recurso_id: id, estado: 'error', error: res.error });
		return { disponible: true, ok: false, error: res.error };
	}
	await supabase.from('clasificacion_ia').insert({
		recurso_id: id,
		estado: 'propuesta',
		modelo: res.modelo,
		propuesta: res.propuesta,
		avisos: res.propuesta.avisos,
		confianza: res.propuesta.confianza
	});
	return { disponible: true, ok: true, propuesta: res.propuesta };
}

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [recursosRes, listasRes, mcmRes] = await Promise.all([
		supabase
			.from('recurso')
			.select(
				`id, nombre, descripcion, tipo, etapas, nivel, edades, idioma, soporte, ubicacion,
				 enlace, imagen, enlace_imagenes, anyo_publicacion, curso_usado, visibilidad, estado,
				 datos_personales, creado_con_ia, fuera_del_banco, pendiente_clasificar,
				 notas_internas, editado_web_at, updated_at, mcm_local_id, version_de,
				 mcm_local:mcm_local_id (nombre),
				 recurso_tag (tag (nombre))`
			)
			.order('updated_at', { ascending: false }),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('mcm_local').select('id, nombre').eq('activo', true).order('nombre')
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

	return {
		recursos: (recursosRes.data ?? []).map((r: any) => ({
			...r,
			mcm_local: r.mcm_local?.nombre ?? null,
			tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean)
		})),
		listas: listasRes.data ?? [],
		mcmLocales: mcmRes.data ?? [],
		sugerencias
	};
};

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export const actions: Actions = {
	guardar: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const nombre = String(f.get('nombre') ?? '').trim();
		if (!id || !nombre) return fail(400, { error: 'Faltan datos' });

		const texto = (campo: string) => String(f.get(campo) ?? '').trim() || null;
		const bool = (campo: string) => f.get(campo) === 'on';

		const { error } = await supabase
			.from('recurso')
			.update({
				nombre,
				descripcion: texto('descripcion'),
				tipo: texto('tipo'),
				etapas: f.getAll('etapas').map(String),
				edades: f.getAll('edades').map(String),
				nivel: texto('nivel'),
				mcm_local_id: texto('mcm_local_id'),
				idioma: texto('idioma'),
				soporte: texto('soporte'),
				ubicacion: texto('ubicacion'),
				enlace: texto('enlace'),
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
				notas_internas: texto('notas_internas'),
				// una versión no puede apuntarse a sí misma (SPEC-009); vacío = sin predecesor
				version_de: texto('version_de') === id ? null : texto('version_de')
			})
			.eq('id', id);
		if (error) return fail(500, { error: error.message });

		// tags: reemplazo completo por slug
		const tags = String(f.get('tags') ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		await supabase.from('recurso_tag').delete().eq('recurso_id', id);
		for (const nombreTag of tags) {
			const slug = slugify(nombreTag);
			await supabase
				.from('tag')
				.upsert({ nombre: nombreTag, slug }, { onConflict: 'slug', ignoreDuplicates: true });
			const { data: tag } = await supabase.from('tag').select('id').eq('slug', slug).single();
			if (tag) await supabase.from('recurso_tag').insert({ recurso_id: id, tag_id: tag.id });
		}

		return { ok: true };
	},

	estado: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const estado = String(f.get('estado') ?? '');
		if (!id || !estado) return fail(400);
		const { error } = await supabase.from('recurso').update({ estado }).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// Crea una nueva versión (borrador) del recurso y devuelve su id (SPEC-009)
	crearVersion: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);
		const { data, error } = await supabase.rpc('crear_version', { origen_id: id });
		if (error) return fail(500, { error: error.message });
		return { ok: true, nuevoId: data as string };
	},

	// Autoclasificación con IA (SPEC-010): propone metadatos desde el texto (+ Drive); no publica.
	clasificar: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401);
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
	clasificarPendientes: async ({ locals: { supabase, user } }) => {
		if (!user) return fail(401);

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
	}
};
