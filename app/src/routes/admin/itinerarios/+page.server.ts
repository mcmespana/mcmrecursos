import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { exigirRol } from '$lib/server/permisos';

/** Crear y publicar itinerarios es cosa de editores y administradores (SPEC-015 §decisión 5). */
const ROLES = ['editor', 'administrador'];

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	/**
	 * Con 10-12 itinerarios como techo (SPEC-015 §decisión 4) esto se trae de una vez y se cuenta
	 * en memoria: nada de contadores en BD ni paginación para una pantalla que nunca pasará de
	 * una docena de filas.
	 */
	const { data } = await supabase
		.from('itinerario')
		.select('id, nombre, descripcion, etapas, estado, itinerario_bloque (id, recurso_bloque (recurso_id))')
		.order('nombre');

	return {
		itinerarios: (data ?? []).map((i: any) => ({
			id: i.id,
			nombre: i.nombre,
			descripcion: i.descripcion,
			etapas: i.etapas ?? [],
			estado: i.estado,
			bloques: (i.itinerario_bloque ?? []).length,
			recursos: (i.itinerario_bloque ?? []).reduce(
				(n: number, b: any) => n + (b.recurso_bloque ?? []).length,
				0
			)
		}))
	};
};

export const actions: Actions = {
	/**
	 * Un itinerario nace con su bloque implícito ya puesto.
	 *
	 * Es lo que permite que el editor no mencione nunca la palabra «bloque» en el caso normal
	 * (SPEC-015 §El editor): si al crear no hubiera bloque, la primera pantalla tendría que pedir
	 * uno antes de dejar añadir el primer recurso. Nace sin nombre, así que no se pinta.
	 */
	crear: async ({ request, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const nombre = String(f.get('nombre') ?? '').trim();
		if (!nombre) return fail(400, { error: 'Falta el nombre' });

		const { data: creado, error } = await locals.supabase
			.from('itinerario')
			.insert({ nombre, orden: 0 })
			.select('id')
			.single();
		if (error) return fail(500, { error: error.message });

		const { error: errBloque } = await locals.supabase
			.from('itinerario_bloque')
			.insert({ itinerario_id: creado.id, nombre: null, orden: 0 });
		if (errBloque) return fail(500, { error: errBloque.message });

		return { ok: true, id: creado.id as string };
	},

	borrar: async ({ request, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);
		// bloques y recurso_bloque caen por `on delete cascade` (00002)
		const { error } = await locals.supabase.from('itinerario').delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	}
};
