import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { exigirAdmin, exigirRol } from '$lib/server/permisos';

/**
 * `salud_banco()` es `security invoker`: el conteo de `olvidados` depende de leer
 * `recursos.acceso`, cuya RLS solo deja a editor/administrador (`es_editor()`). Por eso la
 * rejilla de señales solo se pide y se enseña a esos dos roles; `edicion_local` ve solo las
 * tareas del equipo (docs/specs/SPEC-014-salud-tareas.md).
 */
const ROLES_CON_SENALES = ['editor', 'administrador'];

export const load: PageServerLoad = async ({ locals: { supabase, user }, parent }) => {
	const { rolPanel } = await parent();
	const conSenales = ROLES_CON_SENALES.includes(rolPanel as string);

	const [tareasRes, perfilesRes, ajusteRes, saludRes] = await Promise.all([
		supabase
			.from('tarea')
			.select(
				'id, titulo, detalle, estado, prioridad, asignada_a, recurso_id, mcm_local_id, origen, senal, creada_por, created_at, resuelta_por, resuelta_at, recurso:recurso_id (nombre)'
			)
			.order('created_at', { ascending: false }),
		// nombre + avatar de todo el equipo, sin RLS de `perfil` de por medio (ver migración 00022)
		supabase.rpc('perfiles_panel'),
		supabase.from('ajuste').select('valor').eq('clave', 'salud_senales_ocultas').maybeSingle(),
		conSenales ? supabase.rpc('salud_banco') : Promise.resolve({ data: null })
	]);

	const senalesOcultas = (ajusteRes.data?.valor ?? '')
		.split(',')
		.map((s: string) => s.trim())
		.filter(Boolean);

	return {
		miId: user!.id,
		rol: rolPanel,
		conSenales,
		senales: (saludRes.data as Record<string, number> | null) ?? null,
		senalesOcultas,
		perfiles: perfilesRes.data ?? [],
		tareas: (tareasRes.data ?? []).map((t: any) => ({
			...t,
			recurso_nombre: t.recurso?.nombre ?? null
		}))
	};
};

export const actions: Actions = {
	crear: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const titulo = String(f.get('titulo') ?? '').trim();
		if (!titulo) return fail(400, { error: 'Falta el título' });

		const { error } = await locals.supabase
			.from('tarea')
			.insert({ titulo, creada_por: locals.user!.id });
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// Convierte una señal en tarea de un clic. El índice único (00021) evita duplicarla mientras
	// siga abierta; si ya existe, se avisa en vez de fallar en seco.
	apuntarSenal: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const senal = String(f.get('senal') ?? '');
		const titulo = String(f.get('titulo') ?? '').trim();
		if (!senal || !titulo) return fail(400, { error: 'Falta la señal o el título' });

		const { data: existente } = await locals.supabase
			.from('tarea')
			.select('id')
			.eq('senal', senal)
			.eq('estado', 'abierta')
			.maybeSingle();
		if (existente) return { ok: true, yaExistia: true };

		const { error } = await locals.supabase
			.from('tarea')
			.insert({ titulo, origen: 'salud', senal, creada_por: locals.user!.id });
		// carrera con otra pestaña pulsando a la vez: el índice único ya lo impidió, no es un fallo
		if (error && error.code !== '23505') return fail(500, { error: error.message });
		return { ok: true, yaExistia: error?.code === '23505' };
	},

	estado: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const estado = String(f.get('estado') ?? '');
		if (!id || !['abierta', 'hecha', 'descartada'].includes(estado)) return fail(400);

		const cambios: Record<string, unknown> = { estado };
		if (estado === 'abierta') {
			cambios.resuelta_por = null;
			cambios.resuelta_at = null;
		} else {
			cambios.resuelta_por = locals.user!.id;
			cambios.resuelta_at = new Date().toISOString();
		}
		const { error } = await locals.supabase.from('tarea').update(cambios).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	titulo: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const titulo = String(f.get('titulo') ?? '').trim();
		if (!id || !titulo) return fail(400, { error: 'Falta el título' });
		const { error } = await locals.supabase.from('tarea').update({ titulo }).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	prioridad: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const prioridad = String(f.get('prioridad') ?? '');
		if (!id || !['alta', 'normal', 'baja'].includes(prioridad)) return fail(400);
		const { error } = await locals.supabase.from('tarea').update({ prioridad }).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	asignar: async ({ request, locals }) => {
		await exigirRol(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);
		const asignada_a = String(f.get('asignada_a') ?? '').trim() || null;
		const { error } = await locals.supabase.from('tarea').update({ asignada_a }).eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// Silenciar una señal sin que abulte (SPEC-014): una fila más en `ajuste`, nada de tabla nueva.
	ocultarSenal: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const senal = String(f.get('senal') ?? '');
		const mostrar = String(f.get('mostrar') ?? '') === 'true';
		if (!senal) return fail(400);

		const { data: actual } = await locals.supabase
			.from('ajuste')
			.select('valor')
			.eq('clave', 'salud_senales_ocultas')
			.maybeSingle();
		const lista = new Set(
			(actual?.valor ?? '')
				.split(',')
				.map((s: string) => s.trim())
				.filter(Boolean)
		);
		if (mostrar) lista.delete(senal);
		else lista.add(senal);

		const { error } = await locals.supabase.from('ajuste').upsert({
			clave: 'salud_senales_ocultas',
			valor: [...lista].join(','),
			descripcion: 'Señales de /admin/salud ocultas a propósito (separadas por comas).',
			updated_at: new Date().toISOString(),
			updated_by: locals.user!.id
		});
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	}
};
