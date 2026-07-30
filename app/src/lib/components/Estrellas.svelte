<script lang="ts">
	import { Star } from '@lucide/svelte';

	let {
		media = null,
		num = 0,
		mia = null,
		interactiva = false,
		onvalorar
	}: {
		/** Media agregada (modo lectura). */
		media?: number | null;
		/** Nº de valoraciones (modo lectura). */
		num?: number;
		/** Mi valoración (modo interactivo). */
		mia?: number | null;
		interactiva?: boolean;
		onvalorar?: (estrellas: number) => void;
	} = $props();

	let hover = $state(0);
	const mostrada = $derived(interactiva ? (hover || mia || 0) : (media ?? 0));

	/**
	 * Un `radiogroup` de verdad: una sola parada de tabulación y las flechas cambian la nota. Antes
	 * eran cinco botones con `role="radio"` pero cinco paradas y sin flechas, que es justo lo que un
	 * lector de pantalla no espera de un grupo de radios.
	 */
	const enfocada = $derived(mia ?? 1);

	function teclas(e: KeyboardEvent) {
		const paso = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
		const destino = paso
			? Math.min(5, Math.max(1, (mia ?? 0) + paso))
			: e.key === 'Home'
				? 1
				: e.key === 'End'
					? 5
					: null;
		if (!destino) return;
		e.preventDefault();
		onvalorar?.(destino);
		const grupo = (e.currentTarget as HTMLElement).parentElement;
		(grupo?.children[destino - 1] as HTMLElement | undefined)?.focus();
	}
</script>

{#if interactiva}
	<div class="flex items-center gap-0.5" role="radiogroup" aria-label="Tu valoración">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<button
				type="button"
				role="radio"
				aria-checked={mia === n}
				aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
				tabindex={n === enfocada ? 0 : -1}
				class="toque rounded p-0.5 transition-transform duration-100 hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				style={`transition-delay: ${hover >= n ? (n - 1) * 40 : 0}ms`}
				onmouseenter={() => (hover = n)}
				onmouseleave={() => (hover = 0)}
				onkeydown={teclas}
				onclick={() => onvalorar?.(n)}
			>
				<Star
					class={`size-6 transition-colors ${
						mostrada >= n ? 'fill-warm text-warm' : 'text-muted-foreground/40'
					}`}
				/>
			</button>
		{/each}
	</div>
{:else if media != null}
	<span class="inline-flex items-center gap-1 text-sm" title={`${media} de 5 (${num})`}>
		<Star class="size-4 fill-warm text-warm" />
		<span class="font-medium tabular-nums">{media.toLocaleString('es')}</span>
		{#if num}<span class="text-xs text-muted-foreground tabular-nums">({num})</span>{/if}
	</span>
{:else}
	<span class="inline-flex items-center gap-1 text-xs text-muted-foreground">
		<Star class="size-3.5" /> Sin valorar
	</span>
{/if}
