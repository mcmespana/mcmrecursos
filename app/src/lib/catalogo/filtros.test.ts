import { describe, it, expect } from 'vitest';
import { filtrar, contar, construirFacetas, normalizarConsulta, relacionar, FACETAS } from './filtros';
import type { FacetaConfig } from './filtros';
import type { RecursoCatalogo } from './tipos';

function unRecurso(parcial: Partial<RecursoCatalogo> & { id: string }): RecursoCatalogo {
	return {
		nombre: parcial.id,
		descripcion: null,
		tipo: null,
		etapas: [],
		nivel: null,
		edades: [],
		mcm_local: null,
		idioma: null,
		soporte: null,
		ubicacion: null,
		enlace: null,
		formato: null,
		archivos: [],
		imagen: null,
		anyo_publicacion: null,
		curso_usado: null,
		visibilidad: 'publico',
		estado: 'publicado',
		fuera_del_banco: false,
	es_demo: false,
		pendiente_clasificar: false,
		tags: [],
		autores: [],
		relacionados: [],
		valoracion_media: null,
		num_valoraciones: 0,
		num_favoritos: 0,
		num_usos: 0,
		num_accesos: 0,
		version_de: null,
		reemplazado_por: null,
		es_vigente: true,
		versiones_anteriores: [],
		...parcial
	};
}

const facetaTipo = FACETAS.find((f) => f.campo === 'tipo')!;
const facetaEtapas = FACETAS.find((f) => f.campo === 'etapas')!;

describe('normalizarConsulta', () => {
	it('quita acentos, baja a minúsculas y recorta espacios', () => {
		expect(normalizarConsulta('  Oración de la MAÑANA  ')).toBe('oracion de la manana');
	});

	it('cadena vacía da cadena vacía', () => {
		expect(normalizarConsulta('   ')).toBe('');
	});
});

describe('filtrar', () => {
	const r1 = unRecurso({ id: 'R1', tipo: 'Taller', etapas: ['Infantil'] });
	const r2 = unRecurso({ id: 'R2', tipo: 'Oración', etapas: ['Infantil', 'Juvenil'] });
	const r3 = unRecurso({ id: 'R3', tipo: 'Taller', etapas: ['Juvenil'] });
	const recursos = [r1, r2, r3];

	it('sin selección ninguna, devuelve todo', () => {
		expect(filtrar(recursos, [facetaTipo], {}, null)).toEqual(recursos);
	});

	it('una faceta con un valor filtra por ese valor', () => {
		expect(filtrar(recursos, [facetaTipo], { tipo: ['Taller'] }, null)).toEqual([r1, r3]);
	});

	it('dentro de una faceta, varios valores seleccionados son OR', () => {
		expect(filtrar(recursos, [facetaTipo], { tipo: ['Taller', 'Oración'] }, null)).toEqual(recursos);
	});

	it('entre dos facetas distintas es AND', () => {
		const resultado = filtrar(
			recursos,
			[facetaTipo, facetaEtapas],
			{ tipo: ['Taller'], etapas: ['Juvenil'] },
			null
		);
		expect(resultado).toEqual([r3]);
	});

	it('una selección que no casa con nada da lista vacía', () => {
		expect(filtrar(recursos, [facetaTipo], { tipo: ['No existe'] }, null)).toEqual([]);
	});

	it('idsTexto acota a un conjunto de ids (resultado de la búsqueda)', () => {
		expect(filtrar(recursos, [], {}, new Set(['R1', 'R3']))).toEqual([r1, r3]);
	});

	it('el campo "excepto" se ignora al filtrar (para contar sin autoexcluirse)', () => {
		const resultado = filtrar(recursos, [facetaTipo], { tipo: ['Taller'] }, null, 'tipo');
		expect(resultado).toEqual(recursos);
	});
});

describe('contar', () => {
	it('cuenta cuántos recursos tienen cada valor de la faceta', () => {
		const recursos = [
			unRecurso({ id: 'R1', tipo: 'Taller' }),
			unRecurso({ id: 'R2', tipo: 'Taller' }),
			unRecurso({ id: 'R3', tipo: 'Oración' })
		];
		const counts = contar(recursos, facetaTipo);
		expect(counts.get('Taller')).toBe(2);
		expect(counts.get('Oración')).toBe(1);
	});

	it('un recurso sin valor para la faceta no cuenta en ninguna', () => {
		const counts = contar([unRecurso({ id: 'R1', tipo: null })], facetaTipo);
		expect(counts.size).toBe(0);
	});
});

describe('construirFacetas', () => {
	const config: FacetaConfig[] = [
		{ campo: 'tipo', etiqueta: 'Tipo', tipo: 'multiselect', origen: 'columna', orden: 1, visible: true, protegida: false },
		{ campo: 'mcm_local', etiqueta: 'MCM Local', tipo: 'multiselect', origen: 'columna', orden: 2, visible: true, protegida: true },
		{ campo: 'oculta', etiqueta: 'Oculta', tipo: 'multiselect', origen: 'columna', orden: 3, visible: false, protegida: false }
	];

	it('sin configuración, cae al respaldo FACETAS', () => {
		const facetas = construirFacetas([], true);
		expect(facetas.map((f) => f.campo)).toEqual(FACETAS.map((f) => f.campo));
	});

	it('deja fuera lo no visible', () => {
		const facetas = construirFacetas(config, true);
		expect(facetas.find((f) => f.campo === 'oculta')).toBeUndefined();
	});

	it('sin sesión, deja fuera lo protegido', () => {
		const facetas = construirFacetas(config, false);
		expect(facetas.map((f) => f.campo)).toEqual(['tipo']);
	});

	it('con sesión, lo protegido sí aparece', () => {
		const facetas = construirFacetas(config, true);
		expect(facetas.map((f) => f.campo)).toContain('mcm_local');
	});
});

describe('relacionar', () => {
	it('puntúa por tags compartidos, tipo igual y etapas comunes, de mayor a menor', () => {
		const base = unRecurso({ id: 'R1', tags: ['adviento', 'oracion'], tipo: 'Taller', etapas: ['Infantil'] });
		const mismoTagYtipo = unRecurso({ id: 'R2', tags: ['adviento'], tipo: 'Taller', etapas: [] }); // 3+2=5
		const soloEtapa = unRecurso({ id: 'R3', tags: [], tipo: 'Oración', etapas: ['Infantil'] }); // 1
		const sinNada = unRecurso({ id: 'R4', tags: ['otracosa'], tipo: 'Oración', etapas: ['Adultos'] }); // 0

		const resultado = relacionar(base, [mismoTagYtipo, soloEtapa, sinNada]);
		expect(resultado).toEqual([mismoTagYtipo, soloEtapa]);
	});

	it('excluye el propio recurso y su linaje de versiones', () => {
		const base = unRecurso({
			id: 'R2',
			tags: ['adviento'],
			version_de: 'R1',
			versiones_anteriores: ['R1']
		});
		const anterior = unRecurso({ id: 'R1', tags: ['adviento'] });
		const otro = unRecurso({ id: 'R3', tags: ['adviento'] });

		const resultado = relacionar(base, [base, anterior, otro]);
		expect(resultado).toEqual([otro]);
	});

	it('respeta el límite', () => {
		const base = unRecurso({ id: 'R0', tags: ['x'] });
		const candidatos = Array.from({ length: 10 }, (_, i) => unRecurso({ id: `R${i + 1}`, tags: ['x'] }));
		expect(relacionar(base, candidatos, 3)).toHaveLength(3);
	});

	it('sin ningún candidato con puntuación, devuelve vacío', () => {
		const base = unRecurso({ id: 'R1', tags: ['x'] });
		const candidatos = [unRecurso({ id: 'R2', tags: ['y'] })];
		expect(relacionar(base, candidatos)).toEqual([]);
	});
});
