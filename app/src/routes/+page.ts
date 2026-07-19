import type { PageLoad } from './$types';
import type { ListaValor, RecursoCatalogo, SocialPropio } from '$lib/catalogo/tipos';
import { socialVacio } from '$lib/catalogo/tipos';
import type { FacetaConfig } from '$lib/catalogo/filtros';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();

	const [recursosRes, listasRes, statsRes, facetasRes] = await Promise.all([
		supabase
			.from('recurso')
			.select(
				`id, nombre, descripcion, tipo, etapas, nivel, edades, idioma, soporte, ubicacion,
				 enlace, imagen, anyo_publicacion, curso_usado, visibilidad, estado,
				 fuera_del_banco, pendiente_clasificar,
				 mcm_local:mcm_local_id (nombre),
				 recurso_tag (tag (nombre)),
				 recurso_autor (autor (nombre, apellidos)),
				 relaciones:recurso_relacion!recurso_relacion_recurso_id_fkey (relacionado_id)`
			)
			.order('nombre'),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('recurso_stats').select('*'),
		supabase
			.from('faceta')
			.select('campo, etiqueta, tipo, origen, orden, visible, protegida')
			.order('orden')
	]);

	const stats = new Map((statsRes.data ?? []).map((s: any) => [s.recurso_id, s]));

	const recursos: RecursoCatalogo[] = (recursosRes.data ?? []).map((r: any) => {
		const s = stats.get(r.id);
		return {
			id: r.id,
			nombre: r.nombre,
			descripcion: r.descripcion,
			tipo: r.tipo,
			etapas: r.etapas ?? [],
			nivel: r.nivel,
			edades: r.edades ?? [],
			mcm_local: r.mcm_local?.nombre ?? null,
			idioma: r.idioma,
			soporte: r.soporte,
			ubicacion: r.ubicacion,
			enlace: r.enlace,
			imagen: r.imagen,
			anyo_publicacion: r.anyo_publicacion,
			curso_usado: r.curso_usado,
			visibilidad: r.visibilidad,
			estado: r.estado,
			fuera_del_banco: r.fuera_del_banco,
			pendiente_clasificar: r.pendiente_clasificar,
			tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean),
			autores: (r.recurso_autor ?? [])
				.map((a: any) => [a.autor?.nombre, a.autor?.apellidos].filter(Boolean).join(' '))
				.filter(Boolean),
			relacionados: (r.relaciones ?? []).map((x: any) => x.relacionado_id),
			valoracion_media: s?.valoracion_media != null ? Number(s.valoracion_media) : null,
			num_valoraciones: s?.num_valoraciones ?? 0,
			num_favoritos: s?.num_favoritos ?? 0,
			num_usos: s?.num_usos ?? 0,
			num_accesos: s?.num_accesos ?? 0
		};
	});

	// lo mío (favoritos, usos, valoraciones) — solo con sesión
	const social: SocialPropio = socialVacio();
	if (session) {
		const [favRes, usoRes, valRes] = await Promise.all([
			supabase.from('favorito').select('recurso_id'),
			supabase.from('uso').select('recurso_id'),
			supabase.from('valoracion').select('recurso_id, estrellas')
		]);
		for (const f of favRes.data ?? []) social.favoritos.add(f.recurso_id);
		for (const u of usoRes.data ?? []) social.usos.add(u.recurso_id);
		for (const v of valRes.data ?? []) social.valoraciones.set(v.recurso_id, v.estrellas);
	}

	const listas: ListaValor[] = listasRes.data ?? [];
	const facetas: FacetaConfig[] = facetasRes.data ?? [];

	return { recursos, listas, social, facetas };
};
