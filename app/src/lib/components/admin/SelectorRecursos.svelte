<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { limpiarNombre } from '$lib/catalogo/tipos';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import { Search, X } from '@lucide/svelte';

	/**
	 * Elegir varios recursos de golpe (SPEC-015, segunda vuelta).
	 *
	 * El buscador en línea del editor va muy rápido para añadir de uno en uno, pero para montar un
	 * itinerario de veinte hay que poder abrir la lista, ver qué hay y marcar unos cuantos. Esto es
	 * lo segundo.
	 *
	 * No reutiliza `RecursoTabla` ni `RecursoCard` a propósito: las dos piden `RecursoCatalogo`
	 * entero —archivos, agregados sociales, versiones— y su contrato es «abrir» y «favorito», no
	 * «marcar». Encajarlas aquí obligaría a inventarse una docena de campos que no tenemos en esta
	 * pantalla. Se comparte lo que sí es compartible: `IconoFormato`, `limpiarNombre` y
	 * `normalizarConsulta`, que es la misma búsqueda tolerante a acentos del catálogo.
	 */
	export interface RecursoElegible {
		id: string;
		nombre: string;
		tipo: string | null;
		estado: string;
		enlace: string | null;
		formato: string | null;
		etapas?: string[] | null;
		edades?: string[] | null;
	}

	let {
		abierto = $bindable(false),
		catalogo,
		yaPuestos,
		onanadir
	}: {
		abierto?: boolean;
		catalogo: RecursoElegible[];
		/** ids que ya están en el itinerario: se enseñan marcados y no se pueden desmarcar. */
		yaPuestos: Set<string>;
		onanadir: (ids: string[]) => void | Promise<void>;
	} = $props();

	let busca = $state('');
	let marcados = $state<string[]>([]);

	// al abrir se empieza de cero: lo marcado la vez anterior ya se añadió
	$effect(() => {
		if (abierto) {
			busca = '';
			marcados = [];
		}
	});

	const disponibles = $derived(catalogo.filter((r) => !yaPuestos.has(r.id)));
	const filtrados = $derived.by(() => {
		const q = normalizarConsulta(busca);
		if (!q) return disponibles;
		return disponibles.filter((r) =>
			normalizarConsulta(
				`${r.nombre} ${r.tipo ?? ''} ${(r.etapas ?? []).join(' ')} ${(r.edades ?? []).join(' ')}`
			).includes(q)
		);
	});

	const marcadosSet = $derived(new Set(marcados));
	const alternar = (id: string) =>
		(marcados = marcadosSet.has(id) ? marcados.filter((x) => x !== id) : [...marcados, id]);

	async function confirmar() {
		if (!marcados.length) return;
		const elegidos = [...marcados];
		abierto = false;
		await onanadir(elegidos);
	}
</script>

<Dialog.Root bind:open={abierto}>
	<Dialog.Content class="flex max-h-[calc(100svh-2rem)] flex-col gap-3 sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="font-display text-lg">Elegir recursos</Dialog.Title>
			<Dialog.Description>
				Marca los que quieras y se añaden al final del tramo, en el orden en que aparecen aquí.
			</Dialog.Description>
		</Dialog.Header>

		<div class="relative shrink-0">
			<Search class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input bind:value={busca} placeholder="Buscar por nombre, tipo, etapa…" class="h-9 pl-9" />
		</div>

		<!-- la lista es lo único que scrollea: el buscador y el pie se quedan siempre a la vista -->
		<div class="min-h-0 flex-1 divide-y divide-border overflow-y-auto rounded-xl border border-border">
			{#if filtrados.length === 0}
				<p class="px-4 py-8 text-center text-sm text-muted-foreground">
					{disponibles.length === 0
						? 'Ya están todos los recursos del banco en este itinerario.'
						: 'Nada con ese nombre.'}
				</p>
			{:else}
				{#each filtrados as r (r.id)}
					<label
						class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
					>
						<input
							type="checkbox"
							checked={marcadosSet.has(r.id)}
							onchange={() => alternar(r.id)}
							class="size-4 shrink-0 accent-primary"
						/>
						<IconoFormato enlace={r.enlace} formato={r.formato} class="size-4 shrink-0" />
						<span class="min-w-0 flex-1 truncate text-sm font-medium">{limpiarNombre(r.nombre)}</span>
						{#if r.etapas?.length}
							<span class="hidden shrink-0 text-xs text-muted-foreground sm:inline">
								{r.etapas.join(' · ')}
							</span>
						{/if}
						{#if r.tipo}
							<Badge variant="secondary" class="hidden shrink-0 font-normal sm:inline-flex">
								{r.tipo}
							</Badge>
						{/if}
						{#if r.estado !== 'publicado'}
							<Badge variant="outline" class="shrink-0 text-[10px] text-muted-foreground">
								{r.estado}
							</Badge>
						{/if}
					</label>
				{/each}
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-2 border-t border-border pt-3">
			<span class="text-sm text-muted-foreground tabular-nums">
				{marcados.length}
				{marcados.length === 1 ? 'marcado' : 'marcados'}
			</span>
			<Button variant="ghost" size="sm" class="ml-auto" onclick={() => (abierto = false)}>
				<X class="size-3.5" /> Cancelar
			</Button>
			<Button disabled={!marcados.length} onclick={confirmar}>
				Añadir{marcados.length ? ` ${marcados.length}` : ''}
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
