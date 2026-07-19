<script lang="ts">
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import {
		FAMILIA_BADGE,
		FAMILIA_FONDO,
		FAMILIA_ICON,
		BADGE_NEUTRO,
		FONDO_NEUTRO,
		ICONO_NEUTRO,
		limpiarNombre,
		esEjemplo,
		miniatura
	} from '$lib/catalogo/tipos';
	import { Badge } from '$lib/components/ui/badge';
	import Estrellas from '$lib/components/Estrellas.svelte';
	import { FolderSymlink, Heart, Lock, PackageOpen } from '@lucide/svelte';

	let {
		recurso,
		familia,
		favorito,
		onopen,
		onfavorito
	}: {
		recurso: RecursoCatalogo;
		familia: string | null;
		favorito: boolean;
		onopen: (r: RecursoCatalogo) => void;
		onfavorito: (r: RecursoCatalogo) => void;
	} = $props();

	const badgeClase = $derived((familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO);
	const fondoClase = $derived((familia && FAMILIA_FONDO[familia]) || FONDO_NEUTRO);
	const Icono = $derived((familia && FAMILIA_ICON[familia]) || ICONO_NEUTRO);
	const nombre = $derived(limpiarNombre(recurso.nombre));
	let imgFallo = $state(false);
	const srcMiniatura = $derived(!imgFallo ? miniatura(recurso) : null);
</script>

<article
	class="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
>
	<button
		type="button"
		class="absolute inset-0 z-10 rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		onclick={() => onopen(recurso)}
	>
		<span class="sr-only">Ver ficha de {nombre}</span>
	</button>

	<div class="relative aspect-[2/1] w-full overflow-hidden">
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
				<Icono
					class="size-12 text-foreground/15 transition-transform duration-300 group-hover:scale-110"
					strokeWidth={1.5}
				/>
			</div>
		{/if}

		<div class="absolute top-2 left-2 flex items-center gap-1.5">
			{#if recurso.tipo}
				<Badge class={`border-transparent shadow-sm ${badgeClase}`}>{recurso.tipo}</Badge>
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

		<!-- corazón rápido -->
		<button
			type="button"
			aria-label={favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
			aria-pressed={favorito}
			class={`absolute top-2 right-2 z-20 flex size-8 items-center justify-center rounded-full shadow-sm backdrop-blur transition-all active:scale-90 ${
				favorito
					? 'bg-destructive/90 text-white'
					: 'bg-background/80 text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-destructive'
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

		{#if recurso.etapas.length || recurso.edades.length}
			<p class="line-clamp-1 text-xs text-muted-foreground">
				{[recurso.etapas.join(' · '), recurso.edades.slice(0, 3).join(', ')]
					.filter(Boolean)
					.join(' — ')}
			</p>
		{/if}

		<div class="mt-auto flex items-center justify-between gap-2 pt-1.5">
			<Estrellas media={recurso.valoracion_media} num={recurso.num_valoraciones} />
			<div class="flex items-center gap-2 text-[11px] text-muted-foreground">
				{#if recurso.pendiente_clasificar}
					<span class="inline-flex items-center gap-1" title="Contenedor pendiente de clasificar">
						<PackageOpen class="size-3" /> Por clasificar
					</span>
				{:else if recurso.fuera_del_banco}
					<span class="inline-flex items-center gap-1" title="Material en carpeta local, fuera del banco">
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
	</div>
</article>
