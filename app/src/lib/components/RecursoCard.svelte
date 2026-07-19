<script lang="ts">
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import { FAMILIA_BADGE, BADGE_NEUTRO } from '$lib/catalogo/tipos';
	import { Badge } from '$lib/components/ui/badge';
	import { FolderSymlink, PackageOpen } from '@lucide/svelte';

	let {
		recurso,
		familia,
		onopen
	}: {
		recurso: RecursoCatalogo;
		familia: string | null;
		onopen: (r: RecursoCatalogo) => void;
	} = $props();

	const badgeClase = $derived((familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO);
	const inicial = $derived((recurso.tipo ?? recurso.nombre).charAt(0).toUpperCase());
	const nombreLimpio = $derived(recurso.nombre.replace(/^\[EJEMPLO\]\s*/, ''));
	const esEjemplo = $derived(recurso.nombre.startsWith('[EJEMPLO]'));
</script>

<button
	type="button"
	class="group flex h-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
	onclick={() => onopen(recurso)}
>
	<div class="relative aspect-[16/10] w-full overflow-hidden bg-accent">
		{#if recurso.imagen}
			<img
				src={recurso.imagen}
				alt={`${nombreLimpio} (${recurso.tipo ?? 'recurso'})`}
				class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
				loading="lazy"
			/>
		{:else}
			<div
				class="flex size-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent to-warm/20"
			>
				<span class="font-display text-5xl font-bold text-primary/40">{inicial}</span>
			</div>
		{/if}
		{#if recurso.tipo}
			<Badge class={`absolute top-2 left-2 border-transparent ${badgeClase}`}>{recurso.tipo}</Badge>
		{/if}
		{#if esEjemplo}
			<Badge variant="outline" class="absolute top-2 right-2 bg-background/80 backdrop-blur">
				Ejemplo
			</Badge>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-2 p-4">
		<h3 class="line-clamp-2 leading-snug font-semibold text-balance">{nombreLimpio}</h3>
		{#if recurso.etapas.length || recurso.edades.length}
			<p class="line-clamp-1 text-xs text-muted-foreground">
				{[recurso.etapas.join(' · '), recurso.edades.slice(0, 3).join(', ')]
					.filter(Boolean)
					.join(' — ')}
			</p>
		{/if}
		{#if recurso.tags.length}
			<div class="mt-auto flex flex-wrap gap-1 pt-1">
				{#each recurso.tags.filter((t) => t !== 'Ejemplo').slice(0, 3) as tag (tag)}
					<span class="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground"
						>{tag}</span
					>
				{/each}
			</div>
		{/if}
		{#if recurso.pendiente_clasificar || recurso.fuera_del_banco}
			<div class="flex items-center gap-2 text-[11px] text-muted-foreground">
				{#if recurso.pendiente_clasificar}
					<span class="inline-flex items-center gap-1"
						><PackageOpen class="size-3" /> Por clasificar</span
					>
				{:else if recurso.fuera_del_banco}
					<span class="inline-flex items-center gap-1"
						><FolderSymlink class="size-3" /> Carpeta local</span
					>
				{/if}
			</div>
		{/if}
	</div>
</button>
