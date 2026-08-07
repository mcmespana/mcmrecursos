import { describe, it, expect } from 'vitest';
import {
	detectarFormato,
	formatoDeMime,
	formatoEfectivo,
	necesitaConsultaDrive,
	descargasDe,
	urlCopia,
	urlVistaPrevia,
	proporcionVistaPrevia,
	urlFavicon
} from './formatos';

describe('detectarFormato', () => {
	it('reconoce las familias de Google por la URL', () => {
		expect(detectarFormato('https://docs.google.com/document/d/abc/edit')).toBe('google-doc');
		expect(detectarFormato('https://docs.google.com/presentation/d/abc/edit')).toBe('google-slides');
		expect(detectarFormato('https://docs.google.com/spreadsheets/d/abc/edit')).toBe('google-sheets');
		expect(detectarFormato('https://docs.google.com/forms/d/abc/edit')).toBe('google-form');
		expect(detectarFormato('https://forms.gle/abc123')).toBe('google-form');
		expect(detectarFormato('https://docs.google.com/drawings/d/abc/edit')).toBe('google-drawing');
	});

	it('reconoce una carpeta de Drive', () => {
		expect(detectarFormato('https://drive.google.com/drive/folders/abc123')).toBe('drive-carpeta');
		expect(detectarFormato('https://drive.google.com/drive/u/0/folders/abc123')).toBe('drive-carpeta');
	});

	it('un archivo genérico de Drive cae a drive-archivo (se afina consultando Drive)', () => {
		expect(detectarFormato('https://drive.google.com/file/d/abc123/view')).toBe('drive-archivo');
	});

	it('reconoce vídeo de YouTube, Vimeo, Canva y Genially', () => {
		expect(detectarFormato('https://www.youtube.com/watch?v=abc123')).toBe('youtube');
		expect(detectarFormato('https://youtu.be/abc123')).toBe('youtube');
		expect(detectarFormato('https://vimeo.com/123456')).toBe('video');
		expect(detectarFormato('https://www.canva.com/design/abc123/view')).toBe('canva');
		expect(detectarFormato('https://genial.ly/abc123')).toBe('genially');
	});

	it('detecta por extensión cuando no es un dominio conocido', () => {
		expect(detectarFormato('https://ejemplo.org/archivo.pdf')).toBe('pdf');
		expect(detectarFormato('https://ejemplo.org/documento.docx')).toBe('word');
		expect(detectarFormato('https://ejemplo.org/hoja.xlsx?ref=1')).toBe('excel');
		expect(detectarFormato('https://ejemplo.org/foto.png#ancla')).toBe('imagen');
		expect(detectarFormato('https://ejemplo.org/video.mp4')).toBe('video');
		expect(detectarFormato('https://ejemplo.org/audio.mp3')).toBe('audio');
		expect(detectarFormato('https://ejemplo.org/paquete.zip')).toBe('comprimido');
		expect(detectarFormato('https://ejemplo.org/notas.txt')).toBe('texto');
	});

	it('sin extensión conocida y sin dominio de Google/Drive cae a web', () => {
		expect(detectarFormato('https://ejemplo.org/pagina-cualquiera')).toBe('web');
	});

	it('entradas vacías o nulas dan null', () => {
		expect(detectarFormato(null)).toBeNull();
		expect(detectarFormato(undefined)).toBeNull();
		expect(detectarFormato('')).toBeNull();
		expect(detectarFormato('   ')).toBeNull();
	});
});

describe('formatoDeMime', () => {
	it('mapea los mimeType de Google Workspace', () => {
		expect(formatoDeMime('application/vnd.google-apps.folder')).toBe('drive-carpeta');
		expect(formatoDeMime('application/vnd.google-apps.document')).toBe('google-doc');
		expect(formatoDeMime('application/vnd.google-apps.spreadsheet')).toBe('google-sheets');
	});

	it('mapea mimeTypes estándar por prefijo o coincidencia', () => {
		expect(formatoDeMime('application/pdf')).toBe('pdf');
		expect(formatoDeMime('image/png')).toBe('imagen');
		expect(formatoDeMime('video/mp4')).toBe('video');
		expect(formatoDeMime('audio/mpeg')).toBe('audio');
		expect(formatoDeMime('text/plain')).toBe('texto');
		expect(formatoDeMime('application/zip')).toBe('comprimido');
	});

	it('un mimeType binario desconocido cae a drive-archivo, no a null', () => {
		expect(formatoDeMime('application/octet-stream')).toBe('drive-archivo');
	});

	it('entrada vacía o nula da null', () => {
		expect(formatoDeMime(null)).toBeNull();
		expect(formatoDeMime('')).toBeNull();
	});
});

describe('formatoEfectivo', () => {
	it('el formato guardado manda si es una clave válida', () => {
		expect(formatoEfectivo('https://ejemplo.org/x', 'pdf')).toBe('pdf');
	});

	it('sin formato guardado válido, se deduce del enlace', () => {
		expect(formatoEfectivo('https://ejemplo.org/x.pdf', null)).toBe('pdf');
		expect(formatoEfectivo('https://ejemplo.org/x.pdf', 'no-existe')).toBe('pdf');
	});
});

describe('necesitaConsultaDrive', () => {
	it('solo drive-archivo necesita que se consulte Drive', () => {
		expect(necesitaConsultaDrive('drive-archivo')).toBe(true);
		expect(necesitaConsultaDrive('pdf')).toBe(false);
		expect(necesitaConsultaDrive(null)).toBe(false);
	});
});

describe('descargasDe', () => {
	it('un documento de Google da PDF y su equivalente de Office', () => {
		const d = descargasDe('https://docs.google.com/document/d/abcdefghij0123456789/edit');
		expect(d.map((x) => x.extension)).toEqual(['pdf', 'docx']);
		expect(d[0].url).toBe(
			'https://docs.google.com/document/d/abcdefghij0123456789/export?format=pdf'
		);
	});

	it('una presentación usa /export/<ext> en la ruta, no ?format=', () => {
		const d = descargasDe('https://docs.google.com/presentation/d/abcdefghij0123456789/edit');
		expect(d.map((x) => x.extension)).toEqual(['pdf', 'pptx']);
		expect(d[0].url).toBe(
			'https://docs.google.com/presentation/d/abcdefghij0123456789/export/pdf'
		);
	});

	it('un enlace que no es documento de Google no tiene descargas', () => {
		expect(descargasDe('https://ejemplo.org/archivo.pdf')).toEqual([]);
		expect(descargasDe(null)).toEqual([]);
	});
});

describe('urlCopia', () => {
	it('da la URL de copia para un documento de Google', () => {
		expect(urlCopia('https://docs.google.com/document/d/abcdefghij0123456789/edit')).toBe(
			'https://docs.google.com/document/d/abcdefghij0123456789/copy'
		);
	});

	it('null para lo que no es un documento de Google', () => {
		expect(urlCopia('https://ejemplo.org/x.pdf')).toBeNull();
		expect(urlCopia(null)).toBeNull();
	});
});

describe('urlVistaPrevia', () => {
	it('documentos de Google usan /preview salvo presentaciones, que usan /embed', () => {
		expect(urlVistaPrevia('https://docs.google.com/document/d/abcdefghij0123456789/edit')).toBe(
			'https://docs.google.com/document/d/abcdefghij0123456789/preview'
		);
		expect(
			urlVistaPrevia('https://docs.google.com/presentation/d/abcdefghij0123456789/edit')
		).toBe(
			'https://docs.google.com/presentation/d/abcdefghij0123456789/embed?start=false&loop=false&delayms=5000'
		);
	});

	it('una carpeta de Drive da la vista de rejilla embebida', () => {
		expect(urlVistaPrevia('https://drive.google.com/drive/folders/abcdefghij123456')).toBe(
			'https://drive.google.com/embeddedfolderview?id=abcdefghij123456#grid'
		);
	});

	it('un archivo suelto de Drive da el visor de Drive', () => {
		expect(
			urlVistaPrevia('https://drive.google.com/file/d/abcdefghij0123456789/view')
		).toBe('https://drive.google.com/file/d/abcdefghij0123456789/preview');
	});

	it('YouTube da el embed sin cookies', () => {
		expect(urlVistaPrevia('https://youtu.be/dQw4w9WgXcQ')).toBe(
			'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'
		);
	});

	it('una web genérica no tiene vista previa (null a propósito)', () => {
		expect(urlVistaPrevia('https://ejemplo.org/pagina-cualquiera')).toBeNull();
	});

	it('entrada vacía o nula da null', () => {
		expect(urlVistaPrevia(null)).toBeNull();
		expect(urlVistaPrevia('')).toBeNull();
	});
});

describe('proporcionVistaPrevia', () => {
	it('vídeo y presentaciones son 16:9', () => {
		expect(proporcionVistaPrevia('youtube')).toBe('aspect-video');
		expect(proporcionVistaPrevia('video')).toBe('aspect-video');
		expect(proporcionVistaPrevia('google-slides')).toBe('aspect-video');
		expect(proporcionVistaPrevia('ppt')).toBe('aspect-video');
	});

	it('una carpeta de Drive es 4:3', () => {
		expect(proporcionVistaPrevia('drive-carpeta')).toBe('aspect-[4/3]');
	});

	it('el resto (documentos, hojas…) usa la proporción de lectura', () => {
		expect(proporcionVistaPrevia('pdf')).toBe('aspect-[3/4] sm:aspect-[4/3]');
		expect(proporcionVistaPrevia(null)).toBe('aspect-[3/4] sm:aspect-[4/3]');
	});
});

describe('urlFavicon', () => {
	it('da una URL de favicon con el origen del enlace', () => {
		const url = urlFavicon('https://ejemplo.org/pagina?x=1');
		expect(url).toContain('url=' + encodeURIComponent('https://ejemplo.org'));
	});

	it('entrada vacía, nula o inválida da null', () => {
		expect(urlFavicon(null)).toBeNull();
		expect(urlFavicon('')).toBeNull();
		expect(urlFavicon('no es una url')).toBeNull();
	});
});
