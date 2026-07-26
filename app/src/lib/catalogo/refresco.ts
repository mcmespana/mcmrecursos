import { invalidateAll } from '$app/navigation';

let temporizador: ReturnType<typeof setTimeout> | null = null;

/**
 * Resincroniza el catálogo con el servidor, pero sin hacerlo a cada clic.
 *
 * La capa social ya es optimista en la interfaz: el corazón se pinta al instante. Lo que hace
 * falta del servidor son los contadores agregados, y eso puede esperar. Recargar TODO el
 * catálogo en cada corazón, cada uso y cada valoración es justo lo que hacía que la app
 * pareciera lenta y que los botones se «quedasen pensando». Se agrupan en una sola recarga
 * cuando pasa un momento sin actividad.
 */
export function refrescarCatalogo(retardo = 1500) {
	if (temporizador) clearTimeout(temporizador);
	temporizador = setTimeout(() => {
		temporizador = null;
		invalidateAll();
	}, retardo);
}
