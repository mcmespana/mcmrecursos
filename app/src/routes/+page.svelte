<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { create, insertMultiple, search, type Orama } from '@orama/orama';
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import { FACETAS, filtrar, contar, textoIndexable, type Seleccion } from '$lib/catalogo/filtros';
	import RecursoCard from '$lib/components/RecursoCard.svelte';
	import FacetaFiltro from '$lib/components/FacetaFiltro.svelte';
	import RecursoFicha from '$lib/components/RecursoFicha.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Search, X } from '@lucide/svelte';

	let { data } = $props();

	// --- índice de texto (Orama), reconstruido si cambia el catálogo ---
	const db: Orama<{ id: 'string'; texto: 'string' }> = $derived.by(() => {
		const indice = create({ schema: { id: 'string', texto: 'string' } as const });
		insertMultiple(
			indice,
			data.recursos.map((r) => ({ id: r.id, texto: textoIndexable(r) }))
		);
		return indice;
	});

	// --- estado de búsqueda (inicializado desde la URL) ---
	const paramsIniciales = page.url.searchParams;
	let q = $state(paramsIniciales.get('q') ?? '');
	let seleccion = $state<Seleccion>(
		Object.fromEntries(
			FACETAS.map((f) => [f.campo, paramsIniciales.get(f.campo)?.split('|').filter(Boolean) ?? []])
		)
	);
	// svelte-ignore state_referenced_locally -- solo interesa el valor inicial (deep link)
	let abierto = $state<RecursoCatalogo | null>(
		data.recursos.find((r) => r.id === paramsIniciales.get('r')) ?? null
	);

	let idsTexto = $state<Set<string> | null>(null);
	$effect(() => {
		const consulta = q.trim();
		if (!consulta) {
			idsTexto = null;
			return;
		}
		let vigente = true;
		Promise.resolve(
			search(db, { term: consulta, properties: ['texto'], limit: 2000, tolerance: 1 })
		).then((res) => {
			if (vigente) idsTexto = new Set(res.hits.map((h) => h.document.id as string));
		});
		return () => {
			vigente = false;
		};
	});

	// --- derivados ---
	const resultados = $derived(filtrar(data.recursos, seleccion, idsTexto));
	const filtrosActivos = $derived(
		FACETAS.flatMap((f) => seleccion[f.campo].map((valor) => ({ campo: f.campo, valor })))
	);
	const tipoFamilia = $derived(
		new Map(data.listas.filter((l) => l.lista === 'tipo').map((l) => [l.valor, l.grupo]))
	);
	const opcionesPorFaceta = $derived.by(() => {
		const map = new Map<string, { valor: string; grupo: string | null }[]>();
		for (const f of FACETAS) {
			const deLista = data.listas.filter((l) => l.lista === f.campo);
			if (deLista.length) {
				map.set(
					f.campo,
					deLista.map((l) => ({ valor: l.valor, grupo: l.grupo }))
				);
			} else {
				// facetas sin lista cerrada (tags, mcm_local): valores presentes en el catálogo
				const valores = new Set<string>();
				for (const r of data.recursos) for (const v of f.valores(r)) valores.add(v);
				map.set(
					f.campo,
					[...valores].sort((a, b) => a.localeCompare(b, 'es')).map((valor) => ({ valor, grupo: null }))
				);
			}
		}
		return map;
	});
	const countsPorFaceta = $derived(
		new Map(
			FACETAS.map((f) => [f.campo, contar(filtrar(data.recursos, seleccion, idsTexto, f.campo), f)])
		)
	);
	const relacionadosAbierto = $derived(
		abierto
			? (abierto.relacionados
					.map((id) => data.recursos.find((r) => r.id === id))
					.filter(Boolean) as RecursoCatalogo[])
			: []
	);

	// --- URL compartible ---
	$effect(() => {
		if (!browser) return;
		const params = new URLSearchParams();
		if (q.trim()) params.set('q', q.trim());
		for (const f of FACETAS) {
			if (seleccion[f.campo].length) params.set(f.campo, seleccion[f.campo].join('|'));
		}
		if (abierto) params.set('r', abierto.id);
		const cadena = params.toString();
		const destino = cadena ? `?${cadena}` : page.url.pathname;
		if (`${page.url.search}` !== (cadena ? `?${cadena}` : '')) {
			replaceState(destino, {});
		}
	});

	function limpiarTodo() {
		q = '';
		seleccion = Object.fromEntries(FACETAS.map((f) => [f.campo, []]));
	}

	function navegarFicha(direccion: 1 | -1) {
		if (!abierto) return;
		const i = resultados.findIndex((r) => r.id === abierto!.id);
		const destino = resultados[i + direccion];
		if (destino) abierto = destino;
	}
</script>

<svelte:head>
	<title>Banco de Recursos MCM</title>
	<meta
		name="description"
		content="Catálogo de recursos de tiempo libre del Movimiento Consolación para el Mundo"
	/>
</svelte:head>

<main class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-6 sm:px-6">
	<!-- búsqueda -->
	<div class="relative mx-auto w-full max-w-2xl">
		<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			bind:value={q}
			placeholder="Busca por nombre, tema, autor… (p. ej. «Adviento»)"
			class="h-11 pl-9 text-base"
			type="search"
		/>
	</div>

	<!-- facetas -->
	<div class="flex flex-wrap items-center gap-2">
		{#each FACETAS as faceta (faceta.campo)}
			<FacetaFiltro
				etiqueta={faceta.etiqueta}
				opciones={opcionesPorFaceta.get(faceta.campo) ?? []}
				counts={countsPorFaceta.get(faceta.campo) ?? new Map()}
				seleccion={seleccion[faceta.campo]}
				onchange={(valores) => (seleccion = { ...seleccion, [faceta.campo]: valores })}
			/>
		{/each}
	</div>

	<!-- chips activos + recuento -->
	<div class="flex flex-wrap items-center gap-2">
		<p class="text-sm text-muted-foreground tabular-nums">
			{resultados.length}
			{resultados.length === 1 ? 'recurso' : 'recursos'}
		</p>
		{#each filtrosActivos as filtro (filtro.campo + filtro.valor)}
			<button
				type="button"
				transition:fade={{ duration: 120 }}
				class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
				onclick={() =>
					(seleccion = {
						...seleccion,
						[filtro.campo]: seleccion[filtro.campo].filter((v) => v !== filtro.valor)
					})}
			>
				{filtro.valor}
				<X class="size-3" />
			</button>
		{/each}
		{#if filtrosActivos.length || q.trim()}
			<Button variant="ghost" size="sm" class="h-7 text-xs" onclick={limpiarTodo}>
				Limpiar todo
			</Button>
		{/if}
	</div>

	<!-- resultados -->
	{#if resultados.length}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
			{#each resultados as recurso (recurso.id)}
				<div animate:flip={{ duration: 220 }}>
					<RecursoCard
						{recurso}
						familia={recurso.tipo ? (tipoFamilia.get(recurso.tipo) ?? null) : null}
						onopen={(r) => (abierto = r)}
					/>
				</div>
			{/each}
		</div>
	{:else}
		<div class="flex flex-col items-center gap-3 py-20 text-center">
			<p class="font-display text-xl font-semibold">Sin resultados</p>
			<p class="max-w-sm text-sm text-muted-foreground text-pretty">
				No hay recursos con esa combinación. Prueba a quitar algún filtro o a buscar con otra
				palabra.
			</p>
			<Button variant="outline" size="sm" onclick={limpiarTodo}>Limpiar búsqueda</Button>
		</div>
	{/if}
</main>

<RecursoFicha
	recurso={abierto}
	familia={abierto?.tipo ? (tipoFamilia.get(abierto.tipo) ?? null) : null}
	relacionados={relacionadosAbierto}
	onclose={() => (abierto = null)}
	onnavegar={navegarFicha}
	onabrirrelacionado={(r) => (abierto = r)}
/>
