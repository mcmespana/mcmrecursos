<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { invalidateAll, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { create, insertMultiple, search, type Orama } from '@orama/orama';
	import { toast } from 'svelte-sonner';
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import { FACETAS, filtrar, contar, textoIndexable, type Seleccion } from '$lib/catalogo/filtros';
	import RecursoCard from '$lib/components/RecursoCard.svelte';
	import FacetaFiltro from '$lib/components/FacetaFiltro.svelte';
	import RecursoFicha from '$lib/components/RecursoFicha.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
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

	// --- lo mío (optimista, resincronizado con el servidor) ---
	const favoritos = new SvelteSet<string>();
	const usos = new SvelteSet<string>();
	const valoraciones = new SvelteMap<string, number>();
	$effect(() => {
		favoritos.clear();
		usos.clear();
		valoraciones.clear();
		for (const id of data.social.favoritos) favoritos.add(id);
		for (const id of data.social.usos) usos.add(id);
		for (const [id, n] of data.social.valoraciones) valoraciones.set(id, n);
	});

	let loginAbierto = $state(false);

	function conSesion(): boolean {
		if (!data.session) {
			loginAbierto = true;
			return false;
		}
		return true;
	}

	async function entrarConGoogle() {
		const { error } = await data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback` }
		});
		if (error) toast.error('No se pudo iniciar sesión', { description: error.message });
	}

	async function toggleFavorito(r: RecursoCatalogo) {
		if (!conSesion()) return;
		const tenia = favoritos.has(r.id);
		if (tenia) favoritos.delete(r.id);
		else favoritos.add(r.id);
		const { error } = tenia
			? await data.supabase.from('favorito').delete().eq('recurso_id', r.id)
			: await data.supabase
					.from('favorito')
					.insert({ recurso_id: r.id, perfil_id: data.session!.user.id });
		if (error) {
			if (tenia) favoritos.add(r.id);
			else favoritos.delete(r.id);
			toast.error('No se pudo guardar el favorito');
		} else {
			invalidateAll();
		}
	}

	async function toggleUsado(r: RecursoCatalogo) {
		if (!conSesion()) return;
		const tenia = usos.has(r.id);
		if (tenia) usos.delete(r.id);
		else usos.add(r.id);
		const { error } = tenia
			? await data.supabase.from('uso').delete().eq('recurso_id', r.id)
			: await data.supabase.from('uso').insert({ recurso_id: r.id, perfil_id: data.session!.user.id });
		if (error) {
			if (tenia) usos.add(r.id);
			else usos.delete(r.id);
			toast.error('No se pudo registrar el uso');
		} else {
			invalidateAll();
		}
	}

	async function valorar(r: RecursoCatalogo, estrellas: number) {
		if (!conSesion()) return;
		const anterior = valoraciones.get(r.id) ?? null;
		valoraciones.set(r.id, estrellas);
		const { error } = await data.supabase
			.from('valoracion')
			.upsert({ recurso_id: r.id, perfil_id: data.session!.user.id, estrellas });
		if (error) {
			if (anterior) valoraciones.set(r.id, anterior);
			else valoraciones.delete(r.id);
			toast.error('No se pudo guardar la valoración');
		} else {
			toast.success(`Valorado con ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}`);
			invalidateAll();
		}
	}

	function abrirRecurso(r: RecursoCatalogo) {
		if (!r.enlace) return;
		// registro en segundo plano; la navegación no espera
		data.supabase.rpc('registrar_acceso', { rid: r.id }).then(() => invalidateAll());
		window.open(r.enlace, '_blank', 'noopener,noreferrer');
	}

	// --- derivados de catálogo ---
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
				const valores = new Set<string>();
				for (const r of data.recursos) for (const v of f.valores(r)) valores.add(v);
				map.set(
					f.campo,
					[...valores]
						.sort((a, b) => a.localeCompare(b, 'es'))
						.map((valor) => ({ valor, grupo: null }))
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
	const stats = $derived({
		recursos: data.recursos.length,
		autores: new Set(data.recursos.flatMap((r) => r.autores)).size,
		accesos: data.recursos.reduce((acc, r) => acc + r.num_accesos, 0)
	});

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

<main class="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 pb-10 sm:px-6">
	<!-- héroe compacto -->
	<section class="flex flex-col items-center gap-4 pt-10 pb-2 text-center">
		<h1 class="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
			Encuentra tu próximo <span class="text-primary">recurso</span>
		</h1>
		<p class="text-sm text-muted-foreground tabular-nums">
			{stats.recursos}
			{stats.recursos === 1 ? 'recurso' : 'recursos'} · {stats.autores}
			{stats.autores === 1 ? 'autor' : 'autores'} · {stats.accesos} aperturas
		</p>
		<div class="relative w-full max-w-2xl">
			<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				bind:value={q}
				placeholder="Busca por nombre, tema, autor… (p. ej. «Adviento»)"
				class="h-12 rounded-xl pl-9 text-base shadow-sm"
				type="search"
			/>
		</div>
	</section>

	<!-- facetas: envueltas en escritorio, carrusel en móvil -->
	<div
		class="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
	>
		{#each FACETAS as faceta (faceta.campo)}
			<div class="shrink-0">
				<FacetaFiltro
					etiqueta={faceta.etiqueta}
					opciones={opcionesPorFaceta.get(faceta.campo) ?? []}
					counts={countsPorFaceta.get(faceta.campo) ?? new Map()}
					seleccion={seleccion[faceta.campo]}
					onchange={(valores) => (seleccion = { ...seleccion, [faceta.campo]: valores })}
				/>
			</div>
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
						favorito={favoritos.has(recurso.id)}
						onopen={(r) => (abierto = r)}
						onfavorito={toggleFavorito}
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
	favorito={abierto ? favoritos.has(abierto.id) : false}
	usado={abierto ? usos.has(abierto.id) : false}
	miValoracion={abierto ? (valoraciones.get(abierto.id) ?? null) : null}
	onclose={() => (abierto = null)}
	onnavegar={navegarFicha}
	onabrirrelacionado={(r) => (abierto = r)}
	onfavorito={toggleFavorito}
	onusado={toggleUsado}
	onvalorar={valorar}
	onabrir={abrirRecurso}
/>

<LoginDialog bind:open={loginAbierto} onentrar={entrarConGoogle} />
