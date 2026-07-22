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

/**
 * Recursos relacionados por afinidad (SPEC-009 anexo A): solapamiento de tags (peso alto),
 * mismo tipo (medio) y etapas comunes (bajo). Excluye el propio recurso y su mismo linaje de
 * versiones. Se usa como respaldo cuando no hay relaciones manuales; nunca es aleatorio.
 */
export function relacionar(
	recurso: RecursoCatalogo,
	candidatos: RecursoCatalogo[],
	limite = 6
): RecursoCatalogo[] {
	const tags = new Set(recurso.tags);
	const etapas = new Set(recurso.etapas);
	const mismoLinaje = new Set([recurso.id, ...recurso.versiones_anteriores]);
	if (recurso.reemplazado_por) mismoLinaje.add(recurso.reemplazado_por);

	return candidatos
		.filter((c) => !mismoLinaje.has(c.id) && c.id !== recurso.id)
		.map((c) => {
			let score = 0;
			for (const t of c.tags) if (tags.has(t)) score += 3;
			if (recurso.tipo && c.tipo === recurso.tipo) score += 2;
			for (const e of c.etapas) if (etapas.has(e)) score += 1;
			return { c, score };
		})
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score || (b.c.valoracion_media ?? 0) - (a.c.valoracion_media ?? 0))
		.slice(0, limite)
		.map((x) => x.c);
}
