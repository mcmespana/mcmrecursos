import type { PageLoad } from './$types';
import { cargarDatosCatalogo } from '$lib/catalogo/cargar';

export const load: PageLoad = async ({ parent }) => {
	const { supabase, session } = await parent();
	return cargarDatosCatalogo(supabase, session);
};
