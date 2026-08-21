<script lang="ts">
	import { Badge } from '$lib/components/ui/badge';
	import { ArrowRight, ListOrdered, Route } from '@lucide/svelte';

	let { data } = $props();
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
				<a
					href={`/itinerarios/${i.id}`}
					class="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
				>
					<div class="flex items-start justify-between gap-3">
						<span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
							<Route class="size-4.5 text-primary" />
						</span>
						{#if i.borrador}
							<Badge variant="outline" class="text-muted-foreground">Borrador</Badge>
						{/if}
					</div>

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
						<span
							class="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-primary"
						>
							Recorrerlo <ArrowRight class="size-3.5 transition-transform group-hover:translate-x-0.5" />
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</main>
