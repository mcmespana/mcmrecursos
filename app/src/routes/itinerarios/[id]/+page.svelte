<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { limpiarNombre } from '$lib/catalogo/tipos';
	import { ArrowLeft, ExternalLink, ListOrdered } from '@lucide/svelte';

	/**
	 * Recorrer un itinerario (SPEC-015).
	 *
	 * Numerado y de arriba abajo: el orden **es** el contenido, así que cada fila lleva su número
	 * y no hay rejilla que invite a picotear. Los tramos solo aparecen si el itinerario está
	 * partido; uno simple es una sola lista sin cabeceras que sobren.
	 */
	let { data } = $props();
	const it = $derived(data.itinerario);
	const simple = $derived(it.bloques.length === 1 && !it.bloques[0].nombre);
	const total = $derived(it.bloques.reduce((n: number, b: any) => n + b.recursos.length, 0));

	/** Numeración continua a lo largo de todo el itinerario, no por tramo. */
	function primerNumero(indiceBloque: number) {
		let n = 1;
		for (let i = 0; i < indiceBloque; i++) n += it.bloques[i].recursos.length;
		return n;
	}

	function abrir(r: any) {
		if (!r.enlace) return;
		data.supabase.rpc('registrar_acceso', { rid: r.id });
		window.open(r.enlace, '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>{it.nombre} · Itinerarios · Banco de Recursos MCM</title>
	{#if it.descripcion}<meta name="description" content={it.descripcion} />{/if}
</svelte:head>

<main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6">
	<a
		href="/itinerarios"
		class="toque inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Todos los itinerarios
	</a>

	<header class="flex flex-col gap-3">
		{#if it.borrador}
			<Badge variant="outline" class="w-fit text-muted-foreground">
				Borrador — solo lo ves porque tienes permisos
			</Badge>
		{/if}
		<h1 class="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
			{it.nombre}
		</h1>
		{#if it.descripcion}
			<p class="max-w-[65ch] text-[17px]/[1.6] text-muted-foreground [text-wrap:pretty]">
				{it.descripcion}
			</p>
		{/if}
		<div class="flex flex-wrap items-center gap-2">
			<span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
				<ListOrdered class="size-4" />
				{total}
				{total === 1 ? 'recurso' : 'recursos'}
				{#if !simple}<span class="text-muted-foreground/60">· {it.bloques.length} tramos</span>{/if}
			</span>
			{#each it.etapas as e (e)}
				<Badge variant="secondary" class="font-normal">{e}</Badge>
			{/each}
		</div>
	</header>

	{#if total === 0}
		<p class="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
			Este itinerario todavía no tiene recursos.
		</p>
	{/if}

	{#each it.bloques as bloque, ib (bloque.id)}
		{#if bloque.recursos.length}
			<section class="flex flex-col gap-3">
				{#if bloque.nombre}
					<div class="flex flex-col gap-0.5 border-b border-border pb-2">
						<h2 class="font-display text-xl font-bold">{bloque.nombre}</h2>
						{#if bloque.descripcion}
							<p class="text-sm text-muted-foreground [text-wrap:pretty]">{bloque.descripcion}</p>
						{/if}
					</div>
				{/if}

				<ol class="flex flex-col gap-2">
					{#each bloque.recursos as r, i (r.id)}
						<li
							class="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/30"
						>
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary tabular-nums"
							>
								{primerNumero(ib) + i}
							</span>

							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<!-- el nombre lleva a la ficha de siempre, con toda su capa social -->
								<a
									href={`/?r=${r.id}`}
									class="flex items-center gap-2 font-semibold underline-offset-4 hover:underline"
								>
									<IconoFormato enlace={r.enlace} formato={r.formato} class="size-4 shrink-0" />
									<span class="min-w-0 truncate">{limpiarNombre(r.nombre)}</span>
								</a>
								{#if r.descripcion}
									<p class="line-clamp-2 text-[13px]/[1.5] text-muted-foreground [text-wrap:pretty]">
										{r.descripcion}
									</p>
								{/if}
								<p class="flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
									{#if r.tipo}<span>{r.tipo}</span>{/if}
									{#if r.edades?.length}
										<span class="text-muted-foreground/60">
											para {r.edades.slice(0, 3).join(', ')}
										</span>
									{/if}
								</p>
							</div>

							{#if r.enlace}
								<Button variant="outline" size="sm" class="shrink-0" onclick={() => abrir(r)}>
									<ExternalLink class="size-3.5" /> Abrir
								</Button>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/each}
</main>
