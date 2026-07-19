import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, params }) => {
	const { supabase, session } = await parent();

	const { data: lista } = await supabase
		.from('lista')
		.select('id, nombre, descripcion, publica, perfil_id')
		.eq('id', params.id)
		.maybeSingle();

	// RLS ya filtra: si no es tuya ni pública, no llega
	if (!lista) error(404, 'Lista no encontrada');

	const { data: filas } = await supabase
		.from('lista_recurso')
		.select(
			'created_at, recurso (id, nombre, tipo, etapas, edades, imagen, enlace, estado, visibilidad)'
		)
		.eq('lista_id', params.id)
		.order('created_at', { ascending: false });

	return {
		lista: { ...lista, esMia: session?.user.id === lista.perfil_id },
		recursos: (filas ?? []).map((f: any) => f.recurso).filter(Boolean)
	};
};
