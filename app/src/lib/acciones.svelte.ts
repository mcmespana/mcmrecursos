import type { SubmitFunction } from '@sveltejs/kit';

/**
 * «Hay algo en marcha»: el estado que le faltaba a media app.
 *
 * Sin esto, un formulario enviado con `use:enhance` no da ninguna señal mientras el servidor
 * responde: el botón sigue pulsable, así que un segundo clic manda la acción otra vez (y en la
 * cola de revisión eso publicaba el recurso dos veces), y quien lo usa no sabe si ha pasado
 * algo. Se cuenta con un contador en vez de un booleano porque una misma pantalla puede tener
 * varios formularios pequeños en vuelo.
 */
export function crearOcupado() {
	let enVuelo = $state(0);

	return {
		/** true mientras haya al menos una acción esperando respuesta. */
		get activo() {
			return enVuelo > 0;
		},
		/**
		 * Envoltorio de `use:enhance`: marca ocupado al enviar y lo libera al responder,
		 * pase lo que pase.
		 */
		enhance(alTerminar?: (evento: any) => unknown | Promise<unknown>): SubmitFunction {
			return () => {
				enVuelo++;
				return async (evento: any) => {
					try {
						await alTerminar?.(evento);
					} finally {
						enVuelo--;
					}
				};
			};
		},
		/** Igual, para acciones que no van por formulario (llamadas directas a Supabase). */
		async envolver<T>(tarea: () => Promise<T>): Promise<T> {
			enVuelo++;
			try {
				return await tarea();
			} finally {
				enVuelo--;
			}
		}
	};
}
