import { browser } from '$app/environment';

/**
 * Estado compartido de las dos puertas que abre SPEC-017: el modal de bienvenida (lista de
 * espera) y el panel de sugerencias.
 *
 * Es un módulo con runes, no una librería de estado global: los dos paneles viven en el
 * layout —para poder abrirse desde cualquier página sin montarlos veinte veces— y hay que
 * poder pedirles que se abran desde sitios muy repartidos (la ficha de un recurso de muestra,
 * el pie, la paleta de comandos, la portada). Pasar eso por props sería enhebrar un callback
 * por cinco niveles de componentes para algo que ni siquiera es dato: es una intención.
 *
 * Lo que se recuerda en el navegador es deliberadamente poco y de este dispositivo:
 *
 *   · `mcm-espera-hecho` — «ya dejé mi correo». Corta el modal para siempre. Es lo único que
 *      de verdad hay que recordar: volver a pedirle el correo a quien ya lo dio es lo que
 *      convierte una invitación en una molestia.
 *   · `mcm-espera-visto` — el día (AAAA-MM-DD) en que se cerró sin apuntarse. El modal vuelve
 *      en la siguiente visita, pero no en cada navegación de la misma tarde: entrar en un
 *      recurso y volver al buscador no es «una visita nueva».
 *
 * Las dos claves se leen en un `iniciar()` explícito llamado desde el layout, nunca al
 * importar el módulo: esto se importa también en el servidor, donde `localStorage` no existe.
 */

const CLAVE_HECHO = 'mcm-espera-hecho';
const CLAVE_VISTO = 'mcm-espera-visto';

/** Desde dónde se pidió abrir el modal. Solo para decidir el tono del titular. */
export type OrigenBienvenida = 'auto' | 'ficha' | 'boton';

const hoy = () => new Date().toISOString().slice(0, 10);

function crearComunidad() {
	let bienvenidaAbierta = $state(false);
	let origen = $state<OrigenBienvenida>('auto');
	let sugerenciasAbierto = $state(false);
	/** Correo ya dejado en este dispositivo: ni el modal automático ni el aviso del pie. */
	let apuntado = $state(false);
	/**
	 * Centinela de «ya se ha decidido si el modal sale solo». Es un `let` normal a propósito,
	 * NO estado reactivo: `iniciar()` lo lee y lo escribe, y se llama desde un `$effect` del
	 * layout. Con `$state` ese efecto se suscribía a él, la propia llamada lo invalidaba, el
	 * efecto se reejecutaba, su limpieza cancelaba el temporizador de los 900 ms y el modal no
	 * llegaba a salir nunca. Aquí no hay nada que enseñar en pantalla que dependa de esto.
	 */
	let iniciado = false;

	return {
		get bienvenidaAbierta() {
			return bienvenidaAbierta;
		},
		get origen() {
			return origen;
		},
		get sugerenciasAbierto() {
			return sugerenciasAbierto;
		},
		get apuntado() {
			return apuntado;
		},
		/**
		 * Lee lo guardado y decide si el modal sale solo. Se llama una vez, desde el layout y
		 * dentro de un `$effect` (o sea, ya en el navegador).
		 *
		 * Devuelve si toca abrirlo, en vez de abrirlo aquí, para que quien llama pueda darle el
		 * respiro de unos cientos de milisegundos: un modal que aparece a la vez que la página
		 * tapa el banco antes de que se haya visto, y entonces la invitación no se entiende.
		 */
		iniciar(): boolean {
			if (!browser || iniciado) return false;
			iniciado = true;
			try {
				apuntado = localStorage.getItem(CLAVE_HECHO) === '1';
				if (apuntado) return false;
				return localStorage.getItem(CLAVE_VISTO) !== hoy();
			} catch {
				// navegador con el almacenamiento capado: se enseña, que es el caso amable
				return true;
			}
		},

		abrirBienvenida(desde: OrigenBienvenida = 'boton') {
			origen = desde;
			bienvenidaAbierta = true;
		},

		/**
		 * Cerrar sin apuntarse. Se anota el día para no repetir en la misma sesión de navegación,
		 * y solo cuando el modal salió solo: si lo abrió una persona a propósito, cerrarlo no
		 * dice nada sobre si quiere volver a verlo mañana.
		 */
		cerrarBienvenida() {
			bienvenidaAbierta = false;
			if (origen !== 'auto') return;
			try {
				localStorage.setItem(CLAVE_VISTO, hoy());
			} catch {
				// sin almacenamiento no hay memoria: se volverá a ver, y no pasa nada
			}
		},

		/** Correo dejado: se recuerda para siempre en este dispositivo. */
		marcarApuntado() {
			apuntado = true;
			try {
				localStorage.setItem(CLAVE_HECHO, '1');
			} catch {
				// idem
			}
		},

		abrirSugerencias() {
			sugerenciasAbierto = true;
		},
		cerrarSugerencias() {
			sugerenciasAbierto = false;
		}
	};
}

export const comunidad = crearComunidad();
