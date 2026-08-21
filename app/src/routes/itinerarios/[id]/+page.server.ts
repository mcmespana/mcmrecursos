import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// La RLS de 00026 devuelve 0 filas si es borrador y quien mira no es editor → 404 limpio.
	const { data } = await supabase
		.from('itinerario')
		.select(
			`id, nombre, descripcion, etapas, estado,
			 itinerario_bloque (id, nombre, descripcion, orden,
			   recurso_bloque (orden,
			     recurso:recurso_id (id, nombre, descripcion, tipo, enlace, formato, etapas, edades, imagen)))`
		)
		.eq('id', params.id)
		.maybeSingle();

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
		}));

	return {
		itinerario: {
			id: it.id,
			nombre: it.nombre,
			descripcion: it.descripcion,
			etapas: it.etapas ?? [],
			borrador: it.estado !== 'publicado',
			bloques
		}
	};
};
