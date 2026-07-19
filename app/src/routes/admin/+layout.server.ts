import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const ROLES_PANEL = ['edicion_local', 'editor', 'administrador'];

export const load: LayoutServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) redirect(303, '/');
	const { data: perfil } = await supabase
		.from('perfil')
		.select('id, nombre, rol, mcm_local_id')
		.eq('id', user.id)
		.maybeSingle();
	if (!perfil || !ROLES_PANEL.includes(perfil.rol)) redirect(303, '/');
	return { rolPanel: perfil.rol as string };
};
