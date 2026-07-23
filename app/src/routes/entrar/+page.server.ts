import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

// Login de administración con email + contraseña (Supabase), alternativa a Google OAuth.
// Sin credenciales en el código: el usuario se crea en Supabase (ver docs/05-configuracion-servicios.md §4).

export const load: PageServerLoad = async ({ locals: { session }, url }) => {
	if (session) redirect(303, url.searchParams.get('next') || '/admin');
	return {};
};

export const actions: Actions = {
	default: async ({ request, locals: { supabase }, url }) => {
		const f = await request.formData();
		const email = String(f.get('email') ?? '')
			.trim()
			.toLowerCase();
		const password = String(f.get('password') ?? '');
		if (!email || !password) return fail(400, { error: 'Escribe email y contraseña', email });

		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) return fail(401, { error: 'Email o contraseña incorrectos', email });

		const next = url.searchParams.get('next') || '/admin';
		redirect(303, next.startsWith('/') ? next : '/admin');
	}
};
