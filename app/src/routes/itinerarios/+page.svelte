<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { resumirEdades, vocabularioEdades } from '$lib/catalogo/tipos';
	import { ArrowRight, ListOrdered, Route } from '@lucide/svelte';

	let { data } = $props();
	const vocabEdades = $derived(vocabularioEdades(data.listas));
</script>

<svelte:head>
	<title>Itinerarios · Banco de Recursos MCM</title>
	<meta
		name="description"
		content="Recorridos de recursos en un orden pensado, del Movimiento Consolación para el Mundo"
	/>
</svelte:head>

<main class="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-10 pb-12 sm:px-6">
	<div class="flex flex-col gap-2">
		<h1 class="font-display text-3xl font-bold tracking-tight sm:text-4xl">
			Itinerarios
		</h1>
		<p class="max-w-[60ch] text-muted-foreground">
			Recursos puestos en un orden pensado, con una explicación delante. Para recorrerlos de
			principio a fin en vez de buscar sueltos.
		</p>
	</div>

	{#if data.itinerarios.length === 0}
		<div
			class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-16 text-center"
		>
			<Route class="size-7 text-muted-foreground/50" />
			<p class="font-medium">Todavía no hay ninguno publicado</p>
			<p class="max-w-[40ch] text-sm text-muted-foreground">
				Se están montando. Mientras tanto, el catálogo está entero en la portada.
			</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each data.itinerarios as i (i.id)}
				{@const edades = resumirEdades(i.edades, vocabEdades, 2)}
				<a
					href={`/itinerarios/${i.id}`}
					class="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
				>
					<!-- portada si la tiene; si no, el mismo relleno generado que usan los recursos -->
					<div class="relative aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-primary/10 to-warm/10">
						{#if i.imagen}
							<img
								src={i.imagen}
								alt=""
								class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
								loading="lazy"
							/>
						{:else}
							<span class="flex size-full items-center justify-center">
								<Route class="size-9 text-primary/25" strokeWidth={1.5} />
							</span>
						{/if}
						{#if i.borrador}
							<Badge
								variant="outline"
								class="absolute top-2 right-2 bg-background/85 text-muted-foreground backdrop-blur"
							>
								Borrador
							</Badge>
						{/if}
					</div>

					<div class="flex flex-1 flex-col gap-3 p-5">
					<div class="flex flex-col gap-1">
						<h2 class="font-display text-lg leading-tight font-bold text-balance">{i.nombre}</h2>
						{#if i.descripcion}
							<p class="line-clamp-3 text-sm text-muted-foreground [text-wrap:pretty]">
								{i.descripcion}
							</p>
						{/if}
					</div>

					<div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
						<span
							class="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums"
						>
							<ListOrdered class="size-3.5" />
							{i.recursos}
							{i.recursos === 1 ? 'recurso' : 'recursos'}
						</span>
						{#each i.etapas as e (e)}
							<Badge variant="secondary" class="font-normal">{e}</Badge>
						{/each}
						<!-- con las catorce edades marcadas, una insignia que diga «todas» y no catorce -->
						{#if edades.todas}
							<Badge variant="outline" class="font-normal text-muted-foreground">
								Todas las edades
							</Badge>
						{:else}
							{#each edades.valores as e (e)}
								<Badge variant="outline" class="font-normal text-muted-foreground">{e}</Badge>
							{/each}
						{/if}
						<span
							class="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
						>
							Recorrerlo <ArrowRight class="size-3.5 transition-transform group-hover:translate-x-0.5" />
						</span>
					</div>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
