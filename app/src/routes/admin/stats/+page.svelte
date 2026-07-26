<script lang="ts">
	import { Star } from '@lucide/svelte';
	import { AreaChart } from 'layerchart';

	let { data } = $props();

	// --- KPIs (figuras proporcionales, no tabulares: son números sueltos) ---
	const tiles = $derived([
		{ etiqueta: 'Recursos', valor: data.totales.recursos, sub: null },
		{ etiqueta: 'Publicados', valor: data.totales.publicados, sub: `de ${data.totales.recursos}` },
		{ etiqueta: 'Usuarios', valor: data.totales.usuarios, sub: null },
		{ etiqueta: 'Aperturas', valor: data.totales.accesos, sub: 'desde el inicio' },
		{ etiqueta: 'Valoraciones', valor: data.totales.valoraciones, sub: null },
		{ etiqueta: 'Favoritos', valor: data.totales.favoritos, sub: null }
	]);

	// --- Serie de accesos ---
	const totalPeriodo = $derived(data.accesosPorDia.reduce((a, d) => a + d.valor, 0));
	const hayAccesos = $derived(totalPeriodo > 0);
	const diaPico = $derived(
		data.accesosPorDia.reduce(
			(max, d) => (d.valor > max.valor ? d : max),
			data.accesosPorDia[0] ?? { fecha: new Date(0), valor: 0 }
		)
	);

	const fechaCorta = (d: Date) =>
		new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(d);
	const fechaLarga = (d: Date) =>
		new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(d);

	// --- Composición por estado: secuencia ordinal del flujo editorial (borrador → publicado).
	// Un solo tono (teal) en pasos; el color nunca va solo, siempre con leyenda y recuento.
	const ORDEN_ESTADO: { clave: string; etiqueta: string; clase: string }[] = [
		{ clave: 'publicado', etiqueta: 'Publicado', clase: 'bg-primary' },
		{ clave: 'revisar_ia', etiqueta: 'Revisar IA', clase: 'bg-primary/60' },
		{ clave: 'pendiente_revision', etiqueta: 'Pendiente de revisión', clase: 'bg-primary/40' },
		{ clave: 'subido_usuario', etiqueta: 'Subido por usuario', clase: 'bg-primary/30' },
		{ clave: 'borrador', etiqueta: 'Borrador', clase: 'bg-primary/20' },
		{ clave: 'retirado', etiqueta: 'Retirado', clase: 'bg-muted-foreground/30' },
		{ clave: 'descartado', etiqueta: 'Descartado', clase: 'bg-muted-foreground/30' }
	];
	const estados = $derived.by(() => {
		const total = Object.values(data.porEstado).reduce((a: number, b) => a + (b as number), 0);
		const conocidos = ORDEN_ESTADO.filter((e) => data.porEstado[e.clave]).map((e) => ({
			...e,
			n: data.porEstado[e.clave] as number
		}));
		const otros = Object.entries(data.porEstado)
			.filter(([clave]) => !ORDEN_ESTADO.some((e) => e.clave === clave))
			.map(([clave, n]) => {
				const texto = clave.replace(/_/g, ' ');
				return {
					clave,
					etiqueta: texto.charAt(0).toUpperCase() + texto.slice(1),
					clase: 'bg-muted-foreground/30',
					n: n as number
				};
			});
		return { filas: [...conocidos, ...otros], total };
	});
</script>

<svelte:head><title>Estadísticas · Admin · Banco de Recursos MCM</title></svelte:head>

<!--
	Barra de ranking: marca fina (8 px), extremo de dato redondeado 4 px y base cuadrada
	(docs/04-diseno.md §6). El valor va como etiqueta directa, nunca solo en el tooltip.
-->
{#snippet ranking(
	filas: { nombre: string; valor: number; extra?: number }[],
	sufijoExtra: string,
	vacio: string
)}
	{@const max = Math.max(1, ...filas.map((f) => f.valor))}
	{#if filas.length}
		<ul class="flex flex-col gap-3.5">
			{#each filas as fila (fila.nombre)}
				<li class="flex flex-col gap-1.5">
					<div class="flex items-baseline justify-between gap-3 text-sm">
						<span class="truncate" title={fila.nombre}>{fila.nombre}</span>
						<span class="shrink-0 font-medium tabular-nums">
							{fila.valor.toLocaleString('es')}
							{#if fila.extra != null}
								<span class="font-normal text-muted-foreground">
									· {fila.extra}
									{sufijoExtra}{fila.extra === 1 ? '' : 's'}
								</span>
							{/if}
						</span>
					</div>
					<div class="h-2 rounded-r-[4px] bg-muted">
						<div
							class="h-full rounded-r-[4px] bg-primary"
							style={`width: ${Math.max(2, (fila.valor / max) * 100)}%`}
						></div>
					</div>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted-foreground">{vacio}</p>
	{/if}
{/snippet}

<!-- Vista tabla accesible: toda gráfica tiene su gemela en tabla (docs/04-diseno.md §6). -->
{#snippet tablaDatos(columnas: string[], filas: (string | number)[][])}
	{#if filas.length}
		<details class="group mt-4 border-t pt-3">
			<summary
				class="cursor-pointer list-none text-xs text-muted-foreground transition-colors hover:text-foreground"
			>
				<span class="group-open:hidden">▸ Ver datos</span>
				<span class="hidden group-open:inline">▾ Ocultar datos</span>
			</summary>
			<div class="mt-2 max-h-64 overflow-auto">
				<table class="w-full text-left text-xs">
					<thead class="sticky top-0 bg-card text-muted-foreground">
						<tr>
							{#each columnas as col, i (col)}
								<th class="py-1.5 pr-3 font-medium {i > 0 ? 'text-right' : ''}">{col}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each filas as fila, i (i)}
							<tr class="border-t">
								{#each fila as celda, j (j)}
									<td class="py-1.5 pr-3 {j > 0 ? 'text-right tabular-nums' : ''}">{celda}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</details>
	{/if}
{/snippet}

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h1 class="font-display text-2xl font-bold">Estadísticas</h1>
		<p class="text-sm text-muted-foreground">Uso del banco y estado del catálogo.</p>
	</div>

	<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
		{#each tiles as t (t.etiqueta)}
			<div class="flex flex-col gap-0.5 rounded-xl border bg-card p-4">
				<span class="text-xs tracking-wide text-muted-foreground uppercase">{t.etiqueta}</span>
				<span class="font-display text-3xl leading-none font-bold">
					{t.valor.toLocaleString('es')}
				</span>
				<span class="mt-1 truncate text-xs text-muted-foreground">{t.sub ?? ''}</span>
			</div>
		{/each}
	</div>

	<!-- Evolución de accesos: área en wash + línea de 2 px + crosshair -->
	<section class="flex flex-col rounded-xl border bg-card p-5">
		<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Accesos, últimos 30 días
			</h2>
			{#if hayAccesos}
				<p class="text-sm text-muted-foreground">
					<strong class="font-semibold text-foreground tabular-nums">{totalPeriodo}</strong>
					en el periodo · pico de
					<strong class="font-semibold text-foreground tabular-nums">{diaPico.valor}</strong>
					el {fechaLarga(diaPico.fecha)}
				</p>
			{/if}
		</div>

		{#if hayAccesos}
			<div class="mt-4 h-60">
				<AreaChart
					data={data.accesosPorDia}
					x="fecha"
					y="valor"
					series={[{ key: 'valor', label: 'Accesos', color: 'var(--color-primary)' }]}
					padding={{ top: 8, right: 8, bottom: 24, left: 32 }}
					props={{
						area: { 'fill-opacity': 0.12, line: { class: 'stroke-2' } },
						xAxis: { ticks: 6, format: (d: Date) => fechaCorta(d) },
						yAxis: { ticks: 4 },
						grid: { x: false, y: true },
						// regla sólida (nunca discontinua) y fecha del tooltip en español.
						// Ojo: LayerChart descarta estos objetos si no llevan `class`.
						highlight: {
							axis: 'x',
							lines: { class: 'stroke-muted-foreground/50 [stroke-dasharray:none]' }
						},
						tooltip: { header: { format: (d: Date) => fechaLarga(d) } }
					}}
				/>
			</div>
		{:else}
			<p class="mt-4 text-sm text-muted-foreground">
				Aún no hay accesos registrados en este periodo.
			</p>
		{/if}

		{@render tablaDatos(
			['Día', 'Accesos'],
			data.accesosPorDia.filter((d) => d.valor > 0).map((d) => [fechaLarga(d.fecha), d.valor])
		)}
	</section>

	<!-- Dos rankings de la misma magnitud (aperturas) → mismo tono, mismo tratamiento -->
	<div class="grid items-start gap-6 lg:grid-cols-2">
		<section class="flex flex-col rounded-xl border bg-card p-5">
			<h2 class="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Recursos más abiertos
			</h2>
			{@render ranking(data.topAccesos, '', 'Aún sin aperturas registradas.')}
			{@render tablaDatos(
				['Recurso', 'Aperturas'],
				data.topAccesos.map((f) => [f.nombre, f.valor])
			)}
		</section>

		<section class="flex flex-col rounded-xl border bg-card p-5">
			<h2 class="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Autores con más aperturas
			</h2>
			{@render ranking(data.topAutores, 'recurso', 'Aún no hay autores con recursos.')}
			{@render tablaDatos(
				['Autor', 'Aperturas', 'Recursos'],
				data.topAutores.map((f) => [f.nombre, f.valor, f.extra])
			)}
		</section>
	</div>

	<div class="grid items-start gap-6 lg:grid-cols-2">
		<!-- Valoración: ámbar, el tono reservado a la capa social en toda la app -->
		<section class="flex flex-col rounded-xl border bg-card p-5">
			<h2 class="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Mejor valorados
			</h2>
			{#if data.topValorados.length}
				<ul class="flex flex-col gap-3.5">
					{#each data.topValorados as fila (fila.nombre)}
						<li class="flex flex-col gap-1.5">
							<div class="flex items-baseline justify-between gap-3 text-sm">
								<span class="truncate" title={fila.nombre}>{fila.nombre}</span>
								<span class="inline-flex shrink-0 items-baseline gap-1">
									<Star class="size-3.5 shrink-0 translate-y-0.5 fill-warm text-warm" />
									<span class="font-medium tabular-nums">{fila.valor.toLocaleString('es')}</span>
									<span class="text-xs text-muted-foreground tabular-nums">
										({fila.extra})
									</span>
								</span>
							</div>
							<div class="h-2 rounded-r-[4px] bg-muted">
								<div
									class="h-full rounded-r-[4px] bg-warm"
									style={`width: ${(fila.valor / 5) * 100}%`}
								></div>
							</div>
						</li>
					{/each}
				</ul>
				<p class="mt-3 text-xs text-muted-foreground">
					Media sobre 5 estrellas; entre paréntesis, número de valoraciones.
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">Aún sin valoraciones.</p>
			{/if}
			{@render tablaDatos(
				['Recurso', 'Media', 'Valoraciones'],
				data.topValorados.map((f) => [f.nombre, f.valor.toLocaleString('es'), f.extra])
			)}
		</section>

		<!-- Composición del catálogo: barra apilada con separación de 2 px y leyenda -->
		<section class="flex flex-col rounded-xl border bg-card p-5">
			<h2 class="mb-4 text-sm font-medium tracking-wide text-muted-foreground uppercase">
				Estado del catálogo
			</h2>
			{#if estados.total}
				<div class="flex h-3 w-full gap-0.5 overflow-hidden">
					{#each estados.filas as e (e.clave)}
						<div
							class="h-full first:rounded-l-[4px] last:rounded-r-[4px] {e.clase}"
							style={`width: ${(e.n / estados.total) * 100}%`}
							title={`${e.etiqueta}: ${e.n}`}
						></div>
					{/each}
				</div>
				<ul class="mt-4 flex flex-col gap-2">
					{#each estados.filas as e (e.clave)}
						<li class="flex items-center gap-2 text-sm">
							<span class="size-2.5 shrink-0 rounded-[3px] {e.clase}"></span>
							<span class="flex-1 truncate">{e.etiqueta}</span>
							<span class="font-medium tabular-nums">{e.n}</span>
							<span class="w-12 text-right text-xs text-muted-foreground tabular-nums">
								{Math.round((e.n / estados.total) * 100)}%
							</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted-foreground">Aún no hay recursos en el catálogo.</p>
			{/if}
			{@render tablaDatos(
				['Estado', 'Recursos', '%'],
				estados.filas.map((e) => [
					e.etiqueta,
					e.n,
					`${Math.round((e.n / estados.total) * 100)}%`
				])
			)}
		</section>
	</div>
</div>
