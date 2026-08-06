import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * ¿Esto ya está en el banco? (SPEC-008 §2, migración 00019)
 *
 * Pregunta por un enlace y/o un título y devuelve lo que se le parece. Va por endpoint y no por
 * consulta desde el cliente por dos razones: quien envía un recurso desde `/enviar` no tiene el
 * catálogo en memoria, y comparar enlaces normalizados es trabajo de Postgres —está indexado— no
 * del navegador.
 *
 * La RPC es `security invoker`, así que cada quien encuentra lo que su RLS le deja ver: sin cuenta,
 * solo choca con recursos publicados; catalogando, también con lo que está sin publicar, que es
 * justo cuando importa.
 */
export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	const cuerpo = await request.json().catch(() => ({}));
	const enlace = String(cuerpo?.enlace ?? '').trim() || null;
	const titulo = String(cuerpo?.titulo ?? '').trim() || null;
	const excluir = String(cuerpo?.excluir ?? '').trim() || null;

	// sin nada que comparar no se molesta a la base de datos
	if (!enlace && (!titulo || titulo.length < 6)) return json({ duplicados: [] });

	const { data, error } = await supabase.rpc('buscar_duplicados', {
		enlace_in: enlace,
		titulo_in: titulo,
		excluir_id: excluir
	});

	if (error) return json({ duplicados: [], error: error.message }, { status: 500 });
	return json({ duplicados: data ?? [] });
};
