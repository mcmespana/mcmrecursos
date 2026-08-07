import { error, redirect } from '@sveltejs/kit';

/** Roles que pueden entrar al panel. Mismo listado que `admin/+layout.server.ts`. */
export const ROLES_PANEL = ['edicion_local', 'editor', 'administrador'];

/**
 * Comprueba el rol de quien pide. Hace falta llamarla **desde cada acción**, no solo
 * desde el `load`: en SvelteKit las acciones de formulario corren antes que los `load`,
 * así que el guardián de `admin/+layout.server.ts` no las cubre. Sin esto, cualquier
 * cuenta (el rol por defecto es `consulta`) podía disparar las acciones que llaman a
 * Gemini, Voyage o Drive y gastar cuota, aunque la RLS le cortara luego la escritura.
 *
 * Lanza 403 en vez de redirigir: quien llama es un POST de acción, y un 303 desde una
 * acción se interpretaría como navegación con éxito.
 */
export async function exigirRol(locals: App.Locals, permitidos: string[] = ROLES_PANEL) {
	if (!locals.user) error(401, 'Hace falta iniciar sesión');
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user.id)
		.maybeSingle();
	const rol = (data as { rol?: string } | null)?.rol;
	if (!rol || !permitidos.includes(rol)) error(403, 'Sin permiso para esta operación');
	return rol;
}

/** Atajo para lo que solo puede hacer un administrador. */
export async function exigirAdmin(locals: App.Locals) {
	return exigirRol(locals, ['administrador']);
}

/** Como `exigirAdmin`, pero redirige en vez de dar 403. Para los `load` de página. */
export async function exigirAdminEnPagina(locals: App.Locals) {
	if (!locals.user) redirect(303, '/');
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user.id)
		.maybeSingle();
	if ((data as { rol?: string } | null)?.rol !== 'administrador') redirect(303, '/admin');
}
