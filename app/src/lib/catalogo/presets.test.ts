import { describe, it, expect } from 'vitest';
import { construirFacetas, type FacetaConfig } from './filtros';
import {
	describirFiltros,
	esPresetActivo,
	nombreSugerido,
	presetDeSeleccion,
	seleccionDePreset,
	seleccionVacia,
	type Preset
} from './presets';

const CONFIG: FacetaConfig[] = [
	{ campo: 'tipo', etiqueta: 'Tipo', tipo: 'multiselect', origen: 'columna', orden: 1, visible: true, protegida: false },
	{ campo: 'etapas', etiqueta: 'Etapa', tipo: 'multiselect', origen: 'columna', orden: 2, visible: true, protegida: false },
	{ campo: 'edades', etiqueta: 'Edades', tipo: 'multiselect', origen: 'columna', orden: 3, visible: true, protegida: false }
];
const facetas = construirFacetas(CONFIG, false);
const preset = (filtros: string): Preset => ({ id: 'p', nombre: 'X', filtros, orden: 0, activo: true });

describe('presets', () => {
	it('va y vuelve entre selección y query string', () => {
		const sel = { tipo: ['Oración'], etapas: ['MIC', 'COM'], edades: [] };
		const cadena = presetDeSeleccion(sel, facetas);
		expect(seleccionDePreset(cadena, facetas)).toEqual(sel);
	});

	it('escribe la cadena en el orden de las facetas, no en el de los clics', () => {
		const a = presetDeSeleccion({ etapas: ['MIC'], tipo: ['Taller'], edades: [] }, facetas);
		const b = presetDeSeleccion({ tipo: ['Taller'], etapas: ['MIC'], edades: [] }, facetas);
		expect(a).toBe(b);
	});

	it('reconoce el preset aunque los valores se hayan marcado en otro orden', () => {
		const p = preset('etapas=MIC%7CCOM');
		expect(esPresetActivo(p, { tipo: [], etapas: ['COM', 'MIC'], edades: [] }, facetas)).toBe(true);
	});

	it('no lo reconoce si sobra o falta un valor', () => {
		const p = preset('etapas=MIC');
		expect(esPresetActivo(p, { tipo: [], etapas: ['MIC', 'COM'], edades: [] }, facetas)).toBe(false);
		expect(esPresetActivo(p, seleccionVacia(facetas), facetas)).toBe(false);
	});

	it('ignora los campos que ya no son faceta al aplicar, y los enseña al describir', () => {
		// una faceta retirada desde /admin/config no puede dejar un filtro que nadie pueda quitar
		const p = preset('etapas=MIC&idioma=es');
		expect(seleccionDePreset(p.filtros, facetas)).toEqual({ tipo: [], etapas: ['MIC'], edades: [] });
		expect(describirFiltros(p.filtros, CONFIG)).toBe('Etapa: MIC · idioma: es');
	});

	it('describe con la etiqueta de la faceta y «o» entre valores', () => {
		expect(describirFiltros('etapas=MIC%7CCOM&edades=1%C2%BA+ESO', CONFIG)).toBe(
			'Etapa: MIC o COM · Edades: 1º ESO'
		);
	});

	it('sugiere como nombre los propios valores elegidos', () => {
		expect(nombreSugerido({ tipo: ['Taller'], etapas: ['COM'], edades: [] }, facetas)).toBe(
			'Taller · COM'
		);
	});
});
