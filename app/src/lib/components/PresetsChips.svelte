<script lang="ts">
	import { fade } from 'svelte/transition';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { FacetaDef, Seleccion } from '$lib/catalogo/filtros';
	import {
		esPresetActivo,
		nombreSugerido,
		seleccionDePreset,
		seleccionVacia,
		type Preset
	} from '$lib/catalogo/presets';
	import { BookmarkPlus, Check, Sparkles } from '@lucide/svelte';

	/**
	 * Los atajos de búsqueda: «Adviento», «Para monitores» (SPEC-006 §Filtros).
	 *
	 * El mismo componente sirve en el buscador y en Descubre porque un preset son **facetas** y
	 * las dos pantallas filtran por lo mismo: en `/` recorta la rejilla, en `/descubre` arma el
	 * mazo. De ahí que aquí no haya nada de texto libre ni de barajado — solo la selección.
	 *
	 * Un chip encendido se puede volver a pulsar para apagarlo: es el atajo de vuelta a «todo»,
	 * y sin él había que ir a buscar «Limpiar todo» para deshacer un clic.
	 */
	let {
		presets,
		facetas,
		seleccion,
		etiqueta = 'Atajos',
		centrado = false,
		puedeGuardar = false,
		onaplicar,
		onguardar
	}: {
		presets: Preset[];
		facetas: FacetaDef[];
		seleccion: Seleccion;
		etiqueta?: string;
		/** Centrar la fila: Descubre tiene la cabecera centrada, el buscador alineada a la izquierda. */
		centrado?: boolean;
		/** Solo administradores: la RLS de `preset` es `es_admin()` (migración 00029). */
		puedeGuardar?: boolean;
		onaplicar: (seleccion: Seleccion) => void;
		onguardar?: (nombre: string) => Promise<void> | void;
	} = $props();

	const activos = $derived(new Set(presets.filter((p) => esPresetActivo(p, seleccion, facetas)).map((p) => p.id)));
	const hayFiltros = $derived(facetas.some((f) => (seleccion[f.campo] ?? []).length > 0));
	/** Guardar solo tiene sentido con filtros puestos que no sean ya un preset. */
	const sePuedeGuardarEsto = $derived(puedeGuardar && !!onguardar && hayFiltros && activos.size === 0);

	let guardando = $state(false);
	let dialogo = $state(false);
	let nombre = $state('');

	function abrirDialogo() {
		nombre = nombreSugerido(seleccion, facetas);
		dialogo = true;
	}

	async function confirmar() {
		const limpio = nombre.trim();
		if (!limpio || guardando) return;
		guardando = true;
		try {
			await onguardar?.(limpio);
			dialogo = false;
		} finally {
			guardando = false;
		}
	}

	function pulsar(p: Preset) {
		onaplicar(activos.has(p.id) ? seleccionVacia(facetas) : seleccionDePreset(p.filtros, facetas));
	}
</script>

{#if presets.length || sePuedeGuardarEsto}
	<!--
		Fila que se desliza en móvil con el mismo degradado que la barra de facetas: si hay seis
		atajos, el sexto se corta y hay que insinuar que sigue (F10 de docs/06-reflexion-uiux.md).
	-->
	<div
		class={[
			'-mx-4 flex items-center gap-1.5 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)] [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:[mask-image:none] [&::-webkit-scrollbar]:hidden',
			centrado && 'justify-center'
		]}
	>
		{#if presets.length}
			<span class="inline-flex shrink-0 items-center gap-1 pr-0.5 text-xs text-muted-foreground">
				<Sparkles class="size-3.5 text-primary/60" />
				{etiqueta}
			</span>
		{/if}
		{#each presets as p (p.id)}
			{@const encendido = activos.has(p.id)}
			<button
				type="button"
				aria-pressed={encendido}
				class={[
					'toque inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
					encendido
						? 'border-primary bg-primary text-primary-foreground'
						: 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
				]}
				title={encendido ? `Quitar «${p.nombre}»` : `Filtrar por «${p.nombre}»`}
				onclick={() => pulsar(p)}
			>
				{#if encendido}<Check class="size-3" />{/if}
				{p.nombre}
			</button>
		{/each}

		{#if sePuedeGuardarEsto}
			<button
				type="button"
				transition:fade={{ duration: 120 }}
				class="toque inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
				onclick={abrirDialogo}
			>
				<BookmarkPlus class="size-3.5" /> Guardar como atajo
			</button>
		{/if}
	</div>
{/if}

<Dialog.Root bind:open={dialogo}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title class="font-display text-lg">Guardar estos filtros</Dialog.Title>
			<Dialog.Description>
				Quedará como un atajo para todo el mundo, en el buscador y en Descubre.
			</Dialog.Description>
		</Dialog.Header>

		<form
			class="flex flex-col gap-3"
			onsubmit={(e) => {
				e.preventDefault();
				confirmar();
			}}
		>
			<!-- svelte-ignore a11y_autofocus -- el diálogo se abre para escribir aquí -->
			<Input bind:value={nombre} maxlength={40} autofocus placeholder="Adviento, Para monitores…" />
			<p class="flex flex-wrap gap-1 text-xs text-muted-foreground">
				<span>Guarda:</span>
				{#each facetas as f (f.campo)}
					{#each seleccion[f.campo] ?? [] as v (v)}
						<span class="rounded-full bg-primary/10 px-2 py-0.5 text-primary">{v}</span>
					{/each}
				{/each}
			</p>
			<!--
				El texto del buscador no entra en el atajo: Descubre no busca por texto, así que un
				preset con «Adviento» escrito daría una cosa en el buscador y otra en el mazo.
			-->
			<Dialog.Footer class="gap-2">
				<Button type="button" variant="ghost" onclick={() => (dialogo = false)}>Cancelar</Button>
				<Button type="submit" disabled={!nombre.trim()} cargando={guardando} textoCargando="Guardando…">
					Guardar atajo
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
