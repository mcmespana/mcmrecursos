import { describe, it, expect } from 'vitest';
import { resolverVersiones, mapaAVigente } from './cargar';
import type { RecursoCatalogo } from './tipos';

/** Recurso de mentira con todos los campos obligatorios rellenos de valores neutros. */
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

describe('resolverVersiones', () => {
	it('cadena simple: la versión publicada más nueva queda vigente', () => {
		const r1 = unRecurso({ id: 'R1' });
		const r2 = unRecurso({ id: 'R2', version_de: 'R1' });
		resolverVersiones([r1, r2]);

		expect(r1.es_vigente).toBe(false);
		expect(r1.reemplazado_por).toBe('R2');
		expect(r2.es_vigente).toBe(true);
		expect(r2.versiones_anteriores).toEqual(['R1']);
	});

	it('agrega los sociales del linaje con media ponderada sobre la cabeza', () => {
		const r1 = unRecurso({
			id: 'R1',
			valoracion_media: 5,
			num_valoraciones: 1,
			num_favoritos: 2,
			num_usos: 3,
			num_accesos: 4
		});
		const r2 = unRecurso({
			id: 'R2',
			version_de: 'R1',
			valoracion_media: 3,
			num_valoraciones: 3,
			num_favoritos: 10,
			num_usos: 20,
			num_accesos: 30
		});
		resolverVersiones([r1, r2]);

		// (5*1 + 3*3) / 4 = 3.5
		expect(r2.num_valoraciones).toBe(4);
		expect(r2.valoracion_media).toBe(3.5);
		expect(r2.num_favoritos).toBe(12);
		expect(r2.num_usos).toBe(23);
		expect(r2.num_accesos).toBe(34);
	});

	it('un borrador no sucede a su predecesor', () => {
		const r1 = unRecurso({ id: 'R1' });
		const r2 = unRecurso({ id: 'R2', version_de: 'R1', estado: 'borrador' });
		resolverVersiones([r1, r2]);

		expect(r1.es_vigente).toBe(true);
		expect(r1.reemplazado_por).toBeNull();
	});

	it('cadena de tres: solo la cabeza queda vigente y hereda todo el linaje', () => {
		const r1 = unRecurso({ id: 'R1', num_favoritos: 1 });
		const r2 = unRecurso({ id: 'R2', version_de: 'R1', num_favoritos: 10 });
		const r3 = unRecurso({ id: 'R3', version_de: 'R2', num_favoritos: 100 });
		resolverVersiones([r1, r2, r3]);

		expect(r1.es_vigente).toBe(false);
		expect(r2.es_vigente).toBe(false);
		expect(r3.es_vigente).toBe(true);
		expect(r3.versiones_anteriores.sort()).toEqual(['R1', 'R2']);
		expect(r3.num_favoritos).toBe(111);
	});

	it('version_de colgando (apunta a un id que no existe) no revienta', () => {
		const r1 = unRecurso({ id: 'R1', version_de: 'RX' });
		expect(() => resolverVersiones([r1])).not.toThrow();
		expect(r1.es_vigente).toBe(true);
	});

	it('un ciclo de version_de termina sin colgarse', () => {
		const r1 = unRecurso({ id: 'R1', version_de: 'R2' });
		const r2 = unRecurso({ id: 'R2', version_de: 'R1' });
		expect(() => resolverVersiones([r1, r2])).not.toThrow();
	});
});

describe('mapaAVigente', () => {
	it('sube de una versión antigua a la vigente', () => {
		const r1 = unRecurso({ id: 'R1' });
		const r2 = unRecurso({ id: 'R2', version_de: 'R1' });
		resolverVersiones([r1, r2]);

		const aVigente = mapaAVigente([r1, r2]);
		expect(aVigente('R1')).toBe('R2');
		expect(aVigente('R2')).toBe('R2');
	});

	it('un id desconocido se devuelve tal cual', () => {
		const aVigente = mapaAVigente([unRecurso({ id: 'R1' })]);
		expect(aVigente('RX')).toBe('RX');
	});

	it('con un ciclo, termina y no se cuelga', () => {
		const r1 = unRecurso({ id: 'R1', version_de: 'R2' });
		const r2 = unRecurso({ id: 'R2', version_de: 'R1' });
		resolverVersiones([r1, r2]);
		const aVigente = mapaAVigente([r1, r2]);
		expect(() => aVigente('R1')).not.toThrow();
	});
});
