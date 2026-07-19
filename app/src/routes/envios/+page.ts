import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();
	if (!session) return { envios: [] };

	const { data } = await supabase
		.from('envio')
		.select('id, titulo, enlace, notas, estado, motivo_devolucion, recurso_id, created_at')
		.eq('perfil_id', session.user.id)
		.order('created_at', { ascending: false });

	return { envios: data ?? [] };
};
