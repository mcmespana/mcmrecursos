import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Buzón de sugerencias (SPEC-017 §2).
 *
 * Aquí no hay correo que mandar, así que este endpoint podría no existir y el panel llamar a
 * `crear_sugerencia` por su cuenta. Existe igualmente para que las dos puertas de SPEC-017
 * tengan la misma forma desde el cliente, y porque es donde irá el aviso al equipo el día que
 * se decida mandarlo — un sitio, no dos.
 */
export const POST: RequestHandler = async ({ request, locals: { supabase } }) => {
	let cuerpo: Record<string, unknown>;
	try {
		cuerpo = await request.json();
	} catch {
		return json({ mensaje: 'Petición mal formada' }, { status: 400 });
	}

	const mensaje = typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje.trim() : '';
	if (!mensaje) return json({ mensaje: 'La sugerencia está vacía' }, { status: 400 });

	const TIPOS = ['idea', 'problema', 'falta', 'otro'];
	const tipo = typeof cuerpo.tipo === 'string' && TIPOS.includes(cuerpo.tipo) ? cuerpo.tipo : 'otro';

	const { data, error } = await supabase.rpc('crear_sugerencia', {
		mensaje_in: mensaje,
		tipo_in: tipo,
		email_in: typeof cuerpo.email === 'string' && cuerpo.email.trim() ? cuerpo.email.trim() : null,
		ruta_in: typeof cuerpo.ruta === 'string' ? cuerpo.ruta : null,
		dispositivo: typeof cuerpo.dispositivo === 'string' ? cuerpo.dispositivo : null
	});

	if (error) return json({ mensaje: error.message }, { status: 400 });

	return json({ ok: true, id: data });
};
