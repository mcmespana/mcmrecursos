import type { RecursoCatalogo } from './tipos';

export interface FacetaDef {
	campo: string;
	etiqueta: string;
	/** Extrae los valores del recurso para esta faceta. */
	valores: (r: RecursoCatalogo) => string[];
}

export const FACETAS: FacetaDef[] = [
	{ campo: 'tipo', etiqueta: 'Tipo', valores: (r) => (r.tipo ? [r.tipo] : []) },
	{ campo: 'etapas', etiqueta: 'Etapa', valores: (r) => r.etapas },
	{ campo: 'edades', etiqueta: 'Edades', valores: (r) => r.edades },
	{ campo: 'tags', etiqueta: 'Temática', valores: (r) => r.tags },
	{ campo: 'nivel', etiqueta: 'Nivel', valores: (r) => (r.nivel ? [r.nivel] : []) },
	{ campo: 'mcm_local', etiqueta: 'MCM Local', valores: (r) => (r.mcm_local ? [r.mcm_local] : []) },
	{ campo: 'idioma', etiqueta: 'Idioma', valores: (r) => (r.idioma ? [r.idioma] : []) },
	{ campo: 'soporte', etiqueta: 'Soporte', valores: (r) => (r.soporte ? [r.soporte] : []) }
];

export type Seleccion = Record<string, string[]>;

/** OR dentro de una faceta, AND entre facetas. */
export function filtrar(
	recursos: RecursoCatalogo[],
	seleccion: Seleccion,
	idsTexto: Set<string> | null,
	excepto?: string
): RecursoCatalogo[] {
	return recursos.filter((r) => {
		if (idsTexto && !idsTexto.has(r.id)) return false;
		for (const f of FACETAS) {
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
