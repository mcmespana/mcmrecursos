<script lang="ts">
	import { flip } from 'svelte/animate';
	import { fade } from 'svelte/transition';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import type { Orama } from '@orama/orama';
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
	import { limpiarNombre } from '$lib/catalogo/tipos';
	import { avisoDeshacible } from '$lib/deshacer';
	import RecursoCard from '$lib/components/RecursoCard.svelte';
	import RecursoTabla from '$lib/components/RecursoTabla.svelte';
	import FacetaFiltro from '$lib/components/FacetaFiltro.svelte';
	import RecursoFicha from '$lib/components/RecursoFicha.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import AvisoLocal from '$lib/components/AvisoLocal.svelte';
	import { socialLocal } from '$lib/social/local.svelte';
	import { refrescarCatalogo } from '$lib/catalogo/refresco';
	import { crearTransicionFicha } from '$lib/transicion.svelte';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { LayoutGrid, Rows3, Search, Send, Sparkles, X } from '@lucide/svelte';

	let { data } = $props();

	// facetas del buscador: configuración en BD (tabla `faceta`, editable en /admin/config)
	const facetas = $derived(construirFacetas(data.facetas, !!data.session));

	// grid, índice y facetas trabajan solo con versiones vigentes (SPEC-009); las anteriores
	// siguen accesibles por enlace directo, listas y desde la ficha de la vigente.
	const recursosVigentes = $derived(data.recursos.filter((r) => r.es_vigente));

	/**
	 * Índice de texto (Orama). Se construye la PRIMERA VEZ QUE ALGUIEN ESCRIBE, no al cargar.
	 *
	 * Antes era un `$derived.by` sobre el catálogo, así que se indexaba en cuanto se abría la
	 * página —cuando nadie ha buscado nada todavía— y se volvía a indexar entero en cada
	 * `invalidateAll()`, o sea cada vez que se guardaba un favorito. Con 800 recursos eso son
	 * cientos de milisegundos de hilo principal bloqueado, gratis y a cambio de nada.
	 *
	 * La firma es la lista de ids: si el catálogo cambia de recursos, el índice se rehace. Un
	 * recurso editado con el mismo id no cambia la firma, y no pasa nada — al recargar la página
	 * el índice nace de cero, y editar es cosa del panel, no del buscador.
	 *
	 * El motor también llega tarde: `@orama/orama` se carga con `import()` la primera vez que hace
	 * falta, así que quien entra a mirar la rejilla no descarga el buscador entero para nada.
	 */
	const firmaCatalogo = $derived(recursosVigentes.map((r) => r.id).join('|'));
	let indice: Orama<{ id: 'string'; texto: 'string' }> | null = null;
	let firmaIndexada = '';
	let orama: typeof import('@orama/orama') | null = null;

	async function indiceDeTexto() {
		orama ??= await import('@orama/orama');
		if (indice && firmaIndexada === firmaCatalogo) return { orama, indice };
		const nuevo = orama.create({ schema: { id: 'string', texto: 'string' } as const });
		orama.insertMultiple(
			nuevo,
			recursosVigentes.map((r) => ({ id: r.id, texto: textoIndexable(r) }))
		);
		indice = nuevo;
		firmaIndexada = firmaCatalogo;
		return { orama, indice: nuevo };
	}

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

	/**
	 * Puente entre la URL y la ficha abierta.
	 *
	 * Hasta ahora `?r=` solo se leía al inicializar, así que un `?r=` que llegara DESPUÉS no
	 * abría nada: ni desde la paleta de comandos, ni pegando un enlace en la misma pestaña, ni
	 * con el botón atrás. Se veía cambiar la URL y no pasaba nada más.
	 *
	 * El centinela `ultimoIdEnUrl` es deliberadamente un `let` normal, no estado reactivo: así
	 * este efecto depende SOLO de la URL y no de `abierto`. Si dependiera de `abierto` se pelearía
	 * con el efecto que escribe la URL más abajo — cerrar la ficha vaciaba `abierto`, el efecto
	 * volvía a leer el `?r=` que aún no se había limpiado y la reabría al instante.
	 */
	let ultimoIdEnUrl = paramsIniciales.get('r') ?? '';
	$effect(() => {
		const id = page.url.searchParams.get('r') ?? '';
		if (id === ultimoIdEnUrl) return;
		ultimoIdEnUrl = id;
		if (!id) return;
		const encontrado = data.recursos.find((r) => r.id === id);
		if (encontrado) abierto = encontrado;
	});

	const mostrarFicha = (r: RecursoCatalogo | null) => (abierto = r);

	let idsTexto = $state<Set<string> | null>(null);
	$effect(() => {
		const consulta = q.trim();
		if (!consulta) {
			idsTexto = null;
			return;
		}
		let vigente = true;
		indiceDeTexto()
			.then(({ orama: motor, indice: db }) =>
				motor.search(db, { term: consulta, properties: ['texto'], limit: 2000, tolerance: 1 })
			)
			.then((res) => {
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

	// la miniatura de la tarjeta viaja hasta la cabecera de la ficha (docs/04-diseno.md §5)
	const transicion = crearTransicionFicha();
	const abrirFicha = (r: RecursoCatalogo) => transicion.abrir(r.id, () => mostrarFicha(r));

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

	/**
	 * Quitar un favorito es de un clic y no avisa de nada: el corazón se apaga y, si no era eso lo
	 * que querías, hay que acordarse de cuál era. El aviso con «Deshacer» lo arregla sin retardar
	 * nada — un favorito ya es reversible, así que aquí basta con la acción contraria.
	 */
	const avisarQuitado = (r: RecursoCatalogo) =>
		avisoDeshacible({
			mensaje: 'Quitado de tus favoritos',
			descripcion: limpiarNombre(r.nombre),
			deshacer: () => toggleFavorito(r)
		});

	async function toggleFavorito(r: RecursoCatalogo) {
		if (!data.session) {
			socialLocal.toggleFavorito(r.id);
			if (!socialLocal.favoritos.has(r.id)) avisarQuitado(r);
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
			if (tenia) avisarQuitado(r);
			refrescarCatalogo();
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
			refrescarCatalogo();
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
				refrescarCatalogo();
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
			refrescarCatalogo();
		}
	}

	/** Descargas y copias abren su propio enlace: aquí solo se cuenta el acceso. */
	function registrarAcceso(r: RecursoCatalogo) {
		data.supabase.rpc('registrar_acceso', { rid: r.id }).then(() => refrescarCatalogo());
	}

	function abrirRecurso(r: RecursoCatalogo, enlace?: string) {
		const destino = enlace ?? r.enlace;
		if (!destino) return;
		// registro en segundo plano; la navegación no espera
		data.supabase.rpc('registrar_acceso', { rid: r.id }).then(() => refrescarCatalogo());
		window.open(destino, '_blank', 'noopener,noreferrer');
	}

	// --- derivados de catálogo ---
	const resultados = $derived(filtrar(recursosVigentes, facetas, seleccion, idsBusqueda));

	/**
	 * Cuántas tarjetas hay pintadas. El catálogo entero sigue en memoria —la búsqueda y las
	 * facetas son instantáneas porque no van al servidor— pero pintarlo entero es otra cosa: con
	 * 800 recursos eran 24.000 nodos de DOM, 54 MB de memoria y casi 2 s para abrir una ficha,
	 * porque una View Transition tiene que fotografiar todo eso dos veces. Se pinta una ventana y
	 * crece al llegar al final de la página, que es cuando de verdad hacen falta más.
	 */
	const PASO = 48;
	let ventana = $state(PASO);
	const mostrados = $derived(resultados.slice(0, ventana));
	const quedanPorVer = $derived(Math.max(0, resultados.length - mostrados.length));

	// Al cambiar lo que se busca, la ventana vuelve al principio. Depende de los filtros, NO de
	// `resultados`: si dependiera de la lista, cualquier refresco de contadores (un favorito
	// guardado) te devolvería al principio del catálogo sin haber tocado nada.
	$effect(() => {
		void q;
		void seleccion;
		ventana = PASO;
	});

	// El centinela vive al final de la rejilla: cuando se asoma, se pinta la siguiente tanda. El
	// margen de 800 px hace que la tanda esté lista antes de que se llegue al hueco.
	let centinela = $state<HTMLElement | null>(null);
	$effect(() => {
		// `ventana` es dependencia a propósito: un IntersectionObserver solo avisa cuando algo
		// CRUZA el umbral, así que si el centinela sigue a la vista después de pintar la tanda no
		// volvería a avisar y la lista se quedaría a medias. Recrearlo vuelve a comprobarlo.
		void ventana;
		if (!centinela || typeof IntersectionObserver === 'undefined') return;
		const observador = new IntersectionObserver(
			(entradas) => {
				if (entradas.some((e) => e.isIntersecting)) ventana += PASO;
			},
			{ rootMargin: '800px' }
		);
		observador.observe(centinela);
		return () => observador.disconnect();
	});
	const filtrosActivos = $derived(
		facetas.flatMap((f) => (seleccion[f.campo] ?? []).map((valor) => ({ campo: f.campo, valor })))
	);
	/** ¿Hay intención de búsqueda? Decide si el héroe se aparta (F1). */
	const buscando = $derived(!!q.trim() || filtrosActivos.length > 0);
	/** Rol de panel: decide si se ven las marcas de trabajo interno en tarjeta y ficha (F6). */
	const esEquipo = $derived(
		!!data.perfil && ['edicion_local', 'editor', 'administrador'].includes(data.perfil.rol)
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
	/**
	 * Lo último que escribimos nosotros. Antes se comparaba contra `page.url.search`, pero
	 * `page.url` NO se actualiza con `replaceState`: se quedaba con el valor de la carga inicial,
	 * y por eso al cerrar la ficha el `?r=` se quedaba pegado en la barra del navegador para
	 * siempre (bug de antes). Comparando con lo nuestro, la URL sí se limpia.
	 */
	let ultimaUrlEscrita = browser ? page.url.search : '';
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
		const busqueda = cadena ? `?${cadena}` : '';
		if (ultimaUrlEscrita !== busqueda) {
			ultimaUrlEscrita = busqueda;
			ultimoIdEnUrl = params.get('r') ?? '';
			replaceState(destino, {});
		}
	});

	/**
	 * Estado vacío que sabe qué sobra (docs/04-diseno.md §7 lo pedía con estas palabras: «Sin
	 * resultados con estos 4 filtros — prueba quitando *Vídeo*»).
	 *
	 * Se prueba a quitar cada filtro por separado —y también la búsqueda de texto— y se ofrecen los
	 * que devuelven algo, empezando por el que más desbloquea. Un mensaje genérico deja el trabajo
	 * de adivinar a quien busca, y son cuatro filtros y una consulta: no es evidente cuál es el que
	 * sobra. Solo se calcula cuando hay cero resultados, así que no cuesta nada el resto del tiempo.
	 */
	const culpables = $derived.by(() => {
		if (resultados.length) return [];
		const opciones: { etiqueta: string; cuantos: number; quitar: () => void }[] = [];

		if (q.trim()) {
			const cuantos = filtrar(recursosVigentes, facetas, seleccion, null).length;
			if (cuantos) opciones.push({ etiqueta: `«${q.trim()}»`, cuantos, quitar: () => (q = '') });
		}
		for (const { campo, valor } of filtrosActivos) {
			const sinEse = { ...seleccion, [campo]: seleccion[campo].filter((v) => v !== valor) };
			const cuantos = filtrar(recursosVigentes, facetas, sinEse, idsBusqueda).length;
			if (cuantos) {
				opciones.push({
					etiqueta: valor,
					cuantos,
					quitar: () => (seleccion = sinEse)
				});
			}
		}
		return opciones.sort((a, b) => b.cuantos - a.cuantos).slice(0, 3);
	});

	// para el título del estado vacío: una consulta larga se recorta para no partir la frase
	const consultaCorta = $derived(
		q.trim().length > 24 ? `${q.trim().slice(0, 24)}…` : q.trim()
	);
	const cuantosFiltros = $derived(
		filtrosActivos.length === 1 ? 'este filtro' : `estos ${filtrosActivos.length} filtros`
	);

	function limpiarTodo() {
		q = '';
		seleccion = Object.fromEntries(facetas.map((f) => [f.campo, []]));
	}

	function navegarFicha(direccion: 1 | -1) {
		if (!abierto) return;
		const i = resultados.findIndex((r) => r.id === abierto!.id);
		const destino = resultados[i + direccion];
		if (destino) mostrarFicha(destino);
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
	<!--
		Héroe que se aparta en cuanto hay intención (F1 de docs/06-reflexion-uiux.md).

		El titular y las cifras del banco son una bienvenida: valen la primera vez que entras y no
		valen nada cuando ya estás buscando. Ocupaban ~180 px en escritorio y ~380 px en móvil
		SIEMPRE, así que con una consulta puesta el primer resultado aparecía fuera de pantalla en el
		camino más transitado de la app. Con `buscando` el bloque se reduce al buscador y deja la
		pantalla para lo que se ha pedido.

		Las cifras del banco se van con el titular a propósito: mientras buscas, «7 recursos» (el
		total) convivía a 140 px de «2 recursos» (el resultado), las dos con la misma palabra, y se
		leía como un error.
	-->
	<section
		class={[
			'flex flex-col items-center text-center transition-all',
			buscando ? 'gap-3 pt-4 pb-1' : 'gap-4 pt-10 pb-2'
		]}
	>
		{#if !buscando}
			<h1 class="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
				Encuentra tu próximo <span class="text-primary">recurso</span>
			</h1>
			<p class="text-sm text-muted-foreground tabular-nums">
				{stats.recursos}
				{stats.recursos === 1 ? 'recurso' : 'recursos'} · {stats.autores}
				{stats.autores === 1 ? 'autor' : 'autores'} · {stats.accesos} aperturas
			</p>
		{/if}
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
		<!--
			`aria-live`: el recuento cambia al teclear y al tocar una faceta, y sin esto quien no ve
			la rejilla no se enteraba de que su filtro había dejado 3 resultados o ninguno.
		-->
		<p
			class="text-sm text-muted-foreground tabular-nums"
			role="status"
			aria-live="polite"
			aria-atomic="true"
		>
			{resultados.length}
			{resultados.length === 1 ? 'recurso' : 'recursos'}
			<span class="sr-only">
				{resultados.length === 1 ? 'encontrado' : 'encontrados'}
				{filtrosActivos.length || q.trim() ? 'con la búsqueda actual' : 'en el banco'}
			</span>
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
				class="toque inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20"
				aria-label={`Quitar el filtro ${filtro.valor}`}
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
				class={`toque inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
				class={`toque inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
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
				onopen={abrirFicha}
				onfavorito={toggleFavorito}
			/>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
				{#each mostrados as recurso (recurso.id)}
					<div animate:flip={{ duration: 220 }}>
						<RecursoCard
							{recurso}
							familia={recurso.tipo ? (tipoFamilia.get(recurso.tipo) ?? null) : null}
							favorito={esFavorito(recurso.id)}
							nombreTransicion={transicion.tarjeta(recurso.id)}
							conEstadoEditorial={esEquipo}
						onopen={abrirFicha}
							onfavorito={toggleFavorito}
						/>
					</div>
				{/each}
			</div>

			<!--
				Botón además del centinela, no en su lugar: el observador no salta si el hueco nunca
				entra en pantalla (ventana muy alta, zoom grande) y sin botón la lista se quedaría
				muda. Además da algo que pulsar a quien navega con teclado.
			-->
			{#if quedanPorVer}
				<div bind:this={centinela} class="flex flex-col items-center gap-2 py-4">
					<Button variant="outline" onclick={() => (ventana += PASO)}>
						Ver más recursos <span class="text-muted-foreground tabular-nums">({quedanPorVer})</span>
					</Button>
				</div>
			{/if}
		{/if}
	{:else}
		<div class="flex flex-col items-center gap-3 py-20 text-center">
			<!-- el título nombra lo que ha dejado la pantalla vacía: la consulta, los filtros o los dos -->
			<p class="font-display text-xl font-semibold text-balance">
				Sin resultados
				{#if consultaCorta && filtrosActivos.length}
					con «{consultaCorta}» y {cuantosFiltros}
				{:else if consultaCorta}
					con «{consultaCorta}»
				{:else if filtrosActivos.length}
					con {cuantosFiltros}
				{/if}
			</p>
			{#if culpables.length}
				<p class="max-w-sm text-sm text-muted-foreground text-pretty">
					{culpables.length === 1 ? 'Prueba quitando esto:' : 'Prueba quitando alguno de estos:'}
				</p>
				<div class="flex flex-wrap items-center justify-center gap-2">
					{#each culpables as culpable (culpable.etiqueta)}
						<Button variant="outline" size="sm" onclick={culpable.quitar}>
							<X class="size-3.5" />
							{culpable.etiqueta}
							<span class="text-muted-foreground tabular-nums">
								{culpable.cuantos}
								{culpable.cuantos === 1 ? 'recurso' : 'recursos'}
							</span>
						</Button>
					{/each}
				</div>
			{:else}
				<p class="max-w-sm text-sm text-muted-foreground text-pretty">
					{filtrosActivos.length || q.trim()
						? 'Quitar un solo filtro no basta: hay que aflojar más de uno.'
						: 'El banco está vacío por ahora.'}
				</p>
			{/if}
			{#if filtrosActivos.length || q.trim()}
				<Button variant="ghost" size="sm" onclick={limpiarTodo}>Limpiar todo</Button>
			{/if}
		</div>
	{/if}

	<!--
		Invitación a aportar, al pie del catálogo y no en el héroe: aquí es donde de verdad ocurre
		«no he encontrado lo que buscaba», y no le roba ni un píxel a la primera pantalla, que ya
		va justa en móvil. Sale con resultados y sin ellos, porque las dos son buenas ocasiones.
	-->
	<aside
		class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl border border-dashed border-border px-5 py-4"
	>
		<div class="flex min-w-0 flex-col gap-0.5">
			<p class="font-medium">¿Has preparado algo que no está aquí?</p>
			<p class="text-sm text-muted-foreground text-pretty">
				Pega el enlace y el equipo lo cataloga. No hace falta cuenta ni rellenar nada más.
			</p>
		</div>
		<Button href="/enviar" class="ml-auto shrink-0">
			<Send class="size-4" /> Enviar un recurso
		</Button>
	</aside>
</main>

<RecursoFicha
	supabase={data.supabase}
	session={data.session}
	puedeModerar={data.perfil?.rol === 'editor' || data.perfil?.rol === 'administrador'}
	conEstadoEditorial={esEquipo}
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
	onclose={() => mostrarFicha(null)}
	onnavegar={navegarFicha}
	nombreTransicion={transicion.ficha(abierto?.id)}
	onabrirrelacionado={mostrarFicha}
	onfavorito={toggleFavorito}
	onusado={toggleUsado}
	onvalorar={valorar}
	onabrir={abrirRecurso}
	onacceso={registrarAcceso}
/>

<LoginDialog bind:open={loginAbierto} onentrar={entrarConGoogle} />

{#if browser && !data.session && socialLocal.hayDatos()}
	<AvisoLocal onentrar={entrarConGoogle} />
{/if}
