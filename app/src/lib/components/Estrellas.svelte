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
</script>

{#if interactiva}
	<div class="flex items-center gap-0.5" role="radiogroup" aria-label="Tu valoración">
		{#each [1, 2, 3, 4, 5] as n (n)}
			<button
				type="button"
				role="radio"
				aria-checked={mia === n}
				aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
				class="rounded p-0.5 transition-transform duration-100 hover:scale-125 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
				style={`transition-delay: ${hover >= n ? (n - 1) * 40 : 0}ms`}
				onmouseenter={() => (hover = n)}
				onmouseleave={() => (hover = 0)}
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
