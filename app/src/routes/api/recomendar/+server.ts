import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { iaDisponible } from '$lib/server/ia';
import { embeddingsDisponibles, embeddingConsulta } from '$lib/server/embeddings';
import { funcionActiva } from '$lib/server/ajustes';
import {
	MAX_CONSULTA,
	anotarExito,
	anotarFallo,
	enPausaPorFallos,
	recomendar,
	superaElTope,
	type CandidatoRecomendacion
} from '$lib/server/recomendar';

/**
 * «Recomiéndame una actividad para…» de /descubre (SPEC-007 fase 2).
 *
 * Devuelve una ordenación explicada de recursos ya existentes; el cliente la usa para
 * subir esas tarjetas al principio del mazo. Nunca es imprescindible: cualquier «no» de
 * los de abajo (sin clave, apagado en el panel, en pausa por fallos, demasiadas consultas)
 * se responde con calma y Descubre sigue funcionando con su mazo de siempre.
 */

const CANDIDATOS = 60;
/** Distancia coseno máxima. Más flojo que en el buscador: aquí filtra el modelo después. */
const UMBRAL = 0.85;

const noDisponible = (motivo: string) => json({ disponible: false, motivo });

export const POST: RequestHandler = async ({ request, locals: { supabase }, getClientAddress }) => {
	// 1. ¿hay motor? 2. ¿está encendido? 3. ¿no está castigado por fallar?
	if (!iaDisponible()) return noDisponible('sin_clave');
	if (!(await funcionActiva(supabase, 'descubre_ia', { variableEntorno: 'DESCUBRE_IA' }))) {
		return noDisponible('apagado');
	}
	if (enPausaPorFallos()) return noDisponible('pausa');

	const cuerpo = await request.json().catch(() => ({}));
	const consulta = String(cuerpo?.q ?? '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, MAX_CONSULTA);
	if (consulta.length < 4) return json({ disponible: true, ok: false, error: 'Consulta muy corta' });

	if (superaElTope(getClientAddress())) {
		return json(
			{
				disponible: true,
				ok: false,
				motivo: 'tope',
				error: 'Has pedido muchas recomendaciones seguidas. Prueba dentro de un rato.'
			},
			{ status: 429 }
		);
	}

	// ── candidatos: por significado si hay embeddings, por palabras si no ──
	let ids: string[] = [];
	if (embeddingsDisponibles()) {
		try {
			const embedding = await embeddingConsulta(consulta);
			if (embedding) {
				const { data, error } = await supabase.rpc('buscar_semantica', {
					consulta: embedding,
					limite: CANDIDATOS,
					umbral: UMBRAL
				});
				if (error) throw new Error(error.message);
				ids = (data ?? []).map((r: { id: string }) => r.id);
			}
		} catch (e) {
			// que falle Voyage no tiene por qué tumbar la recomendación: se sigue por palabras
			console.warn('[recomendar] embeddings caídos, se tira de léxico:', (e as Error).message);
		}
	}

	const { data: filas, error } = await candidatos(supabase, consulta, ids);
	if (error) return json({ disponible: true, ok: false, error: error.message }, { status: 500 });

	const fichas = mapear(filas ?? [], ids);
	if (fichas.length < 3) {
		return json({ disponible: true, ok: true, consulta, recomendaciones: [], vacio: true });
	}

	// ── vocabularios: la interpretación tiene que hablar el idioma de los filtros ──
	const { data: listas } = await supabase
		.from('lista_valor')
		.select('lista, valor')
		.eq('activo', true)
		.in('lista', ['etapas', 'edades', 'tipo']);
	const de = (lista: string) =>
		(listas ?? []).filter((l: any) => l.lista === lista).map((l: any) => l.valor as string);

	const salida = await recomendar(consulta, fichas, {
		etapas: de('etapas'),
		edades: de('edades'),
		tipos: de('tipo')
	});

	if (!salida.ok) {
		anotarFallo();
		return json({ disponible: true, ok: false, error: salida.error }, { status: 502 });
	}
	anotarExito();

	return json({
		disponible: true,
		ok: true,
		consulta,
		resumen: salida.interpretacion.resumen,
		sugerencias: {
			etapas: salida.interpretacion.etapas,
			edades: salida.interpretacion.edades,
			tipo: salida.interpretacion.tipos
		},
		recomendaciones: salida.recomendaciones
	});
};

const SELECT = 'id, nombre, descripcion, tipo, etapas, edades, nivel, recurso_tag (tag (nombre))';

/**
 * Fichas de los candidatos. Con ids del buscador semántico se piden esos; sin ellos
 * (Voyage apagado o caído) se hace una criba léxica por las palabras largas de la consulta.
 * En ambos casos manda la RLS —nadie recibe recursos que no podría ver— y se respeta el
 * opt-out `no_ia` de SPEC-010: lo marcado no se manda a ningún modelo.
 */
function candidatos(supabase: any, consulta: string, ids: string[]) {
	const base = supabase.from('recurso').select(SELECT).eq('estado', 'publicado').eq('no_ia', false);

	if (ids.length) return base.in('id', ids);

	// solo letras y números: nada de comas ni paréntesis que rompan el `or` de PostgREST
	const palabras = [...new Set(consulta.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])].slice(0, 6);
	if (!palabras.length) return base.limit(0);
	return base
		.or(palabras.map((p) => `nombre.ilike.%${p}%,descripcion.ilike.%${p}%`).join(','))
		.limit(CANDIDATOS);
}

/** Filas de Supabase → fichas para el modelo, en el orden de cercanía que dio pgvector. */
function mapear(filas: any[], ids: string[]): CandidatoRecomendacion[] {
	const rango = new Map(ids.map((id, i) => [id, i]));
	return filas
		.map((r) => ({
			id: r.id as string,
			nombre: r.nombre as string,
			descripcion: (r.descripcion ?? null) as string | null,
			tipo: (r.tipo ?? null) as string | null,
			etapas: (r.etapas ?? []) as string[],
			edades: (r.edades ?? []) as string[],
			nivel: (r.nivel ?? null) as string | null,
			tags: ((r.recurso_tag ?? []) as any[]).map((t) => t.tag?.nombre).filter(Boolean) as string[]
		}))
		.sort((a, b) => (rango.get(a.id) ?? 999) - (rango.get(b.id) ?? 999));
}
