import type { LayoutServerLoad } from './$types';
import { embeddingsDisponibles } from '$lib/server/embeddings';

export const load: LayoutServerLoad = async ({ locals: { session }, cookies }) => {
	return {
		session,
		cookies: cookies.getAll(),
		// activa el buscador por significado en el cliente solo si Voyage está configurado
		busquedaSemantica: embeddingsDisponibles()
	};
};
