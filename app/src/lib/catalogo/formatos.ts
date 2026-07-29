import {
	CirclePlay,
	ClipboardList,
	FileArchive,
	FileSpreadsheet,
	FileText,
	Film,
	Folder,
	Globe,
	Image,
	Music,
	Palette,
	PenTool,
	Presentation,
	Sparkles,
	type Icon as IconType
} from '@lucide/svelte';

/**
 * Formato de un archivo enlazado (SPEC-011).
 *
 * No confundir con `tipo` (qué es el recurso: sesión, campamento, oración…) ni con `soporte`
 * (etiqueta editorial del catálogo). El formato se DEDUCE del enlace y solo sirve para poner
 * el icono correcto en el botón de abrir: si el recurso vive en Drive, que se vea Drive; si es
 * un PDF, que se vea un PDF.
 */
export type ClaveFormato =
	| 'google-doc'
	| 'google-slides'
	| 'google-sheets'
	| 'google-form'
	| 'google-drawing'
	| 'drive-carpeta'
	| 'drive-archivo'
	| 'pdf'
	| 'word'
	| 'ppt'
	| 'excel'
	| 'imagen'
	| 'video'
	| 'audio'
	| 'comprimido'
	| 'texto'
	| 'youtube'
	| 'canva'
	| 'genially'
	| 'web';

export interface Formato {
	/** Nombre completo, para tooltips y para el desplegable del panel. */
	etiqueta: string;
	/** Nombre corto, para el botón de abrir junto al icono. */
	corto: string;
	icono: typeof IconType;
	/** Color de marca del icono (claro/oscuro). */
	color: string;
	/** true = se dibuja el triángulo de Google Drive en vez del icono de Lucide. */
	marcaDrive?: boolean;
	/** Valor de la lista `soporte` que le corresponde, para autorrellenar el formulario. */
	soporte?: string;
}

export const FORMATOS: Record<ClaveFormato, Formato> = {
	'google-doc': {
		etiqueta: 'Documento de Google',
		corto: 'Documento',
		icono: FileText,
		color: 'text-blue-600 dark:text-blue-400',
		soporte: 'Docs'
	},
	'google-slides': {
		etiqueta: 'Presentación de Google',
		corto: 'Presentación',
		icono: Presentation,
		color: 'text-amber-600 dark:text-amber-400',
		soporte: 'PPT'
	},
	'google-sheets': {
		etiqueta: 'Hoja de cálculo de Google',
		corto: 'Hoja de cálculo',
		icono: FileSpreadsheet,
		color: 'text-emerald-600 dark:text-emerald-400',
		soporte: 'Hoja de cálculo'
	},
	'google-form': {
		etiqueta: 'Formulario de Google',
		corto: 'Formulario',
		icono: ClipboardList,
		color: 'text-violet-600 dark:text-violet-400',
		soporte: 'Formulario'
	},
	'google-drawing': {
		etiqueta: 'Dibujo de Google',
		corto: 'Dibujo',
		icono: PenTool,
		color: 'text-orange-600 dark:text-orange-400'
	},
	'drive-carpeta': {
		etiqueta: 'Carpeta de Drive',
		corto: 'Carpeta',
		icono: Folder,
		color: 'text-[#4285F4]',
		soporte: 'Carpeta de Drive'
	},
	'drive-archivo': {
		etiqueta: 'Archivo en Drive',
		corto: 'Drive',
		icono: FileText,
		color: '',
		marcaDrive: true,
		soporte: 'Archivo'
	},
	pdf: {
		etiqueta: 'PDF',
		corto: 'PDF',
		icono: FileText,
		color: 'text-red-600 dark:text-red-400',
		soporte: 'PDF'
	},
	word: {
		etiqueta: 'Documento de Word',
		corto: 'Word',
		icono: FileText,
		color: 'text-blue-700 dark:text-blue-400',
		soporte: 'Word'
	},
	ppt: {
		etiqueta: 'Presentación de PowerPoint',
		corto: 'PowerPoint',
		icono: Presentation,
		color: 'text-orange-600 dark:text-orange-400',
		soporte: 'PPT'
	},
	excel: {
		etiqueta: 'Hoja de cálculo de Excel',
		corto: 'Excel',
		icono: FileSpreadsheet,
		color: 'text-green-700 dark:text-green-400',
		soporte: 'Hoja de cálculo'
	},
	imagen: {
		etiqueta: 'Imagen',
		corto: 'Imagen',
		icono: Image,
		color: 'text-sky-600 dark:text-sky-400',
		soporte: 'Imagen'
	},
	video: {
		etiqueta: 'Vídeo',
		corto: 'Vídeo',
		icono: Film,
		color: 'text-rose-600 dark:text-rose-400',
		soporte: 'Vídeo'
	},
	audio: {
		etiqueta: 'Audio',
		corto: 'Audio',
		icono: Music,
		color: 'text-amber-600 dark:text-amber-400',
		soporte: 'Audio'
	},
	comprimido: {
		etiqueta: 'Archivo comprimido',
		corto: 'ZIP',
		icono: FileArchive,
		color: 'text-slate-600 dark:text-slate-400',
		soporte: 'Archivo'
	},
	texto: {
		etiqueta: 'Texto plano',
		corto: 'Texto',
		icono: FileText,
		color: 'text-slate-600 dark:text-slate-400',
		soporte: 'Archivo'
	},
	youtube: {
		etiqueta: 'Vídeo de YouTube',
		corto: 'YouTube',
		icono: CirclePlay,
		color: 'text-red-600 dark:text-red-500',
		soporte: 'YouTube'
	},
	canva: {
		etiqueta: 'Diseño de Canva',
		corto: 'Canva',
		icono: Palette,
		color: 'text-cyan-600 dark:text-cyan-400',
		soporte: 'Canva'
	},
	genially: {
		etiqueta: 'Genially',
		corto: 'Genially',
		icono: Sparkles,
		color: 'text-violet-600 dark:text-violet-400',
		soporte: 'Genially'
	},
	web: {
		etiqueta: 'Página web',
		corto: 'Web',
		icono: Globe,
		color: 'text-slate-600 dark:text-slate-400',
		soporte: 'Web'
	}
};

const POR_EXTENSION: Record<string, ClaveFormato> = {
	pdf: 'pdf',
	doc: 'word',
	docx: 'word',
	odt: 'word',
	rtf: 'word',
	ppt: 'ppt',
	pptx: 'ppt',
	odp: 'ppt',
	xls: 'excel',
	xlsx: 'excel',
	ods: 'excel',
	csv: 'excel',
	png: 'imagen',
	jpg: 'imagen',
	jpeg: 'imagen',
	gif: 'imagen',
	webp: 'imagen',
	svg: 'imagen',
	heic: 'imagen',
	mp4: 'video',
	mov: 'video',
	avi: 'video',
	mkv: 'video',
	webm: 'video',
	mp3: 'audio',
	wav: 'audio',
	m4a: 'audio',
	ogg: 'audio',
	zip: 'comprimido',
	rar: 'comprimido',
	'7z': 'comprimido',
	txt: 'texto',
	md: 'texto'
};

/**
 * Formato deducido del enlace. Cubre lo que se ve en la URL: Google Docs/Slides/Sheets/Forms
 * y las carpetas de Drive se distinguen solas; los `drive.google.com/file/d/…` solo dicen
 * «es un archivo en Drive» y se afinan luego consultando a Drive (ver `formatoDeMime`).
 */
export function detectarFormato(enlace: string | null | undefined): ClaveFormato | null {
	const url = (enlace ?? '').trim().toLowerCase();
	if (!url) return null;

	if (url.includes('docs.google.com/document')) return 'google-doc';
	if (url.includes('docs.google.com/presentation')) return 'google-slides';
	if (url.includes('docs.google.com/spreadsheets')) return 'google-sheets';
	if (url.includes('docs.google.com/forms') || url.includes('forms.gle/')) return 'google-form';
	if (url.includes('docs.google.com/drawings')) return 'google-drawing';
	if (/drive\.google\.com\/(?:drive\/)?(?:u\/\d+\/)?(?:drive\/)?folders\//.test(url))
		return 'drive-carpeta';
	if (url.includes('youtube.com/') || url.includes('youtu.be/')) return 'youtube';
	if (url.includes('vimeo.com/')) return 'video';
	if (url.includes('canva.com/')) return 'canva';
	if (url.includes('genial.ly/') || url.includes('genially.com/')) return 'genially';

	// extensión del path (sin query ni ancla)
	const ext = url.split(/[?#]/)[0].split('.').pop() ?? '';
	if (ext && ext !== url && POR_EXTENSION[ext]) return POR_EXTENSION[ext];

	if (url.includes('drive.google.com') || url.includes('docs.google.com')) return 'drive-archivo';
	return 'web';
}

/** Formato a partir del mimeType que devuelve la API de Drive. */
export function formatoDeMime(mime: string | null | undefined): ClaveFormato | null {
	const m = (mime ?? '').toLowerCase();
	if (!m) return null;
	if (m === 'application/vnd.google-apps.folder') return 'drive-carpeta';
	if (m === 'application/vnd.google-apps.document') return 'google-doc';
	if (m === 'application/vnd.google-apps.presentation') return 'google-slides';
	if (m === 'application/vnd.google-apps.spreadsheet') return 'google-sheets';
	if (m === 'application/vnd.google-apps.form') return 'google-form';
	if (m === 'application/vnd.google-apps.drawing') return 'google-drawing';
	if (m === 'application/pdf') return 'pdf';
	if (m.includes('wordprocessingml') || m === 'application/msword') return 'word';
	if (m.includes('presentationml') || m === 'application/vnd.ms-powerpoint') return 'ppt';
	if (m.includes('spreadsheetml') || m === 'application/vnd.ms-excel') return 'excel';
	if (m.startsWith('image/')) return 'imagen';
	if (m.startsWith('video/')) return 'video';
	if (m.startsWith('audio/')) return 'audio';
	if (m.startsWith('text/')) return 'texto';
	if (m.includes('zip') || m.includes('compressed')) return 'comprimido';
	return 'drive-archivo';
}

/** El formato guardado manda; si no lo hay, se deduce del enlace al vuelo. */
export function formatoEfectivo(
	enlace: string | null | undefined,
	guardado?: string | null
): ClaveFormato | null {
	if (guardado && guardado in FORMATOS) return guardado as ClaveFormato;
	return detectarFormato(enlace);
}

/** `drive-archivo` es el «no sé qué es todavía»: solo Drive puede afinarlo. */
export function necesitaConsultaDrive(clave: ClaveFormato | null): boolean {
	return clave === 'drive-archivo';
}

// ---------------------------------------------------------------------------
// Descargar y copiar documentos de Google (SPEC-011 §URLs de Google)
// ---------------------------------------------------------------------------

/**
 * Los editores de Google exportan por URL, sin API y sin credenciales: basta cambiar el
 * `/edit` final. Para textos y hojas el formato va en la query (`?format=pdf`); para
 * presentaciones y dibujos, en la ruta (`/export/pdf`).
 *
 * No es una llamada nuestra: es un enlace que abre quien lo pulsa, con SUS permisos. Si el
 * documento está compartido por enlace —como está todo lo del banco, que para eso se enlaza—
 * funciona sin haber iniciado sesión. Si estuviera restringido, Google pide cuenta, que es
 * exactamente lo que ya pasa hoy al abrir el original: el peor caso no empeora.
 */
/**
 * Se ofrecen dos por familia —PDF y el equivalente de Office— porque son los que de verdad se
 * piden: el PDF para imprimir y repartir, el Office para adaptarlo sin cuenta de Google.
 * Google admite bastantes más (`odt`, `rtf`, `txt`, `epub`, `csv`, `tsv`, `ods`, `odp`, `svg`,
 * `png`, `jpg`…); añadir uno es meterlo en esta lista.
 */
const FAMILIA_GOOGLE = {
	document: { ruta: false, formatos: ['pdf', 'docx'] },
	spreadsheets: { ruta: false, formatos: ['pdf', 'xlsx'] },
	presentation: { ruta: true, formatos: ['pdf', 'pptx'] },
	drawings: { ruta: true, formatos: ['pdf', 'png'] }
} as const;

type FamiliaGoogle = keyof typeof FAMILIA_GOOGLE;

/** Extensión → cómo se llama y con qué icono se pinta en el botón de descarga. */
const DESCARGA: Record<string, { etiqueta: string; formato: ClaveFormato }> = {
	pdf: { etiqueta: 'PDF', formato: 'pdf' },
	docx: { etiqueta: 'Word', formato: 'word' },
	xlsx: { etiqueta: 'Excel', formato: 'excel' },
	pptx: { etiqueta: 'PowerPoint', formato: 'ppt' },
	odt: { etiqueta: 'OpenDocument', formato: 'word' },
	ods: { etiqueta: 'OpenDocument', formato: 'excel' },
	odp: { etiqueta: 'OpenDocument', formato: 'ppt' },
	rtf: { etiqueta: 'RTF', formato: 'word' },
	csv: { etiqueta: 'CSV', formato: 'excel' },
	tsv: { etiqueta: 'TSV', formato: 'excel' },
	txt: { etiqueta: 'Texto', formato: 'texto' },
	epub: { etiqueta: 'EPUB', formato: 'texto' },
	png: { etiqueta: 'PNG', formato: 'imagen' },
	svg: { etiqueta: 'SVG', formato: 'imagen' }
};

export interface Descarga {
	/** Extensión (`pdf`, `docx`…), por si hace falta distinguirlas. */
	extension: string;
	etiqueta: string;
	/** Clave de formato, solo para elegir el icono. */
	formato: ClaveFormato;
	url: string;
}

/** Familia de editor de Google y id del documento, si el enlace es de uno. */
function documentoGoogle(enlace: string | null | undefined): { familia: FamiliaGoogle; id: string } | null {
	const m = (enlace ?? '').match(
		/docs\.google\.com\/(document|spreadsheets|presentation|drawings)\/d\/([\w-]{20,})/
	);
	return m ? { familia: m[1] as FamiliaGoogle, id: m[2] } : null;
}

/**
 * Descargas disponibles para un enlace, en orden de utilidad (PDF primero).
 * Vacío si el enlace no es un documento de Google: no hay atajo por URL para un .docx que
 * viva en Drive como fichero suelto (ver SPEC-011).
 */
export function descargasDe(enlace: string | null | undefined): Descarga[] {
	const doc = documentoGoogle(enlace);
	if (!doc) return [];
	const { ruta, formatos } = FAMILIA_GOOGLE[doc.familia];
	const base = `https://docs.google.com/${doc.familia}/d/${doc.id}`;
	return formatos
		.filter((ext) => DESCARGA[ext])
		.map((ext) => ({
			extension: ext,
			etiqueta: DESCARGA[ext].etiqueta,
			formato: DESCARGA[ext].formato,
			url: ruta ? `${base}/export/${ext}` : `${base}/export?format=${ext}`
		}));
}

/**
 * URL para hacerse una copia editable del documento en el Drive de quien la pulsa.
 * Google enseña un «¿Quieres hacer una copia?» y solo necesita permiso de LECTURA sobre el
 * original, así que nadie puede tocar el documento del banco por aquí.
 */
export function urlCopia(enlace: string | null | undefined): string | null {
	const doc = documentoGoogle(enlace);
	return doc ? `https://docs.google.com/${doc.familia}/d/${doc.id}/copy` : null;
}

/**
 * Favicon de un sitio, servido por Google. Se usa como miniatura de respaldo de los recursos
 * que son una web: mejor la marca del sitio que un icono de globo genérico.
 */
export function urlFavicon(enlace: string | null | undefined, tamano = 64): string | null {
	const url = (enlace ?? '').trim();
	if (!url) return null;
	let host: string;
	try {
		host = new URL(url).origin;
	} catch {
		return null;
	}
	return (
		'https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON' +
		`&fallback_opts=TYPE,SIZE,URL&size=${tamano}&url=${encodeURIComponent(host)}`
	);
}
