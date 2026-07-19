import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const ROLES = ['consulta', 'edicion_local', 'editor', 'administrador', 'consulta_externa'];
const ORIGENES_FACETA = ['columna', 'extra', 'tag', 'autor', 'mcm_local'];
const TIPOS_FACETA = ['multiselect', 'select', 'boolean', 'rango'];

async function exigirAdmin(locals: App.Locals) {
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user!.id)
		.maybeSingle();
	if (data?.rol !== 'administrador') redirect(303, '/admin');
}

const slugify = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '');

export const load: PageServerLoad = async ({ locals }) => {
	await exigirAdmin(locals);
	const [listasRes, facetasRes, mcmRes, accesosRes] = await Promise.all([
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
			.order('email')
	]);
	return {
		listas: listasRes.data ?? [],
		facetas: facetasRes.data ?? [],
		mcmLocales: mcmRes.data ?? [],
		accesos: (accesosRes.data ?? []).map((a: any) => ({
			...a,
			mcm_local: a.mcm_local?.nombre ?? null
		})),
		roles: ROLES
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
