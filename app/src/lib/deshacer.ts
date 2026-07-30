import { browser } from '$app/environment';
import { toast } from 'svelte-sonner';

/**
 * Deshacer en vez de confirmar (docs/04-diseno.md §5).
 *
 * Un diálogo de «¿estás seguro?» cobra el peaje a todo el mundo para evitar el error de uno, y
 * encima no sirve de nada cuando el error es haber pulsado en la fila equivocada: se confirma
 * igual de rápido. El patrón que sí funciona es al contrario — la pantalla reacciona al instante
 * y la acción se queda unos segundos en cuenta atrás, con un «Deshacer» a mano.
 *
 * Lo importante: durante la cuenta atrás NO ha pasado nada en la base de datos. No hay que
 * revertir un borrado, es que aún no se ha borrado. Eso es más seguro que un diálogo, que ejecuta
 * en cuanto lo confirmas.
 */

/** Segundos de cuenta atrás. Suficiente para leer el aviso y reaccionar, sin dejar la lista mintiendo. */
const SEGUNDOS = 7;

/**
 * Cuentas atrás en marcha. Si te vas de la página con alguna pendiente, se lanzan: lo pediste, y
 * abandonarlas dejaría la pantalla diciendo una cosa y la base de datos otra hasta la siguiente
 * recarga. Por eso las peticiones van con `keepalive` (ver `lanzarAccion`).
 */
const pendientes = new Set<() => void>();

if (browser) {
	window.addEventListener('pagehide', () => {
		for (const lanzar of [...pendientes]) lanzar();
	});
}

export interface OpcionesRetardo {
	/** Lo que se ha hecho, ya en pasado: «Envío descartado». */
	mensaje: string;
	descripcion?: string;
	segundos?: number;
	/**
	 * La acción de verdad. Devuelve el mensaje de error si falla (o lanza): en ese caso se
	 * avisa y se llama a `ondeshacer` para devolver la pantalla a su sitio.
	 */
	ejecutar: () => Promise<string | null | void>;
	/** Revierte el cambio optimista de la pantalla (al pulsar «Deshacer» o si la acción falla). */
	ondeshacer?: () => void;
	/** Se llama cuando la acción ha terminado bien: aquí va el `invalidateAll()`. */
	onhecho?: () => void;
}

/**
 * Aplica ya el cambio en pantalla (eso lo hace quien llama) y ejecuta la acción unos segundos
 * después, salvo que se pulse «Deshacer».
 */
export function accionRetardada({
	mensaje,
	descripcion,
	segundos = SEGUNDOS,
	ejecutar,
	ondeshacer,
	onhecho
}: OpcionesRetardo) {
	let resuelto = false;
	let temporizador: ReturnType<typeof setTimeout>;

	const fallo = (motivo?: string) => {
		toast.error('No se pudo completar', { description: motivo ?? 'Inténtalo de nuevo' });
		ondeshacer?.();
	};

	const lanzar = () => {
		if (resuelto) return;
		resuelto = true;
		clearTimeout(temporizador);
		pendientes.delete(lanzar);
		Promise.resolve()
			.then(ejecutar)
			.then((error) => (error ? fallo(error) : onhecho?.()))
			.catch((e) => fallo((e as Error)?.message));
	};

	temporizador = setTimeout(lanzar, segundos * 1000);
	pendientes.add(lanzar);

	toast(mensaje, {
		description: descripcion,
		duration: segundos * 1000,
		action: {
			label: 'Deshacer',
			onClick: () => {
				if (resuelto) return;
				resuelto = true;
				clearTimeout(temporizador);
				pendientes.delete(lanzar);
				ondeshacer?.();
			}
		}
	});
}

/**
 * Variante para lo que ya es reversible de por sí (un favorito, una marca de «lo he usado»): la
 * acción se ejecuta al momento y «Deshacer» hace la contraria. Aquí retrasar no aporta nada y
 * complicaría el estado; lo que faltaba era el atajo para volver atrás.
 */
export function avisoDeshacible({
	mensaje,
	descripcion,
	segundos = SEGUNDOS,
	deshacer
}: {
	mensaje: string;
	descripcion?: string;
	segundos?: number;
	deshacer: () => void;
}) {
	toast(mensaje, {
		description: descripcion,
		duration: segundos * 1000,
		action: { label: 'Deshacer', onClick: deshacer }
	});
}
