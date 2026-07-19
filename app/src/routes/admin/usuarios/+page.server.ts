import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['consulta', 'edicion_local', 'editor', 'administrador', 'consulta_externa'];

async function exigirAdmin(locals: App.Locals) {
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user!.id)
		.maybeSingle();
	if (data?.rol !== 'administrador') redirect(303, '/admin');
}

export const load: PageServerLoad = async ({ locals }) => {
	await exigirAdmin(locals);
	const [usuariosRes, mcmRes] = await Promise.all([
		locals.supabase
			.from('perfil')
			.select('id, nombre, apellidos, email, avatar_url, rol, activo, created_at, mcm_local_id, mcm_local:mcm_local_id (nombre)')
			.order('created_at'),
		locals.supabase.from('mcm_local').select('id, nombre').eq('activo', true).order('nombre')
	]);
	return {
		usuarios: (usuariosRes.data ?? []).map((u: any) => ({
			...u,
			mcm_local: u.mcm_local?.nombre ?? null
		})),
		mcmLocales: mcmRes.data ?? [],
		roles: ROLES
	};
};

export const actions: Actions = {
	actualizar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const campo = String(f.get('campo') ?? '');
		const valor = String(f.get('valor') ?? '');
		if (!id || !campo) return fail(400);

		// Un admin no puede degradarse ni desactivarse a sí mismo
		if (id === locals.user!.id && (campo === 'rol' || campo === 'activo')) {
			return fail(400, { error: 'No puedes cambiarte el rol ni desactivarte a ti mismo' });
		}

		let cambio: Record<string, unknown>;
		if (campo === 'rol') {
			if (!ROLES.includes(valor)) return fail(400, { error: 'Rol inválido' });
			cambio = { rol: valor };
		} else if (campo === 'mcm_local_id') {
			cambio = { mcm_local_id: valor || null };
		} else if (campo === 'activo') {
			cambio = { activo: valor === 'true' };
		} else {
			return fail(400);
		}

		const { error } = await locals.supabase.from('perfil').update(cambio).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	}
};
