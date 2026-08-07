import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guardarTags, guardarArchivos, guardarRelacionados } from './recursos';

type Cliente = SupabaseClient<any, 'recursos'>;
type Respuesta = { data?: any; error?: { message: string } | null };

/**
 * Doble mínimo del cliente de Supabase: cada `await supabase.from(tabla)....` consume,
 * en orden, la siguiente respuesta de `respuestas`. Registra en `llamadas` el primer método
 * de cada cadena (delete/select/upsert/insert) con su tabla, para comprobar qué se llegó
 * a llamar y qué no.
 */
function clienteFalso(respuestas: Respuesta[]) {
	let i = 0;
	const llamadas: string[] = [];
	function from(tabla: string) {
		const chain: any = {
			delete: () => (llamadas.push(`${tabla}.delete`), chain),
			select: () => (llamadas.push(`${tabla}.select`), chain),
			upsert: () => (llamadas.push(`${tabla}.upsert`), chain),
			insert: () => (llamadas.push(`${tabla}.insert`), chain),
			eq: () => chain,
			maybeSingle: () => chain,
			then: (resolve: (r: Respuesta) => void) => resolve(respuestas[i++] ?? { data: null, error: null })
		};
		return chain;
	}
	return { cliente: { from } as unknown as Cliente, llamadas };
}

describe('guardarTags', () => {
	it('todo bien: borra, crea la temática y enlaza, devuelve null', async () => {
		const { cliente, llamadas } = clienteFalso([
			{ data: [] }, // tag.select (existentes)
			{ error: null }, // recurso_tag.delete
			{ error: null }, // tag.upsert
			{ data: { id: 't1' }, error: null }, // tag.select ... maybeSingle
			{ error: null } // recurso_tag.insert
		]);
		const fallo = await guardarTags(cliente, 'R1', 'Adviento');
		expect(fallo).toBeNull();
		expect(llamadas).toEqual(['tag.select', 'recurso_tag.delete', 'tag.upsert', 'tag.select', 'recurso_tag.insert']);
	});

	it('si el delete de recurso_tag falla, devuelve el mensaje y no sigue insertando', async () => {
		const { cliente, llamadas } = clienteFalso([
			{ data: [] },
			{ error: { message: 'boom-delete' } }
		]);
		const fallo = await guardarTags(cliente, 'R1', 'Adviento');
		expect(fallo).toBe('boom-delete');
		expect(llamadas).not.toContain('tag.upsert');
	});

	it('si el insert de recurso_tag falla, devuelve ese mensaje', async () => {
		const { cliente } = clienteFalso([
			{ data: [] },
			{ error: null },
			{ error: null },
			{ data: { id: 't1' }, error: null },
			{ error: { message: 'boom-insert' } }
		]);
		const fallo = await guardarTags(cliente, 'R1', 'Adviento');
		expect(fallo).toBe('boom-insert');
	});

	it('si no se encuentra el id de la temática recién creada, el mensaje la menciona', async () => {
		const { cliente } = clienteFalso([
			{ data: [] },
			{ error: null },
			{ error: null },
			{ data: null, error: null } // maybeSingle no encuentra nada
		]);
		const fallo = await guardarTags(cliente, 'R1', 'Adviento');
		expect(fallo).toContain('Adviento');
	});
});

describe('guardarArchivos', () => {
	it('si el delete falla, devuelve el mensaje y no llega a insertar', async () => {
		const { cliente, llamadas } = clienteFalso([{ error: { message: 'boom-archivo-delete' } }]);
		const fallo = await guardarArchivos(cliente, 'R1', [], []);
		expect(fallo).toBe('boom-archivo-delete');
		expect(llamadas).toEqual(['recurso_archivo.delete']);
	});

	it('sin enlaces, borra pero no inserta y devuelve null', async () => {
		const { cliente, llamadas } = clienteFalso([{ error: null }]);
		const fallo = await guardarArchivos(cliente, 'R1', [], []);
		expect(fallo).toBeNull();
		expect(llamadas).toEqual(['recurso_archivo.delete']);
	});
});

describe('guardarRelacionados', () => {
	it('si guardarTags falla, no llega a llamar a guardarArchivos', async () => {
		const { cliente, llamadas } = clienteFalso([
			{ data: [] }, // tag.select
			{ error: { message: 'boom' } } // recurso_tag.delete falla
		]);
		const f = new FormData();
		f.append('tags', 'Adviento');

		const fallo = await guardarRelacionados(cliente, 'R1', f);
		expect(fallo).toBe('boom');
		expect(llamadas).not.toContain('recurso_archivo.delete');
	});
});
