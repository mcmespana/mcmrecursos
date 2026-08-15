import { toast } from 'svelte-sonner';
import type { SupabaseClient } from '@supabase/supabase-js';
import { accionRetardada, avisoDeshacible } from '$lib/deshacer';
import { buzon, type Aviso } from './estado.svelte';

export type AccionAviso =
	| 'hecha'
	| 'reabrir'
	| 'leido'
	| 'borrar'
	| 'asignar'
	| 'prioridad'
	| 'vence';

/**
 * Lo que hace cada botón de una tarjeta del buzón, en un solo sitio.
 *
 * Vive aquí y no dentro del panel flotante porque la pantalla completa tiene que comportarse
 * exactamente igual: si cerrar una tarea ofrece «deshacer» en el panel, tiene que ofrecerlo
 * también en grande. Duplicarlo era la forma segura de que se separasen a la tercera semana.
 *
 * El reparto entre los dos patrones de `docs/04-diseno.md` §5:
 *  - **borrar** no tiene marcha atrás → `accionRetardada`: la fila se va de la pantalla y el
 *    `delete` espera siete segundos. Durante la cuenta atrás la base de datos está intacta.
 *  - **cerrar** es reversible de por sí → `avisoDeshacible`: se guarda ya y «Deshacer» reabre.
 */
export function crearAcciones(supabase: SupabaseClient<any, 'recursos'>, uid: string) {
	return async function accion(a: Aviso, que: AccionAviso, valor?: string | null) {
		if (que === 'borrar') {
			const quitado = buzon.quitarLocal(a.id);
			if (!quitado) return;
			accionRetardada({
				mensaje: a.tipo === 'tarea' ? 'Tarea borrada' : 'Aviso borrado',
				descripcion: a.titulo,
				ejecutar: () => buzon.borrarServidor(supabase, quitado.aviso.id),
				ondeshacer: () => buzon.restaurarLocal(quitado.aviso, quitado.indice)
			});
			return;
		}

		if (que === 'leido') {
			await buzon.marcarLeido(supabase, a.id, valor !== 'no');
			return;
		}

		if (que === 'hecha') {
			const error = await buzon.cambiar(supabase, a.id, {
				estado: 'hecha',
				resuelta_por: uid,
				resuelta_at: new Date().toISOString()
			});
			if (error) {
				toast.error('No se pudo cerrar', { description: error });
				return;
			}
			avisoDeshacible({
				mensaje: a.tipo === 'tarea' ? 'Tarea hecha' : 'Aviso archivado',
				descripcion: a.titulo,
				deshacer: () =>
					buzon.cambiar(supabase, a.id, {
						estado: 'abierta',
						resuelta_por: null,
						resuelta_at: null
					})
			});
			return;
		}

		const cambios: Partial<Aviso> =
			que === 'reabrir'
				? { estado: 'abierta', resuelta_por: null, resuelta_at: null }
				: que === 'asignar'
					? { asignada_a: valor ?? null }
					: que === 'prioridad'
						? { prioridad: (valor ?? 'normal') as Aviso['prioridad'] }
						: // una fecha suelta se ancla al final de ese día: «vence el 31» incluye el 31
							{ vence_at: valor ? new Date(`${valor}T23:59:59`).toISOString() : null };

		const error = await buzon.cambiar(supabase, a.id, cambios);
		if (error) toast.error('No se pudo guardar', { description: error });
	};
}
