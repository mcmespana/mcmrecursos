import type { SubmitFunction } from '@sveltejs/kit';

/**
 * «Hay algo en marcha» y «acaba de salir bien»: los dos estados que le faltaban a media app.
 *
 * Sin esto, un formulario enviado con `use:enhance` no da ninguna señal mientras el servidor
 * responde: el botón sigue pulsable, así que un segundo clic manda la acción otra vez (y en la
 * cola de revisión eso publicaba el recurso dos veces), y quien lo usa no sabe si ha pasado
 * algo. Se cuenta con un contador en vez de un booleano porque una misma pantalla puede tener
 * varios formularios pequeños en vuelo.
 *
 * `clave` sirve para pantallas con muchos botones iguales (p. ej. /admin/config): permite que
 * el check de confirmación salga solo en el que se pulsó, no en los treinta.
 */
export function crearOcupado(duracionExito = 1600) {
	let enVuelo = $state(0);
	let exito = $state<string | null>(null);
	let temporizador: ReturnType<typeof setTimeout> | null = null;

	function celebrar(clave: string) {
		exito = clave;
		if (temporizador) clearTimeout(temporizador);
		temporizador = setTimeout(() => (exito = null), duracionExito);
	}

	return {
		/** true mientras haya al menos una acción esperando respuesta. */
		get activo() {
			return enVuelo > 0;
		},
		/** ¿acaba de terminar bien la acción con esta clave? */
		hecho(clave = '') {
			return exito === clave;
		},
		/**
		 * Envoltorio de `use:enhance`: marca ocupado al enviar y lo libera al responder,
		 * pase lo que pase. Si la acción va bien, deja el check un momento.
		 */
		enhance(
			alTerminar?: (evento: any) => unknown | Promise<unknown>,
			clave = ''
		): SubmitFunction {
			return () => {
				enVuelo++;
				return async (evento: any) => {
					try {
						await alTerminar?.(evento);
						if (evento?.result?.type === 'success') celebrar(clave);
					} finally {
						enVuelo--;
					}
				};
			};
		},
		/** Igual, para acciones que no van por formulario (llamadas directas a Supabase). */
		async envolver<T>(tarea: () => Promise<T>, clave = ''): Promise<T> {
			enVuelo++;
			try {
				const salida = await tarea();
				celebrar(clave);
				return salida;
			} finally {
				enVuelo--;
			}
		}
	};
}
