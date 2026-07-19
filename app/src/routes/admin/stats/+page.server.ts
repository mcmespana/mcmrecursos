import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const [recursosRes, statsRes, perfilesRes] = await Promise.all([
		supabase.from('recurso').select('id, nombre, tipo, estado'),
		supabase.from('recurso_stats').select('*'),
		supabase.from('perfil').select('id', { count: 'exact', head: true })
	]);

	const recursos = recursosRes.data ?? [];
	const stats = new Map((statsRes.data ?? []).map((s: any) => [s.recurso_id, s]));
	const nombreDe = new Map(recursos.map((r) => [r.id, r.nombre.replace(/^\[EJEMPLO\]\s*/, '')]));

	const porEstado: Record<string, number> = {};
	for (const r of recursos) porEstado[r.estado] = (porEstado[r.estado] ?? 0) + 1;

	const conStats = [...stats.values()].filter((s: any) => nombreDe.has(s.recurso_id));
	const topAccesos = conStats
		.sort((a: any, b: any) => b.num_accesos - a.num_accesos)
		.slice(0, 8)
		.map((s: any) => ({ nombre: nombreDe.get(s.recurso_id)!, valor: s.num_accesos }));
	const topValorados = conStats
		.filter((s: any) => s.valoracion_media != null)
		.sort((a: any, b: any) => b.valoracion_media - a.valoracion_media || b.num_valoraciones - a.num_valoraciones)
		.slice(0, 8)
		.map((s: any) => ({
			nombre: nombreDe.get(s.recurso_id)!,
			valor: Number(s.valoracion_media),
			extra: s.num_valoraciones
		}));

	return {
		totales: {
			recursos: recursos.length,
			publicados: porEstado['publicado'] ?? 0,
			usuarios: perfilesRes.count ?? 0,
			accesos: conStats.reduce((acc: number, s: any) => acc + s.num_accesos, 0),
			valoraciones: conStats.reduce((acc: number, s: any) => acc + s.num_valoraciones, 0),
			favoritos: conStats.reduce((acc: number, s: any) => acc + s.num_favoritos, 0)
		},
		porEstado,
		topAccesos,
		topValorados
	};
};
