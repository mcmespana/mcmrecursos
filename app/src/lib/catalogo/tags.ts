/**
 * Normalización de temáticas (tags).
 *
 * El slug es lo que decide si dos temáticas son la misma: «Adviento», «adviento» y «ADVIENTO»
 * comparten slug y no deben convertirse en tres etiquetas distintas. La BD ya lo garantiza
 * (`tag.slug` es único), pero el formulario tiene que enseñarlo ANTES de guardar: si escribes
 * algo que ya existe, se reutiliza la etiqueta existente con su grafía buena.
 */
export const slugTag = (nombre: string): string =>
	nombre
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

/** Texto sin acentos ni mayúsculas, para buscar sugerencias mientras se escribe. */
export const plano = (texto: string): string =>
	texto
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim();

/**
 * Limpia una lista de temáticas escritas a mano: quita vacíos, funde duplicados por slug y,
 * cuando el slug coincide con una temática ya existente en el banco, se queda con la grafía
 * canónica de esa (para no crear «adviento» al lado de «Adviento»).
 */
export function normalizarTags(entradas: string[], existentes: string[] = []): string[] {
	const canonico = new Map(existentes.map((t) => [slugTag(t), t]));
	const salida: string[] = [];
	const vistos = new Set<string>();
	for (const bruto of entradas) {
		const nombre = bruto.trim().replace(/\s+/g, ' ');
		if (!nombre) continue;
		const slug = slugTag(nombre);
		if (!slug || vistos.has(slug)) continue;
		vistos.add(slug);
		salida.push(canonico.get(slug) ?? nombre);
	}
	return salida;
}

/** Divide lo que se ha tecleado o pegado: acepta comas, punto y coma y saltos de línea. */
export const partirTags = (texto: string): string[] =>
	texto
		.split(/[,;\n]+/)
		.map((t) => t.trim())
		.filter(Boolean);
