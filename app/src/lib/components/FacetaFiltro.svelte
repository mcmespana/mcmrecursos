<script lang="ts">
	import * as Popover from '$lib/components/ui/popover';
	import { Input } from '$lib/components/ui/input';
	import { buttonVariants } from '$lib/components/ui/button';
	import { Check, ChevronDown } from '@lucide/svelte';
	import { normalizarConsulta } from '$lib/catalogo/filtros';

	let {
		etiqueta,
		opciones,
		counts,
		seleccion,
		onchange
	}: {
		etiqueta: string;
		opciones: { valor: string; grupo: string | null }[];
		counts: Map<string, number>;
		seleccion: string[];
		onchange: (valores: string[]) => void;
	} = $props();

	let filtroInterno = $state('');

	const visibles = $derived(
		opciones.filter(
			(o) =>
				(counts.get(o.valor) ?? 0) > 0 ||
				seleccion.includes(o.valor) ||
				normalizarConsulta(o.valor).includes(normalizarConsulta(filtroInterno))
		)
	);
	const filtradas = $derived(
		filtroInterno
			? visibles.filter((o) =>
					normalizarConsulta(o.valor).includes(normalizarConsulta(filtroInterno))
				)
			: visibles
	);
	const conGrupos = $derived(filtradas.some((o) => o.grupo));

	function toggle(valor: string) {
		onchange(
			seleccion.includes(valor) ? seleccion.filter((v) => v !== valor) : [...seleccion, valor]
		);
	}
</script>

<Popover.Root>
	<Popover.Trigger
		class={buttonVariants({ variant: seleccion.length ? 'default' : 'outline', size: 'sm' }) +
			' gap-1.5'}
	>
		{etiqueta}
		{#if seleccion.length}
			<span
				class="rounded-full bg-primary-foreground/20 px-1.5 text-xs font-semibold tabular-nums"
			>
				{seleccion.length}
			</span>
		{/if}
		<ChevronDown class="size-3.5 opacity-60" />
	</Popover.Trigger>
	<Popover.Content class="w-64 p-2" align="start">
		{#if opciones.length > 8}
			<Input
				bind:value={filtroInterno}
				placeholder={`Buscar en ${etiqueta.toLowerCase()}…`}
				class="mb-2 h-8"
			/>
		{/if}
		<div class="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
			{#each filtradas as opcion, i (opcion.valor)}
				{#if conGrupos && opcion.grupo && (i === 0 || filtradas[i - 1].grupo !== opcion.grupo)}
					<p class="px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
						{opcion.grupo}
					</p>
				{/if}
				<button
					type="button"
					class="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
					onclick={() => toggle(opcion.valor)}
				>
					<span class="flex items-center gap-2">
						<span
							class={`flex size-4 items-center justify-center rounded border ${
								seleccion.includes(opcion.valor)
									? 'border-primary bg-primary text-primary-foreground'
									: 'border-input'
							}`}
						>
							{#if seleccion.includes(opcion.valor)}<Check class="size-3" />{/if}
						</span>
						{opcion.valor}
					</span>
					<span class="text-xs text-muted-foreground tabular-nums">
						{counts.get(opcion.valor) ?? 0}
					</span>
				</button>
			{:else}
				<p class="px-2 py-3 text-sm text-muted-foreground">Sin opciones</p>
			{/each}
		</div>
	</Popover.Content>
</Popover.Root>
