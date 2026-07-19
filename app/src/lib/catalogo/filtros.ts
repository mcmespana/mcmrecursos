import type { RecursoCatalogo } from './tipos';

export interface FacetaDef {
	campo: string;
	etiqueta: string;
	/** Extrae los valores del recurso para esta faceta. */
	valores: (r: RecursoCatalogo) => string[];
}

/** Fila de `recursos.faceta`: los filtros del buscador se configuran desde /admin/config. */
export interface FacetaConfig {
	campo: string;
	etiqueta: string;
	tipo: string;
	origen: string;
	orden: number;
	visible: boolean;
	protegida: boolean;
}

const EXTRACTORES: Record<string, (r: RecursoCatalogo) => string[]> = {
	tipo: (r) => (r.tipo ? [r.tipo] : []),
	etapas: (r) => r.etapas,
	edades: (r) => r.edades,
	tags: (r) => r.tags,
	nivel: (r) => (r.nivel ? [r.nivel] : []),
	mcm_local: (r) => (r.mcm_local ? [r.mcm_local] : []),
	idioma: (r) => (r.idioma ? [r.idioma] : []),
	soporte: (r) => (r.soporte ? [r.soporte] : []),
	autores: (r) => r.autores,
	anyo_publicacion: (r) => (r.anyo_publicacion != null ? [String(r.anyo_publicacion)] : [])
};

/** Respaldo si la tabla `faceta` no devuelve nada (p. ej. sin conexión en build). */
export const FACETAS: FacetaDef[] = [
	{ campo: 'tipo', etiqueta: 'Tipo', valores: EXTRACTORES.tipo },
	{ campo: 'etapas', etiqueta: 'Etapa', valores: EXTRACTORES.etapas },
	{ campo: 'edades', etiqueta: 'Edades', valores: EXTRACTORES.edades },
	{ campo: 'tags', etiqueta: 'Temática', valores: EXTRACTORES.tags },
	{ campo: 'nivel', etiqueta: 'Nivel', valores: EXTRACTORES.nivel },
	{ campo: 'mcm_local', etiqueta: 'MCM Local', valores: EXTRACTORES.mcm_local },
	{ campo: 'idioma', etiqueta: 'Idioma', valores: EXTRACTORES.idioma },
	{ campo: 'soporte', etiqueta: 'Soporte', valores: EXTRACTORES.soporte }
];

/**
 * Facetas efectivas del buscador a partir de la configuración en BD.
 * Solo select/multiselect (los rangos llegarán con su propia UI); `protegida`
 * se oculta sin sesión. Campos sin extractor dedicado leen la propiedad homónima
 * del recurso (promoción de columnas sin tocar código).
 */
export function construirFacetas(config: FacetaConfig[], conSesion: boolean): FacetaDef[] {
	const visibles = config
		.filter((f) => f.visible && (conSesion || !f.protegida))
		.filter((f) => f.tipo === 'multiselect' || f.tipo === 'select')
		.sort((a, b) => a.orden - b.orden || a.etiqueta.localeCompare(b.etiqueta, 'es'));
	if (!visibles.length) return FACETAS;
	return visibles.map((f) => ({
		campo: f.campo,
		etiqueta: f.etiqueta,
		valores:
			EXTRACTORES[f.campo] ??
			((r) => {
				const v = (r as unknown as Record<string, unknown>)[f.campo];
				if (v == null || v === '') return [];
				return Array.isArray(v) ? v.map(String) : [String(v)];
			})
	}));
}

export type Seleccion = Record<string, string[]>;

/** OR dentro de una faceta, AND entre facetas. */
export function filtrar(
	recursos: RecursoCatalogo[],
	facetas: FacetaDef[],
	seleccion: Seleccion,
	idsTexto: Set<string> | null,
	excepto?: string
): RecursoCatalogo[] {
	return recursos.filter((r) => {
		if (idsTexto && !idsTexto.has(r.id)) return false;
		for (const f of facetas) {
			if (f.campo === excepto) continue;
			const sel = seleccion[f.campo];
			if (!sel?.length) continue;
			const vals = f.valores(r);
			if (!sel.some((s) => vals.includes(s))) return false;
		}
		return true;
	});
}

export function contar(recursos: RecursoCatalogo[], faceta: FacetaDef): Map<string, number> {
	const counts = new Map<string, number>();
	for (const r of recursos) {
		for (const v of faceta.valores(r)) {
			counts.set(v, (counts.get(v) ?? 0) + 1);
		}
	}
	return counts;
}

const sinAcentos = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');

/** Texto agregado por recurso para el índice de búsqueda. */
export function textoIndexable(r: RecursoCatalogo): string {
	return sinAcentos(
		[r.nombre, r.descripcion ?? '', r.tags.join(' '), r.autores.join(' '), r.tipo ?? ''].join(' ')
	);
}

export function normalizarConsulta(q: string): string {
	return sinAcentos(q.trim());
}
