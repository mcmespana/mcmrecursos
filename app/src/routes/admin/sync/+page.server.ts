import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [infoRes, logRes, conflictosRes] = await Promise.all([
		supabase.from('sync_info').select('ultima_sync').maybeSingle(),
		supabase
			.from('sync_log')
			.select('id, created_at, procesadas, creadas, actualizadas, retiradas, errores')
			.order('created_at', { ascending: false })
			.limit(20),
		supabase
			.from('recurso')
			.select('id, nombre, estado, editado_web_at, updated_at')
			.not('editado_web_at', 'is', null)
			.order('editado_web_at', { ascending: false })
	]);

	return {
		ultimaSync: infoRes.data?.ultima_sync ?? null,
		log: logRes.data ?? [],
		conflictos: conflictosRes.data ?? []
	};
};

export const actions: Actions = {
	aplicar_sheet: async ({ request, locals: { supabase } }) => {
		const f = await request.formData();
		const rid = String(f.get('id') ?? '');
		if (!rid) return fail(400);
		const { error } = await supabase.rpc('resolver_conflicto_web', { rid });
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	}
};
