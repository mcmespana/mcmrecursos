import type { PageServerLoad } from './$types';

/**
 * Listado público de itinerarios (SPEC-015).
 *
 * Sin buscador ni paginación: son 10-12 como techo (decisión 4), así que una rejilla de
 * tarjetas y punto. La RLS (migración 00026) ya deja fuera los borradores para quien no es
 * editor, así que aquí no hay que filtrar por estado a mano.
 */
export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const { data } = await supabase
		.from('itinerario')
		.select(
			'id, nombre, descripcion, etapas, edades, imagen, estado, itinerario_bloque (id, recurso_bloque (recurso_id))'
		)
		.order('nombre');

	return {
		itinerarios: (data ?? []).map((i: any) => ({
			id: i.id,
			nombre: i.nombre,
			descripcion: i.descripcion,
			etapas: i.etapas ?? [],
			edades: i.edades ?? [],
			imagen: i.imagen,
			// un editor ve también sus borradores: conviene que la tarjeta lo diga
			borrador: i.estado !== 'publicado',
			recursos: (i.itinerario_bloque ?? []).reduce(
				(n: number, b: any) => n + (b.recurso_bloque ?? []).length,
				0
			)
		}))
	};
};
