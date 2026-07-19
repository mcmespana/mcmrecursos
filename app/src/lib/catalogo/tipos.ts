export interface RecursoCatalogo {
	id: string;
	nombre: string;
	descripcion: string | null;
	tipo: string | null;
	etapas: string[];
	nivel: string | null;
	edades: string[];
	mcm_local: string | null;
	idioma: string | null;
	soporte: string | null;
	ubicacion: string | null;
	enlace: string | null;
	imagen: string | null;
	anyo_publicacion: number | null;
	curso_usado: string | null;
	visibilidad: string;
	estado: string;
	fuera_del_banco: boolean;
	pendiente_clasificar: boolean;
	tags: string[];
	autores: string[];
	relacionados: string[];
}

export interface ListaValor {
	lista: string;
	valor: string;
	grupo: string | null;
	orden: number;
}

/** Familias de `tipo` → clases de badge (paleta por familia, ver docs/04-diseno.md). */
export const FAMILIA_BADGE: Record<string, string> = {
	'Sesiones y formación': 'bg-primary/12 text-primary dark:bg-primary/20',
	Actividades: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
	'Celebración y oración': 'bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
	'Audiovisual y gráfico': 'bg-warm/20 text-warm-foreground dark:bg-warm/15 dark:text-warm',
	Documentos: 'bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300'
};

export const BADGE_NEUTRO = 'bg-muted text-muted-foreground';
