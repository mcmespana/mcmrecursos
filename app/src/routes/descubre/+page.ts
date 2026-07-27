import type { PageLoad } from './$types';
import { cargarDatosCatalogo } from '$lib/catalogo/cargar';

export const load: PageLoad = async ({ parent, data }) => {
	const { supabase, session } = await parent();
	return { ...data, ...(await cargarDatosCatalogo(supabase, session)) };
};
