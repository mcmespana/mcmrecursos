import type { PageLoad } from './$types';

/**
 * Vocabularios para el bloque opcional de clasificación del formulario público.
 * Son lectura pública (RLS `lectura publica`), así que también los ve quien no tiene cuenta.
 */
export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();

	const [listasRes, tagsRes] = await Promise.all([
		supabase
			.from('lista_valor')
			.select('lista, valor, grupo, orden')
			.eq('activo', true)
			.in('lista', ['tipo', 'etapas', 'edades', 'idioma'])
			.order('orden'),
		supabase.from('tag').select('nombre, recurso_tag(recurso_id)').limit(400)
	]);

	// las temáticas se ofrecen por uso: primero las que más recursos tienen
	const tags = (tagsRes.data ?? [])
		.map((t: any) => ({ nombre: t.nombre as string, usos: (t.recurso_tag ?? []).length }))
		.sort((a, b) => b.usos - a.usos || a.nombre.localeCompare(b.nombre, 'es'))
		.map((t) => t.nombre);

	return { listas: listasRes.data ?? [], tags };
};
