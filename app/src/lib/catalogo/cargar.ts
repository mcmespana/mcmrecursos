import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { ListaValor, RecursoCatalogo, SocialPropio } from './tipos';
import { socialVacio } from './tipos';
import type { FacetaConfig } from './filtros';

export interface DatosCatalogo {
	recursos: RecursoCatalogo[];
	listas: ListaValor[];
	social: SocialPropio;
	facetas: FacetaConfig[];
}

/** Carga completa del catálogo público (recursos + listas + facetas + lo mío). */
export async function cargarDatosCatalogo(
	supabase: SupabaseClient<any, 'recursos'>,
	session: Session | null
): Promise<DatosCatalogo> {
	const [recursosRes, listasRes, statsRes, facetasRes] = await Promise.all([
		supabase
			.from('recurso')
			.select(
				`id, nombre, descripcion, tipo, etapas, nivel, edades, idioma, soporte, ubicacion,
				 enlace, imagen, anyo_publicacion, curso_usado, visibilidad, estado, version_de,
				 fuera_del_banco, pendiente_clasificar,
				 mcm_local:mcm_local_id (nombre),
				 recurso_tag (tag (nombre)),
				 recurso_autor (autor (nombre, apellidos)),
				 relaciones:recurso_relacion!recurso_relacion_recurso_id_fkey (relacionado_id)`
			)
			.order('nombre'),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden'),
		supabase.from('recurso_stats').select('*'),
		supabase
			.from('faceta')
			.select('campo, etiqueta, tipo, origen, orden, visible, protegida')
			.order('orden')
	]);

	const stats = new Map((statsRes.data ?? []).map((s: any) => [s.recurso_id, s]));

	const recursos: RecursoCatalogo[] = (recursosRes.data ?? []).map((r: any) => {
		const s = stats.get(r.id);
		return {
			id: r.id,
			nombre: r.nombre,
			descripcion: r.descripcion,
			tipo: r.tipo,
			etapas: r.etapas ?? [],
			nivel: r.nivel,
			edades: r.edades ?? [],
			mcm_local: r.mcm_local?.nombre ?? null,
			idioma: r.idioma,
			soporte: r.soporte,
			ubicacion: r.ubicacion,
			enlace: r.enlace,
			imagen: r.imagen,
			anyo_publicacion: r.anyo_publicacion,
			curso_usado: r.curso_usado,
			visibilidad: r.visibilidad,
			estado: r.estado,
			fuera_del_banco: r.fuera_del_banco,
			pendiente_clasificar: r.pendiente_clasificar,
			tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean),
			autores: (r.recurso_autor ?? [])
				.map((a: any) => [a.autor?.nombre, a.autor?.apellidos].filter(Boolean).join(' '))
				.filter(Boolean),
			relacionados: (r.relaciones ?? []).map((x: any) => x.relacionado_id),
			valoracion_media: s?.valoracion_media != null ? Number(s.valoracion_media) : null,
			num_valoraciones: s?.num_valoraciones ?? 0,
			num_favoritos: s?.num_favoritos ?? 0,
			num_usos: s?.num_usos ?? 0,
			num_accesos: s?.num_accesos ?? 0,
			version_de: r.version_de ?? null,
			reemplazado_por: null,
			es_vigente: true,
			versiones_anteriores: []
		};
	});

	resolverVersiones(recursos);

	// lo mío (favoritos, usos, valoraciones) — solo con sesión.
	// Se mapea al recurso vigente del linaje (herencia SPEC-009 §2).
	const social: SocialPropio = socialVacio();
	if (session) {
		const [favRes, usoRes, valRes] = await Promise.all([
			supabase.from('favorito').select('recurso_id'),
			supabase.from('uso').select('recurso_id'),
			supabase.from('valoracion').select('recurso_id, estrellas')
		]);
		const alVigente = mapaAVigente(recursos);
		for (const f of favRes.data ?? []) social.favoritos.add(alVigente(f.recurso_id));
		for (const u of usoRes.data ?? []) social.usos.add(alVigente(u.recurso_id));
		for (const v of valRes.data ?? []) {
			const id = alVigente(v.recurso_id);
			// si el usuario valoró varias versiones, gana la de la versión vigente si existe
			if (!social.valoraciones.has(id) || id === v.recurso_id) {
				social.valoraciones.set(id, v.estrellas);
			}
		}
	}

	return {
		recursos,
		listas: listasRes.data ?? [],
		social,
		facetas: facetasRes.data ?? []
	};
}

/**
 * Resuelve el linaje de versiones (SPEC-009): marca `es_vigente`, `reemplazado_por` y
 * `versiones_anteriores`, y agrega la capa social del linaje sobre la versión vigente
 * (herencia no destructiva de valoraciones/favoritos/usos/accesos §2/§3).
 */
function resolverVersiones(recursos: RecursoCatalogo[]) {
	const porId = new Map(recursos.map((r) => [r.id, r]));
	// hijo publicado por predecesor: quién sucede a quién
	const sucesorDe = new Map<string, RecursoCatalogo>();
	for (const r of recursos) {
		if (r.version_de && r.estado === 'publicado' && porId.has(r.version_de)) {
			sucesorDe.set(r.version_de, r);
		}
	}
	for (const r of recursos) {
		const sucesor = sucesorDe.get(r.id);
		if (sucesor) {
			r.es_vigente = false;
			r.reemplazado_por = sucesor.id;
		}
	}
	// para cada cabeza (vigente que sucede a alguien), reunir el linaje y agregar stats
	for (const cabeza of recursos) {
		if (cabeza.version_de == null && !esSucesora(cabeza, porId)) continue;
		if (!cabeza.es_vigente) continue;
		const linaje = linajeDe(cabeza, porId, sucesorDe);
		if (linaje.length <= 1) continue;
		cabeza.versiones_anteriores = linaje
			.filter((r) => r.id !== cabeza.id)
			.map((r) => r.id);
		agregarStats(cabeza, linaje);
	}
}

/** ¿este recurso es una versión (tiene predecesor en el mapa)? */
function esSucesora(r: RecursoCatalogo, porId: Map<string, RecursoCatalogo>): boolean {
	return !!(r.version_de && porId.has(r.version_de));
}

/** Linaje completo (de la más nueva a la más antigua) que contiene a `r`. */
function linajeDe(
	r: RecursoCatalogo,
	porId: Map<string, RecursoCatalogo>,
	sucesorDe: Map<string, RecursoCatalogo>
): RecursoCatalogo[] {
	// subir a la cabeza (siguiendo sucesores publicados)
	let cabeza = r;
	const vistos = new Set<string>([r.id]);
	let sig = sucesorDe.get(cabeza.id);
	while (sig && !vistos.has(sig.id)) {
		cabeza = sig;
		vistos.add(sig.id);
		sig = sucesorDe.get(cabeza.id);
	}
	// bajar por version_de acumulando toda la cadena
	const cadena: RecursoCatalogo[] = [];
	let actual: RecursoCatalogo | undefined = cabeza;
	const bajados = new Set<string>();
	while (actual && !bajados.has(actual.id)) {
		cadena.push(actual);
		bajados.add(actual.id);
		actual = actual.version_de ? porId.get(actual.version_de) : undefined;
	}
	return cadena;
}

/** Suma los agregados sociales del linaje sobre la cabeza (media ponderada de estrellas). */
function agregarStats(cabeza: RecursoCatalogo, linaje: RecursoCatalogo[]) {
	let sumaEstrellas = 0;
	let numVal = 0;
	let favoritos = 0;
	let usos = 0;
	let accesos = 0;
	for (const r of linaje) {
		if (r.valoracion_media != null && r.num_valoraciones) {
			sumaEstrellas += r.valoracion_media * r.num_valoraciones;
			numVal += r.num_valoraciones;
		}
		favoritos += r.num_favoritos;
		usos += r.num_usos;
		accesos += r.num_accesos;
	}
	cabeza.valoracion_media = numVal ? Math.round((sumaEstrellas / numVal) * 10) / 10 : null;
	cabeza.num_valoraciones = numVal;
	cabeza.num_favoritos = favoritos;
	cabeza.num_usos = usos;
	cabeza.num_accesos = accesos;
}

/** Devuelve una función id→id_vigente (sube por la cadena de sucesores publicados). */
function mapaAVigente(recursos: RecursoCatalogo[]): (id: string) => string {
	const porId = new Map(recursos.map((r) => [r.id, r]));
	return (id: string) => {
		let actual = porId.get(id);
		const vistos = new Set<string>();
		while (actual && actual.reemplazado_por && !vistos.has(actual.id)) {
			vistos.add(actual.id);
			actual = porId.get(actual.reemplazado_por);
		}
		return actual?.id ?? id;
	};
}
