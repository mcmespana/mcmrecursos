import { detectarFormato, formatoDeMime, necesitaConsultaDrive } from '$lib/catalogo/formatos';
import { mimeDeDrive } from './drive';

/**
 * Formato definitivo de un enlace (SPEC-011).
 *
 * Primero se mira la URL, que ya distingue Docs, Slides, Sheets, Forms, carpetas de Drive,
 * YouTube, Canva y todo lo que lleve extensión. Solo cuando la URL se queda en «es un archivo
 * de Drive» se gasta una llamada a la API para saber si es un PDF, un Word, una imagen… Si la
 * cuenta de servicio no está configurada, se conserva el genérico y se verá el icono de Drive.
 */
export async function resolverFormato(enlace: string | null | undefined): Promise<string | null> {
	const base = detectarFormato(enlace);
	if (!necesitaConsultaDrive(base)) return base;
	return formatoDeMime(await mimeDeDrive(enlace ?? null)) ?? base;
}
