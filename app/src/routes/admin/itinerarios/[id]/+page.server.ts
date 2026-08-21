import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { exigirRol } from '$lib/server/permisos';

const ROLES = ['editor', 'administrador'];

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	const [itinRes, listasRes, recursosRes] = await Promise.all([
		supabase
			.from('itinerario')
			.select(
				`id, nombre, descripcion, etapas, edades, imagen, estado,
				 itinerario_bloque (id, nombre, descripcion, orden,
				   recurso_bloque (orden, recurso:recurso_id (id, nombre, tipo, enlace, formato, etapas, edades)))`
			)
			.eq('id', params.id)
			.maybeSingle(),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		/**
		 * Catálogo ligero para el buscador de «añadir recurso»: solo lo que la fila necesita
		 * pintar. Se trae entero porque el filtrado es en el cliente y así escribir en el
		 * buscador no va al servidor en cada tecla — el mismo trato que se le da al catálogo
		 * público. Si algún día son miles, aquí es donde toca meter búsqueda en servidor.
		 */
		supabase
			.from('recurso')
			.select('id, nombre, tipo, estado, enlace, formato, etapas, edades')
			.order('nombre')
	]);

	if (!itinRes.data) error(404, 'Ese itinerario no existe');

	const it = itinRes.data as any;
	const bloques = [...(it.itinerario_bloque ?? [])]
		.sort((a: any, b: any) => a.orden - b.orden)
		.map((b: any) => ({
			id: b.id,
			nombre: b.nombre,
			descripcion: b.descripcion,
			orden: b.orden,
			recursos: [...(b.recurso_bloque ?? [])]
				.sort((x: any, y: any) => x.orden - y.orden)
				.map((rb: any) => ({ orden: rb.orden, ...rb.recurso }))
				.filter((r: any) => r.id)
		}));

	return {
		itinerario: {
			id: it.id,
			nombre: it.nombre,
			descripcion: it.descripcion,
			etapas: it.etapas ?? [],
			edades: it.edades ?? [],
			imagen: it.imagen,
			estado: it.estado,
			bloques
		},
		listas: listasRes.data ?? [],
		catalogo: recursosRes.data ?? []
	};
};

/** Renumera 0..n-1 una lista de recursos dentro de un bloque, en una sola ida al servidor. */
async function reordenar(
	supabase: App.Locals['supabase'],
	bloqueId: string,
	idsEnOrden: string[]
): Promise<string | null> {
	if (!idsEnOrden.length) return null;
	const filas = idsEnOrden.map((recurso_id, orden) => ({ recurso_id, bloque_id: bloqueId, orden }));
	const { error: err } = await supabase
		.from('recurso_bloque')
		.upsert(filas, { onConflict: 'recurso_id,bloque_id' });
	return err?.message ?? null;
}

export const actions: Actions = {
	/** Los cuatro campos del itinerario, de una vez (SPEC-015 §El editor). */
	guardar: async ({ request, params, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const nombre = String(f.get('nombre') ?? '').trim();
		if (!nombre) return fail(400, { error: 'El nombre no puede quedar vacío' });

		const { error: err } = await locals.supabase
			.from('itinerario')
			.update({
				nombre,
				descripcion: String(f.get('descripcion') ?? '').trim() || null,
				imagen: String(f.get('imagen') ?? '').trim() || null,
				etapas: f.getAll('etapas').map(String).filter(Boolean),
				edades: f.getAll('edades').map(String).filter(Boolean),
				estado: String(f.get('estado') ?? 'borrador') === 'publicado' ? 'publicado' : 'borrador'
			})
			.eq('id', params.id);
		if (err) return fail(500, { error: err.message });
		return { ok: true };
	},

	/** Añadir recursos al final de un bloque, sin pisar el orden de los que ya estaban. */
	anadir: async ({ request, params, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const bloqueId = String(f.get('bloque_id') ?? '');
		const ids = f.getAll('recurso_id').map(String).filter(Boolean);
		if (!bloqueId || !ids.length) return fail(400, { error: 'Falta el recurso' });

		const { data: existentes } = await locals.supabase
			.from('recurso_bloque')
			.select('recurso_id, orden')
			.eq('bloque_id', bloqueId)
			.order('orden');
		const yaEstan = new Set((existentes ?? []).map((r: any) => r.recurso_id));
		const nuevos = ids.filter((id) => !yaEstan.has(id));
		if (!nuevos.length) return { ok: true, repetidos: true };

		const desde = (existentes ?? []).length;
		const { error: err } = await locals.supabase.from('recurso_bloque').insert(
			nuevos.map((recurso_id, i) => ({ recurso_id, bloque_id: bloqueId, orden: desde + i }))
		);
		if (err) return fail(500, { error: err.message });
		return { ok: true, anadidos: nuevos.length };
	},

	quitar: async ({ request, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const bloqueId = String(f.get('bloque_id') ?? '');
		const recursoId = String(f.get('recurso_id') ?? '');
		if (!bloqueId || !recursoId) return fail(400);

		const { error: err } = await locals.supabase
			.from('recurso_bloque')
			.delete()
			.eq('bloque_id', bloqueId)
			.eq('recurso_id', recursoId);
		if (err) return fail(500, { error: err.message });

		// renumerar lo que queda: si no, se van quedando huecos y el «mover» se vuelve raro
		const { data: quedan } = await locals.supabase
			.from('recurso_bloque')
			.select('recurso_id')
			.eq('bloque_id', bloqueId)
			.order('orden');
		const fallo = await reordenar(
			locals.supabase,
			bloqueId,
			(quedan ?? []).map((r: any) => r.recurso_id)
		);
		if (fallo) return fail(500, { error: fallo });
		return { ok: true };
	},

	/** El orden completo del bloque, tal y como lo dejó quien lo movió en pantalla. */
	ordenar: async ({ request, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const bloqueId = String(f.get('bloque_id') ?? '');
		const ids = f.getAll('recurso_id').map(String).filter(Boolean);
		if (!bloqueId) return fail(400);
		const fallo = await reordenar(locals.supabase, bloqueId, ids);
		if (fallo) return fail(500, { error: fallo });
		return { ok: true };
	},

	/** «Partir en tramos»: el primer tramo extra. El bloque implícito recibe título por fin. */
	nuevoBloque: async ({ request, params, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const nombre = String(f.get('nombre') ?? '').trim() || 'Tramo nuevo';

		const { data: bloques } = await locals.supabase
			.from('itinerario_bloque')
			.select('id, orden')
			.eq('itinerario_id', params.id)
			.order('orden');

		const { error: err } = await locals.supabase
			.from('itinerario_bloque')
			.insert({ itinerario_id: params.id, nombre, orden: (bloques ?? []).length });
		if (err) return fail(500, { error: err.message });
		return { ok: true };
	},

	/** Reordenar los tramos entre sí. Sin esto, el orden de los bloques era el de creación. */
	ordenarBloques: async ({ request, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const ids = f.getAll('bloque_id').map(String).filter(Boolean);
		if (!ids.length) return fail(400);
		for (const [orden, id] of ids.entries()) {
			const { error: err } = await locals.supabase
				.from('itinerario_bloque')
				.update({ orden })
				.eq('id', id);
			if (err) return fail(500, { error: err.message });
		}
		return { ok: true };
	},

	bloque: async ({ request, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);
		const { error: err } = await locals.supabase
			.from('itinerario_bloque')
			.update({
				nombre: String(f.get('nombre') ?? '').trim() || null,
				descripcion: String(f.get('descripcion') ?? '').trim() || null
			})
			.eq('id', id);
		if (err) return fail(500, { error: err.message });
		return { ok: true };
	},

	borrarBloque: async ({ request, params, locals }) => {
		await exigirRol(locals, ROLES);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);

		// nunca dejar el itinerario sin ningún bloque: sin él no se puede añadir nada
		const { count } = await locals.supabase
			.from('itinerario_bloque')
			.select('id', { count: 'exact', head: true })
			.eq('itinerario_id', params.id);
		if ((count ?? 0) <= 1) {
			return fail(400, { error: 'Es el único tramo: quita antes sus recursos si quieres vaciarlo' });
		}

		const { error: err } = await locals.supabase.from('itinerario_bloque').delete().eq('id', id);
		if (err) return fail(500, { error: err.message });
		return { ok: true };
	}
};
