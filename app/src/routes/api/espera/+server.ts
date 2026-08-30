import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { emailBienvenidaEspera } from '$lib/server/email';

/**
 * Alta en la lista de espera (SPEC-017 §1).
 *
 * Pasa por el servidor y no directamente por `supabase.rpc()` desde el navegador por una sola
 * razón, y es suficiente: el correo de confirmación lo manda Resend, y la clave de Resend no
 * puede salir del servidor. De paso queda un sitio donde el fallo del correo no arrastra al
 * alta — que es la regla importante aquí: si Resend está caído, el correo se ha guardado
 * igual y la persona no tiene que volver a apuntarse.
 *
 * La validación de verdad (formato del correo, freno de spam, no duplicar) vive en la función
 * `apuntarse_espera` de la BD, que es la única puerta: lo de aquí es solo higiene de tipos.
 */
export const POST: RequestHandler = async ({ request, locals: { supabase }, url }) => {
	let cuerpo: Record<string, unknown>;
	try {
		cuerpo = await request.json();
	} catch {
		return json({ mensaje: 'Petición mal formada' }, { status: 400 });
	}

	const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : '';
	if (!email) return json({ mensaje: 'Hace falta un correo' }, { status: 400 });

	const ayudas = Array.isArray(cuerpo.ayudas)
		? cuerpo.ayudas.filter((a): a is string => typeof a === 'string').slice(0, 8)
		: [];

	const { data, error } = await supabase.rpc('apuntarse_espera', {
		email_in: email,
		nombre_in: typeof cuerpo.nombre === 'string' ? cuerpo.nombre : null,
		quiere_ayudar_in: cuerpo.quiereAyudar === true,
		ayudas_in: ayudas,
		mensaje_in: typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : null,
		origen_in: cuerpo.origen === 'pagina' ? 'pagina' : 'modal',
		dispositivo: typeof cuerpo.dispositivo === 'string' ? cuerpo.dispositivo : null
	});

	if (error) {
		// Los mensajes de `raise exception` de la función están escritos para leerse tal cual
		// («ese correo no parece válido»), así que se devuelven sin traducir.
		return json({ mensaje: error.message }, { status: 400 });
	}

	const resultado = (data ?? {}) as { id?: string; ya_estaba?: boolean; total?: number };

	// Solo se saluda a quien acaba de llegar: mandarle el mismo correo de bienvenida a quien ya
	// estaba apuntado es exactamente el spam del que promete no haber esta pantalla.
	if (!resultado.ya_estaba) {
		await emailBienvenidaEspera(email, cuerpo.quiereAyudar === true, url.origin);
	}

	return json({
		ok: true,
		yaEstaba: !!resultado.ya_estaba,
		total: resultado.total ?? 0
	});
};
