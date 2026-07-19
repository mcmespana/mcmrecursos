<script lang="ts">
	import { limpiarNombre, miniatura } from '$lib/catalogo/tipos';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { ArrowLeft, Globe, Share2 } from '@lucide/svelte';

	let { data } = $props();

	async function compartir() {
		await navigator.clipboard.writeText(location.href).catch(() => {});
		toast.success('Enlace copiado');
	}
</script>

<svelte:head><title>{data.lista.nombre} · Banco de Recursos MCM</title></svelte:head>

<main class="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
	<div class="flex flex-col gap-2">
		<a
			href={data.lista.esMia ? '/listas' : '/'}
			class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft class="size-3.5" />
			{data.lista.esMia ? 'Mis listas' : 'Catálogo'}
		</a>
		<div class="flex flex-wrap items-center gap-3">
			<h1 class="font-display text-3xl font-bold text-balance">{data.lista.nombre}</h1>
			{#if data.lista.publica}
				<Badge variant="secondary" class="gap-1"><Globe class="size-3" /> Pública</Badge>
				<Button variant="outline" size="sm" onclick={compartir}>
					<Share2 class="size-3.5" /> Compartir
				</Button>
			{/if}
		</div>
		{#if data.lista.descripcion}
			<p class="text-muted-foreground text-pretty">{data.lista.descripcion}</p>
		{/if}
		<p class="text-sm text-muted-foreground tabular-nums">
			{data.recursos.length}
			{data.recursos.length === 1 ? 'recurso' : 'recursos'}
		</p>
	</div>

	{#if !data.recursos.length}
		<p class="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
			Esta lista está vacía todavía.
		</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each data.recursos as recurso (recurso.id)}
				<li>
					<a
						href={`/?r=${recurso.id}`}
						class="flex items-center gap-4 rounded-xl border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
					>
						<span
							class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-primary/15 via-accent to-warm/20"
						>
							{#if miniatura(recurso)}
								<img src={miniatura(recurso)} alt="" class="size-full object-cover" loading="lazy" />
							{:else}
								<span class="font-display text-lg font-bold text-primary/50">
									{(recurso.tipo ?? recurso.nombre).charAt(0)}
								</span>
							{/if}
						</span>
						<span class="flex min-w-0 flex-1 flex-col gap-0.5">
							<span class="truncate font-semibold">{limpiarNombre(recurso.nombre)}</span>
							<span class="truncate text-xs text-muted-foreground">
								{[recurso.tipo, recurso.etapas?.join(' · ')].filter(Boolean).join(' — ')}
							</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>
