import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Destino del redirect de Google OAuth (flujo PKCE de Supabase).
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const code = url.searchParams.get('code');
	const next = url.searchParams.get('next') ?? '/';

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			redirect(303, next.startsWith('/') ? next : '/');
		}
	}

	redirect(303, '/?error=auth');
};
