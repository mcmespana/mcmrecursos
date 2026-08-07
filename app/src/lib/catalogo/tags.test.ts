import { describe, it, expect } from 'vitest';
import { slugTag, plano, normalizarTags, partirTags } from './tags';

describe('slugTag', () => {
	it('funde mayúsculas, acentos y espacios en el mismo slug', () => {
		expect(slugTag('Adviento')).toBe('adviento');
		expect(slugTag('ADVIENTO')).toBe('adviento');
		expect(slugTag('adviento')).toBe('adviento');
	});

	it('convierte espacios y símbolos en guiones, sin dejarlos en los extremos', () => {
		expect(slugTag('  Vida en el Espíritu  ')).toBe('vida-en-el-espiritu');
		expect(slugTag('¡Fiesta!')).toBe('fiesta');
	});

	it('cadena vacía da slug vacío', () => {
		expect(slugTag('')).toBe('');
		expect(slugTag('   ')).toBe('');
	});
});

describe('plano', () => {
	it('quita acentos y baja a minúsculas', () => {
		expect(plano('Espíritu Santo')).toBe('espiritu santo');
		expect(plano('CONFIRMACIÓN')).toBe('confirmacion');
	});

	it('recorta espacios de los extremos', () => {
		expect(plano('  adviento  ')).toBe('adviento');
	});
});

describe('partirTags', () => {
	it('parte por comas, puntos y coma y saltos de línea', () => {
		expect(partirTags('adviento,cuaresma;pascua\nnavidad')).toEqual([
			'adviento',
			'cuaresma',
			'pascua',
			'navidad'
		]);
	});

	it('recorta espacios de cada trozo y descarta los vacíos', () => {
		expect(partirTags(' a , , b ,')).toEqual(['a', 'b']);
	});

	it('cadena vacía da lista vacía', () => {
		expect(partirTags('')).toEqual([]);
		expect(partirTags('   ')).toEqual([]);
	});
});

describe('normalizarTags', () => {
	it('deduplica por slug conservando la primera aparición', () => {
		expect(normalizarTags(['Adviento', 'adviento', 'ADVIENTO'])).toEqual(['Adviento']);
	});

	it('reutiliza la grafía ya existente en el banco en vez de la recién escrita', () => {
		expect(normalizarTags(['adviento'], ['Adviento'])).toEqual(['Adviento']);
	});

	it('descarta entradas vacías o solo espacios', () => {
		expect(normalizarTags(['adviento', '', '   '])).toEqual(['adviento']);
	});

	it('colapsa espacios internos repetidos', () => {
		expect(normalizarTags(['vida   en el   espíritu'])).toEqual(['vida en el espíritu']);
	});

	it('sin existentes y sin entradas da lista vacía', () => {
		expect(normalizarTags([])).toEqual([]);
	});
});
