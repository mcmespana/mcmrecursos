import { env } from '$env/dynamic/private';

/**
 * Autoclasificación de recursos con Google Gemini (SPEC-010).
 *
 * REST directo (`generateContent` + `responseSchema`) — sin SDK, solo fetch. Sin
 * GEMINI_API_KEY configurada, la función se degrada a `{ disponible: false }` y la app
 * sigue igual (mismo patrón que el email con Resend). Solo texto: nunca imágenes.
 */

// Gemini 3.6 Flash (jul 2026): más capaz y más barato que 3.5 para clasificar.
// Alternativas por env: `gemini-3.5-flash-lite` (lotes de alto volumen) o
// `gemini-flash-latest` (alias estable al Flash GA vigente).
const MODELO_DEFECTO = 'gemini-3.6-flash';

/** Texto del recurso a clasificar. `textoDocumento` = contenido leído de Drive, si lo hay. */
export interface EntradaClasificacion {
	nombre: string;
	descripcion?: string | null;
	notas?: string | null;
	tipoActual?: string | null;
	enlace?: string | null;
	tagsActuales?: string[];
	textoDocumento?: string | null;
}

/** Vocabularios cerrados que la IA debe respetar (de `lista_valor` + tags existentes). */
export interface VocabulariosIa {
	tipos: string[];
	etapas: string[];
	edades: string[];
	niveles: string[];
	idiomas: string[];
	soportes: string[];
	tags: string[];
}

export interface PropuestaClasificacion {
	tipo: string | null;
	etapas: string[];
	edades: string[];
	nivel: string | null;
	idioma: string | null;
	soporte: string | null;
	tags: string[];
	descripcion: string | null;
	avisos: string[];
	confianza: number | null;
}

export type ResultadoClasificacion =
	| { disponible: false }
	| { disponible: true; ok: true; propuesta: PropuestaClasificacion; modelo: string }
	| { disponible: true; ok: false; error: string };

export function iaDisponible(): boolean {
	return !!env.GEMINI_API_KEY;
}

const listar = (etiqueta: string, valores: string[]) =>
	valores.length ? `${etiqueta}: ${valores.join(' | ')}` : `${etiqueta}: (sin lista)`;

function construirPrompt(entrada: EntradaClasificacion, vocab: VocabulariosIa): string {
	return [
		'Eres un catalogador del Banco de Recursos del Movimiento Consolación para el Mundo',
		'(recursos de tiempo libre para grupos de niños y jóvenes, en español).',
		'Clasifica el siguiente recurso usando SOLO los valores permitidos de cada lista.',
		'Si un campo no se puede deducir con confianza, déjalo vacío (null o []). No inventes',
		'etiquetas fuera de las listas. La descripción sugerida: 1-2 frases claras en español.',
		'En "avisos" señala problemas para publicar (p. ej. falta de contexto, enlace dudoso,',
		'posible falta de año/etapa). "confianza" es tu certeza global de 0 a 1.',
		'',
		'VALORES PERMITIDOS',
		listar('tipo (elige uno)', vocab.tipos),
		listar('etapas (varias)', vocab.etapas),
		listar('edades (varias)', vocab.edades),
		listar('nivel (uno)', vocab.niveles),
		listar('idioma (uno)', vocab.idiomas),
		listar('soporte (uno)', vocab.soportes),
		`tags sugeridas (reutiliza si encajan, si no propón nuevas breves en minúscula): ${vocab.tags.slice(0, 120).join(', ')}`,
		'',
		'RECURSO A CLASIFICAR',
		`Nombre: ${entrada.nombre}`,
		entrada.tipoActual ? `Tipo actual: ${entrada.tipoActual}` : '',
		entrada.descripcion ? `Descripción: ${entrada.descripcion}` : '',
		entrada.notas ? `Notas: ${entrada.notas}` : '',
		entrada.tagsActuales?.length ? `Tags actuales: ${entrada.tagsActuales.join(', ')}` : '',
		entrada.enlace ? `Enlace: ${entrada.enlace}` : '',
		entrada.textoDocumento
			? `\nCONTENIDO DEL DOCUMENTO (extraído de Drive, úsalo como fuente principal):\n${entrada.textoDocumento}`
			: ''
	]
		.filter(Boolean)
		.join('\n');
}

const ESQUEMA = {
	type: 'object',
	properties: {
		tipo: { type: 'string', nullable: true },
		etapas: { type: 'array', items: { type: 'string' } },
		edades: { type: 'array', items: { type: 'string' } },
		nivel: { type: 'string', nullable: true },
		idioma: { type: 'string', nullable: true },
		soporte: { type: 'string', nullable: true },
		tags: { type: 'array', items: { type: 'string' } },
		descripcion: { type: 'string', nullable: true },
		avisos: { type: 'array', items: { type: 'string' } },
		confianza: { type: 'number', nullable: true }
	},
	required: ['tipo', 'etapas', 'edades', 'tags', 'avisos']
};

/** Filtra la propuesta a valores permitidos (defensa por si el modelo se sale de la lista). */
function sanear(cruda: any, vocab: VocabulariosIa): PropuestaClasificacion {
	const permitido = (v: unknown, lista: string[]) =>
		typeof v === 'string' && lista.includes(v) ? v : null;
	const permitidos = (arr: unknown, lista: string[]) =>
		Array.isArray(arr) ? (arr.filter((x) => typeof x === 'string' && lista.includes(x)) as string[]) : [];
	const textos = (arr: unknown) =>
		Array.isArray(arr) ? (arr.filter((x) => typeof x === 'string' && x.trim()) as string[]) : [];

	return {
		tipo: permitido(cruda?.tipo, vocab.tipos),
		etapas: permitidos(cruda?.etapas, vocab.etapas),
		edades: permitidos(cruda?.edades, vocab.edades),
		nivel: permitido(cruda?.nivel, vocab.niveles),
		idioma: permitido(cruda?.idioma, vocab.idiomas),
		soporte: permitido(cruda?.soporte, vocab.soportes),
		// tags: se permiten nuevas (el editor las revisa), pero limpiamos y acotamos
		tags: textos(cruda?.tags)
			.map((t) => t.trim())
			.slice(0, 12),
		descripcion: typeof cruda?.descripcion === 'string' ? cruda.descripcion.trim() || null : null,
		avisos: textos(cruda?.avisos).slice(0, 8),
		confianza:
			typeof cruda?.confianza === 'number' ? Math.max(0, Math.min(1, cruda.confianza)) : null
	};
}

export async function clasificarRecurso(
	entrada: EntradaClasificacion,
	vocab: VocabulariosIa
): Promise<ResultadoClasificacion> {
	if (!env.GEMINI_API_KEY) return { disponible: false };
	const modelo = env.GEMINI_MODELO || MODELO_DEFECTO;

	try {
		const res = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
			{
				method: 'POST',
				headers: {
					'x-goog-api-key': env.GEMINI_API_KEY,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					contents: [{ parts: [{ text: construirPrompt(entrada, vocab) }] }],
					generationConfig: {
						temperature: 0,
						responseMimeType: 'application/json',
						responseSchema: ESQUEMA
					}
				})
			}
		);

		if (!res.ok) {
			const detalle = await res.text();
			return { disponible: true, ok: false, error: `Gemini ${res.status}: ${detalle.slice(0, 300)}` };
		}

		const data = await res.json();
		const texto = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join('') ?? '';
		if (!texto) return { disponible: true, ok: false, error: 'Respuesta vacía de Gemini' };

		let cruda: unknown;
		try {
			cruda = JSON.parse(texto);
		} catch {
			return { disponible: true, ok: false, error: 'Gemini no devolvió JSON válido' };
		}

		return { disponible: true, ok: true, propuesta: sanear(cruda, vocab), modelo };
	} catch (e) {
		return { disponible: true, ok: false, error: `Error de red con Gemini: ${(e as Error).message}` };
	}
}
