import { env } from '$env/dynamic/private';

/**
 * Emails transaccionales via Resend. Sin RESEND_API_KEY configurada, se registra
 * en el log del servidor y no se envía (la app nunca se rompe por el email).
 */
async function enviar(para: string, asunto: string, html: string) {
	if (!env.RESEND_API_KEY) {
		console.info(`[email omitido — sin RESEND_API_KEY] para=${para} asunto="${asunto}"`);
		return;
	}
	try {
		const res = await fetch('https://api.resend.com/emails', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.RESEND_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: env.RESEND_FROM ?? 'Banco de Recursos MCM <onboarding@resend.dev>',
				to: [para],
				subject: asunto,
				html
			})
		});
		if (!res.ok) console.error('[email] fallo Resend:', res.status, await res.text());
	} catch (e) {
		console.error('[email] error de red:', e);
	}
}

const plantilla = (titulo: string, cuerpo: string, ctaTexto?: string, ctaUrl?: string) => `
<div style="font-family: Figtree, -apple-system, Segoe UI, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
	<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
		<div style="width: 34px; height: 34px; background: #16606b; border-radius: 9px; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">B</div>
		<strong style="font-size: 17px;">Banco de Recursos MCM</strong>
	</div>
	<h1 style="font-size: 22px; margin: 0 0 12px;">${titulo}</h1>
	<div style="font-size: 15px; line-height: 1.6; color: #333;">${cuerpo}</div>
	${ctaTexto && ctaUrl ? `<a href="${ctaUrl}" style="display: inline-block; margin-top: 20px; background: #16606b; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600;">${ctaTexto}</a>` : ''}
	<p style="margin-top: 28px; font-size: 12px; color: #888;">Movimiento Consolación para el Mundo · Banco de Recursos</p>
</div>`;

export function emailEnvioPublicado(para: string, tituloRecurso: string, urlFicha: string) {
	return enviar(
		para,
		`Tu recurso «${tituloRecurso}» ya está publicado 🎉`,
		plantilla(
			'¡Publicado!',
			`<p>Tu aportación <strong>${tituloRecurso}</strong> ha sido revisada y ya forma parte del Banco de Recursos. Gracias por hacerlo crecer.</p>`,
			'Ver la ficha',
			urlFicha
		)
	);
}

export function emailEnvioDevuelto(para: string, tituloRecurso: string, motivo: string, urlEnvios: string) {
	return enviar(
		para,
		`Tu envío «${tituloRecurso}» necesita un retoque`,
		plantilla(
			'Necesita un retoque',
			`<p>Hemos revisado <strong>${tituloRecurso}</strong> y hay algo que corregir antes de publicarlo:</p>
			 <blockquote style="border-left: 3px solid #e5a13a; margin: 12px 0; padding: 6px 14px; color: #555;">${motivo}</blockquote>
			 <p>Puedes corregirlo y reenviarlo desde tus envíos.</p>`,
			'Ir a mis envíos',
			urlEnvios
		)
	);
}

/**
 * Bienvenida a la lista de espera (SPEC-017 §1).
 *
 * Se manda una sola vez, al alta nueva. Hace tres cosas y ninguna es de relleno: confirma que
 * el correo llegó bien —el error más caro de una lista de espera es la dirección con una letra
 * cambiada, y esto lo detecta en el acto—, recuerda que se pueden enviar recursos ya, sin
 * esperar a nadie, y le dice a quien marcó «quiero ayudar» que le vamos a escribir, para que
 * no se quede pensando si aquella casilla sirvió de algo.
 */
export function emailBienvenidaEspera(para: string, quiereAyudar: boolean, origen: string) {
	return enviar(
		para,
		'Te avisamos en cuanto haya material 🌱',
		plantilla(
			'¡Apuntado!',
			`<p>Gracias por dejarnos tu correo. El Banco de Recursos del MCM ya está montado
			  —buscador, filtros, valoraciones, itinerarios— y ahora mismo le falta lo principal:
			  <strong>el contenido</strong>. Estamos subiéndolo estas semanas.</p>
			 <p>Te escribiremos en cuanto haya material de verdad. Ni un correo antes.</p>
			 ${
					quiereAyudar
						? `<p style="background: #f4f9fa; border-left: 3px solid #16606b; padding: 10px 14px; border-radius: 6px;">
			         Además nos dijiste que <strong>quieres echar una mano</strong>. Te escribimos a
			         este mismo correo para prepararlo juntos: hay sitio para quien quiera aportar
			         material, catalogar, probar o simplemente correr la voz.</p>`
						: ''
				}
			 <p><strong>¿Y si el material lo tienes tú?</strong> No hace falta esperar: si tienes
			  sesiones, oraciones, vídeos o carpetas enteras, se pueden enviar hoy mismo. Basta con
			  el enlace — del resto nos encargamos nosotros.</p>`,
			'Enviar un recurso',
			`${origen}/enviar`
		)
	);
}
