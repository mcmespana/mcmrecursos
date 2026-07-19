import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();
	if (!session) return { listas: [] };

	const { data } = await supabase
		.from('lista')
		.select('id, nombre, descripcion, publica, updated_at, lista_recurso(recurso_id)')
		.eq('perfil_id', session.user.id)
		.order('updated_at', { ascending: false });

	return {
		listas: (data ?? []).map((l: any) => ({
			id: l.id,
			nombre: l.nombre,
			descripcion: l.descripcion,
			publica: l.publica,
			num_recursos: (l.lista_recurso ?? []).length
		}))
	};
};
