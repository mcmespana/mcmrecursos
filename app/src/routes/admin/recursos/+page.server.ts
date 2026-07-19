import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [recursosRes, listasRes, mcmRes] = await Promise.all([
		supabase
			.from('recurso')
			.select(
				`id, nombre, descripcion, tipo, etapas, nivel, edades, idioma, soporte, ubicacion,
				 enlace, imagen, enlace_imagenes, anyo_publicacion, curso_usado, visibilidad, estado,
				 datos_personales, creado_con_ia, fuera_del_banco, pendiente_clasificar,
				 notas_internas, editado_web_at, updated_at, mcm_local_id,
				 mcm_local:mcm_local_id (nombre),
				 recurso_tag (tag (nombre))`
			)
			.order('updated_at', { ascending: false }),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('mcm_local').select('id, nombre').eq('activo', true).order('nombre')
	]);

	return {
		recursos: (recursosRes.data ?? []).map((r: any) => ({
			...r,
			mcm_local: r.mcm_local?.nombre ?? null,
			tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean)
		})),
		listas: listasRes.data ?? [],
		mcmLocales: mcmRes.data ?? []
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
				notas_internas: texto('notas_internas')
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
	}
};
