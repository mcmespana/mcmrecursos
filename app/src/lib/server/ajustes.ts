import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

/**
 * Ajustes de la app (tabla `recursos.ajuste`): interruptores que se pueden mover desde
 * /admin/config sin tocar código ni redesplegar.
 *
 * Orden de mando, de más fuerte a más débil:
 *   1. Variable de entorno (p. ej. `DESCUBRE_IA=off`) — el freno de mano. Gana siempre,
 *      por si el problema es la propia BD o hay que apagar algo a las 3 de la mañana
 *      desde Vercel sin entrar al panel.
 *   2. La fila de `recursos.ajuste` — el interruptor del día a día, en /admin/config.
 *   3. El valor por defecto que pase quien pregunta.
 *
 * La lectura se cachea unos segundos: esto se consulta en cada petición y el valor cambia
 * una vez cada mucho, así que no tiene sentido ir a la BD cada vez. El precio es que
 * apagar algo tarda hasta `TTL_MS` en notarse en todas las instancias — segundos, no minutos.
 */

const TTL_MS = 20_000;

const cache = new Map<string, { valor: string | null; expira: number }>();

/** Traduce lo que sea que haya en el ajuste o en el entorno a un booleano. */
function comoBooleano(valor: string | null | undefined): boolean | null {
	if (valor == null) return null;
	const v = valor.trim().toLowerCase();
	if (['on', 'true', '1', 'si', 'sí'].includes(v)) return true;
	if (['off', 'false', '0', 'no'].includes(v)) return false;
	return null;
}

export function limpiarCacheAjustes(clave?: string) {
	if (clave) cache.delete(clave);
	else cache.clear();
}

async function leerAjuste(supabase: SupabaseClient<any, any>, clave: string): Promise<string | null> {
	const guardado = cache.get(clave);
	if (guardado && guardado.expira > Date.now()) return guardado.valor;

	const { data, error } = await supabase
		.from('ajuste')
		.select('valor')
		.eq('clave', clave)
		.maybeSingle();

	// Si la consulta falla (tabla aún sin migrar, BD caída…) no se cachea el fallo:
	// se devuelve `null` y manda el valor por defecto de quien pregunta.
	if (error) return null;

	const valor = data?.valor ?? null;
	cache.set(clave, { valor, expira: Date.now() + TTL_MS });
	return valor;
}

/**
 * ¿Está encendida esta función? Env > tabla `ajuste` > `porDefecto`.
 * `variableEntorno` es opcional: sin ella, solo mandan la tabla y el defecto.
 */
export async function funcionActiva(
	supabase: SupabaseClient<any, any>,
	clave: string,
	opciones: { variableEntorno?: string; porDefecto?: boolean } = {}
): Promise<boolean> {
	const { variableEntorno, porDefecto = true } = opciones;

	if (variableEntorno) {
		const forzado = comoBooleano(env[variableEntorno]);
		if (forzado !== null) return forzado;
	}
	return comoBooleano(await leerAjuste(supabase, clave)) ?? porDefecto;
}

/** ¿Hay un `DESCUBRE_IA` (o similar) en el entorno mandando por encima del panel? */
export function forzadoPorEntorno(variableEntorno: string): boolean {
	return comoBooleano(env[variableEntorno]) !== null;
}
