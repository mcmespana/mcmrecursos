import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { exigirRol } from '$lib/server/permisos';

/**
 * `/admin/comunidad` — lo que llega de fuera (SPEC-017 §4).
 *
 * Dos bandejas en una pantalla porque son la misma pregunta: qué está diciendo la gente que
 * entra. La lista de espera solo la ven editores y administradores (son correos ajenos, y la
 * RLS de `espera` ya lo impone); las sugerencias también las ve quien tiene edición local,
 * porque muchas van a ser sobre recursos de su MCM.
 */

const ESTADOS = ['nueva', 'vista', 'resuelta', 'descartada'];

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(303, '/');
	const rol = await exigirRol(locals);
	const veEspera = rol === 'editor' || rol === 'administrador';

	const [esperaRes, sugerenciasRes] = await Promise.all([
		veEspera
			? locals.supabase
					.from('espera')
					.select('id, email, nombre, quiere_ayudar, ayudas, mensaje, origen, contactado_at, notas, created_at')
					.order('created_at', { ascending: false })
			: Promise.resolve({ data: [] as any[] }),
		locals.supabase
			.from('sugerencia')
			.select('id, tipo, mensaje, email, ruta, estado, tarea_id, created_at')
			.order('created_at', { ascending: false })
			.limit(300)
	]);

	return {
		rolPanel: rol,
		veEspera,
		espera: esperaRes.data ?? [],
		sugerencias: sugerenciasRes.data ?? []
	};
};

export const actions: Actions = {
	/** Marcar/desmarcar «ya le he escrito». El envío del aviso se hace por fuera, a mano. */
	contactado: async ({ request, locals }) => {
		await exigirRol(locals, ['editor', 'administrador']);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400, { error: 'Falta el id' });
		const marcar = f.get('valor') === 'true';
		const { error: e } = await locals.supabase
			.from('espera')
			.update({ contactado_at: marcar ? new Date().toISOString() : null })
			.eq('id', id);
		if (e) return fail(500, { error: e.message });
		return { ok: true };
	},

	estado: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const estado = String(f.get('estado') ?? '');
		if (!id || !ESTADOS.includes(estado)) return fail(400, { error: 'Estado inválido' });
		const { error: e } = await locals.supabase
			.from('sugerencia')
			.update({ estado })
			.eq('id', id);
		if (e) return fail(500, { error: e.message });
		return { ok: true };
	},

	/**
	 * Convertir una sugerencia en tarea del equipo (SPEC-016). Lo hace la función de BD, que es
	 * quien sabe cómo se titula una tarea y de dónde sale su prioridad.
	 */
	aTarea: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400, { error: 'Falta el id' });
		const { data, error: e } = await locals.supabase.rpc('sugerencia_a_tarea', {
			sugerencia_id: id
		});
		if (e) return fail(500, { error: e.message });
		return { ok: true, tareaId: data };
	},

	/** Descarga de los correos, para el envío masivo que se hace fuera de la app. */
	exportar: async ({ locals }) => {
		const rol = await exigirRol(locals, ['editor', 'administrador']);
		if (!rol) error(403, 'Sin permiso');
		const { data } = await locals.supabase
			.from('espera')
			.select('email, nombre, quiere_ayudar, ayudas, created_at')
			.order('created_at');
		return { ok: true, csv: aCsv(data ?? []) };
	}
};

/** CSV mínimo y con comillas: los nombres traen comas, y una lista rota no sirve de nada. */
function aCsv(filas: Record<string, unknown>[]): string {
	const cols = ['email', 'nombre', 'quiere_ayudar', 'ayudas', 'created_at'];
	const escapar = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
	return [
		cols.join(','),
		...filas.map((f) => cols.map((c) => escapar(Array.isArray(f[c]) ? (f[c] as string[]).join(' ') : f[c])).join(','))
	].join('\n');
}
