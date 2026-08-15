<script lang="ts">
	import { MediaQuery } from 'svelte/reactivity';
	import * as Popover from '$lib/components/ui/popover';
	import * as Sheet from '$lib/components/ui/sheet';
	import { toast } from 'svelte-sonner';
	import { browser } from '$app/environment';
	import { buzon, type Aviso } from '$lib/avisos/estado.svelte';
	import { crearAcciones } from '$lib/avisos/acciones';
	import TarjetaAviso from './TarjetaAviso.svelte';
	import Compositor from './Compositor.svelte';
	import { Bell, CheckCheck, Expand, Inbox } from '@lucide/svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	/**
	 * El buzón del equipo, a un clic desde cualquier pantalla (SPEC-016).
	 *
	 * Va en la cabecera y no como burbuja flotante en una esquina: el catálogo es una rejilla que
	 * usa todo el ancho, y un botón fijo encima tapa recursos en cada pantalla de la app para
	 * servir a algo que se mira tres veces al día. Arriba, junto a la cuenta, es donde el ojo ya
	 * busca lo que es «tuyo», y el badge se ve sin abrir nada.
	 *
	 * En escritorio cuelga como popover anclado a la campana; en móvil sube como hoja inferior,
	 * que es el gesto que ya usa la ficha de recurso. Mismo contenido en los dos, escrito una vez.
	 */
	let {
		supabase,
		uid
	}: { supabase: SupabaseClient<any, 'recursos'>; uid: string } = $props();

	const escritorio = new MediaQuery('min-width: 640px');

	let abierto = $state(false);
	let filtro = $state<'sinleer' | 'mios' | 'todo' | 'hechas'>('todo');

	// El conteo tiene que estar antes de que nadie abra nada: una consulta diminuta al entrar.
	$effect(() => {
		if (browser && uid) buzon.refrescarResumen(supabase, uid);
	});

	// La lista completa solo se pide cuando de verdad se va a ver.
	$effect(() => {
		if (abierto && uid) buzon.cargar(supabase, uid);
	});

	/** Al abrir, si hay algo sin leer conviene empezar por ahí; si no, por todo lo abierto. */
	$effect(() => {
		if (abierto) filtro = buzon.sinLeer > 0 ? 'sinleer' : 'todo';
	});

	const abiertos = $derived(buzon.avisos.filter((a) => a.estado === 'abierta'));
	const ORDEN = { alta: 0, normal: 1, baja: 2 } as Record<string, number>;

	const lista = $derived.by(() => {
		let base: Aviso[];
		if (filtro === 'hechas') base = buzon.avisos.filter((a) => a.estado === 'hecha');
		else if (filtro === 'sinleer') base = abiertos.filter((a) => !a.leido);
		else if (filtro === 'mios') base = abiertos.filter((a) => a.asignada_a === buzon.miId);
		else base = abiertos;

		if (filtro === 'hechas') {
			return [...base].sort((a, b) => (b.resuelta_at ?? '').localeCompare(a.resuelta_at ?? ''));
		}
		// lo urgente arriba, y dentro de cada prioridad lo que vence antes
		return [...base].sort(
			(a, b) =>
				ORDEN[a.prioridad] - ORDEN[b.prioridad] ||
				(a.vence_at ?? '9999').localeCompare(b.vence_at ?? '9999') ||
				b.created_at.localeCompare(a.created_at)
		);
	});

	const FILTROS = $derived([
		{ id: 'sinleer' as const, etiqueta: 'Sin leer', n: buzon.sinLeer },
		{ id: 'mios' as const, etiqueta: 'Míos', n: buzon.mias },
		{ id: 'todo' as const, etiqueta: 'Todo', n: buzon.abiertas },
		{ id: 'hechas' as const, etiqueta: 'Hechas', n: 0 }
	]);

	const accion = $derived(crearAcciones(supabase, uid));

	async function marcarTodoLeido() {
		await buzon.marcarTodoLeido(supabase);
		toast.success('Todo marcado como leído');
	}
</script>

{#snippet disparador(props: Record<string, unknown>)}
	<button
		{...props}
		class="toque relative inline-flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
		aria-label={buzon.sinLeer
			? `Avisos y tareas, ${buzon.sinLeer} sin leer`
			: 'Avisos y tareas del equipo'}
	>
		<Bell class="size-4" />
		{#if buzon.sinLeer > 0}
			<span
				class="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums ring-2 ring-background"
			>
				{buzon.sinLeer > 9 ? '9+' : buzon.sinLeer}
			</span>
		{:else if buzon.vencidas > 0}
			<!-- nada sin leer pero algo se ha pasado de fecha: un punto, sin número que alarme -->
			<span
				class="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
			></span>
		{/if}
	</button>
{/snippet}

{#snippet contenido()}
	<!-- Cabecera: qué es esto y en qué estado está, sin obligar a contar tarjetas -->
	<div class="flex items-start justify-between gap-3 border-b border-border px-5 pt-4 pb-3">
		<div class="flex flex-col gap-0.5">
			<h2 class="font-display text-base leading-tight font-bold tracking-tight">Avisos y tareas</h2>
			<p class="text-xs text-muted-foreground">
				{#if buzon.abiertas === 0}
					Todo al día
				{:else}
					{buzon.abiertas} sin cerrar{#if buzon.vencidas}<span class="text-destructive">
							· {buzon.vencidas} vencid{buzon.vencidas === 1 ? 'a' : 'as'}</span
						>{/if}
				{/if}
			</p>
		</div>
		<div class="flex items-center gap-0.5">
			{#if buzon.sinLeer > 0}
				<button
					type="button"
					class="toque inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onclick={marcarTodoLeido}
				>
					<CheckCheck class="size-3.5" /> Marcar leído
				</button>
			{/if}
			<a
				href="/admin/avisos"
				onclick={() => (abierto = false)}
				class="toque inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				title="Verlo en grande"
			>
				<Expand class="size-3.5" /> <span class="sr-only sm:not-sr-only">En grande</span>
			</a>
		</div>
	</div>

	<!-- Filtros -->
	<div class="flex items-center gap-1.5 px-4 pt-3 pb-2.5">
		{#each FILTROS as f (f.id)}
			<button
				type="button"
				class={[
					'toque inline-flex h-7.5 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors',
					filtro === f.id
						? 'bg-foreground text-background'
						: 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
				]}
				onclick={() => (filtro = f.id)}
			>
				{f.etiqueta}
				{#if f.n > 0}
					<span
						class={[
							'tabular-nums',
							filtro === f.id
								? 'flex h-4 min-w-4 items-center justify-center rounded-full bg-background/25 px-1 text-[11px] font-semibold'
								: 'text-[11px] text-muted-foreground/70'
						]}
					>
						{f.n}
					</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- Lista -->
	<div class="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
		<Compositor {supabase} />

		{#if buzon.cargando && !buzon.cargado}
			{#each { length: 3 } as _, i (i)}
				<div class="h-28 animate-pulse rounded-2xl border border-border bg-muted/40"></div>
			{/each}
		{:else if lista.length === 0}
			<div class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-10 text-center">
				<Inbox class="size-6 text-muted-foreground/50" />
				<p class="text-sm font-medium">
					{#if filtro === 'sinleer'}Nada sin leer
					{:else if filtro === 'mios'}Nada asignado a ti
					{:else if filtro === 'hechas'}Todavía nada hecho
					{:else}El buzón está vacío{/if}
				</p>
				<p class="max-w-[26ch] text-xs text-muted-foreground">
					{#if filtro === 'todo'}
						Lo que no cabe en ninguna pantalla —«pedirle a Marta las fotos»— se apunta aquí.
					{:else}
						Cambia de filtro para ver el resto del buzón.
					{/if}
				</p>
			</div>
		{:else}
			{#each lista as a (a.id)}
				<TarjetaAviso aviso={a} onaccion={(que, valor) => accion(a, que, valor)} />
			{/each}
		{/if}
	</div>
{/snippet}

{#if escritorio.current}
	<Popover.Root bind:open={abierto}>
		<Popover.Trigger>
			{#snippet child({ props })}{@render disparador(props)}{/snippet}
		</Popover.Trigger>
		<Popover.Content
			align="end"
			sideOffset={10}
			class="flex max-h-[min(38rem,calc(100svh-5rem))] w-[27rem] flex-col overflow-hidden rounded-3xl border-border p-0 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-12px_rgba(0,0,0,0.18),0_40px_80px_-32px_rgba(0,0,0,0.26)]"
		>
			{@render contenido()}
		</Popover.Content>
	</Popover.Root>
{:else}
	<Sheet.Root bind:open={abierto}>
		<Sheet.Trigger>
			{#snippet child({ props })}{@render disparador(props)}{/snippet}
		</Sheet.Trigger>
		<Sheet.Content
			side="bottom"
			showCloseButton={false}
			class="flex max-h-[88svh] flex-col gap-0 rounded-t-3xl p-0"
		>
			<Sheet.Title class="sr-only">Avisos y tareas</Sheet.Title>
			<!-- asidero: en una hoja que se arrastra, el tirador es la señal de que se puede -->
			<div class="flex justify-center pt-2.5 pb-1">
				<span class="h-1 w-9 rounded-full bg-border"></span>
			</div>
			{@render contenido()}
		</Sheet.Content>
	</Sheet.Root>
{/if}
