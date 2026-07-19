import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { emailEnvioDevuelto, emailEnvioPublicado } from '$lib/server/email';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [enviosRes, listasRes, mcmRes] = await Promise.all([
		supabase
			.from('envio')
			.select('id, titulo, enlace, notas, estado, motivo_ia, perfil_id, mcm_local_id, created_at')
			.in('estado', ['enviado', 'en_revision', 'revisar_ia'])
			.order('created_at'),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('mcm_local').select('id, nombre').eq('activo', true).order('nombre')
	]);

	const envios = enviosRes.data ?? [];
	const ids = [...new Set(envios.map((e) => e.perfil_id))];
	const { data: autores } = ids.length
		? await supabase.from('perfil_publico').select('id, nombre, avatar_url').in('id', ids)
		: { data: [] };
	const porId = new Map((autores ?? []).map((a) => [a.id, a]));

	return {
		envios: envios.map((e) => ({ ...e, remitente: porId.get(e.perfil_id) ?? null })),
		listas: listasRes.data ?? [],
		mcmLocales: mcmRes.data ?? []
	};
};

async function siguienteId(supabase: App.Locals['supabase']): Promise<string> {
	const { data } = await supabase.from('recurso').select('id').like('id', 'R%');
	const max = (data ?? [])
		.map((r) => (/^R\d+$/.test(r.id) ? parseInt(r.id.slice(1), 10) : 0))
		.reduce((a, b) => Math.max(a, b), 0);
	return `R${String(max + 1).padStart(4, '0')}`;
}

export const actions: Actions = {
	publicar: async ({ request, url, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		const nombre = String(f.get('nombre') ?? '').trim();
		if (!envioId || !nombre) return fail(400, { error: 'Faltan datos' });

		const rid = await siguienteId(supabase);
		const etapas = f.getAll('etapas').map(String);
		const edades = f.getAll('edades').map(String);

		const { error: errRecurso } = await supabase.from('recurso').insert({
			id: rid,
			nombre,
			descripcion: String(f.get('descripcion') ?? '').trim() || null,
			tipo: String(f.get('tipo') ?? '') || null,
			etapas,
			edades,
			nivel: String(f.get('nivel') ?? '') || null,
			mcm_local_id: String(f.get('mcm_local_id') ?? '') || null,
			idioma: String(f.get('idioma') ?? '') || null,
			soporte: String(f.get('soporte') ?? '') || null,
			ubicacion: String(f.get('ubicacion') ?? '') || null,
			enlace: String(f.get('enlace') ?? '').trim() || null,
			visibilidad: String(f.get('visibilidad') ?? 'publico'),
			estado: 'publicado',
			fuera_del_banco: true
		});
		if (errRecurso) return fail(500, { error: `No se pudo crear el recurso: ${errRecurso.message}` });

		// tags por slug (crea las que falten)
		const tags = String(f.get('tags') ?? '')
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean);
		for (const nombreTag of tags) {
			const slug = nombreTag
				.toLowerCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^a-z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '');
			await supabase.from('tag').upsert({ nombre: nombreTag, slug }, { onConflict: 'slug', ignoreDuplicates: true });
			const { data: tag } = await supabase.from('tag').select('id').eq('slug', slug).single();
			if (tag) await supabase.from('recurso_tag').insert({ recurso_id: rid, tag_id: tag.id });
		}

		const { error: errEnvio } = await supabase
			.from('envio')
			.update({ estado: 'publicado', recurso_id: rid, revisado_por: user.id })
			.eq('id', envioId);
		if (errEnvio) return fail(500, { error: errEnvio.message });

		const { data: email } = await supabase.rpc('email_remitente', { envio_id: envioId });
		if (email) await emailEnvioPublicado(email, nombre, `${url.origin}/?r=${rid}`);

		return { ok: true, recurso_id: rid };
	},

	devolver: async ({ request, url, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		const motivo = String(f.get('motivo') ?? '').trim();
		if (!envioId || !motivo) return fail(400, { error: 'Falta el motivo' });

		const { data: envio } = await supabase.from('envio').select('titulo').eq('id', envioId).single();
		const { error } = await supabase
			.from('envio')
			.update({ estado: 'devuelto', motivo_devolucion: motivo, revisado_por: user.id })
			.eq('id', envioId);
		if (error) return fail(500, { error: error.message });

		const { data: email } = await supabase.rpc('email_remitente', { envio_id: envioId });
		if (email && envio) await emailEnvioDevuelto(email, envio.titulo, motivo, `${url.origin}/envios`);

		return { ok: true };
	},

	descartar: async ({ request, locals: { supabase, user } }) => {
		if (!user) return fail(401);
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		const { error } = await supabase
			.from('envio')
			.update({ estado: 'descartado', revisado_por: user.id })
			.eq('id', envioId);
		if (error) return fail(500, { error: error.message });
		return { ok: true };
	}
};
