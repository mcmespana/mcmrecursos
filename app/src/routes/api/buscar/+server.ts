import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { embeddingsDisponibles, embeddingConsulta } from '$lib/server/embeddings';

/**
 * Búsqueda semántica (SPEC-010): embebe la consulta con Voyage y pide a Postgres
 * (RPC `buscar_semantica`, pgvector) los recursos más cercanos. Devuelve ids
 * ordenados por relevancia; el buscador del cliente los mezcla con la búsqueda
 * léxica (Orama). Sin VOYAGE_API_KEY responde `{ disponible: false }`.
 */
export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	if (!embeddingsDisponibles()) return json({ disponible: false, ids: [] });

	const cuerpo = await request.json().catch(() => ({}));
	const consulta = String(cuerpo?.q ?? '').trim();
	if (consulta.length < 3) return json({ disponible: true, ids: [] });

	let embedding: number[] | null;
	try {
		embedding = await embeddingConsulta(consulta);
	} catch (e) {
		return json({ disponible: true, ids: [], error: (e as Error).message }, { status: 502 });
	}
	if (!embedding) return json({ disponible: false, ids: [] });

	const { data, error } = await supabase.rpc('buscar_semantica', {
		consulta: embedding,
		limite: 48
	});
	if (error) return json({ disponible: true, ids: [], error: error.message }, { status: 500 });

	return json({ disponible: true, ids: (data ?? []).map((r: { id: string }) => r.id) });
};
