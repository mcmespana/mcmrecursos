import { SvelteMap } from 'svelte/reactivity';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * El buzón del equipo (SPEC-016), compartido entre la campana de la cabecera y `/admin/avisos`.
 *
 * Vive en un módulo y no dentro de un componente porque las dos pantallas tienen que contar lo
 * mismo: si marcas algo hecho en el panel flotante, el número de la campana baja en el mismo
 * fotograma, sin recargar ni volver a preguntar al servidor. Es la única copia de la verdad en
 * el cliente, y todas las acciones son optimistas contra ella con reversión si el servidor dice
 * que no.
 */

export type TipoAviso = 'tarea' | 'aviso';
export type EstadoAviso = 'abierta' | 'hecha' | 'descartada';
export type Prioridad = 'alta' | 'normal' | 'baja';

export interface Aviso {
	id: string;
	tipo: TipoAviso;
	titulo: string;
	detalle: string | null;
	estado: EstadoAviso;
	prioridad: Prioridad;
	asignada_a: string | null;
	recurso_id: string | null;
	origen: string;
	senal: string | null;
	creada_por: string | null;
	created_at: string;
	vence_at: string | null;
	resuelta_por: string | null;
	resuelta_at: string | null;
	recurso_nombre?: string | null;
	/** ¿lo he leído yo? Se calcula al cargar cruzando con `tarea_visto`. */
	leido: boolean;
}

export interface PersonaEquipo {
	id: string;
	nombre: string;
	apellidos: string;
	avatar_url: string | null;
}

const COLUMNAS =
	'id, tipo, titulo, detalle, estado, prioridad, asignada_a, recurso_id, origen, senal, creada_por, created_at, vence_at, resuelta_por, resuelta_at, recurso:recurso_id (nombre)';

function crearBuzon() {
	let avisos = $state<Aviso[]>([]);
	let equipo = $state<PersonaEquipo[]>([]);
	let miId = $state<string | null>(null);
	let cargando = $state(false);
	let cargado = $state(false);
	/**
	 * Conteos del servidor, para que la campana sepa qué número enseñar sin haberse traído la
	 * lista. En cuanto la lista está cargada manda ella: los conteos se derivan de lo que hay en
	 * pantalla y así una acción optimista mueve el badge en el mismo fotograma.
	 */
	let resumen = $state({ sin_leer: 0, abiertas: 0, mias: 0, vencidas: 0 });
	/** ids con una acción en vuelo, para atenuar solo esa tarjeta y no la lista entera. */
	const enVuelo = new SvelteMap<string, true>();

	const abiertos = $derived(avisos.filter((a) => a.estado === 'abierta'));

	return {
		get avisos() {
			return avisos;
		},
		get equipo() {
			return equipo;
		},
		get miId() {
			return miId;
		},
		get cargando() {
			return cargando;
		},
		get cargado() {
			return cargado;
		},
		ocupado: (id: string) => enVuelo.has(id),

		/** Lo que mueve el badge de la campana: abierto y sin leer por mí. */
		get sinLeer() {
			return cargado ? abiertos.filter((a) => !a.leido).length : resumen.sin_leer;
		},
		get abiertas() {
			return cargado ? abiertos.length : resumen.abiertas;
		},
		get mias() {
			return cargado ? abiertos.filter((a) => a.asignada_a === miId).length : resumen.mias;
		},
		get vencidas() {
			if (!cargado) return resumen.vencidas;
			const ahora = Date.now();
			return abiertos.filter((a) => a.vence_at && Date.parse(a.vence_at) < ahora).length;
		},

		persona: (id: string | null) => (id ? (equipo.find((p) => p.id === id) ?? null) : null),

		/**
		 * Trae el buzón entero de una vez. Son decenas de filas, no miles: paginar aquí sería
		 * complicar el panel para ahorrar un payload que cabe en un parpadeo.
		 */
		async cargar(supabase: SupabaseClient<any, 'recursos'>, uid: string, forzar = false) {
			if (cargando || (cargado && !forzar)) return;
			cargando = true;
			miId = uid;
			try {
				const [avisosRes, equipoRes, vistosRes] = await Promise.all([
					supabase.from('tarea').select(COLUMNAS).order('created_at', { ascending: false }),
					supabase.rpc('perfiles_panel'),
					supabase.from('tarea_visto').select('tarea_id').eq('perfil_id', uid)
				]);
				const vistos = new Set((vistosRes.data ?? []).map((v: any) => v.tarea_id as string));
				avisos = (avisosRes.data ?? []).map((t: any) => ({
					...t,
					recurso_nombre: t.recurso?.nombre ?? null,
					leido: vistos.has(t.id)
				}));
				equipo = (equipoRes.data ?? []) as PersonaEquipo[];
				cargado = true;
			} finally {
				cargando = false;
			}
		},

		/**
		 * Conteos para la campana de quien todavía no ha abierto el panel: una consulta diminuta
		 * en vez de traerse el buzón entero en cada pantalla de la app.
		 */
		async refrescarResumen(supabase: SupabaseClient<any, 'recursos'>, uid: string) {
			if (cargado) return;
			miId = uid;
			const { data } = await supabase.rpc('avisos_resumen');
			if (!data) return;
			resumen = {
				sin_leer: Number((data as any).sin_leer ?? 0),
				abiertas: Number((data as any).abiertas ?? 0),
				mias: Number((data as any).mias ?? 0),
				vencidas: Number((data as any).vencidas ?? 0)
			};
		},

		/**
		 * Cambio optimista con reversión: la lista se actualiza antes de hablar con el servidor y
		 * vuelve atrás si falla. Es lo que hace que el panel se sienta instantáneo.
		 */
		async cambiar(
			supabase: SupabaseClient<any, 'recursos'>,
			id: string,
			cambios: Partial<Aviso>
		): Promise<string | null> {
			const i = avisos.findIndex((a) => a.id === id);
			if (i < 0) return null;
			const previo = { ...avisos[i] };
			avisos[i] = { ...avisos[i], ...cambios };
			enVuelo.set(id, true);
			// `leido` no es columna de `tarea`: vive en `tarea_visto` y se guarda aparte
			const { leido, recurso_nombre, ...columnas } = cambios as any;
			try {
				if (Object.keys(columnas).length) {
					const { error } = await supabase.from('tarea').update(columnas).eq('id', id);
					if (error) {
						avisos[i] = previo;
						return error.message;
					}
				}
				return null;
			} finally {
				enVuelo.delete(id);
			}
		},

		/** Marcar leído es por persona, así que va a `tarea_visto` y no a la propia tarea. */
		async marcarLeido(supabase: SupabaseClient<any, 'recursos'>, id: string, leido = true) {
			const i = avisos.findIndex((a) => a.id === id);
			if (i < 0 || !miId) return;
			const previo = avisos[i].leido;
			avisos[i] = { ...avisos[i], leido };
			const { error } = leido
				? await supabase
						.from('tarea_visto')
						.upsert({ tarea_id: id, perfil_id: miId }, { onConflict: 'tarea_id,perfil_id' })
				: await supabase.from('tarea_visto').delete().eq('tarea_id', id).eq('perfil_id', miId);
			if (error) avisos[i] = { ...avisos[i], leido: previo };
		},

		async marcarTodoLeido(supabase: SupabaseClient<any, 'recursos'>) {
			const previos = avisos.map((a) => a.leido);
			avisos = avisos.map((a) => (a.estado === 'abierta' ? { ...a, leido: true } : a));
			const { error } = await supabase.rpc('marcar_avisos_leidos');
			if (error) avisos = avisos.map((a, i) => ({ ...a, leido: previos[i] }));
		},

		async crear(
			supabase: SupabaseClient<any, 'recursos'>,
			nuevo: {
				titulo: string;
				tipo: TipoAviso;
				prioridad?: Prioridad;
				asignada_a?: string | null;
				vence_at?: string | null;
				detalle?: string | null;
			}
		): Promise<string | null> {
			const { data, error } = await supabase
				.from('tarea')
				.insert({
					titulo: nuevo.titulo,
					tipo: nuevo.tipo,
					prioridad: nuevo.prioridad ?? 'normal',
					asignada_a: nuevo.asignada_a ?? null,
					vence_at: nuevo.vence_at ?? null,
					detalle: nuevo.detalle ?? null,
					creada_por: miId
				})
				.select(COLUMNAS)
				.single();
			if (error) return error.message;
			// lo que acabas de escribir no puede salirte a ti como «sin leer»
			avisos = [{ ...(data as any), recurso_nombre: null, leido: true }, ...avisos];
			if (miId) await supabase.from('tarea_visto').insert({ tarea_id: data.id, perfil_id: miId });
			return null;
		},

		/**
		 * Borrar va en dos tiempos a propósito (`accionRetardada`, docs/04-diseno.md §5): la fila
		 * sale de la pantalla al momento y el `delete` de verdad no se lanza hasta que se agota la
		 * cuenta atrás. Por eso quitar de la lista y borrar en el servidor son dos operaciones
		 * distintas y no una sola optimista — durante esos segundos la base de datos está intacta,
		 * y deshacer es devolver la fila a su sitio, no resucitarla.
		 */
		quitarLocal(id: string): { aviso: Aviso; indice: number } | null {
			const i = avisos.findIndex((a) => a.id === id);
			if (i < 0) return null;
			const aviso = avisos[i];
			avisos = [...avisos.slice(0, i), ...avisos.slice(i + 1)];
			return { aviso, indice: i };
		},

		restaurarLocal(aviso: Aviso, indice: number) {
			avisos = [...avisos.slice(0, indice), aviso, ...avisos.slice(indice)];
		},

		async borrarServidor(
			supabase: SupabaseClient<any, 'recursos'>,
			id: string
		): Promise<string | null> {
			const { error } = await supabase.from('tarea').delete().eq('id', id);
			return error?.message ?? null;
		}
	};
}

export const buzon = crearBuzon();

/** «hace 2 h», «ayer», «12 ago» — la precisión que se lee de un vistazo, ni una unidad más. */
export function haceCuanto(iso: string): string {
	const ms = Date.now() - Date.parse(iso);
	const min = Math.round(ms / 60000);
	if (min < 1) return 'ahora';
	if (min < 60) return `hace ${min} min`;
	const horas = Math.round(min / 60);
	if (horas < 24) return `hace ${horas} h`;
	const dias = Math.round(horas / 24);
	if (dias === 1) return 'ayer';
	if (dias < 7) return `hace ${dias} días`;
	return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/**
 * La fecha límite, contada desde hoy: «vence hoy» pesa mucho más que «31 dic», y es lo que
 * decide si la píldora sale en rojo.
 */
export function vencimiento(iso: string | null): {
	texto: string;
	corto: string;
	vencida: boolean;
	pronto: boolean;
} | null {
	if (!iso) return null;
	const hoy = new Date();
	hoy.setHours(0, 0, 0, 0);
	const dia = new Date(iso);
	dia.setHours(0, 0, 0, 0);
	const dias = Math.round((dia.getTime() - hoy.getTime()) / 86400000);
	const corto = new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
	if (dias < 0) {
		const n = Math.abs(dias);
		return { texto: n === 1 ? 'venció ayer' : `venció hace ${n} días`, corto, vencida: true, pronto: true };
	}
	if (dias === 0) return { texto: 'vence hoy', corto: 'hoy', vencida: false, pronto: true };
	if (dias === 1) return { texto: 'vence mañana', corto: 'mañana', vencida: false, pronto: true };
	if (dias <= 7) return { texto: `vence en ${dias} días`, corto, vencida: false, pronto: true };
	return { texto: `antes del ${corto}`, corto, vencida: false, pronto: false };
}
