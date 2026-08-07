import { describe, it, expect } from 'vitest';
import { sanear } from './recomendar';
import type { CandidatoRecomendacion, VocabulariosRecomendacion } from './recomendar';

const candidatos: CandidatoRecomendacion[] = [
	{ id: 'R1', nombre: 'Uno', descripcion: null, tipo: null, etapas: [], edades: [], nivel: null, tags: [] },
	{ id: 'R2', nombre: 'Dos', descripcion: null, tipo: null, etapas: [], edades: [], nivel: null, tags: [] }
];

const vocab: VocabulariosRecomendacion = {
	etapas: ['Infantil', 'Juvenil'],
	edades: ['6-8', '9-11'],
	tipos: ['Taller', 'Oración']
};

describe('sanear', () => {
	it('descarta ids que no están entre los candidatos', () => {
		const salida = sanear(
			{ recomendaciones: [{ id: 'R1', motivo: 'bien' }, { id: 'RX', motivo: 'inventado' }] },
			candidatos,
			vocab
		);
		expect(salida.recomendaciones.map((r) => r.id)).toEqual(['R1']);
	});

	it('descarta ids repetidos, quedándose con la primera aparición', () => {
		const salida = sanear(
			{
				recomendaciones: [
					{ id: 'R1', motivo: 'primera' },
					{ id: 'R1', motivo: 'repetida' },
					{ id: 'R2', motivo: 'otra' }
				]
			},
			candidatos,
			vocab
		);
		expect(salida.recomendaciones.map((r) => r.id)).toEqual(['R1', 'R2']);
		expect(salida.recomendaciones[0].motivo).toBe('primera');
	});

	it('recorta el motivo a 140 caracteres con puntos suspensivos', () => {
		const largo = 'x'.repeat(200);
		const salida = sanear({ recomendaciones: [{ id: 'R1', motivo: largo }] }, candidatos, vocab);
		expect(salida.recomendaciones[0].motivo).toHaveLength(140);
		expect(salida.recomendaciones[0].motivo.endsWith('…')).toBe(true);
	});

	it('corta la lista a un máximo de 15', () => {
		const veinte = Array.from({ length: 20 }, (_, i) => ({
			id: 'R1',
			motivo: `motivo ${i}`
		}));
		// usamos un solo candidato válido repetido: lo que importa aquí es el tope de 15,
		// no el dedup (ese va en su propio test)
		const salida = sanear({ recomendaciones: veinte }, candidatos, vocab);
		expect(salida.recomendaciones.length).toBeLessThanOrEqual(15);
	});

	it('solo deja pasar valores de etapas/edades/tipos que están en el vocabulario', () => {
		const salida = sanear(
			{ recomendaciones: [], etapas: ['Infantil', 'Universitaria'], edades: ['6-8'], tipos: ['Nada'] },
			candidatos,
			vocab
		);
		expect(salida.interpretacion.etapas).toEqual(['Infantil']);
		expect(salida.interpretacion.edades).toEqual(['6-8']);
		expect(salida.interpretacion.tipos).toEqual([]);
	});

	it('resumen vacío o solo espacios se convierte en null; uno largo se recorta a 160', () => {
		expect(sanear({ recomendaciones: [], resumen: '   ' }, candidatos, vocab).interpretacion.resumen).toBeNull();
		const largo = 'y'.repeat(300);
		const salida = sanear({ recomendaciones: [], resumen: largo }, candidatos, vocab);
		expect(salida.interpretacion.resumen).toHaveLength(160);
	});

	it('entrada basura no revienta y devuelve listas vacías', () => {
		expect(() => sanear(null, candidatos, vocab)).not.toThrow();
		expect(sanear(null, candidatos, vocab).recomendaciones).toEqual([]);
		expect(sanear({}, candidatos, vocab).recomendaciones).toEqual([]);
		expect(sanear({ recomendaciones: 'no soy un array' }, candidatos, vocab).recomendaciones).toEqual([]);
	});
});
