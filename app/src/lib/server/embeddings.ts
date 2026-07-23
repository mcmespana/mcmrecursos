import { env } from '$env/dynamic/private';

/**
 * Embeddings semánticos con Voyage AI (SPEC-010).
 *
 * REST directo (`/v1/embeddings`), sin SDK. Sin VOYAGE_API_KEY, las funciones
 * devuelven `null` y la búsqueda semántica queda inactiva sin afectar al resto
 * (mismo patrón de degradación que Gemini/Resend).
 *
 * Modelo por defecto: voyage-4-lite (familia Voyage 4, ene 2026) — buena calidad
 * a coste bajo y espacio de embeddings compartido con el resto de la familia, así
 * que se puede reindexar con otro modelo Voyage 4 sin rehacer las consultas.
 */

const MODELO_DEFECTO = 'voyage-4-lite';
export const DIMENSIONES = 1024;

export function embeddingsDisponibles(): boolean {
	return !!env.VOYAGE_API_KEY;
}

async function llamar(input: string[], inputType: 'query' | 'document'): Promise<number[][]> {
	const modelo = env.VOYAGE_MODELO || MODELO_DEFECTO;
	const res = await fetch('https://api.voyageai.com/v1/embeddings', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.VOYAGE_API_KEY}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			model: modelo,
			input,
			input_type: inputType,
			output_dimension: DIMENSIONES,
			truncation: true
		})
	});
	if (!res.ok) {
		throw new Error(`Voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
	}
	const data = await res.json();
	return ((data?.data ?? []) as { index: number; embedding: number[] }[])
		.slice()
		.sort((a, b) => a.index - b.index)
		.map((d) => d.embedding);
}

/** Embedding de una consulta de búsqueda. `null` si Voyage no está configurado. */
export async function embeddingConsulta(texto: string): Promise<number[] | null> {
	if (!env.VOYAGE_API_KEY) return null;
	const t = texto.trim();
	if (!t) return null;
	const [e] = await llamar([t], 'query');
	return e ?? null;
}

/** Embeddings de una tanda de documentos. `null` si Voyage no está configurado. */
export async function embeddingsDocumentos(textos: string[]): Promise<number[][] | null> {
	if (!env.VOYAGE_API_KEY) return null;
	if (!textos.length) return [];
	return llamar(textos, 'document');
}
