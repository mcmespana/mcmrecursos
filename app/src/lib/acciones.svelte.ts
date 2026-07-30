import type { SubmitFunction } from '@sveltejs/kit';
import { deserialize } from '$app/forms';
import { SvelteSet } from 'svelte/reactivity';

/**
 * Llama a una acción de formulario de SvelteKit sin tener un `<form>` delante.
 *
 * Hace falta para las acciones con cuenta atrás (`accionRetardada`): cuando se pulsa el botón no
 * se envía nada, y el envío de verdad ocurre siete segundos después, cuando ya no hay ningún
 * evento de formulario del que colgarse. Se replican las cabeceras que usa `use:enhance` para que
 * el servidor devuelva el resultado como JSON en vez de redirigir.
 *
 * `keepalive` es lo que permite que una cuenta atrás lanzada al cerrar la pestaña llegue a su
 * destino en lugar de morir con el documento.
 *
 * @param accion ruta de la acción, tal cual se pondría en el `action` del formulario: `?/eliminar`.
 * @returns el mensaje de error si falló, o `null` si fue bien.
 */
export async function lanzarAccion(
	accion: string,
	campos: Record<string, string>
): Promise<string | null> {
	const cuerpo = new URLSearchParams();
	for (const [clave, valor] of Object.entries(campos)) cuerpo.append(clave, valor);

	const respuesta = await fetch(accion, {
		method: 'POST',
		headers: {
			accept: 'application/json',
			'content-type': 'application/x-www-form-urlencoded',
			'x-sveltekit-action': 'true'
		},
		cache: 'no-store',
		keepalive: true,
		body: cuerpo
	});

	const resultado = deserialize(await respuesta.text());
	if (resultado.type === 'failure') {
		return (resultado.data as { error?: string } | undefined)?.error ?? 'No se pudo completar';
	}
	if (resultado.type === 'error') return resultado.error?.message ?? 'Error del servidor';
	return null;
}

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
 * el check de confirmación y el spinner de carga salgan solo en el que se pulsó, no en los
 * treinta.
 */
export function crearOcupado(duracionExito = 1600) {
	let enVuelo = $state(0);
	const clavesEnVuelo = new SvelteSet<string>();
	let exito = $state<string | null>(null);
	let temporizador: ReturnType<typeof setTimeout> | null = null;

	function celebrar(clave: string) {
		exito = clave;
		if (temporizador) clearTimeout(temporizador);
		temporizador = setTimeout(() => (exito = null), duracionExito);
	}

	return {
		/** true mientras haya al menos una acción esperando respuesta (para bloquear la pantalla). */
		get activo() {
			return enVuelo > 0;
		},
		/** ¿está en marcha la acción con esta clave concreta? Para el spinner de su propio botón. */
		cargando(clave = '') {
			return clavesEnVuelo.has(clave);
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
				clavesEnVuelo.add(clave);
				return async (evento: any) => {
					try {
						await alTerminar?.(evento);
						if (evento?.result?.type === 'success') celebrar(clave);
					} finally {
						enVuelo--;
						clavesEnVuelo.delete(clave);
					}
				};
			};
		},
		/** Igual, para acciones que no van por formulario (llamadas directas a Supabase). */
		async envolver<T>(tarea: () => Promise<T>, clave = ''): Promise<T> {
			enVuelo++;
			clavesEnVuelo.add(clave);
			try {
				const salida = await tarea();
				celebrar(clave);
				return salida;
			} finally {
				enVuelo--;
				clavesEnVuelo.delete(clave);
			}
		}
	};
}
