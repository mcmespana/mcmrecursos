import { tick } from 'svelte';

/**
 * View Transition de tarjeta a ficha: la miniatura viaja (docs/04-diseno.md §5).
 *
 * El truco está en que un `view-transition-name` tiene que ser ÚNICO en el documento en cada
 * instante: si la tarjeta y la ficha lo llevan a la vez, el navegador aborta la transición. Así
 * que el nombre se pasa de mano en mano — primero lo lleva la tarjeta, y dentro de la
 * transición pasa a la ficha — y al acabar se retira de las dos.
 *
 * Degrada solo: si el navegador no trae la API (Firefox y Safari viejos) o quien mira ha pedido
 * menos movimiento, se abre la ficha directamente y no pasa nada.
 */
export function crearTransicionFicha() {
	let activa = $state<{ id: string; lado: 'tarjeta' | 'ficha' } | null>(null);

	const nombreDe = (id: string, lado: 'tarjeta' | 'ficha') =>
		activa?.id === id && activa.lado === lado ? `recurso-${id}` : null;

	return {
		/** Nombre para la miniatura de esta tarjeta, o null si ahora no le toca. */
		tarjeta: (id: string) => nombreDe(id, 'tarjeta'),
		/** Nombre para el bloque de cabecera de la ficha, o null. */
		ficha: (id: string | null | undefined) => (id ? nombreDe(id, 'ficha') : null),

		/**
		 * Abre la ficha animando la miniatura. `aplicar` es quien cambia el estado de la página
		 * (normalmente `() => (abierto = recurso)`).
		 */
		async abrir(id: string, aplicar: () => void) {
			const puede =
				typeof document !== 'undefined' &&
				typeof document.startViewTransition === 'function' &&
				!window.matchMedia('(prefers-reduced-motion: reduce)').matches;

			if (!puede) {
				aplicar();
				return;
			}

			// 1. la tarjeta se queda con el nombre y esperamos a que esté en el DOM
			activa = { id, lado: 'tarjeta' };
			await tick();

			// 2. dentro de la transición, el nombre cambia de dueño
			const transicion = document.startViewTransition(async () => {
				aplicar();
				activa = { id, lado: 'ficha' };
				await tick();
			});

			try {
				await transicion.finished;
			} catch {
				// transición abortada (otra encima, o el DOM cambió a mitad): da igual, el
				// estado ya se aplicó dentro del callback
			} finally {
				activa = null;
			}
		}
	};
}
