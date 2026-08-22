import type { SupabaseClient } from '@supabase/supabase-js';
import type { FacetaDef, Seleccion } from './filtros';

/**
 * Presets: una combinación de filtros con nombre (SPEC-006 §Filtros, SPEC-007 §Fases 1).
 *
 * Lo que se guarda es la **misma query string** que `/` y `/descubre` ya escriben en la barra
 * del navegador (`etapas=MIC|COM&tags=Adviento`), así que un preset es un enlace que las dos
 * pantallas entienden: en el buscador filtra la rejilla, en Descubre arma el mazo. El porqué de
 * ese formato —y de que el texto libre no viaje dentro— está en la migración 00029.
 */
export interface Preset {
	id: string;
	nombre: string;
	filtros: string;
	orden: number;
	activo: boolean;
}

/** Selección vacía con una entrada por faceta: el estado inicial de las dos pantallas. */
export function seleccionVacia(facetas: FacetaDef[]): Seleccion {
	return Object.fromEntries(facetas.map((f) => [f.campo, []]));
}

/**
 * Query string → selección. Solo se aceptan campos que existan como faceta: si se retira una
 * faceta desde /admin/config, los presets que la usaran siguen aplicando el resto en vez de
 * quedarse con un filtro fantasma que nadie puede quitar desde la pantalla.
 */
export function seleccionDePreset(filtros: string, facetas: FacetaDef[]): Seleccion {
	const params = new URLSearchParams(filtros);
	return Object.fromEntries(
		facetas.map((f) => [f.campo, params.get(f.campo)?.split('|').filter(Boolean) ?? []])
	);
}

/** Selección → query string, en el orden de las facetas para que dos iguales se escriban igual. */
export function presetDeSeleccion(seleccion: Seleccion, facetas: FacetaDef[]): string {
	const params = new URLSearchParams();
	for (const f of facetas) {
		const v = seleccion[f.campo] ?? [];
		if (v.length) params.set(f.campo, v.join('|'));
	}
	return params.toString();
}

/**
 * ¿La selección actual **es** este preset? Decide qué chip se pinta encendido.
 *
 * Compara conjuntos, no cadenas: llegar a «MIC y COM» tocando primero COM da otra query string
 * que la guardada, y el chip tiene que reconocerse igual.
 */
export function esPresetActivo(
	preset: Preset,
	seleccion: Seleccion,
	facetas: FacetaDef[]
): boolean {
	const suya = seleccionDePreset(preset.filtros, facetas);
	return facetas.every((f) => {
		const a = new Set(suya[f.campo] ?? []);
		const b = new Set(seleccion[f.campo] ?? []);
		return a.size === b.size && [...a].every((v) => b.has(v));
	});
}

/**
 * Los filtros del preset en una línea legible: «Etapa: MIC o COM · Temática: Adviento».
 *
 * Acepta cualquier cosa con `campo` y `etiqueta` (las facetas del buscador o las filas de la
 * tabla `faceta`), y **no descarta** los campos que ya no son faceta: en la pantalla de gestión
 * lo que interesa es ver lo que el preset lleva dentro, incluido lo que se ha quedado viejo.
 */
export function describirFiltros(
	filtros: string,
	facetas: { campo: string; etiqueta: string }[]
): string {
	const etiquetas = new Map(facetas.map((f) => [f.campo, f.etiqueta]));
	const partes: string[] = [];
	for (const [campo, valor] of new URLSearchParams(filtros)) {
		const valores = valor.split('|').filter(Boolean);
		if (!valores.length) continue;
		const et = etiquetas.get(campo);
		partes.push(et ? `${et}: ${valores.join(' o ')}` : `${campo}: ${valores.join(' o ')}`);
	}
	return partes.join(' · ');
}

/** Nombre sugerido al guardar: los propios valores elegidos, que casi siempre es el buen nombre. */
export function nombreSugerido(seleccion: Seleccion, facetas: FacetaDef[]): string {
	const valores = facetas.flatMap((f) => seleccion[f.campo] ?? []);
	return valores.slice(0, 3).join(' · ');
}

/**
 * Guarda un preset nuevo. Lo llaman las dos pantallas que los pintan, así que la inserción vive
 * aquí y no duplicada en cada una.
 *
 * Va por el cliente del navegador y no por una acción de formulario porque la RLS ya es la
 * autorización: la política de escritura de `preset` es `es_admin()` (migración 00029), igual
 * que la capa social se escribe directamente desde el catálogo.
 */
export async function crearPreset(
	supabase: SupabaseClient<any, 'recursos'>,
	datos: { nombre: string; filtros: string; orden: number; creadoPor: string | null }
): Promise<{ preset: Preset | null; error: string | null }> {
	const { data, error } = await supabase
		.from('preset')
		.insert({
			nombre: datos.nombre,
			filtros: datos.filtros,
			orden: datos.orden,
			creado_por: datos.creadoPor
		})
		.select('id, nombre, filtros, orden, activo')
		.single();
	return { preset: (data as Preset) ?? null, error: error?.message ?? null };
}
