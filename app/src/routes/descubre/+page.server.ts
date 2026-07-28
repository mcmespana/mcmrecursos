import type { PageServerLoad } from './$types';
import { iaDisponible } from '$lib/server/ia';
import { funcionActiva } from '$lib/server/ajustes';

/**
 * ¿Se enseña el buscador «Recomiéndame…»? Hace falta clave de Gemini Y que la función
 * esté encendida (tabla `ajuste`, o `DESCUBRE_IA` en el entorno). Si no, la página ni
 * menciona la IA: Descubre es el de siempre.
 */
export const load: PageServerLoad = async ({ locals: { supabase } }) => ({
	iaDescubre:
		iaDisponible() &&
		(await funcionActiva(supabase, 'descubre_ia', { variableEntorno: 'DESCUBRE_IA' }))
});
