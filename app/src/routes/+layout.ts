import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import type { LayoutLoad } from './$types';

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

	return { session, supabase };
};
