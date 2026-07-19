import type { PageLoad } from './$types';
import type { ListaValor, RecursoCatalogo } from '$lib/catalogo/tipos';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();

	const [recursosRes, listasRes] = await Promise.all([
		supabase
			.from('recurso')
			.select(
				`id, nombre, descripcion, tipo, etapas, nivel, edades, idioma, soporte, ubicacion,
				 enlace, imagen, anyo_publicacion, curso_usado, visibilidad, estado,
				 fuera_del_banco, pendiente_clasificar,
				 mcm_local:mcm_local_id (nombre),
				 recurso_tag (tag (nombre)),
				 recurso_autor (autor (nombre, apellidos)),
				 relaciones:recurso_relacion!recurso_relacion_recurso_id_fkey (relacionado_id)`
			)
			.order('nombre'),
		supabase.from('lista_valor').select('lista, valor, grupo, orden').eq('activo', true).order('orden')
	]);

	const recursos: RecursoCatalogo[] = (recursosRes.data ?? []).map((r: any) => ({
		id: r.id,
		nombre: r.nombre,
		descripcion: r.descripcion,
		tipo: r.tipo,
		etapas: r.etapas ?? [],
		nivel: r.nivel,
		edades: r.edades ?? [],
		mcm_local: r.mcm_local?.nombre ?? null,
		idioma: r.idioma,
		soporte: r.soporte,
		ubicacion: r.ubicacion,
		enlace: r.enlace,
		imagen: r.imagen,
		anyo_publicacion: r.anyo_publicacion,
		curso_usado: r.curso_usado,
		visibilidad: r.visibilidad,
		estado: r.estado,
		fuera_del_banco: r.fuera_del_banco,
		pendiente_clasificar: r.pendiente_clasificar,
		tags: (r.recurso_tag ?? []).map((t: any) => t.tag?.nombre).filter(Boolean),
		autores: (r.recurso_autor ?? [])
			.map((a: any) => [a.autor?.nombre, a.autor?.apellidos].filter(Boolean).join(' '))
			.filter(Boolean),
		relacionados: (r.relaciones ?? []).map((x: any) => x.relacionado_id)
	}));

	const listas: ListaValor[] = listasRes.data ?? [];

	return { recursos, listas };
};
