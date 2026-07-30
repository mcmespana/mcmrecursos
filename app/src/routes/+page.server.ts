import type { PageServerLoad } from './$types';
import { cargarDatosCatalogo } from '$lib/catalogo/cargar';

/**
 * El catálogo se carga en el SERVIDOR, no en el navegador.
 *
 * Antes esto era un `load` universal (`+page.ts`), y eso costaba el catálogo entero DOS VECES en
 * cada visita en frío: una serializado dentro del HTML del SSR y otra en JSON al hidratar. El
 * culpable no era el `load` de la página, sino el del layout: crea el cliente de Supabase, que es
 * distinto en servidor y en navegador, así que se ejecuta en los dos lados — y cuando un `load`
 * padre se reejecuta, los hijos también. Con `+page.server.ts` los datos viajan una sola vez.
 *
 * `depends('supabase:auth')` mantiene lo de antes: al cambiar la sesión, la capa social propia
 * (favoritos, usos, valoraciones) se vuelve a pedir.
 */
export const load: PageServerLoad = async ({ locals: { supabase, session }, depends }) => {
	depends('supabase:auth');
	return cargarDatosCatalogo(supabase, session);
};
