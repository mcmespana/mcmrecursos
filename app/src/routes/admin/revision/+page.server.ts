import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { emailEnvioDevuelto, emailEnvioPublicado } from '$lib/server/email';
import { clasificarRecurso } from '$lib/server/ia';
import { extraerTextoDrive } from '$lib/server/drive';
import { camposDelFormulario, guardarRelacionados } from '$lib/server/recursos';
import { exigirRol } from '$lib/server/permisos';

/** Estados desde los que un envío todavía se puede resolver. */
const ABIERTOS = ['enviado', 'en_revision', 'revisar_ia'];

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [enviosRes, listasRes, mcmRes, tagsRes] = await Promise.all([
		supabase
			.from('envio')
			.select(
				`id, titulo, enlace, notas, estado, motivo_ia, perfil_id, anon_id,
				 nombre_contacto, email_contacto, clasificacion, mcm_local_id, created_at`
			)
			.in('estado', ABIERTOS)
			.order('created_at'),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('mcm_local').select('id, nombre').eq('activo', true).order('nombre'),
		supabase.from('tag').select('nombre, recurso_tag (recurso_id)').limit(500)
	]);

	const envios = enviosRes.data ?? [];
	const ids = [...new Set(envios.map((e) => e.perfil_id).filter(Boolean))] as string[];
	const { data: autores } = ids.length
		? await supabase.from('perfil_publico').select('id, nombre, avatar_url').in('id', ids)
		: { data: [] };
	const porId = new Map((autores ?? []).map((a) => [a.id, a]));

	const tags = (tagsRes.data ?? [])
		.map((t: any) => ({ nombre: t.nombre as string, usos: (t.recurso_tag ?? []).length }))
		.sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, 'es'))
		.map((t) => t.nombre);

	return {
		envios: envios.map((e: any) => ({
			...e,
			// sin cuenta no hay perfil: se enseña el nombre de contacto, si lo dejó
			remitente: e.perfil_id
				? (porId.get(e.perfil_id) ?? null)
				: e.nombre_contacto || e.email_contacto
					? { nombre: e.nombre_contacto || e.email_contacto, avatar_url: null }
					: null,
			anonimo: !e.perfil_id
		})),
		listas: listasRes.data ?? [],
		mcmLocales: mcmRes.data ?? [],
		tags
	};
};

export const actions: Actions = {
	publicar: async ({ request, url, locals }) => {
		await exigirRol(locals);
		const { supabase, user } = locals;
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		const campos = await camposDelFormulario(f);
		if (!envioId || !campos.nombre) return fail(400, { error: 'Faltan datos' });

		// Cerrar el envío ANTES de crear el recurso hace de cerrojo: si llegan dos peticiones
		// (doble clic, reenvío del formulario), la segunda no encuentra ninguna fila abierta y se
		// va sin publicar nada. Antes se creaban dos recursos idénticos.
		const { data: reclamado } = await supabase
			.from('envio')
			.update({ estado: 'publicado', revisado_por: user!.id })
			.eq('id', envioId)
			.in('estado', ABIERTOS)
			.select('id');
		if (!reclamado?.length) {
			return fail(409, { error: 'Ese envío ya lo ha resuelto alguien (o tú mismo hace un instante)' });
		}

		const devolverEnvio = async () => {
			await supabase.from('envio').update({ estado: 'enviado', revisado_por: null }).eq('id', envioId);
		};

		const { data: nuevoId, error: errId } = await supabase.rpc('nuevo_id_recurso');
		if (errId || !nuevoId) {
			await devolverEnvio();
			return fail(500, { error: errId?.message ?? 'No se pudo generar el id' });
		}
		const rid = String(nuevoId);

		const { error: errRecurso } = await supabase.from('recurso').insert({ id: rid, ...campos });
		if (errRecurso) {
			await devolverEnvio();
			return fail(500, { error: `No se pudo crear el recurso: ${errRecurso.message}` });
		}

		await guardarRelacionados(supabase, rid, f);
		await supabase.from('envio').update({ recurso_id: rid }).eq('id', envioId);

		const { data: email } = await supabase.rpc('email_remitente', { envio_id: envioId });
		if (email) await emailEnvioPublicado(email, campos.nombre, `${url.origin}/?r=${rid}`);

		return { ok: true, recurso_id: rid };
	},

	devolver: async ({ request, url, locals }) => {
		await exigirRol(locals);
		const { supabase, user } = locals;
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		const motivo = String(f.get('motivo') ?? '').trim();
		if (!envioId || !motivo) return fail(400, { error: 'Falta el motivo' });

		const { data: envio } = await supabase.from('envio').select('titulo').eq('id', envioId).single();
		const { data: cambiado } = await supabase
			.from('envio')
			.update({ estado: 'devuelto', motivo_devolucion: motivo, revisado_por: user!.id })
			.eq('id', envioId)
			.in('estado', ABIERTOS)
			.select('id');
		if (!cambiado?.length) return fail(409, { error: 'Ese envío ya está resuelto' });

		const { data: email } = await supabase.rpc('email_remitente', { envio_id: envioId });
		if (email && envio) await emailEnvioDevuelto(email, envio.titulo, motivo, `${url.origin}/envios`);

		return { ok: true };
	},

	descartar: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase, user } = locals;
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		const { data: cambiado } = await supabase
			.from('envio')
			.update({ estado: 'descartado', revisado_por: user!.id })
			.eq('id', envioId)
			.in('estado', ABIERTOS)
			.select('id');
		if (!cambiado?.length) return fail(409, { error: 'Ese envío ya está resuelto' });
		return { ok: true };
	},

	// Autoclasificación del envío antes de publicarlo (SPEC-010): propone catalogación.
	clasificar: async ({ request, locals }) => {
		await exigirRol(locals);
		const { supabase } = locals;
		const f = await request.formData();
		const envioId = String(f.get('envio_id') ?? '');
		if (!envioId) return fail(400);

		const [envioRes, listasRes, tagsRes] = await Promise.all([
			supabase.from('envio').select('titulo, enlace, notas, clasificacion').eq('id', envioId).maybeSingle(),
			supabase.from('lista_valor').select('lista, valor').eq('activo', true),
			supabase.from('tag').select('nombre').order('nombre').limit(200)
		]);
		const e: any = envioRes.data;
		if (!e) return fail(404, { error: 'Envío no encontrado' });

		const deLista = (lista: string) =>
			(listasRes.data ?? []).filter((l: any) => l.lista === lista).map((l: any) => l.valor);
		const vocab = {
			tipos: deLista('tipo'),
			etapas: deLista('etapas'),
			edades: deLista('edades'),
			niveles: deLista('nivel'),
			idiomas: deLista('idioma'),
			soportes: deLista('soporte'),
			tags: (tagsRes.data ?? []).map((t: any) => t.nombre)
		};

		const textoDocumento = await extraerTextoDrive(e.enlace);
		const res = await clasificarRecurso(
			{
				nombre: e.titulo,
				// lo que aportó quien envió el recurso también es contexto para la IA
				notas: [e.notas, resumirClasificacion(e.clasificacion)].filter(Boolean).join(' · ') || null,
				enlace: e.enlace,
				textoDocumento
			},
			vocab
		);
		if (!res.disponible) return { ok: false, disponible: false };
		if (!res.ok) return fail(502, { error: res.error });

		await supabase.from('clasificacion_ia').insert({
			envio_id: envioId,
			estado: 'propuesta',
			modelo: res.modelo,
			propuesta: res.propuesta,
			avisos: res.propuesta.avisos,
			confianza: res.propuesta.confianza
		});
		return { ok: true, disponible: true, propuesta: res.propuesta };
	}
};

/** La clasificación opcional del remitente, en una línea legible para el prompt. */
function resumirClasificacion(c: any): string | null {
	if (!c || typeof c !== 'object') return null;
	const partes = [
		c.tipo && `tipo: ${c.tipo}`,
		c.idioma && `idioma: ${c.idioma}`,
		c.etapas?.length && `etapas: ${c.etapas.join(', ')}`,
		c.edades?.length && `edades: ${c.edades.join(', ')}`,
		c.tags?.length && `temáticas: ${c.tags.join(', ')}`
	].filter(Boolean);
	return partes.length ? `Quien lo envía sugiere — ${partes.join('; ')}` : null;
}
