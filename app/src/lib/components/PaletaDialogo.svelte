<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import * as Command from '$lib/components/ui/command';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { iconoDeTipo } from '$lib/catalogo/tipos';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Inbox, ListChecks, Moon, Search, Send, Shield, Sparkles, Sun } from '@lucide/svelte';
	import { toggleMode } from 'mode-watcher';

	/**
	 * El diálogo de la paleta de comandos, separado del disparador a propósito.
	 *
	 * Aquí vive lo caro —la primitiva `Command` de bits-ui y la lista de recursos— y este componente
	 * se carga con `import()` la primera vez que alguien abre la paleta. Antes viajaba en el paquete
	 * del layout, o sea que se descargaba en TODAS las páginas para todo el mundo, incluido quien no
	 * ha pulsado ⌘K en su vida.
	 */
	let {
		supabase,
		puedeAdministrar = false,
		abierta = $bindable(false)
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		puedeAdministrar?: boolean;
		abierta?: boolean;
	} = $props();

	interface RecursoBreve {
		id: string;
		nombre: string;
		tipo: string | null;
		enlace: string | null;
		formato: string | null;
	}

	let consulta = $state('');
	let pedidos = $state<RecursoBreve[]>([]);
	let cargando = $state(false);
	let cargados = false;

	/**
	 * En la portada y en Descubre el catálogo ya está en memoria: la paleta lo reutiliza en vez de
	 * pedirlo otra vez. Antes se traía el catálogo COMPLETO en la primera ⌘K aunque estuvieras
	 * mirándolo — con 2.000 recursos, medio mega de más por abrir un buscador.
	 */
	const delCatalogo = $derived(
		((page.data.recursos ?? []) as any[])
			.filter((r) => r.estado === 'publicado' && r.es_vigente !== false)
			.map((r) => ({
				id: r.id,
				nombre: r.nombre,
				tipo: r.tipo,
				enlace: r.enlace,
				formato: r.formato
			})) as RecursoBreve[]
	);
	const recursos = $derived(delCatalogo.length ? delCatalogo : pedidos);

	async function cargarRecursos() {
		if (cargados || delCatalogo.length) return;
		cargados = true;
		cargando = true;
		const { data } = await supabase
			.from('recurso')
			.select('id, nombre, tipo, enlace, formato')
			.eq('estado', 'publicado')
			.order('nombre');
		pedidos = (data ?? []) as RecursoBreve[];
		cargando = false;
	}

	// cada vez que se abre: buscador limpio, y el catálogo pedido si esta pantalla no lo tenía
	$effect(() => {
		if (!abierta) return;
		consulta = '';
		cargarRecursos();
	});

	/**
	 * Filtra la primitiva, no nosotros. Se intentó al revés —filtrar la lista a mano y pasarle a
	 * la primitiva solo lo visible— y ahí se rompía el teclado: sin saber qué hay visible, no
	 * resalta nada, y sin resaltado Intro no abre nada.
	 *
	 * Lo único que se le cambia es cómo compara: sin acentos ni mayúsculas, para que «oracion»
	 * encuentre «Oración». Devuelve 1 si encaja y 0 si no; los sinónimos de cada entrada viajan
	 * en su `keywords`.
	 */
	function filtro(valor: string, busqueda: string, palabras?: string[]): number {
		const q = normalizarConsulta(busqueda);
		if (!q) return 1;
		return normalizarConsulta([valor, ...(palabras ?? [])].join(' ')).includes(q) ? 1 : 0;
	}

	/**
	 * Lo que se pinta de la lista de recursos. La primitiva filtra lo que le llegue, pero pintar
	 * 2.000 entradas al abrir la paleta son 16.000 nodos de DOM y una espera tonta: nadie lee más
	 * de una pantalla de resultados. Sin nada escrito se enseñan unas pocas como aperitivo, y al
	 * escribir se recortan con la MISMA comparación que usa `filtro` — así todo lo que se le pasa
	 * a la primitiva encaja siempre, y sigue resaltando y navegando con el teclado como antes.
	 */
	const TOPE = 40;
	const listados = $derived.by(() => {
		const q = normalizarConsulta(consulta);
		if (!q) return recursos.slice(0, 8);
		const salida: RecursoBreve[] = [];
		for (const r of recursos) {
			if (normalizarConsulta(`${r.nombre} ${r.tipo ?? ''}`).includes(q)) salida.push(r);
			if (salida.length >= TOPE) break;
		}
		return salida;
	});
	const totalCoincidencias = $derived.by(() => {
		const q = normalizarConsulta(consulta);
		if (!q) return recursos.length;
		let n = 0;
		for (const r of recursos) {
			if (normalizarConsulta(`${r.nombre} ${r.tipo ?? ''}`).includes(q)) n++;
		}
		return n;
	});

	const SECCIONES = [
		{ ruta: '/', etiqueta: 'Buscar en el banco', icono: Search, claves: ['catalogo', 'inicio'] },
		{ ruta: '/descubre', etiqueta: 'Descubre', icono: Sparkles, claves: ['mazo', 'swipe'] },
		{ ruta: '/enviar', etiqueta: 'Enviar un recurso', icono: Send, claves: ['aportar', 'subir'] },
		{ ruta: '/listas', etiqueta: 'Mis listas', icono: ListChecks, claves: ['guardado'] },
		{ ruta: '/envios', etiqueta: 'Mis envíos', icono: Inbox, claves: ['aportaciones'] }
	];

	async function irARecurso(r: RecursoBreve) {
		abierta = false;
		await goto(`/?r=${r.id}`);
	}

	async function irA(ruta: string) {
		abierta = false;
		await goto(ruta);
	}
</script>

<Command.Dialog
	bind:open={abierta}
	title="Paleta de comandos"
	description="Busca un recurso o salta a una sección"
	filter={filtro}
	class="sm:max-w-lg"
>
	<Command.Input placeholder="Busca un recurso, una sección…" bind:value={consulta} />
	<Command.List class="max-h-[60svh]">
		{#if cargando}
			<Command.Loading>Cargando el catálogo…</Command.Loading>
		{/if}

		<Command.Empty>Nada con «{consulta}». Prueba con otra palabra.</Command.Empty>

		{#if listados.length}
			<Command.Group
				heading={consulta.trim()
					? `Recursos (${listados.length} de ${totalCoincidencias})`
					: 'Recursos'}
			>
				{#each listados as r (r.id)}
					{@const Icono = iconoDeTipo(r.tipo, null)}
					{@const titulo = r.nombre.replace(/^\[EJEMPLO\]\s*/, '')}
					<Command.Item
						value={r.id}
						keywords={[titulo, r.tipo ?? '']}
						onSelect={() => irARecurso(r)}
					>
						<Icono class="size-4 shrink-0 text-muted-foreground" />
						<span class="truncate">{titulo}</span>
						<span class="ml-auto flex shrink-0 items-center gap-2">
							{#if r.tipo}
								<span class="text-xs text-muted-foreground">{r.tipo}</span>
							{/if}
							<IconoFormato enlace={r.enlace} formato={r.formato} class="size-3.5" />
						</span>
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}

		<Command.Group heading="Ir a">
			{#each SECCIONES as seccion (seccion.ruta)}
				{@const Icono = seccion.icono}
				<Command.Item
					value={`ir:${seccion.ruta}`}
					keywords={[seccion.etiqueta, ...seccion.claves]}
					onSelect={() => irA(seccion.ruta)}
				>
					<Icono class="size-4 shrink-0 text-muted-foreground" />
					{seccion.etiqueta}
				</Command.Item>
			{/each}
			{#if puedeAdministrar}
				<Command.Item
					value="ir:/admin"
					keywords={['Administración', 'panel', 'revisión', 'recursos']}
					onSelect={() => irA('/admin')}
				>
					<Shield class="size-4 shrink-0 text-muted-foreground" />
					Administración
				</Command.Item>
			{/if}
		</Command.Group>

		<Command.Group heading="Acciones">
			<Command.Item
				value="tema"
				keywords={['tema', 'claro', 'oscuro', 'modo']}
				onSelect={() => {
					toggleMode();
					abierta = false;
				}}
			>
				<Sun class="size-4 shrink-0 text-muted-foreground dark:hidden" />
				<Moon class="hidden size-4 shrink-0 text-muted-foreground dark:block" />
				Cambiar entre claro y oscuro
			</Command.Item>
		</Command.Group>
	</Command.List>

	<div class="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
		<span class="flex items-center gap-1">
			<kbd class="rounded border bg-muted px-1 font-sans">↑</kbd>
			<kbd class="rounded border bg-muted px-1 font-sans">↓</kbd> moverse
		</span>
		<span class="flex items-center gap-1">
			<kbd class="rounded border bg-muted px-1 font-sans">↵</kbd> abrir
		</span>
		<span class="ml-auto flex items-center gap-1">
			<kbd class="rounded border bg-muted px-1 font-sans">esc</kbd> cerrar
		</span>
	</div>
</Command.Dialog>
