import {
	BookOpen,
	Clapperboard,
	Shapes,
	Sparkles,
	Tent,
	Users,
	type Icon as IconType
} from '@lucide/svelte';

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
	// agregados sociales (vista recurso_stats)
	valoracion_media: number | null;
	num_valoraciones: number;
	num_favoritos: number;
	num_usos: number;
	num_accesos: number;
}

export interface ListaValor {
	lista: string;
	valor: string;
	grupo: string | null;
	orden: number;
}

/** Lo mío (solo con sesión): estado social del usuario sobre el catálogo. */
export interface SocialPropio {
	favoritos: Set<string>;
	usos: Set<string>;
	valoraciones: Map<string, number>;
}

export const socialVacio = (): SocialPropio => ({
	favoritos: new Set(),
	usos: new Set(),
	valoraciones: new Map()
});

/** Familias de `tipo` → clases de badge (paleta por familia, ver docs/04-diseno.md). */
export const FAMILIA_BADGE: Record<string, string> = {
	'Sesiones y formación': 'bg-primary/12 text-primary dark:bg-primary/20',
	Actividades: 'bg-emerald-500/12 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
	'Celebración y oración': 'bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300',
	'Audiovisual y gráfico': 'bg-warm/20 text-warm-foreground dark:bg-warm/15 dark:text-warm',
	Documentos: 'bg-slate-500/12 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300'
};

/** Tinte del fondo de miniatura de respaldo por familia. */
export const FAMILIA_FONDO: Record<string, string> = {
	'Sesiones y formación': 'from-primary/20 via-primary/5 to-primary/15',
	Actividades: 'from-emerald-500/20 via-emerald-500/5 to-emerald-500/15',
	'Celebración y oración': 'from-violet-500/20 via-violet-500/5 to-violet-500/15',
	'Audiovisual y gráfico': 'from-warm/30 via-warm/10 to-warm/20',
	Documentos: 'from-slate-500/20 via-slate-500/5 to-slate-500/15'
};

export const FAMILIA_ICON: Record<string, typeof IconType> = {
	'Sesiones y formación': Users,
	Actividades: Tent,
	'Celebración y oración': Sparkles,
	'Audiovisual y gráfico': Clapperboard,
	Documentos: BookOpen
};

export const ICONO_NEUTRO = Shapes;
export const BADGE_NEUTRO = 'bg-muted text-muted-foreground';
export const FONDO_NEUTRO = 'from-primary/15 via-accent to-warm/20';

export const limpiarNombre = (nombre: string) => nombre.replace(/^\[EJEMPLO\]\s*/, '');
export const esEjemplo = (nombre: string) => nombre.startsWith('[EJEMPLO]');
