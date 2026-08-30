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

	// Pastilla de la navegación: cuántas tareas abiertas hay (RLS ya acota a lo que le toca ver).
	const { count: tareasAbiertas } = await supabase
		.from('tarea')
		.select('id', { count: 'exact', head: true })
		.eq('estado', 'abierta');

	// Pastilla de «Comunidad»: sugerencias sin abrir todavía (SPEC-017 §4).
	const { count: sugerenciasNuevas } = await supabase
		.from('sugerencia')
		.select('id', { count: 'exact', head: true })
		.eq('estado', 'nueva');

	return {
		rolPanel: perfil.rol as string,
		tareasAbiertas: tareasAbiertas ?? 0,
		sugerenciasNuevas: sugerenciasNuevas ?? 0
	};
};
