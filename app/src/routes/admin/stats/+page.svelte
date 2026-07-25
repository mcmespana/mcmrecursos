<script lang="ts">
	import { Star } from '@lucide/svelte';
	import { AreaChart, BarChart } from 'layerchart';

	let { data } = $props();

	const tiles = $derived([
		['Recursos', data.totales.recursos],
		['Publicados', data.totales.publicados],
		['Usuarios', data.totales.usuarios],
		['Aperturas', data.totales.accesos],
		['Valoraciones', data.totales.valoraciones],
		['Favoritos', data.totales.favoritos]
	] as [string, number][]);
</script>

<svelte:head><title>Estadísticas · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-6">
	<h1 class="font-display text-2xl font-bold">Estadísticas</h1>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
		{#each tiles as [etiqueta, valor] (etiqueta)}
			<div class="flex flex-col gap-1 rounded-xl border bg-card p-4">
				<span class="text-xs tracking-wide text-muted-foreground uppercase">{etiqueta}</span>
				<span class="font-display text-3xl font-bold tabular-nums">{valor}</span>
			</div>
		{/each}
	</div>

	<section class="flex flex-col gap-3 rounded-xl border bg-card p-5">
		<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
			Accesos, últimos 30 días
		</h2>
		{#if data.accesosPorDia.some((d) => d.valor > 0)}
			<div class="h-56">
				<AreaChart
					data={data.accesosPorDia}
					x="fecha"
					y="valor"
					series={[{ key: 'valor', color: 'var(--color-primary)' }]}
				/>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">Aún sin accesos en este periodo.</p>
		{/if}
	</section>

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="flex flex-col gap-3 rounded-xl border bg-card p-5">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Más abiertos
			</h2>
			{#if data.topAccesos.length}
				<div class="h-64">
					<BarChart
						data={data.topAccesos}
						x="valor"
						y="nombre"
						orientation="horizontal"
						series={[{ key: 'valor', color: 'var(--color-primary)' }]}
					/>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Aún sin datos.</p>
			{/if}
		</section>

		<section class="flex flex-col gap-3 rounded-xl border bg-card p-5">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Mejor valorados
			</h2>
			<ul class="flex flex-col gap-2.5">
				{#each data.topValorados as fila (fila.nombre)}
					<li class="flex items-center justify-between gap-3 text-sm">
						<span class="truncate">{fila.nombre}</span>
						<span class="inline-flex shrink-0 items-center gap-1 tabular-nums">
							<Star class="size-3.5 fill-warm text-warm" />
							{fila.valor.toLocaleString('es')}
							<span class="text-xs text-muted-foreground">({fila.extra})</span>
						</span>
					</li>
				{:else}
					<li class="text-sm text-muted-foreground">Aún sin valoraciones.</li>
				{/each}
			</ul>
		</section>
	</div>

	<section class="flex flex-col gap-3 rounded-xl border bg-card p-5">
		<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
			Autores con más aperturas
		</h2>
		{#if data.topAutores.length}
			<div class="h-64">
				<BarChart
					data={data.topAutores}
					x="valor"
					y="nombre"
					orientation="horizontal"
					series={[{ key: 'valor', color: 'var(--color-warm)' }]}
				/>
			</div>
		{:else}
			<p class="text-sm text-muted-foreground">Aún sin autores con recursos.</p>
		{/if}
	</section>

	<section class="flex flex-col gap-3 rounded-xl border bg-card p-5">
		<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">Por estado</h2>
		<div class="flex flex-wrap gap-2">
			{#each Object.entries(data.porEstado) as [estado, n] (estado)}
				<span class="rounded-full bg-secondary px-3 py-1 text-sm tabular-nums">
					{estado}: <strong>{n}</strong>
				</span>
			{/each}
		</div>
	</section>
</div>
