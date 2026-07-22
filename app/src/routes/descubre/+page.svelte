<script lang="ts">
	import { untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import {
		FAMILIA_BADGE,
		FAMILIA_FONDO,
		FAMILIA_ICON,
		BADGE_NEUTRO,
		FONDO_NEUTRO,
		ICONO_NEUTRO,
		limpiarNombre,
		miniatura
	} from '$lib/catalogo/tipos';
	import { construirFacetas, filtrar, relacionar, type Seleccion } from '$lib/catalogo/filtros';
	import RecursoFicha from '$lib/components/RecursoFicha.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import AvisoLocal from '$lib/components/AvisoLocal.svelte';
	import Estrellas from '$lib/components/Estrellas.svelte';
	import { socialLocal } from '$lib/social/local.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Eye, Heart, RotateCcw, SearchX, Shuffle, X } from '@lucide/svelte';

	let { data } = $props();

	const facetas = $derived(construirFacetas(data.facetas, !!data.session));
	const tipoFamilia = $derived(
		new Map(data.listas.filter((l) => l.lista === 'tipo').map((l) => [l.valor, l.grupo]))
	);
	// el mazo solo baraja versiones vigentes (SPEC-009)
	const recursosVigentes = $derived(data.recursos.filter((r) => r.es_vigente));

	// --- filtros: misma sintaxis de URL que el buscador (?etapas=MIC|COM&tipo=…) ---
	const paramsIniciales = page.url.searchParams;
	// svelte-ignore state_referenced_locally -- solo interesa el valor inicial (deep link)
	let seleccion = $state<Seleccion>(
		Object.fromEntries(
			construirFacetas(data.facetas, true).map((f) => [
				f.campo,
				paramsIniciales.get(f.campo)?.split('|').filter(Boolean) ?? []
			])
		)
	);
	const filtrosActivos = $derived(
		facetas.flatMap((f) => (seleccion[f.campo] ?? []).map((valor) => ({ campo: f.campo, valor })))
	);

	$effect(() => {
		if (!browser) return;
		const params = new URLSearchParams();
		for (const f of facetas) {
			if (seleccion[f.campo]?.length) params.set(f.campo, seleccion[f.campo].join('|'));
		}
		const cadena = params.toString();
		if (`${page.url.search}` !== (cadena ? `?${cadena}` : '')) {
			replaceState(cadena ? `?${cadena}` : page.url.pathname, {});
		}
	});

	// --- lo mío (idéntico al buscador: optimista, local sin sesión) ---
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
			if (!error) toast.success(`Valorado con ${estrellas} ${estrellas === 1 ? 'estrella' : 'estrellas'}`);
			else toast.error('No se pudo guardar la valoración');
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
		}
	}

	function abrirRecurso(r: RecursoCatalogo) {
		if (!r.enlace) return;
		data.supabase.rpc('registrar_acceso', { rid: r.id });
		window.open(r.enlace, '_blank', 'noopener,noreferrer');
	}

	// --- descartes de la sesión (no repetir hasta volver a barajar) ---
	const CLAVE_DESCARTES = 'mcm-descubre-descartados';
	const descartados = new SvelteSet<string>();
	let descartesCargados = false;
	function cargarDescartes() {
		if (descartesCargados || !browser) return;
		descartesCargados = true;
		try {
			for (const id of JSON.parse(sessionStorage.getItem(CLAVE_DESCARTES) ?? '[]')) {
				descartados.add(id);
			}
		} catch {
			// descartes corruptos: se empieza de cero
		}
	}
	function persistirDescartes() {
		if (browser) sessionStorage.setItem(CLAVE_DESCARTES, JSON.stringify([...descartados]));
	}

	// --- el mazo: filtros del buscador, barajado con sesgo a mejor valorados;
	//     lo que ya tienes en favoritos/usados cae al final (ya lo conoces) ---
	let mazo = $state<RecursoCatalogo[]>([]);
	let abierto = $state<RecursoCatalogo | null>(null);
	let historial = $state<{ recurso: RecursoCatalogo; accion: 'descartar' | 'guardar' }[]>([]);

	function armarMazo() {
		cargarDescartes();
		const candidatos = filtrar(recursosVigentes, facetas, seleccion, null).filter(
			(r) => !descartados.has(r.id)
		);
		const peso = (r: RecursoCatalogo) => {
			let w = (r.valoracion_media ?? 2.8) + Math.random() * 3;
			if (esFavorito(r.id) || esUsado(r.id)) w -= 10;
			return w;
		};
		mazo = candidatos
			.map((r) => [r, peso(r)] as const)
			.sort((a, b) => b[1] - a[1])
			.map(([r]) => r);
	}

	$effect(() => {
		if (!browser) return;
		void seleccion; // el mazo se rearma al cambiar filtros, no con cada swipe
		untrack(armarMazo);
	});

	const total = $derived(filtrar(recursosVigentes, facetas, seleccion, null).length);

	// --- gesto de arrastre con física ligera ---
	let drag = $state({ x: 0, y: 0, activo: false, saliendo: null as null | 'izq' | 'der' });
	let origen = { x: 0, y: 0 };

	function pointerdown(e: PointerEvent) {
		if (drag.saliendo || abierto) return;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		origen = { x: e.clientX, y: e.clientY };
		drag = { x: 0, y: 0, activo: true, saliendo: null };
	}
	function pointermove(e: PointerEvent) {
		if (!drag.activo || drag.saliendo) return;
		drag = { ...drag, x: e.clientX - origen.x, y: e.clientY - origen.y };
	}
	function pointerup() {
		if (!drag.activo || drag.saliendo) return;
		if (drag.x < -100) return lanzar('izq');
		if (drag.x > 100) return lanzar('der');
		if (drag.y < -110 && Math.abs(drag.x) < 80) {
			drag = { x: 0, y: 0, activo: false, saliendo: null };
			if (mazo[0]) abierto = mazo[0];
			return;
		}
		drag = { x: 0, y: 0, activo: false, saliendo: null }; // vuelve con muelle (transición CSS)
	}

	function lanzar(lado: 'izq' | 'der') {
		if (!mazo.length || drag.saliendo) return;
		const ancho = browser ? window.innerWidth : 800;
		drag = {
			x: lado === 'izq' ? -ancho : ancho,
			y: drag.y * 1.4,
			activo: false,
			saliendo: lado
		};
		const r = mazo[0];
		setTimeout(() => {
			if (lado === 'der') guardar(r);
			else descartar(r);
			drag = { x: 0, y: 0, activo: false, saliendo: null };
		}, 260);
	}

	function descartar(r: RecursoCatalogo) {
		descartados.add(r.id);
		persistirDescartes();
		historial = [...historial, { recurso: r, accion: 'descartar' }];
		mazo = mazo.filter((m) => m.id !== r.id);
	}

	function guardar(r: RecursoCatalogo) {
		if (!esFavorito(r.id)) toggleFavorito(r);
		descartados.add(r.id);
		persistirDescartes();
		historial = [...historial, { recurso: r, accion: 'guardar' }];
		mazo = mazo.filter((m) => m.id !== r.id);
		toast.success('Guardado en favoritos ❤', { duration: 1400 });
	}

	function deshacer() {
		const ultimo = historial.at(-1);
		if (!ultimo) return;
		historial = historial.slice(0, -1);
		descartados.delete(ultimo.recurso.id);
		persistirDescartes();
		if (ultimo.accion === 'guardar' && esFavorito(ultimo.recurso.id)) {
			toggleFavorito(ultimo.recurso);
		}
		mazo = [ultimo.recurso, ...mazo.filter((m) => m.id !== ultimo.recurso.id)];
	}

	function barajar() {
		for (const { recurso } of historial) descartados.delete(recurso.id);
		descartados.clear();
		persistirDescartes();
		historial = [];
		armarMazo();
	}

	function teclado(e: KeyboardEvent) {
		if (abierto || loginAbierto) return;
		const objetivo = e.target as HTMLElement;
		if (objetivo.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === 'ArrowLeft') lanzar('izq');
		else if (e.key === 'ArrowRight') lanzar('der');
		else if (e.key === 'ArrowUp' && mazo[0]) {
			e.preventDefault();
			abierto = mazo[0];
		} else if (e.key === 'Backspace' || e.key.toLowerCase() === 'z') deshacer();
	}

	const visibles = $derived(mazo.slice(0, 3));
	const relacionadosAbierto = $derived.by(() => {
		if (!abierto) return [];
		const manuales = abierto.relacionados
			.map((id) => data.recursos.find((r) => r.id === id))
			.filter(Boolean) as RecursoCatalogo[];
		return manuales.length ? manuales : relacionar(abierto, recursosVigentes);
	});
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
	// navegación de la ficha dentro del mazo actual
	const indiceAbierto = $derived(abierto ? mazo.findIndex((r) => r.id === abierto!.id) : -1);
	function navegarFicha(direccion: 1 | -1) {
		if (indiceAbierto < 0) return;
		const destino = mazo[indiceAbierto + direccion];
		if (destino) abierto = destino;
	}
	let imgFallos = $state<Record<string, boolean>>({});
</script>

<svelte:head>
	<title>Descubre · Banco de Recursos MCM</title>
	<meta name="description" content="Descubre recursos de tiempo libre uno a uno, estilo swipe" />
</svelte:head>

<svelte:window onkeydown={teclado} />

<main class="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pt-6 pb-10 sm:px-6">
	<header class="flex w-full flex-col items-center gap-2 text-center">
		<h1 class="font-display text-3xl font-bold tracking-tight">
			Descubre <span class="text-primary">recursos</span>
		</h1>
		<p class="text-sm text-muted-foreground">
			Uno a uno: ✕ descarta, ❤ guarda en favoritos, ↑ abre la ficha. También con las flechas del
			teclado.
		</p>
		{#if filtrosActivos.length}
			<div class="flex flex-wrap items-center justify-center gap-1.5">
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
				<a
					href={`/${page.url.search}`}
					class="text-xs text-muted-foreground underline-offset-2 hover:underline"
				>
					ajustar en el buscador
				</a>
			</div>
		{:else}
			<a href="/" class="text-xs text-muted-foreground underline-offset-2 hover:underline">
				¿Buscas algo concreto? Filtra en el buscador y vuelve con «Descubre»
			</a>
		{/if}
		<p class="text-xs text-muted-foreground tabular-nums">
			{mazo.length} de {total} en el mazo
		</p>
	</header>

	<!-- el mazo -->
	<div class="relative h-[min(62svh,560px)] w-full max-w-sm select-none">
		{#if visibles.length}
			{#each visibles as r, i (r.id)}
				{@const familia = r.tipo ? (tipoFamilia.get(r.tipo) ?? null) : null}
				{@const Icono = (familia && FAMILIA_ICON[familia]) || ICONO_NEUTRO}
				{@const src = !imgFallos[r.id] ? miniatura(r) : null}
				{@const esTop = i === 0}
				<article
					class={`absolute inset-0 flex flex-col overflow-hidden rounded-3xl border bg-card shadow-xl ${
						esTop ? 'cursor-grab touch-none active:cursor-grabbing' : ''
					} ${drag.activo && esTop ? '' : 'transition-transform duration-300 ease-out'}`}
					style={esTop
						? `transform: translate(${drag.x}px, ${drag.y}px) rotate(${drag.x * 0.05}deg); z-index: 30;`
						: `transform: scale(${1 - i * 0.045}) translateY(${i * 14}px); z-index: ${30 - i};`}
					onpointerdown={esTop ? pointerdown : undefined}
					onpointermove={esTop ? pointermove : undefined}
					onpointerup={esTop ? pointerup : undefined}
					onpointercancel={esTop ? pointerup : undefined}
				>
					<div class="relative h-[52%] w-full shrink-0 overflow-hidden">
						{#if src}
							<img src={src} alt="" class="size-full object-cover" draggable="false" onerror={() => (imgFallos = { ...imgFallos, [r.id]: true })} />
						{:else}
							<div class={`flex size-full items-center justify-center bg-gradient-to-br ${(familia && FAMILIA_FONDO[familia]) || FONDO_NEUTRO}`}>
								<Icono class="size-20 text-foreground/15" strokeWidth={1.2} />
							</div>
						{/if}
						{#if r.tipo}
							<Badge class={`absolute top-3 left-3 border-transparent shadow-sm ${(familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO}`}>
								{r.tipo}
							</Badge>
						{/if}

						{#if esTop}
							<!-- sellos de intención mientras arrastras -->
							<span
								class="absolute top-4 right-4 rotate-12 rounded-lg border-4 border-destructive px-3 py-1 font-display text-2xl font-bold text-destructive"
								style={`opacity: ${Math.min(Math.max(-drag.x - 30, 0) / 90, 1)}`}
							>
								✕
							</span>
							<span
								class="absolute top-4 left-14 -rotate-12 rounded-lg border-4 border-primary px-3 py-1 font-display text-2xl font-bold text-primary"
								style={`opacity: ${Math.min(Math.max(drag.x - 30, 0) / 90, 1)}`}
							>
								❤
							</span>
						{/if}
					</div>

					<div class="flex min-h-0 flex-1 flex-col gap-1.5 p-4">
						<h2 class="font-display text-xl leading-snug font-bold text-balance">
							{limpiarNombre(r.nombre)}
						</h2>
						{#if r.etapas.length || r.edades.length}
							<p class="text-xs text-muted-foreground">
								{[r.etapas.join(' · '), r.edades.slice(0, 3).join(', ')].filter(Boolean).join(' — ')}
							</p>
						{/if}
						<div class="flex items-center gap-3">
							<Estrellas media={r.valoracion_media} num={r.num_valoraciones} />
							<span class="text-xs text-muted-foreground tabular-nums">{r.num_accesos} aperturas</span>
						</div>
						{#if r.descripcion}
							<p class="line-clamp-3 text-sm text-muted-foreground">{r.descripcion}</p>
						{/if}
						{#if r.tags.length}
							<div class="mt-auto flex flex-wrap gap-1 pt-1">
								{#each r.tags.slice(0, 4) as tag (tag)}
									<span class="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{tag}</span>
								{/each}
							</div>
						{/if}
					</div>
				</article>
			{/each}
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed text-center">
				<SearchX class="size-10 text-muted-foreground/50" strokeWidth={1.5} />
				<p class="font-display text-lg font-semibold">
					{total ? 'Has visto todo el mazo' : 'No hay recursos con estos filtros'}
				</p>
				<p class="max-w-60 text-sm text-pretty text-muted-foreground">
					{total
						? 'Puedes volver a barajar los descartados o ajustar los filtros.'
						: 'Prueba a quitar algún filtro para llenar el mazo.'}
				</p>
				<div class="flex gap-2">
					{#if total}
						<Button size="sm" onclick={barajar}><Shuffle class="size-4" /> Volver a barajar</Button>
					{/if}
					<Button variant="outline" size="sm" href="/">Ir al buscador</Button>
				</div>
			</div>
		{/if}
	</div>

	<!-- botonera -->
	<div class="flex items-center gap-4">
		<Button
			variant="outline"
			size="icon"
			class="size-11 rounded-full"
			aria-label="Deshacer último"
			title="Deshacer (Z)"
			disabled={!historial.length}
			onclick={deshacer}
		>
			<RotateCcw class="size-4" />
		</Button>
		<Button
			variant="outline"
			size="icon"
			class="size-14 rounded-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
			aria-label="Descartar"
			title="Descartar (←)"
			disabled={!mazo.length}
			onclick={() => lanzar('izq')}
		>
			<X class="size-6" />
		</Button>
		<Button
			size="icon"
			class="size-14 rounded-full"
			aria-label="Guardar en favoritos"
			title="Guardar (→)"
			disabled={!mazo.length}
			onclick={() => lanzar('der')}
		>
			<Heart class="size-6" />
		</Button>
		<Button
			variant="outline"
			size="icon"
			class="size-11 rounded-full"
			aria-label="Ver ficha"
			title="Ver ficha (↑)"
			disabled={!mazo.length}
			onclick={() => mazo[0] && (abierto = mazo[0])}
		>
			<Eye class="size-4" />
		</Button>
	</div>
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
	total={mazo.length}
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
