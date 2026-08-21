import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { iaDisponible } from '$lib/server/ia';
import { embeddingsDisponibles } from '$lib/server/embeddings';
import { forzadoPorEntorno, funcionActiva, limpiarCacheAjustes } from '$lib/server/ajustes';
import { exigirAdmin, exigirAdminEnPagina } from '$lib/server/permisos';

const ROLES = ['consulta', 'edicion_local', 'editor', 'administrador', 'consulta_externa'];
const ORIGENES_FACETA = ['columna', 'extra', 'tag', 'autor', 'mcm_local'];
const TIPOS_FACETA = ['multiselect', 'select', 'boolean', 'rango'];

/** Funciones que se pueden apagar desde aquí (tabla `ajuste`). */
const AJUSTES = ['descubre_ia'];

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

export const load: PageServerLoad = async ({ locals }) => {
	await exigirAdminEnPagina(locals);
	const [listasRes, facetasRes, mcmRes, accesosRes, presetsRes] = await Promise.all([
		locals.supabase
			.from('lista_valor')
			.select('id, lista, valor, grupo, orden, activo')
			.order('lista')
			.order('orden'),
		locals.supabase
			.from('faceta')
			.select('id, campo, etiqueta, tipo, origen, orden, visible, protegida')
			.order('orden'),
		locals.supabase.from('mcm_local').select('id, nombre, slug, activo').order('nombre'),
		locals.supabase
			.from('acceso_previo')
			.select('email, rol, mcm_local_id, created_at, mcm_local:mcm_local_id (nombre)')
			.order('email'),
		// Aquí SÍ salen los desactivados: esta es la pantalla donde se vuelven a encender.
		locals.supabase
			.from('preset')
			.select('id, nombre, filtros, orden, activo')
			.order('orden')
			.order('nombre')
	]);
	return {
		listas: listasRes.data ?? [],
		facetas: facetasRes.data ?? [],
		mcmLocales: mcmRes.data ?? [],
		presets: presetsRes.data ?? [],
		accesos: (accesosRes.data ?? []).map((a: any) => ({
			...a,
			mcm_local: a.mcm_local?.nombre ?? null
		})),
		roles: ROLES,
		// estado de las funciones apagables + si sus claves están puestas (solo el sí/no,
		// nunca el valor de la clave)
		funciones: {
			descubreIa: await funcionActiva(locals.supabase, 'descubre_ia', {
				variableEntorno: 'DESCUBRE_IA'
			}),
			descubreIaForzado: forzadoPorEntorno('DESCUBRE_IA'),
			gemini: iaDisponible(),
			voyage: embeddingsDisponibles()
		}
	};
};

export const actions: Actions = {
	// --- Listas cerradas (lista_valor) ---
	listaGuardar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const lista = String(f.get('lista') ?? '').trim();
		const valor = String(f.get('valor') ?? '').trim();
		const grupo = String(f.get('grupo') ?? '').trim() || null;
		const orden = Number(f.get('orden') ?? 0) || 0;
		if (!valor) return fail(400, { error: 'El valor es obligatorio' });

		const { error } = id
			? await locals.supabase.from('lista_valor').update({ valor, grupo, orden }).eq('id', id)
			: await locals.supabase.from('lista_valor').insert({ lista, valor, grupo, orden });
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},
	listaActivo: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const { error } = await locals.supabase
			.from('lista_valor')
			.update({ activo: String(f.get('activo')) === 'true' })
			.eq('id', String(f.get('id') ?? ''));
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// --- Facetas del buscador ---
	facetaGuardar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const etiqueta = String(f.get('etiqueta') ?? '').trim();
		const orden = Number(f.get('orden') ?? 0) || 0;
		if (!etiqueta) return fail(400, { error: 'La etiqueta es obligatoria' });

		if (id) {
			const { error } = await locals.supabase
				.from('faceta')
				.update({ etiqueta, orden })
				.eq('id', id);
			if (error) return fail(500, { error: error.message });
			return { ok: true };
		}

		const campo = String(f.get('campo') ?? '').trim();
		const origen = String(f.get('origen') ?? 'columna');
		const tipo = String(f.get('tipo') ?? 'multiselect');
		if (!/^[a-z_][a-z0-9_]*$/.test(campo)) {
			return fail(400, { error: 'Campo inválido: minúsculas, números y _ (p. ej. curso_usado)' });
		}
		if (!ORIGENES_FACETA.includes(origen) || !TIPOS_FACETA.includes(tipo)) return fail(400);
		const { error } = await locals.supabase
			.from('faceta')
			.insert({ campo, etiqueta, origen, tipo, orden });
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},
	facetaFlag: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const campo = String(f.get('campo') ?? '');
		if (campo !== 'visible' && campo !== 'protegida') return fail(400);
		const { error } = await locals.supabase
			.from('faceta')
			.update({ [campo]: String(f.get('valor')) === 'true' })
			.eq('id', String(f.get('id') ?? ''));
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// --- MCM locales ---
	mcmGuardar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const nombre = String(f.get('nombre') ?? '').trim();
		if (!nombre) return fail(400, { error: 'El nombre es obligatorio' });

		const { error } = id
			? await locals.supabase.from('mcm_local').update({ nombre }).eq('id', id)
			: await locals.supabase.from('mcm_local').insert({ nombre, slug: slugify(nombre) });
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},
	mcmActivo: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const { error } = await locals.supabase
			.from('mcm_local')
			.update({ activo: String(f.get('activo')) === 'true' })
			.eq('id', String(f.get('id') ?? ''));
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// --- Interruptores de funciones (ajuste) ---
	ajusteFlag: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const clave = String(f.get('clave') ?? '');
		if (!AJUSTES.includes(clave)) return fail(400, { error: 'Ese ajuste no existe' });

		const { error } = await locals.supabase.from('ajuste').upsert({
			clave,
			valor: String(f.get('valor')) === 'true' ? 'on' : 'off',
			updated_at: new Date().toISOString(),
			updated_by: locals.user!.id
		});
		if (error) return fail(500, { error: error.message });

		// esta instancia se entera ya; las demás, al caducar su caché (segundos)
		limpiarCacheAjustes(clave);
		return { ok: true };
	},

	// --- Presets del buscador y de Descubre (migración 00029) ---
	//
	// Solo nombre, orden y activo: los filtros que lleva dentro NO se editan a mano aquí. Se
	// cambian donde se ven —abriendo el preset en el buscador, tocando facetas y volviendo a
	// guardarlo—, que es donde se sabe cuántos recursos deja. Un campo de texto para escribir
	// `etapas=MIC|COM` sería la forma más rápida de dejar un chip que no encuentra nada.
	presetGuardar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		const nombre = String(f.get('nombre') ?? '').trim();
		if (!id) return fail(400);
		if (!nombre) return fail(400, { error: 'El nombre es obligatorio' });
		const { error } = await locals.supabase
			.from('preset')
			.update({ nombre, orden: Number(f.get('orden') ?? 0) || 0 })
			.eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},
	presetActivo: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const { error } = await locals.supabase
			.from('preset')
			.update({ activo: String(f.get('activo')) === 'true' })
			.eq('id', String(f.get('id') ?? ''));
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},
	presetBorrar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const id = String(f.get('id') ?? '');
		if (!id) return fail(400);
		const { error } = await locals.supabase.from('preset').delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	},

	// --- Accesos preautorizados (acceso_previo) ---
	accesoGuardar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const email = String(f.get('email') ?? '')
			.trim()
			.toLowerCase();
		const rol = String(f.get('rol') ?? '');
		const mcmLocalId = String(f.get('mcm_local_id') ?? '') || null;
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, { error: 'Email inválido' });
		if (!ROLES.includes(rol)) return fail(400, { error: 'Rol inválido' });

		// mismo guard que /admin/usuarios: un admin no puede degradarse a sí mismo
		if (email === locals.user!.email?.toLowerCase() && rol !== 'administrador') {
			return fail(400, { error: 'No puedes quitarte a ti mismo el rol de administrador' });
		}

		const { error } = await locals.supabase
			.from('acceso_previo')
			.upsert({ email, rol, mcm_local_id: mcmLocalId });
		if (error) return fail(500, { error: error.message });

		// si el perfil ya existe, se aplica al momento (como hizo la migración 00010)
		const { data: perfil } = await locals.supabase
			.from('perfil')
			.select('id, mcm_local_id')
			.eq('email', email)
			.maybeSingle();
		if (perfil) {
			const { error: e2 } = await locals.supabase
				.from('perfil')
				.update({ rol, mcm_local_id: mcmLocalId ?? perfil.mcm_local_id })
				.eq('id', perfil.id);
			if (e2) return fail(500, { error: `Preautorizado, pero no se aplicó al perfil: ${e2.message}` });
			return { ok: true, aplicado: true };
		}
		return { ok: true, aplicado: false };
	},
	accesoBorrar: async ({ request, locals }) => {
		await exigirAdmin(locals);
		const f = await request.formData();
		const email = String(f.get('email') ?? '');
		if (email === locals.user!.email?.toLowerCase()) {
			return fail(400, { error: 'No puedes borrar tu propio acceso' });
		}
		const { error } = await locals.supabase.from('acceso_previo').delete().eq('email', email);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	}
};
