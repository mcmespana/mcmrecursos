import type { PageServerLoad } from './$types';
import { iaDisponible } from '$lib/server/ia';
import { funcionActiva } from '$lib/server/ajustes';
import { cargarDatosCatalogo } from '$lib/catalogo/cargar';

/**
 * Descubre reparte el mismo catálogo que la portada, y por el mismo motivo se carga aquí y no en
 * el navegador: en un `load` universal viajaba dos veces por visita en frío (el porqué, en
 * `src/routes/+page.server.ts`).
 *
 * `iaDescubre`: ¿se enseña el buscador «Recomiéndame…»? Hace falta clave de Gemini Y que la
 * función esté encendida (tabla `ajuste`, o `DESCUBRE_IA` en el entorno). Si no, la página ni
 * menciona la IA: Descubre es el de siempre.
 */
export const load: PageServerLoad = async ({ locals: { supabase, session }, depends }) => {
	depends('supabase:auth');
	const [datos, activa] = await Promise.all([
		cargarDatosCatalogo(supabase, session),
		funcionActiva(supabase, 'descubre_ia', { variableEntorno: 'DESCUBRE_IA' })
	]);
	return { ...datos, iaDescubre: iaDisponible() && activa };
};
