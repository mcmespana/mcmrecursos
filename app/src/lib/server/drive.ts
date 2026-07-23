import { env } from '$env/dynamic/private';
import crypto from 'node:crypto';

/**
 * Lectura de documentos de Google Drive con una cuenta de servicio (SPEC-010).
 *
 * Permite que la IA clasifique con el CONTENIDO REAL del documento, no solo el título.
 * Sin `GOOGLE_SERVICE_ACCOUNT_JSON`, se degrada a null (la clasificación usa solo el texto
 * existente). Solo texto: exporta Google Docs/Slides/Sheets y ficheros de texto; los binarios
 * (PDF, etc.) se ignoran en esta versión.
 *
 * Requiere que las carpetas del banco estén compartidas (lector) con el `client_email` de la
 * cuenta de servicio. Ver docs/05-configuracion-servicios.md §3.
 */

let tokenCache: { token: string; exp: number } | null = null;

function credenciales(): { email: string; key: string } | null {
	if (!env.GOOGLE_SERVICE_ACCOUNT_JSON) return null;
	try {
		const j = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
		if (!j.client_email || !j.private_key) return null;
		return { email: j.client_email, key: String(j.private_key).replace(/\\n/g, '\n') };
	} catch {
		return null;
	}
}

export function driveDisponible(): boolean {
	return !!credenciales();
}

const base64url = (buf: Buffer | string) =>
	Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function accessToken(): Promise<string | null> {
	const cred = credenciales();
	if (!cred) return null;
	const now = Math.floor(Date.now() / 1000);
	if (tokenCache && tokenCache.exp > now + 60) return tokenCache.token;

	const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const claim = base64url(
		JSON.stringify({
			iss: cred.email,
			scope: 'https://www.googleapis.com/auth/drive.readonly',
			aud: 'https://oauth2.googleapis.com/token',
			iat: now,
			exp: now + 3600
		})
	);
	const unsigned = `${header}.${claim}`;
	let firma: string;
	try {
		firma = base64url(crypto.createSign('RSA-SHA256').update(unsigned).sign(cred.key));
	} catch {
		return null; // private_key malformada
	}

	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: `${unsigned}.${firma}`
		})
	});
	if (!res.ok) return null;
	const data = await res.json();
	if (!data?.access_token) return null;
	tokenCache = { token: data.access_token, exp: now + (data.expires_in ?? 3600) };
	return tokenCache.token;
}

function idDeDrive(enlace: string): string | null {
	const m =
		enlace.match(/\/(?:file|document|presentation|spreadsheets)\/d\/([\w-]{20,})/) ??
		enlace.match(/[?&]id=([\w-]{20,})/);
	return m ? m[1] : null;
}

const EXPORT: Record<string, string> = {
	'application/vnd.google-apps.document': 'text/plain',
	'application/vnd.google-apps.presentation': 'text/plain',
	'application/vnd.google-apps.spreadsheet': 'text/csv'
};

/**
 * Texto del documento de Drive al que apunta `enlace`, o null si no aplica / no disponible.
 * Acota a `maxChars` para no disparar el coste de tokens.
 */
export async function extraerTextoDrive(
	enlace: string | null,
	maxChars = 18000
): Promise<string | null> {
	if (!enlace) return null;
	const id = idDeDrive(enlace);
	if (!id) return null;
	const token = await accessToken();
	if (!token) return null;
	const auth = { Authorization: `Bearer ${token}` };

	try {
		const metaRes = await fetch(
			`https://www.googleapis.com/drive/v3/files/${id}?fields=mimeType&supportsAllDrives=true`,
			{ headers: auth }
		);
		if (!metaRes.ok) return null;
		const mime: string = (await metaRes.json())?.mimeType ?? '';

		let texto = '';
		const exp = EXPORT[mime];
		if (exp) {
			const r = await fetch(
				`https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exp)}&supportsAllDrives=true`,
				{ headers: auth }
			);
			if (!r.ok) return null;
			texto = await r.text();
		} else if (mime.startsWith('text/')) {
			const r = await fetch(
				`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`,
				{ headers: auth }
			);
			if (!r.ok) return null;
			texto = await r.text();
		} else {
			return null; // binarios (PDF, imágenes…) no se extraen en esta versión
		}

		texto = texto.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
		return texto ? texto.slice(0, maxChars) : null;
	} catch {
		return null;
	}
}
