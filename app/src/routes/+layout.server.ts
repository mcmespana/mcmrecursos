import type { LayoutServerLoad } from './$types';
import { embeddingsDisponibles } from '$lib/server/embeddings';

export const load: LayoutServerLoad = async ({ locals: { session, supabase }, cookies }) => {
	/**
	 * Cuánta gente espera ya (SPEC-017 §1). Es un `count(*)` sobre una tabla diminuta detrás de
	 * una función pública que solo devuelve el número — nunca una dirección — así que viaja con
	 * el layout y no cuesta una petición aparte. El modal decide si vale la pena enseñarlo: con
	 * cuatro apuntados, el número resta.
	 */
	const { data: enEspera } = await supabase.rpc('cuenta_espera');

	return {
		session,
		cookies: cookies.getAll(),
		enEspera: (enEspera as number | null) ?? 0,
		// activa el buscador por significado en el cliente solo si Voyage está configurado
		busquedaSemantica: embeddingsDisponibles()
	};
};
