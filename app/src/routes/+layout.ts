import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

export interface PerfilPropio {
	id: string;
	nombre: string;
	apellidos: string;
	mcm_local_id: string | null;
	rol: string;
}

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
	depends('supabase:auth');

	const supabase = isBrowser()
		? createBrowserClient<any, 'recursos'>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
				db: { schema: 'recursos' },
				global: { fetch }
			})
		: createServerClient<any, 'recursos'>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
				db: { schema: 'recursos' },
				global: { fetch },
				cookies: {
					getAll: () => data.cookies,
					setAll: () => {}
				}
			});

	const {
		data: { session }
	} = await supabase.auth.getSession();

	let perfil: PerfilPropio | null = null;
	let mcmLocales: { id: string; nombre: string }[] = [];
	if (session) {
		const { data: p } = await supabase
			.from('perfil')
			.select('id, nombre, apellidos, mcm_local_id, rol')
			.eq('id', session.user.id)
			.maybeSingle();
		perfil = p;
		if (perfil && !perfil.mcm_local_id) {
			const { data: locales } = await supabase
				.from('mcm_local')
				.select('id, nombre')
				.eq('activo', true)
				.order('nombre');
			mcmLocales = locales ?? [];
		}
	}

	return { session, supabase, perfil, mcmLocales, busquedaSemantica: data.busquedaSemantica };
};
