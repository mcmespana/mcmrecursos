<script lang="ts">
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import {
		FAMILIA_BADGE,
		FAMILIA_FONDO,
		BADGE_NEUTRO,
		FONDO_NEUTRO,
		iconoDeTipo,
		limpiarNombre,
		esEjemplo,
		miniatura,
		resumirEdades
	} from '$lib/catalogo/tipos';
	import { FORMATOS, formatoEfectivo, urlFavicon } from '$lib/catalogo/formatos';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import Estrellas from '$lib/components/Estrellas.svelte';
	import { FolderSymlink, Heart, Lock, PackageOpen } from '@lucide/svelte';

	let {
		recurso,
		familia,
		favorito,
		vocabEdades = [],
		nombreTransicion = null,
		conEstadoEditorial = false,
		onopen,
		onfavorito
	}: {
		recurso: RecursoCatalogo;
		familia: string | null;
		favorito: boolean;
		/** Vocabulario de edades, para poder decir «todas» en vez de listarlas (`resumirEdades`). */
		vocabEdades?: string[];
		/** `view-transition-name` de la miniatura mientras se abre la ficha (SPEC-012 §Movimiento). */
		nombreTransicion?: string | null;
		/**
		 * Enseñar las marcas de trabajo interno («Por clasificar», «fuera del banco»). Solo para
		 * quien tiene rol de panel: a quien viene a buscar una sesión para el martes no le dicen
		 * nada, y lo que comunican es «este recurso está a medio hacer» sobre material que
		 * probablemente está perfecto (F6 de docs/06-reflexion-uiux.md).
		 */
		conEstadoEditorial?: boolean;
		onopen: (r: RecursoCatalogo) => void;
		onfavorito: (r: RecursoCatalogo) => void;
	} = $props();

	const badgeClase = $derived((familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO);
	const fondoClase = $derived((familia && FAMILIA_FONDO[familia]) || FONDO_NEUTRO);
	const Icono = $derived(iconoDeTipo(recurso.tipo, familia));
	const nombre = $derived(limpiarNombre(recurso.nombre));
	// la tarjeta enseña tres edades como mucho; con todas puestas dice «todas»
	const edades = $derived(resumirEdades(recurso.edades, vocabEdades, 3));
	const formato = $derived(formatoEfectivo(recurso.enlace, recurso.formato));
	// una web sin miniatura se reconoce mucho mejor por su favicon que por un globo genérico
	const favicon = $derived(formato === 'web' ? urlFavicon(recurso.enlace, 128) : null);
	let faviconFallo = $state(false);
	let imgFallo = $state(false);
	const srcMiniatura = $derived(!imgFallo ? miniatura(recurso) : null);
</script>

<article
	class="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
>
	<!--
		La tarjeta entera se abre con un botón que la cubre, y el corazón va por encima (z-20). El
		nombre accesible lleva también el tipo: en la rejilla hay decenas de «Ver ficha de…» seguidos
		y con solo el título no siempre se sabe qué se va a abrir.
	-->
	<button
		type="button"
		class="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		onclick={() => onopen(recurso)}
	>
		<span class="sr-only">
			Ver ficha de {nombre}{recurso.tipo ? `, ${recurso.tipo}` : ''}
		</span>
	</button>

	<div
		class="relative aspect-[2/1] w-full overflow-hidden"
		style={nombreTransicion ? `view-transition-name: ${nombreTransicion}` : undefined}
	>
		{#if srcMiniatura}
			<img
				src={srcMiniatura}
				alt={`${nombre} (${recurso.tipo ?? 'recurso'})`}
				class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
				loading="lazy"
				onerror={() => (imgFallo = true)}
			/>
		{:else}
			<div class={`flex size-full items-center justify-center bg-gradient-to-br ${fondoClase}`}>
				{#if favicon && !faviconFallo}
					<img
						src={favicon}
						alt=""
						class="size-10 rounded-lg bg-background/70 p-2 shadow-sm transition-transform duration-300 group-hover:scale-110"
						loading="lazy"
						onerror={() => (faviconFallo = true)}
					/>
				{:else}
					<Icono
						class="size-12 text-foreground/15 transition-transform duration-300 group-hover:scale-110"
						strokeWidth={1.5}
					/>
				{/if}
			</div>
		{/if}

		<div class="absolute top-2 left-2 flex items-center gap-1.5">
			{#if recurso.tipo}
				<Badge class={`border-transparent shadow-sm ${badgeClase}`}>{recurso.tipo}</Badge>
			{/if}
			{#if formato}
				<span
					class="flex items-center gap-1 rounded-full bg-background/85 px-1.5 py-0.5 shadow-sm backdrop-blur"
					title={recurso.archivos.length
						? `${FORMATOS[formato].etiqueta} · y ${recurso.archivos.length} formato${recurso.archivos.length === 1 ? '' : 's'} más`
						: FORMATOS[formato].etiqueta}
				>
					<IconoFormato enlace={recurso.enlace} formato={recurso.formato} class="size-3.5" />
					{#if recurso.archivos.length}
						<span class="text-[10px] font-medium text-muted-foreground tabular-nums">
							+{recurso.archivos.length}
						</span>
					{/if}
				</span>
			{/if}
			{#if recurso.visibilidad === 'privado'}
				<span
					class="flex size-5 items-center justify-center rounded-full bg-background/85 shadow-sm backdrop-blur"
					title="Recurso privado: requiere iniciar sesión"
				>
					<Lock class="size-3 text-muted-foreground" />
				</span>
			{/if}
		</div>
		{#if esEjemplo(recurso.nombre)}
			<Badge
				variant="outline"
				class="absolute right-2 bottom-2 bg-background/80 text-[10px] backdrop-blur"
			>
				Ejemplo
			</Badge>
		{/if}

		<!--
			Corazón rápido. Se muestra siempre en pantallas pequeñas: sin ratón no hay `hover`, así
			que en móvil el `opacity-0` lo dejaba invisible y no había forma de guardar un favorito
			sin abrir la ficha. `toque-encima` le da los 44 px de zona sensible sin engordarlo.
		-->
		<button
			type="button"
			aria-label={`${favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}: ${nombre}`}
			aria-pressed={favorito}
			class={`toque-encima absolute top-2 right-2 z-20 flex size-8 items-center justify-center rounded-full shadow-sm backdrop-blur transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
				favorito
					? 'bg-destructive/90 text-white'
					: 'bg-background/80 text-muted-foreground opacity-100 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100'
			}`}
			onclick={(e) => {
				e.stopPropagation();
				onfavorito(recurso);
			}}
		>
			<Heart class={`size-4 transition-transform ${favorito ? 'scale-110 fill-current' : ''}`} />
		</button>
	</div>

	<div class="flex flex-1 flex-col gap-1 p-3">
		<h3 class="line-clamp-2 text-[15px] leading-snug font-semibold text-balance">{nombre}</h3>

		<!--
			Etapas y edades son dos taxonomías distintas y aquí iban pegadas con un guion largo:
			«MIC · COM · LC — 5º EP, 6º EP». Para quien lleva años en el MCM las siglas son
			transparentes; para un monitor nuevo —justo quien más necesita el banco— son ruido con
			aspecto de dato. Ahora las edades van con su «para» delante, que es lo que la sigla no
			dice (F5 de docs/06-reflexion-uiux.md).
		-->
		<!--
			Dos líneas, no una: con cuatro etapas y «para todas las edades» el `line-clamp-1` cortaba
			justo la parte que informa y dejaba «MIC · COM · LC · Monitores · para…», que es peor que
			no poner nada. Casi siempre sigue cabiendo en una.
		-->
		{#if recurso.etapas.length || recurso.edades.length}
			<p class="line-clamp-2 text-xs text-muted-foreground">
				{#if recurso.etapas.length}<span>{recurso.etapas.join(' · ')}</span>{/if}
				{#if recurso.edades.length}
					<span class="text-muted-foreground/70">
						{recurso.etapas.length ? '· para' : 'Para'}
						{edades.todas ? 'todas las edades' : edades.valores.join(', ')}
					</span>
				{/if}
			</p>
		{/if}

		<!--
			La fila social solo si dice algo (F8). Con el banco joven, «Sin valorar» salía en cinco
			de siete tarjetas: una fila entera ocupando sitio para informar de que no hay
			información. Cuando haya valoraciones aparece sola.
		-->
		{#if recurso.num_valoraciones || recurso.num_favoritos || (conEstadoEditorial && recurso.pendiente_clasificar) || recurso.fuera_del_banco}
			<div class="mt-auto flex items-center justify-between gap-2 pt-1.5">
				{#if recurso.num_valoraciones}
					<Estrellas media={recurso.valoracion_media} num={recurso.num_valoraciones} />
				{:else}
					<span></span>
				{/if}
				<div class="flex items-center gap-2 text-[11px] text-muted-foreground">
					{#if conEstadoEditorial && recurso.pendiente_clasificar}
						<span class="inline-flex items-center gap-1" title="Contenedor pendiente de clasificar">
							<PackageOpen class="size-3" /> Por clasificar
						</span>
					{:else if recurso.fuera_del_banco}
						<span
							class="inline-flex items-center gap-1"
							title="Material en carpeta local, fuera del banco"
						>
							<FolderSymlink class="size-3" />
						</span>
					{/if}
					{#if recurso.num_favoritos}
						<span class="inline-flex items-center gap-0.5 tabular-nums">
							<Heart class="size-3" />
							{recurso.num_favoritos}
						</span>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</article>
