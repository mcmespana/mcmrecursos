<script lang="ts">
	import { browser } from '$app/environment';
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
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import {
		ArrowDown,
		ArrowUp,
		Check,
		ChevronDown,
		ChevronUp,
		Heart,
		Lock,
		Settings2,
		Star
	} from '@lucide/svelte';

	let {
		recursos,
		tipoFamilia,
		esFavorito,
		onopen,
		onfavorito
	}: {
		recursos: RecursoCatalogo[];
		tipoFamilia: Map<string, string | null>;
		esFavorito: (id: string) => boolean;
		onopen: (r: RecursoCatalogo) => void;
		onfavorito: (r: RecursoCatalogo) => void;
	} = $props();

	interface Columna {
		id: string;
		etiqueta: string;
		/** Valor plano para ordenar y (salvo render especial) para pintar. */
		valor: (r: RecursoCatalogo) => string | number | null;
		numerica?: boolean;
	}

	// candidatas de SPEC-006 §2b; «nombre» es fija y va aparte
	const COLUMNAS: Columna[] = [
		{ id: 'miniatura', etiqueta: 'Miniatura', valor: () => null },
		{ id: 'tipo', etiqueta: 'Tipo', valor: (r) => r.tipo },
		{ id: 'etapas', etiqueta: 'Etapas', valor: (r) => r.etapas.join(', ') || null },
		{ id: 'edades', etiqueta: 'Edades', valor: (r) => r.edades.join(', ') || null },
		{ id: 'nivel', etiqueta: 'Nivel', valor: (r) => r.nivel },
		{ id: 'mcm_local', etiqueta: 'MCM Local', valor: (r) => r.mcm_local },
		{ id: 'idioma', etiqueta: 'Idioma', valor: (r) => r.idioma },
		{ id: 'soporte', etiqueta: 'Soporte', valor: (r) => r.soporte },
		{ id: 'anyo', etiqueta: 'Año', valor: (r) => r.anyo_publicacion, numerica: true },
		{ id: 'valoracion', etiqueta: 'Valoración', valor: (r) => r.valoracion_media, numerica: true },
		{ id: 'accesos', etiqueta: 'Aperturas', valor: (r) => r.num_accesos, numerica: true }
	];
	const DEFECTO = ['tipo', 'etapas', 'edades', 'anyo', 'valoracion'];
	const CLAVE = 'mcm-tabla-columnas';

	// preferencias del usuario: orden de todas las columnas + cuáles se ven
	let ordenColumnas = $state<string[]>(COLUMNAS.map((c) => c.id));
	let visibles = $state<string[]>([...DEFECTO]);

	$effect(() => {
		if (!browser) return;
		try {
			const crudo = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
			if (crudo) {
				const conocidas = new Set(COLUMNAS.map((c) => c.id));
				const orden = (crudo.orden ?? []).filter((id: string) => conocidas.has(id));
				// columnas nuevas que no estaban guardadas se añaden al final
				for (const c of COLUMNAS) if (!orden.includes(c.id)) orden.push(c.id);
				ordenColumnas = orden;
				visibles = (crudo.visibles ?? DEFECTO).filter((id: string) => conocidas.has(id));
			}
		} catch {
			// preferencias corruptas: se ignoran
		}
	});

	function guardar() {
		if (!browser) return;
		localStorage.setItem(CLAVE, JSON.stringify({ orden: ordenColumnas, visibles }));
	}

	function toggleColumna(id: string) {
		visibles = visibles.includes(id) ? visibles.filter((v) => v !== id) : [...visibles, id];
		guardar();
	}

	function moverColumna(id: string, delta: -1 | 1) {
		const i = ordenColumnas.indexOf(id);
		const j = i + delta;
		if (i < 0 || j < 0 || j >= ordenColumnas.length) return;
		const copia = [...ordenColumnas];
		[copia[i], copia[j]] = [copia[j], copia[i]];
		ordenColumnas = copia;
		guardar();
	}

	function restablecer() {
		ordenColumnas = COLUMNAS.map((c) => c.id);
		visibles = [...DEFECTO];
		guardar();
	}

	const columnasVisibles = $derived(
		ordenColumnas
			.map((id) => COLUMNAS.find((c) => c.id === id))
			.filter((c): c is Columna => !!c && visibles.includes(c.id))
	);

	// --- orden de filas ---
	let orden = $state<{ id: string; asc: boolean } | null>(null);

	function ordenarPor(id: string) {
		orden = orden?.id === id ? (orden.asc ? { id, asc: false } : null) : { id, asc: true };
	}

	const valorOrden = (id: string, r: RecursoCatalogo): string | number | null =>
		id === 'nombre' ? limpiarNombre(r.nombre) : (COLUMNAS.find((c) => c.id === id)?.valor(r) ?? null);

	const ordenados = $derived.by(() => {
		if (!orden) return recursos;
		const { id, asc } = orden;
		return [...recursos].sort((a, b) => {
			const va = valorOrden(id, a);
			const vb = valorOrden(id, b);
			if (va == null && vb == null) return 0;
			if (va == null) return 1; // los vacíos siempre al final
			if (vb == null) return -1;
			const cmp =
				typeof va === 'number' && typeof vb === 'number'
					? va - vb
					: String(va).localeCompare(String(vb), 'es');
			return asc ? cmp : -cmp;
		});
	});

	let imgFallos = $state<Record<string, boolean>>({});
</script>

{#snippet cabecera(id: string, etiqueta: string, numerica?: boolean)}
	<button
		type="button"
		class={`group inline-flex items-center gap-1 font-medium tracking-wide uppercase hover:text-foreground ${numerica ? 'flex-row-reverse' : ''}`}
		onclick={() => ordenarPor(id)}
	>
		{etiqueta}
		{#if orden?.id === id}
			{#if orden.asc}<ArrowUp class="size-3" />{:else}<ArrowDown class="size-3" />{/if}
		{:else}
			<ArrowUp class="size-3 opacity-0 transition-opacity group-hover:opacity-40" />
		{/if}
	</button>
{/snippet}

<div class="max-h-[75svh] overflow-auto rounded-xl border bg-card shadow-sm">
	<table class="w-full min-w-[640px] text-sm">
		<thead class="sticky top-0 z-10 bg-background text-left text-xs text-muted-foreground">
			<tr class="border-b">
				<th class="px-3 py-2">{@render cabecera('nombre', 'Nombre')}</th>
				{#each columnasVisibles as c (c.id)}
					<th class={`px-3 py-2 ${c.numerica ? 'text-right' : ''} ${c.id === 'miniatura' ? 'w-12' : ''}`}>
						{#if c.id === 'miniatura'}
							<span class="sr-only">Miniatura</span>
						{:else}
							{@render cabecera(c.id, c.etiqueta, c.numerica)}
						{/if}
					</th>
				{/each}
				<th class="w-16 px-2 py-1 text-right">
					<Popover.Root>
						<Popover.Trigger
							class={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' h-7 gap-1 px-2 text-xs'}
							title="Configurar columnas"
						>
							<Settings2 class="size-3.5" />
							<span class="sr-only sm:not-sr-only">Columnas</span>
						</Popover.Trigger>
						<Popover.Content class="w-60 p-2" align="end">
							<p class="px-2 pb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Columnas de la tabla
							</p>
							<div class="flex flex-col gap-0.5">
								{#each ordenColumnas as id, i (id)}
									{@const col = COLUMNAS.find((c) => c.id === id)!}
									<div class="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent/60">
										<button
											type="button"
											class="flex flex-1 items-center gap-2 rounded px-1 py-1 text-left text-sm normal-case"
											onclick={() => toggleColumna(id)}
										>
											<span
												class={`flex size-4 items-center justify-center rounded border ${
													visibles.includes(id)
														? 'border-primary bg-primary text-primary-foreground'
														: 'border-input'
												}`}
											>
												{#if visibles.includes(id)}<Check class="size-3" />{/if}
											</span>
											<span class="text-foreground">{col.etiqueta}</span>
										</button>
										<button
											type="button"
											class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
											aria-label={`Subir ${col.etiqueta}`}
											disabled={i === 0}
											onclick={() => moverColumna(id, -1)}
										>
											<ChevronUp class="size-3.5" />
										</button>
										<button
											type="button"
											class="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
											aria-label={`Bajar ${col.etiqueta}`}
											disabled={i === ordenColumnas.length - 1}
											onclick={() => moverColumna(id, 1)}
										>
											<ChevronDown class="size-3.5" />
										</button>
									</div>
								{/each}
							</div>
							<div class="mt-1.5 border-t pt-1.5">
								<Button variant="ghost" size="sm" class="h-7 w-full text-xs" onclick={restablecer}>
									Restablecer columnas
								</Button>
							</div>
						</Popover.Content>
					</Popover.Root>
				</th>
			</tr>
		</thead>
		<tbody>
			{#each ordenados as r (r.id)}
				{@const familia = r.tipo ? (tipoFamilia.get(r.tipo) ?? null) : null}
				{@const fav = esFavorito(r.id)}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<tr
					class="h-10 cursor-pointer border-t transition-colors first:border-t-0 hover:bg-accent/40"
					onclick={() => onopen(r)}
				>
					<td class="max-w-80 px-3">
						<button
							type="button"
							class="flex w-full items-center gap-1.5 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
							onclick={(e) => {
								e.stopPropagation();
								onopen(r);
							}}
						>
							<span class="truncate font-medium">{limpiarNombre(r.nombre)}</span>
							{#if r.visibilidad === 'privado'}
								<span title="Recurso privado: requiere iniciar sesión">
									<Lock class="size-3 shrink-0 text-muted-foreground" />
								</span>
							{/if}
						</button>
					</td>
					{#each columnasVisibles as c (c.id)}
						{#if c.id === 'miniatura'}
							{@const src = !imgFallos[r.id] ? miniatura(r) : null}
							{@const Icono = (familia && FAMILIA_ICON[familia]) || ICONO_NEUTRO}
							<td class="w-12 px-3 py-1">
								{#if src}
									<img
										{src}
										alt=""
										class="size-8 rounded-md object-cover"
										loading="lazy"
										onerror={() => (imgFallos = { ...imgFallos, [r.id]: true })}
									/>
								{:else}
									<span
										class={`flex size-8 items-center justify-center rounded-md bg-gradient-to-br ${(familia && FAMILIA_FONDO[familia]) || FONDO_NEUTRO}`}
									>
										<Icono class="size-4 text-foreground/25" strokeWidth={1.5} />
									</span>
								{/if}
							</td>
						{:else if c.id === 'tipo'}
							<td class="px-3">
								{#if r.tipo}
									<Badge class={`border-transparent ${(familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO}`}>
										{r.tipo}
									</Badge>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</td>
						{:else if c.id === 'valoracion'}
							<td class="px-3 text-right whitespace-nowrap">
								{#if r.valoracion_media != null}
									<span class="inline-flex items-center gap-1 tabular-nums">
										<Star class="size-3.5 fill-warm text-warm" />
										{r.valoracion_media.toLocaleString('es')}
										<span class="text-xs text-muted-foreground">({r.num_valoraciones})</span>
									</span>
								{:else}
									<span class="text-muted-foreground">—</span>
								{/if}
							</td>
						{:else}
							<td
								class={`max-w-52 truncate px-3 text-muted-foreground ${c.numerica ? 'text-right tabular-nums' : ''}`}
							>
								{c.valor(r) ?? '—'}
							</td>
						{/if}
					{/each}
					<td class="px-2 text-right">
						<button
							type="button"
							aria-label={fav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
							aria-pressed={fav}
							class={`rounded-full p-1.5 transition-colors active:scale-90 ${
								fav ? 'text-destructive' : 'text-muted-foreground/50 hover:text-destructive'
							}`}
							onclick={(e) => {
								e.stopPropagation();
								onfavorito(r);
							}}
						>
							<Heart class={`size-4 ${fav ? 'fill-current' : ''}`} />
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
