import { describe, it, expect } from 'vitest';
import { resumirEdades, vocabularioEdades } from './tipos';
import type { ListaValor } from './tipos';

const LISTAS: ListaValor[] = [
	{ lista: 'edades', valor: '3º EP', grupo: null, orden: 1 },
	{ lista: 'edades', valor: '4º EP', grupo: null, orden: 2 },
	{ lista: 'edades', valor: '1º ESO', grupo: null, orden: 3 },
	{ lista: 'tipo', valor: 'Taller', grupo: 'actividad', orden: 1 }
];
const VOCAB = vocabularioEdades(LISTAS);

describe('resumirEdades', () => {
	it('saca el vocabulario solo de la lista de edades', () => {
		expect(VOCAB).toEqual(['3º EP', '4º EP', '1º ESO']);
	});

	it('dice «todas» cuando están todas, sin importar el orden', () => {
		const r = resumirEdades(['1º ESO', '3º EP', '4º EP'], VOCAB);
		expect(r.todas).toBe(true);
		expect(r.valores).toEqual([]);
	});

	it('no dice «todas» si falta alguna', () => {
		expect(resumirEdades(['3º EP', '4º EP'], VOCAB).todas).toBe(false);
	});

	it('recorta a `max` cuando no están todas', () => {
		expect(resumirEdades(['3º EP', '4º EP'], VOCAB, 1).valores).toEqual(['3º EP']);
	});

	it('aguanta vacío y nulo', () => {
		expect(resumirEdades([], VOCAB)).toEqual({ todas: false, valores: [] });
		expect(resumirEdades(null, VOCAB)).toEqual({ todas: false, valores: [] });
	});

	it('con un vocabulario de una sola edad no dice «todas»: su nombre ya lo dice', () => {
		expect(resumirEdades(['3º EP'], ['3º EP']).todas).toBe(false);
	});

	it('sin vocabulario cargado se comporta como antes: enseña lo que hay', () => {
		expect(resumirEdades(['3º EP', '4º EP'], [], 3).valores).toEqual(['3º EP', '4º EP']);
	});
});
