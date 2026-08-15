<script lang="ts" module>
	/**
	 * Las señales del catálogo, ordenadas por lo que duele (SPEC-014 §señales, rediseño 2026-08-15).
	 *
	 * El problema de la versión anterior no era el contenido sino la **falta de jerarquía**: catorce
	 * tarjetas idénticas en una rejilla de tres columnas, donde «12 publicados que no llevan a
	 * ningún sitio» pesaba exactamente lo mismo que «3 sin descripción». Con todo al mismo nivel no
	 * hay pantalla que se lea: hay que leérsela entera para saber por dónde empezar, y eso es
	 * justo lo que una pantalla de salud tiene que ahorrarte.
	 *
	 * Ahora la gravedad decide el peso visual. Tres niveles, y cada uno se dibuja distinto:
	 *
	 *  - `roto`  — lo que un monitor se encuentra hoy y no funciona. Tarjetas grandes, número en
	 *              tipografía display, rojo. Son pocas por definición; si hay una, manda.
	 *  - `medias`— catálogo a medio rellenar: no está roto, pero no aparece donde debería.
	 *  - `pulir` — metadatos y decisiones conscientes. Filas compactas: seis cosas cosméticas no
	 *              merecen seis tarjetas del mismo tamaño que «hay enlaces muertos».
	 */
	export type Nivel = 'roto' | 'medias' | 'pulir';

	export interface MetaSenal {
		titulo: string;
		/** Por qué duele, no qué falta. Sin el número: el número ya es el héroe de la tarjeta. */
		porque: string;
		nivel: Nivel;
		/** Para las que ya tienen quien las arregla en lote desde /admin/recursos. */
		accionPropia?: { etiqueta: string; accion: string };
	}

	export const SENAL_META: Record<string, MetaSenal> = {
		sin_enlace: {
			titulo: 'Sin enlace',
			porque: 'Están publicados y no llevan a ninguna parte.',
			nivel: 'roto'
		},
		enlaces_repetidos: {
			titulo: 'Enlaces repetidos',
			porque: 'Grupos de recursos que apuntan al mismo sitio.',
			nivel: 'roto'
		},
		sin_tematicas: {
			titulo: 'Sin temáticas',
			porque: 'No salen al filtrar por tema, que es como más se busca.',
			nivel: 'medias'
		},
		sin_etapa: {
			titulo: 'Sin etapa',
			porque: 'Invisibles al filtro que más se usa.',
			nivel: 'medias'
		},
		envios_viejos: {
			titulo: 'Envíos parados',
			porque: 'Llevan más de 14 días esperando revisión.',
			nivel: 'medias'
		},
		olvidados: {
			titulo: 'Olvidados',
			porque: 'Publicados hace más de 90 días y nadie los ha abierto.',
			nivel: 'medias'
		},
		sin_formato: {
			titulo: 'Sin formato',
			porque: 'No se sabe si es un documento, un vídeo o una carpeta.',
			nivel: 'medias',
			accionPropia: { etiqueta: 'Detectar formatos', accion: 'detectarFormatos' }
		},
		por_clasificar: {
			titulo: 'Por clasificar',
			porque: 'Esperan a que la IA proponga sus metadatos.',
			nivel: 'medias',
			accionPropia: { etiqueta: 'Analizar pendientes', accion: 'clasificarPendientes' }
		},
		sin_embedding: {
			titulo: 'Sin indexar',
			porque: 'Publicados que no se pueden buscar por significado.',
			nivel: 'medias',
			accionPropia: { etiqueta: 'Reindexar búsqueda', accion: 'reindexarSemantica' }
		},
		sin_descripcion: {
			titulo: 'Sin descripción',
			porque: 'Se ven en la ficha, pero no cuentan de qué van.',
			nivel: 'pulir'
		},
		sin_tipo: { titulo: 'Sin tipo', porque: 'Sin familia asignada.', nivel: 'pulir' },
		sin_edades: { titulo: 'Sin edades', porque: 'Sin tramo de edad.', nivel: 'pulir' },
		fuera_del_banco: {
			titulo: 'Fuera del banco',
			porque: 'Marcados a propósito. Aquí solo para tenerlos contados.',
			nivel: 'pulir'
		},
		editados_en_web: {
			titulo: 'Editados en la web',
			porque: 'Protegidos de la próxima sincronización.',
			nivel: 'pulir'
		}
	};

	const ORDEN = Object.keys(SENAL_META);

	export interface Senal {
		key: string;
		n: number;
		meta: MetaSenal;
		oculta: boolean;
	}

	/** `envios_viejos` cuenta sobre `envio`, no sobre `recurso`: `ids_senal()` (00023) no lo filtra. */
	export function rutaVer(key: string): string {
		if (key === 'envios_viejos') return '/admin/revision';
		return `/admin/recursos?pendiente=${key}`;
	}

	export function listarSenales(
		senales: Record<string, number> | null,
		ocultas: string[],
		verOcultas: boolean
	): Senal[] {
		if (!senales) return [];
		return ORDEN.map((key) => ({
			key,
			n: senales[key] ?? 0,
			meta: SENAL_META[key],
			oculta: ocultas.includes(key)
		})).filter((s) => s.n > 0 && (!s.oculta || verOcultas));
	}
</script>

<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ArrowRight, Eye, EyeOff, ListPlus, ShieldCheck, Sparkles } from '@lucide/svelte';

	let {
		senales,
		ocultas,
		esAdmin = false,
		cargando,
		onapuntar,
		onlote,
		onocultar
	}: {
		senales: Record<string, number> | null;
		ocultas: string[];
		esAdmin?: boolean;
		cargando: (clave: string) => boolean;
		onapuntar: (key: string, n: number) => void;
		onlote: (accion: string, etiqueta: string) => void;
		onocultar: (key: string, mostrar: boolean) => void;
	} = $props();

	let verOcultas = $state(false);

	const lista = $derived(listarSenales(senales, ocultas, verOcultas));
	const rotas = $derived(lista.filter((s) => s.meta.nivel === 'roto'));
	const medias = $derived(lista.filter((s) => s.meta.nivel === 'medias'));
	const pulir = $derived(lista.filter((s) => s.meta.nivel === 'pulir'));
	const hayOcultasConDatos = $derived(ocultas.some((k) => (senales?.[k] ?? 0) > 0));

	const hayAlgo = $derived(lista.length > 0);

	/**
	 * El resumen de arriba cuenta **señales**, no recursos sumados.
	 *
	 * Sumar los contadores de todas las señales daría un número grande y falso: un mismo recurso
	 * puede estar sin etapa y sin descripción a la vez, y «4 enlaces repetidos» son grupos, no
	 * recursos — sumar eso con «12 sin enlace» es sumar peras con manzanas. Así que aquí se cuenta
	 * lo único que se puede contar sin mentir, y la magnitud de cada cosa vive en su tarjeta.
	 *
	 * Va como línea discreta y no como panel rojo a todo lo ancho: la sección «Roto» que viene
	 * justo debajo ya es el aviso, y repetirlo en grande solo gritaba.
	 */
	const resumen = $derived(
		[
			{ n: rotas.length, etiqueta: 'rota', plural: 'rotas', punto: 'bg-destructive' },
			{ n: medias.length, etiqueta: 'a medio catalogar', plural: 'a medio catalogar', punto: 'bg-warm' },
			{ n: pulir.length, etiqueta: 'por pulir', plural: 'por pulir', punto: 'bg-muted-foreground/40' }
		].filter((x) => x.n > 0)
	);
</script>

{#snippet ojo(s: Senal)}
	{#if esAdmin}
		<button
			type="button"
			class="toque inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 opacity-0 transition hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/senal:opacity-100 max-sm:opacity-100"
			onclick={() => onocultar(s.key, s.oculta)}
			aria-label={s.oculta ? `Dejar de ocultar ${s.meta.titulo}` : `Ocultar ${s.meta.titulo}`}
			title={s.oculta ? 'Dejar de ocultar' : 'Silenciar esta señal'}
		>
			{#if s.oculta}<Eye class="size-3.5" />{:else}<EyeOff class="size-3.5" />{/if}
		</button>
	{/if}
{/snippet}

{#snippet acciones(s: Senal, compacto = false)}
	<a
		href={rutaVer(s.key)}
		class="inline-flex items-center gap-1 text-[13px] font-semibold text-primary underline-offset-4 hover:underline"
	>
		Ver {compacto ? '' : `los ${s.n}`}<ArrowRight class="size-3.5" />
	</a>
	{#if s.meta.accionPropia}
		<Button
			variant="outline"
			size="sm"
			cargando={cargando(`lote-${s.meta.accionPropia.accion}`)}
			textoCargando="Trabajando…"
			onclick={() => onlote(s.meta.accionPropia!.accion, s.meta.accionPropia!.etiqueta)}
		>
			<Sparkles class="size-3.5" />{s.meta.accionPropia.etiqueta}
		</Button>
	{:else}
		<button
			type="button"
			disabled={cargando(`senal-${s.key}`)}
			class="toque inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
			onclick={() => onapuntar(s.key, s.n)}
			title="Crear una tarea en el buzón del equipo"
		>
			<ListPlus class="size-3.5" /> Apuntar
		</button>
	{/if}
{/snippet}

<div class="flex flex-col gap-7">
	{#if !hayAlgo}
		<!-- Sin emoji y sin «¡enhorabuena!»: decir qué se ha mirado vale más que celebrarlo -->
		<div
			class="flex items-center gap-3.5 rounded-2xl border border-emerald-600/25 bg-emerald-600/[0.06] p-5"
		>
			<ShieldCheck class="size-6 shrink-0 text-emerald-700 dark:text-emerald-500" />
			<div class="flex flex-col gap-0.5">
				<p class="font-display text-lg font-bold">Nada que señalar</p>
				<p class="text-sm text-muted-foreground">
					Ni enlaces muertos, ni recursos sin clasificar, ni envíos parados. El catálogo está al día.
				</p>
			</div>
		</div>
	{:else}
		<p class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
			{#each resumen as r, i (r.etiqueta)}
				<span class="flex items-center gap-1.5">
					<span class={`size-1.5 rounded-full ${r.punto}`}></span>
					<span class="font-semibold text-foreground tabular-nums">{r.n}</span>
					{#if i === 0}{r.n === 1 ? 'señal' : 'señales'}{/if}
					{r.n === 1 ? r.etiqueta : r.plural}
				</span>
			{/each}
		</p>
	{/if}

	{#if rotas.length}
		<section class="flex flex-col gap-3">
			<h2 class="flex items-center gap-2 text-sm font-semibold tracking-wide text-destructive uppercase">
				<span class="size-1.5 rounded-full bg-destructive"></span> Roto
			</h2>
			<!-- Dos columnas: son pocas y tienen que pesar -->
			<div class="grid gap-3 md:grid-cols-2">
				{#each rotas as s (s.key)}
					<div
						class={`group/senal flex flex-col gap-3 rounded-2xl border border-destructive/25 bg-destructive/[0.05] p-5 ${s.oculta ? 'opacity-55' : ''}`}
					>
						<div class="flex items-start gap-4">
							<span class="font-display text-4xl leading-none font-extrabold text-destructive tabular-nums">
								{s.n.toLocaleString('es')}
							</span>
							<div class="flex min-w-0 flex-1 flex-col gap-0.5">
								<p class="font-semibold">{s.meta.titulo}</p>
								<p class="text-[13px]/[1.45] text-muted-foreground [text-wrap:pretty]">
									{s.meta.porque}
								</p>
							</div>
							{@render ojo(s)}
						</div>
						<div class="mt-auto flex flex-wrap items-center gap-3">{@render acciones(s)}</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if medias.length}
		<section class="flex flex-col gap-3">
			<h2
				class="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
			>
				<span class="size-1.5 rounded-full bg-warm"></span> A medio catalogar
			</h2>
			<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
				{#each medias as s (s.key)}
					<div
						class={`group/senal flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 ${s.oculta ? 'opacity-55' : ''}`}
					>
						<div class="flex items-start gap-3">
							<span
								class="font-display text-3xl leading-none font-bold tabular-nums"
							>
								{s.n.toLocaleString('es')}
							</span>
							<div class="flex min-w-0 flex-1 flex-col gap-0.5">
								<p class="text-sm font-semibold">{s.meta.titulo}</p>
								<p class="text-[12.5px]/[1.45] text-muted-foreground [text-wrap:pretty]">
									{s.meta.porque}
								</p>
							</div>
							{@render ojo(s)}
						</div>
						<div class="mt-auto flex flex-wrap items-center gap-3">{@render acciones(s)}</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if pulir.length}
		<section class="flex flex-col gap-3">
			<h2
				class="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted-foreground uppercase"
			>
				<span class="size-1.5 rounded-full bg-muted-foreground/40"></span> Por pulir
			</h2>
			<!--
				Filas y no tarjetas: son detalles. Darles el mismo cajón que a «hay enlaces muertos»
				es lo que hacía que la pantalla no se pudiera leer de un vistazo.
			-->
			<div class="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
				{#each pulir as s (s.key)}
					<!--
						En una línea a partir de `sm`. En móvil no cabe: el texto quedaba estrangulado
						en una columna de cuatro palabras de ancho, así que las acciones se van a su
						propia línea y la descripción recupera el ancho entero.
					-->
					<div
						class={`group/senal flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${s.oculta ? 'opacity-55' : ''}`}
					>
						<span class="w-10 shrink-0 font-display text-xl leading-none font-bold tabular-nums">
							{s.n.toLocaleString('es')}
						</span>
						<div
							class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-x-2.5"
						>
							<p class="text-sm font-semibold">{s.meta.titulo}</p>
							<p class="text-[12.5px] text-muted-foreground [text-wrap:pretty]">{s.meta.porque}</p>
						</div>
						<div class="flex w-full items-center gap-3 pl-13 sm:w-auto sm:pl-0">
							{@render acciones(s, true)}{@render ojo(s)}
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if hayOcultasConDatos}
		<button
			type="button"
			class="toque inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			onclick={() => (verOcultas = !verOcultas)}
		>
			{#if verOcultas}<EyeOff class="size-3.5" />{:else}<Eye class="size-3.5" />{/if}
			{verOcultas ? 'Esconder las señales silenciadas' : 'Ver las señales silenciadas'}
		</button>
	{/if}
</div>
