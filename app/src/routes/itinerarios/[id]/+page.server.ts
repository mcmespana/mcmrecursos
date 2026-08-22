import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// La RLS de 00026 devuelve 0 filas si es borrador y quien mira no es editor → 404 limpio.
	// El vocabulario de edades va aparte: sirve para decir «todas» en vez de listar catorce cursos.
	const [{ data }, edadesRes] = await Promise.all([
		supabase
			.from('itinerario')
			.select(
				`id, nombre, descripcion, etapas, edades, imagen, estado,
				 itinerario_bloque (id, nombre, descripcion, orden,
				   recurso_bloque (orden,
				     recurso:recurso_id (id, nombre, descripcion, tipo, etapas, nivel, edades, idioma,
				       soporte, ubicacion, enlace, formato, imagen, anyo_publicacion, curso_usado,
				       visibilidad, estado, fuera_del_banco, pendiente_clasificar, version_de,
				       mcm_local:mcm_local_id (nombre),
				       recurso_archivo (id, enlace, etiqueta, formato, orden),
				       recurso_tag (tag (nombre)))))`
			)
			.eq('id', params.id)
			.maybeSingle(),
		supabase
			.from('lista_valor')
			.select('lista, valor, grupo, orden')
			.eq('lista', 'edades')
			.eq('activo', true)
			.order('orden')
	]);

	if (!data) error(404, 'Ese itinerario no existe o todavía no está publicado');

	const it = data as any;
	const bloques = [...(it.itinerario_bloque ?? [])]
		.sort((a: any, b: any) => a.orden - b.orden)
		.map((b: any) => ({
			id: b.id,
			nombre: b.nombre,
			descripcion: b.descripcion,
			recursos: [...(b.recurso_bloque ?? [])]
				.sort((x: any, y: any) => x.orden - y.orden)
				.map((rb: any) => rb.recurso)
				.filter(Boolean)
				.map((r: any) => ({
					...r,
					mcm_local: r.mcm_local?.nombre ?? null,
					archivos: [...((r.recurso_archivo ?? []) as any[])].sort(
						(a, b2) => (a.orden ?? 0) - (b2.orden ?? 0)
					),
					tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean),
					autores: [],
					// la ficha los pide, pero en un itinerario no se enseñan relacionados
					relacionados: [],
					valoracion_media: null,
					num_valoraciones: 0,
					num_favoritos: 0,
					num_usos: 0,
					num_accesos: 0,
					reemplazado_por: null,
					es_vigente: true,
					versiones_anteriores: []
				}))
		}));

	return {
		listas: edadesRes.data ?? [],
		itinerario: {
			id: it.id,
			nombre: it.nombre,
			descripcion: it.descripcion,
			etapas: it.etapas ?? [],
			edades: it.edades ?? [],
			imagen: it.imagen,
			borrador: it.estado !== 'publicado',
			bloques
		}
	};
};
