import type { PageServerLoad } from './$types';

const DIAS_SERIE = 30;

export const load: PageServerLoad = async ({ locals: { supabase } }) => {
	const desde = new Date();
	desde.setUTCDate(desde.getUTCDate() - (DIAS_SERIE - 1));
	desde.setUTCHours(0, 0, 0, 0);

	const [recursosRes, statsRes, perfilesRes, accesosRes, autoresRes] = await Promise.all([
		supabase.from('recurso').select('id, nombre, tipo, estado'),
		supabase.from('recurso_stats').select('*'),
		supabase.from('perfil').select('id', { count: 'exact', head: true }),
		supabase.from('acceso').select('created_at').gte('created_at', desde.toISOString()),
		supabase.from('recurso_autor').select('recurso_id, autor:autor_id (nombre, apellidos)')
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

	// serie diaria de accesos (últimos DIAS_SERIE días, con los días sin clics a 0)
	const porDia = new Map<string, number>();
	for (let i = 0; i < DIAS_SERIE; i++) {
		const d = new Date(desde);
		d.setUTCDate(d.getUTCDate() + i);
		porDia.set(d.toISOString().slice(0, 10), 0);
	}
	for (const a of accesosRes.data ?? []) {
		const dia = String(a.created_at).slice(0, 10);
		if (porDia.has(dia)) porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
	}
	const accesosPorDia = [...porDia.entries()].map(([dia, valor]) => ({
		fecha: new Date(`${dia}T00:00:00Z`),
		valor
	}));

	// ranking de autores por accesos acumulados de sus recursos
	const porAutor = new Map<string, { nombre: string; recursos: Set<string>; accesos: number }>();
	for (const ra of autoresRes.data ?? []) {
		const autor: any = ra.autor;
		if (!autor) continue;
		const clave = [autor.nombre, autor.apellidos].filter(Boolean).join(' ');
		if (!clave) continue;
		const entrada = porAutor.get(clave) ?? { nombre: clave, recursos: new Set<string>(), accesos: 0 };
		entrada.recursos.add(ra.recurso_id);
		entrada.accesos += stats.get(ra.recurso_id)?.num_accesos ?? 0;
		porAutor.set(clave, entrada);
	}
	const topAutores = [...porAutor.values()]
		.sort((a, b) => b.accesos - a.accesos)
		.slice(0, 8)
		.map((a) => ({ nombre: a.nombre, valor: a.accesos, extra: a.recursos.size }));

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
		topValorados,
		topAutores,
		accesosPorDia
	};
};
