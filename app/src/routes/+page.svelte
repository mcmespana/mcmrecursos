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
	import {
		construirFacetas,
		filtrar,
		contar,
		relacionar,
		textoIndexable,
		type Seleccion
	} from '$lib/catalogo/filtros';
	import RecursoCard from '$lib/components/RecursoCard.svelte';
	import RecursoTabla from '$lib/components/RecursoTabla.svelte';
	import FacetaFiltro from '$lib/components/FacetaFiltro.svelte';
	import RecursoFicha from '$lib/components/RecursoFicha.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import AvisoLocal from '$lib/components/AvisoLocal.svelte';
	import { socialLocal } from '$lib/social/local.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { LayoutGrid, Rows3, Search, Sparkles, X } from '@lucide/svelte';

	let { data } = $props();

	// facetas del buscador: configuración en BD (tabla `faceta`, editable en /admin/config)
	const facetas = $derived(construirFacetas(data.facetas, !!data.session));

	// grid, índice y facetas trabajan solo con versiones vigentes (SPEC-009); las anteriores
	// siguen accesibles por enlace directo, listas y desde la ficha de la vigente.
	const recursosVigentes = $derived(data.recursos.filter((r) => r.es_vigente));

	// --- índice de texto (Orama), reconstruido si cambia el catálogo ---
	const db: Orama<{ id: 'string'; texto: 'string' }> = $derived.by(() => {
		const indice = create({ schema: { id: 'string', texto: 'string' } as const });
		insertMultiple(
			indice,
			recursosVigentes.map((r) => ({ id: r.id, texto: textoIndexable(r) }))
		);
		return indice;
	});

	// --- estado de búsqueda (inicializado desde la URL) ---
	const paramsIniciales = page.url.searchParams;
	let q = $state(paramsIniciales.get('q') ?? '');
	let vista = $state<'galeria' | 'tabla'>(
		paramsIniciales.get('vista') === 'tabla' ? 'tabla' : 'galeria'
	);
	// svelte-ignore state_referenced_locally -- solo interesa el valor inicial (deep link)
	let seleccion = $state<Seleccion>(
		Object.fromEntries(
			construirFacetas(data.facetas, true).map((f) => [
				f.campo,
				paramsIniciales.get(f.campo)?.split('|').filter(Boolean) ?? []
			])
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

	// --- búsqueda por significado (embeddings Voyage, SPEC-010) ---
	// Amplía la recuperación: encuentra recursos afines aunque no compartan palabras.
	// Se mezcla con la búsqueda léxica; solo activa si el servidor tiene Voyage.
	let idsSemanticos = $state<Set<string> | null>(null);
	$effect(() => {
		const consulta = q.trim();
		if (!browser || !data.busquedaSemantica || consulta.length < 3) {
			idsSemanticos = null;
			return;
		}
		let vigente = true;
		const t = setTimeout(async () => {
			try {
				const res = await fetch('/api/buscar', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ q: consulta })
				});
				const json = await res.json();
				if (vigente && json?.disponible) idsSemanticos = new Set<string>(json.ids ?? []);
			} catch {
				/* red caída: la búsqueda léxica sigue funcionando */
			}
		}, 350);
		return () => {
			vigente = false;
			clearTimeout(t);
		};
	});

	// unión léxico + semántico: null (sin consulta) = todo el catálogo
	const idsBusqueda = $derived.by(() => {
		if (!idsTexto && !idsSemanticos) return null;
		const s = new Set<string>();
		if (idsTexto) for (const id of idsTexto) s.add(id);
		if (idsSemanticos) for (const id of idsSemanticos) s.add(id);
		return s;
	});
	// ¿el motor semántico aportó recursos que el léxico no encontró?
	const aporteSemantico = $derived(
		!!idsSemanticos && [...idsSemanticos].some((id) => !idsTexto?.has(id))
	);

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
	$effect(() => {
		if (browser) socialLocal.cargar();
	});

	// sin sesión, la capa social es local (localStorage) — el AvisoLocal lo explica
	const esFavorito = (id: string) =>
		data.session ? favoritos.has(id) : socialLocal.favoritos.has(id);
	const esUsado = (id: string) => (data.session ? usos.has(id) : socialLocal.usos.has(id));
	const miValoracionDe = (id: string) =>
		(data.session ? valoraciones.get(id) : socialLocal.valoraciones.get(id)) ?? null;

	async function entrarConGoogle() {
		const { error } = await data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback` }
		});
		if (error) toast.error('No se pudo iniciar sesión', { description: error.message });
	}

	async function toggleFavorito(r: RecursoCatalogo) {
		if (!data.session) {
			socialLocal.toggleFavorito(r.id);
			return;
		}
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
		if (!data.session) {
			socialLocal.toggleUso(r.id);
			return;
		}
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
		if (!data.session) {
			socialLocal.valorar(r.id, estrellas);
			const { error } = await data.supabase.rpc('valorar_anon', {
				rid: r.id,
				estrellas_in: estrellas,
				dispositivo: socialLocal.dispositivo
			});
			if (error) {
				toast.error('No se pudo guardar la valoración');
			} else {
				toast.success(`Valorado con ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}`);
				invalidateAll();
			}
			return;
		}
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
	const resultados = $derived(filtrar(recursosVigentes, facetas, seleccion, idsBusqueda));
	const filtrosActivos = $derived(
		facetas.flatMap((f) => (seleccion[f.campo] ?? []).map((valor) => ({ campo: f.campo, valor })))
	);
	const tipoFamilia = $derived(
		new Map(data.listas.filter((l) => l.lista === 'tipo').map((l) => [l.valor, l.grupo]))
	);
	const opcionesPorFaceta = $derived.by(() => {
		const map = new Map<string, { valor: string; grupo: string | null }[]>();
		for (const f of facetas) {
			const deLista = data.listas.filter((l) => l.lista === f.campo);
			if (deLista.length) {
				map.set(
					f.campo,
					deLista.map((l) => ({ valor: l.valor, grupo: l.grupo }))
				);
			} else {
				const valores = new Set<string>();
				for (const r of recursosVigentes) for (const v of f.valores(r)) valores.add(v);
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
			facetas.map((f) => [
				f.campo,
				contar(filtrar(recursosVigentes, facetas, seleccion, idsBusqueda, f.campo), f)
			])
		)
	);
	// relacionados: los manuales mandan; si no hay, afinidad real (SPEC-009 anexo A)
	const relacionadosAbierto = $derived.by(() => {
		if (!abierto) return [];
		const manuales = abierto.relacionados
			.map((id) => data.recursos.find((r) => r.id === id))
			.filter(Boolean) as RecursoCatalogo[];
		return manuales.length ? manuales : relacionar(abierto, recursosVigentes);
	});
	// versiones del recurso abierto (SPEC-009)
	const versionActualAbierto = $derived(
		abierto && !abierto.es_vigente && abierto.reemplazado_por
			? (data.recursos.find((r) => r.id === abierto!.reemplazado_por) ?? null)
			: null
	);
	const versionesAnterioresAbierto = $derived(
		abierto
			? (abierto.versiones_anteriores
					.map((id) => data.recursos.find((r) => r.id === id))
					.filter(Boolean) as RecursoCatalogo[])
			: []
	);
	// posición del recurso abierto dentro de la lista visible (para nav ←/→ y «i / total»)
	const indiceAbierto = $derived(
		abierto ? resultados.findIndex((r) => r.id === abierto!.id) : -1
	);
	const stats = $derived({
		recursos: recursosVigentes.length,
		autores: new Set(recursosVigentes.flatMap((r) => r.autores)).size,
		accesos: recursosVigentes.reduce((acc, r) => acc + r.num_accesos, 0)
	});

	// --- URL compartible ---
	$effect(() => {
		if (!browser) return;
		const params = new URLSearchParams();
		if (q.trim()) params.set('q', q.trim());
		if (vista === 'tabla') params.set('vista', 'tabla');
		for (const f of facetas) {
			if (seleccion[f.campo]?.length) params.set(f.campo, seleccion[f.campo].join('|'));
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
		seleccion = Object.fromEntries(facetas.map((f) => [f.campo, []]));
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
		{#each facetas as faceta (faceta.campo)}
			<div class="shrink-0">
				<FacetaFiltro
					etiqueta={faceta.etiqueta}
					opciones={opcionesPorFaceta.get(faceta.campo) ?? []}
					counts={countsPorFaceta.get(faceta.campo) ?? new Map()}
					seleccion={seleccion[faceta.campo] ?? []}
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
		{#if aporteSemantico}
			<span
				transition:fade={{ duration: 120 }}
				class="inline-flex items-center gap-1 rounded-full bg-warm/15 px-2.5 py-1 text-xs font-medium text-warm-foreground"
				title="Se han incluido recursos relacionados por significado, no solo por palabras."
			>
				<Sparkles class="size-3.5" /> por significado
			</span>
		{/if}
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

		<!-- toggle galería / tabla (SPEC-006 §2b) -->
		<div class="ml-auto flex items-center rounded-lg border p-0.5" role="group" aria-label="Modo de vista">
			<button
				type="button"
				aria-pressed={vista === 'galeria'}
				title="Vista galería"
				class={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
					vista === 'galeria' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
				}`}
				onclick={() => (vista = 'galeria')}
			>
				<LayoutGrid class="size-3.5" />
				<span class="hidden sm:inline">Galería</span>
			</button>
			<button
				type="button"
				aria-pressed={vista === 'tabla'}
				title="Vista tabla"
				class={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
					vista === 'tabla' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
				}`}
				onclick={() => (vista = 'tabla')}
			>
				<Rows3 class="size-3.5" />
				<span class="hidden sm:inline">Tabla</span>
			</button>
		</div>
	</div>

	<!-- resultados -->
	{#if resultados.length}
		{#if vista === 'tabla'}
			<RecursoTabla
				recursos={resultados}
				{tipoFamilia}
				{esFavorito}
				onopen={(r) => (abierto = r)}
				onfavorito={toggleFavorito}
			/>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
				{#each resultados as recurso (recurso.id)}
					<div animate:flip={{ duration: 220 }}>
						<RecursoCard
							{recurso}
							familia={recurso.tipo ? (tipoFamilia.get(recurso.tipo) ?? null) : null}
							favorito={esFavorito(recurso.id)}
							onopen={(r) => (abierto = r)}
							onfavorito={toggleFavorito}
						/>
					</div>
				{/each}
			</div>
		{/if}
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
	supabase={data.supabase}
	session={data.session}
	puedeModerar={data.perfil?.rol === 'editor' || data.perfil?.rol === 'administrador'}
	onrequierelogin={() => (loginAbierto = true)}
	recurso={abierto}
	familia={abierto?.tipo ? (tipoFamilia.get(abierto.tipo) ?? null) : null}
	relacionados={relacionadosAbierto}
	favorito={abierto ? esFavorito(abierto.id) : false}
	usado={abierto ? esUsado(abierto.id) : false}
	miValoracion={abierto ? miValoracionDe(abierto.id) : null}
	indice={indiceAbierto}
	total={resultados.length}
	versionActual={versionActualAbierto}
	versionesAnteriores={versionesAnterioresAbierto}
	onclose={() => (abierto = null)}
	onnavegar={navegarFicha}
	onabrirrelacionado={(r) => (abierto = r)}
	onfavorito={toggleFavorito}
	onusado={toggleUsado}
	onvalorar={valorar}
	onabrir={abrirRecurso}
/>

<LoginDialog bind:open={loginAbierto} onentrar={entrarConGoogle} />

{#if browser && !data.session && socialLocal.hayDatos()}
	<AvisoLocal onentrar={entrarConGoogle} />
{/if}
