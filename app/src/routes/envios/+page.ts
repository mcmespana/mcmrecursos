import { browser } from '$app/environment';
import { socialLocal } from '$lib/social/local.svelte';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();

	if (session) {
		const { data } = await supabase
			.from('envio')
			.select('id, titulo, enlace, notas, estado, motivo_devolucion, recurso_id, created_at')
			.eq('perfil_id', session.user.id)
			.order('created_at', { ascending: false });
		return { envios: data ?? [], anonimos: false };
	}

	// Sin cuenta: los envíos van atados al uuid del dispositivo (localStorage), así que solo
	// se pueden pedir desde el navegador. En el servidor todavía no hay nada que enseñar.
	if (!browser) return { envios: [], anonimos: true };

	socialLocal.cargar();
	if (!socialLocal.dispositivo) return { envios: [], anonimos: true };
	const { data } = await supabase.rpc('mis_envios_anon', {
		dispositivo: socialLocal.dispositivo
	});
	return { envios: (data ?? []) as any[], anonimos: true };
};
