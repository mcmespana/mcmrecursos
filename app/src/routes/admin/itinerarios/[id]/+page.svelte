<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Badge } from '$lib/components/ui/badge';
	import SelectorMultiple from '$lib/components/SelectorMultiple.svelte';
	import SelectorRecursos from '$lib/components/admin/SelectorRecursos.svelte';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { crearOcupado, lanzarAccion } from '$lib/acciones.svelte';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import { limpiarNombre } from '$lib/catalogo/tipos';
	import { flip } from 'svelte/animate';
	import { fade, slide } from 'svelte/transition';
	import {
		ArrowLeft,
		GripVertical,
		ImageIcon,
		LayoutList,
		ChevronDown,
		ChevronUp,
		Eye,
		Plus,
		Search,
		SplitSquareVertical,
		Trash2,
		X
	} from '@lucide/svelte';

	/**
	 * Montar un itinerario (SPEC-015 §El editor).
	 *
	 * La regla que ordena esta pantalla: **cuatro campos arriba y una lista debajo**. Nada más.
	 * Los bloques son estructura opcional y no se nombran hasta que alguien pulsa «partir en
	 * tramos»: el caso que dispara la spec es «veinte sesiones en orden», no «tres tramos con
	 * título», y obligar a pensar en tramos para añadir el primer recurso era el trámite que
	 * hacía que no se creara ninguno.
	 */
	let { data } = $props();

	const ocupado = crearOcupado();
	const it = $derived(data.itinerario);
	/** Un solo bloque sin título = itinerario simple: no se pinta la palabra «tramo» en ningún sitio. */
	const simple = $derived(it.bloques.length === 1 && !it.bloques[0].nombre);

	const opciones = (lista: string) =>
		data.listas
			.filter((l: any) => l.lista === lista)
			.map((l: any) => ({ valor: l.valor, grupo: l.grupo }));

	// --- los cuatro campos ---
	let nombre = $state('');
	let descripcion = $state('');
	let etapas = $state<string[]>([]);
	let edades = $state<string[]>([]);
	let imagen = $state('');
	let publicado = $state(false);
	// se reinicia al cambiar de itinerario, no en cada `invalidateAll`
	let idCargado = $state('');
	$effect(() => {
		if (idCargado === it.id) return;
		idCargado = it.id;
		nombre = it.nombre;
		descripcion = it.descripcion ?? '';
		etapas = [...it.etapas];
		edades = [...it.edades];
		imagen = it.imagen ?? '';
		publicado = it.estado === 'publicado';
	});

	function guardar() {
		return ocupado.enhance(async ({ result }: any) => {
			if (result.type === 'success') {
				toast.success('Guardado');
				await invalidateAll();
			} else {
				toast.error('No se pudo guardar', { description: result.data?.error });
			}
		}, 'guardar');
	}

	// --- la lista de recursos ---
	/** ids ya usados en cualquier tramo: no tiene sentido ofrecerlos otra vez. */
	const yaPuestos = $derived(
		new Set(it.bloques.flatMap((b: any) => b.recursos.map((r: any) => r.id)))
	);

	let busqueda = $state('');
	let bloqueDestino = $state<string | null>(null);

	const candidatos = $derived.by(() => {
		const q = normalizarConsulta(busqueda);
		if (q.length < 2) return [];
		return data.catalogo
			.filter((r: any) => !yaPuestos.has(r.id))
			.filter((r: any) => normalizarConsulta(`${r.nombre} ${r.tipo ?? ''}`).includes(q))
			.slice(0, 8);
	});

	async function anadir(bloqueId: string, recursoId: string) {
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/anadir', {
				bloque_id: bloqueId,
				recurso_id: recursoId
			});
			if (error) {
				toast.error('No se pudo añadir', { description: error });
				return;
			}
			busqueda = '';
			await invalidateAll();
		}, `anadir-${recursoId}`);
	}

	async function quitar(bloqueId: string, recursoId: string, comoSeLlama: string) {
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/quitar', {
				bloque_id: bloqueId,
				recurso_id: recursoId
			});
			if (error) {
				toast.error('No se pudo quitar', { description: error });
				return;
			}
			await invalidateAll();
			toast.success(`«${comoSeLlama}» fuera del itinerario`, {
				description: 'El recurso sigue en el banco, solo sale de aquí.'
			});
		}, `quitar-${recursoId}`);
	}

	/** ids añadidos hace un instante: para que la fila entre con un destello y se vea que llegó. */
	let recienAnadidos = $state<string[]>([]);
	let selectorAbierto = $state(false);
	let bloqueDelSelector = $state<string | null>(null);

	function abrirSelector(bloqueId: string) {
		bloqueDelSelector = bloqueId;
		selectorAbierto = true;
	}

	/** Añadir varios de golpe desde el selector, en el orden en que se marcaron. */
	async function anadirVarios(ids: string[]) {
		const bloqueId = bloqueDelSelector;
		if (!bloqueId || !ids.length) return;
		const cuerpo = new URLSearchParams();
		cuerpo.set('bloque_id', bloqueId);
		for (const id of ids) cuerpo.append('recurso_id', id);
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/anadir', cuerpo);
			if (error) {
				toast.error('No se pudieron añadir', { description: error });
				return;
			}
			await invalidateAll();
			destacar(ids);
			toast.success(`${ids.length} ${ids.length === 1 ? 'recurso añadido' : 'recursos añadidos'}`);
		}, 'anadir-varios');
	}

	function destacar(ids: string[]) {
		recienAnadidos = ids;
		setTimeout(() => (recienAnadidos = recienAnadidos.filter((x) => !ids.includes(x))), 1800);
	}

	/**
	 * Reordenar: arrastrando y con flechas, las dos cosas.
	 *
	 * Arrastrar es lo natural para «esto va tres más abajo» y es lo que se pidió; las flechas se
	 * quedan porque son las que funcionan con teclado y en táctil, donde el arrastre nativo de HTML
	 * no existe. Se usa el drag&drop del navegador y no una librería: para una lista vertical de
	 * veinte, `dragstart`/`dragover`/`drop` bastan y no hay 30 KB que descargar.
	 */
	let arrastrando = $state<{ bloque: string; id: string } | null>(null);
	let encima = $state<string | null>(null);

	async function guardarOrden(bloque: any, ids: string[]) {
		const cuerpo = new URLSearchParams();
		cuerpo.set('bloque_id', bloque.id);
		for (const id of ids) cuerpo.append('recurso_id', id);
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/ordenar', cuerpo);
			if (error) {
				toast.error('No se pudo reordenar', { description: error });
				return;
			}
			await invalidateAll();
		}, `mover-${bloque.id}`);
	}

	async function mover(bloque: any, indice: number, salto: -1 | 1) {
		const destino = indice + salto;
		if (destino < 0 || destino >= bloque.recursos.length) return;
		const ids = bloque.recursos.map((r: any) => r.id);
		[ids[indice], ids[destino]] = [ids[destino], ids[indice]];
		await guardarOrden(bloque, ids);
	}

	/** Mover un tramo entero arriba o abajo. */
	async function moverBloque(indice: number, salto: -1 | 1) {
		const destino = indice + salto;
		if (destino < 0 || destino >= it.bloques.length) return;
		const ids = it.bloques.map((b: any) => b.id);
		[ids[indice], ids[destino]] = [ids[destino], ids[indice]];
		const cuerpo = new URLSearchParams();
		for (const id of ids) cuerpo.append('bloque_id', id);
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/ordenarBloques', cuerpo);
			if (error) {
				toast.error('No se pudo reordenar los tramos', { description: error });
				return;
			}
			await invalidateAll();
		}, 'ordenar-bloques');
	}

	/** Suelta lo arrastrado justo delante de la fila sobre la que se suelta. */
	async function soltarEn(bloque: any, idDestino: string) {
		const origen = arrastrando;
		arrastrando = null;
		encima = null;
		if (!origen || origen.bloque !== bloque.id || origen.id === idDestino) return;
		const ids = bloque.recursos.map((r: any) => r.id);
		const desde = ids.indexOf(origen.id);
		const hasta = ids.indexOf(idDestino);
		if (desde < 0 || hasta < 0) return;
		ids.splice(desde, 1);
		ids.splice(hasta, 0, origen.id);
		await guardarOrden(bloque, ids);
	}

	function accionSimple(accion: string, campos: Record<string, string>, exito?: string) {
		return ocupado.envolver(async () => {
			const error = await lanzarAccion(accion, campos);
			if (error) {
				toast.error('No se pudo completar', { description: error });
				return;
			}
			await invalidateAll();
			if (exito) toast.success(exito);
		}, accion + JSON.stringify(campos));
	}

	const total = $derived(it.bloques.reduce((n: number, b: any) => n + b.recursos.length, 0));
</script>

<svelte:head><title>{it.nombre} · Itinerarios · Admin</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center gap-3">
		<a
			href="/admin/itinerarios"
			class="toque inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
		>
			<ArrowLeft class="size-4" /> Itinerarios
		</a>
		<span class="ml-auto flex items-center gap-2">
			{#if it.estado === 'publicado'}
				<Button variant="outline" size="sm" href={`/itinerarios/${it.id}`} target="_blank">
					<Eye class="size-3.5" /> Verlo publicado
				</Button>
			{/if}
			<Badge
				class={it.estado === 'publicado'
					? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-500'
					: 'bg-muted text-muted-foreground'}
			>
				{it.estado === 'publicado' ? 'Publicado' : 'Borrador'}
			</Badge>
		</span>
	</div>

	<!-- Los cuatro campos. Ni uno más (SPEC-015 §El editor) -->
	<form method="POST" action="?/guardar" use:enhance={guardar()} class="flex flex-col gap-4">
		<div class="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					Nombre
				</span>
				<Input name="nombre" bind:value={nombre} class="h-11 font-display text-lg font-bold" />
			</label>

			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					De qué va
				</span>
				<Textarea
					name="descripcion"
					bind:value={descripcion}
					rows={3}
					placeholder="La explicación que se lee antes de empezar: para qué sirve este itinerario y cómo recorrerlo."
				/>
			</label>

			<SelectorMultiple
				etiqueta="Etapas"
				opciones={opciones('etapas')}
				bind:valor={etapas}
				nombre="etapas"
				ayuda="Déjalo vacío si vale para cualquier etapa."
			/>
			<SelectorMultiple
				etiqueta="Edades"
				opciones={opciones('edades')}
				bind:valor={edades}
				nombre="edades"
				ayuda="Déjalo vacío si vale para cualquier edad."
			/>

			<!-- Portada opcional: si falta, la tarjeta pinta el fallback generado de siempre -->
			<label class="flex flex-col gap-1.5">
				<span
					class="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase"
				>
					<ImageIcon class="size-3.5" /> Portada
				</span>
				<div class="flex items-center gap-3">
					<Input
						name="imagen"
						bind:value={imagen}
						placeholder="Enlace a una imagen (opcional)"
						class="h-9 flex-1"
					/>
					{#if imagen.trim()}
						<img
							src={imagen}
							alt=""
							class="size-14 shrink-0 rounded-lg border border-border object-cover"
						/>
					{/if}
				</div>
			</label>

			<div class="flex flex-wrap items-center gap-3 border-t border-border pt-3">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={publicado} class="size-4 accent-primary" />
					Publicado
					<span class="text-xs text-muted-foreground">
						{publicado ? 'se ve en /itinerarios' : 'solo lo veis vosotros'}
					</span>
				</label>
				<input type="hidden" name="estado" value={publicado ? 'publicado' : 'borrador'} />
				<Button
					type="submit"
					class="ml-auto"
					cargando={ocupado.cargando('guardar')}
					hecho={ocupado.hecho('guardar')}
					textoCargando="Guardando…"
				>
					Guardar
				</Button>
			</div>
		</div>
	</form>

	<!-- La lista: el corazón de la pantalla -->
	<section class="flex flex-col gap-3">
		<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
			<h2 class="font-display text-lg font-bold">
				{simple ? 'Los recursos, en orden' : 'Los tramos'}
			</h2>
			<span class="text-sm text-muted-foreground tabular-nums">
				{total}
				{total === 1 ? 'recurso' : 'recursos'}
			</span>
			{#if simple}
				<button
					type="button"
					class="toque ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onclick={() =>
						accionSimple('?/nuevoBloque', { nombre: 'Segundo tramo' }, 'Itinerario partido en tramos')}
					title="Agrupar los recursos en secciones con título"
				>
					<SplitSquareVertical class="size-3.5" /> Partir en tramos
				</button>
			{:else}
				<button
					type="button"
					class="toque ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
					onclick={() => accionSimple('?/nuevoBloque', { nombre: 'Tramo nuevo' }, 'Tramo añadido')}
				>
					<Plus class="size-3.5" /> Otro tramo
				</button>
			{/if}
		</div>

		{#each it.bloques as bloque, ib (bloque.id)}
			<div class="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
				<!-- La cabecera del tramo solo existe si el itinerario está partido -->
				{#if !simple}
					<form
						method="POST"
						action="?/bloque"
						use:enhance={() => async ({ result }: any) => {
							if (result.type === 'success') await invalidateAll();
						}}
						class="flex flex-wrap items-center gap-2 border-b border-border pb-3"
					>
						<span
							class="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums"
						>
							{ib + 1}
						</span>
						<input type="hidden" name="id" value={bloque.id} />
						<Input
							name="nombre"
							value={bloque.nombre ?? ''}
							placeholder="Título del tramo"
							class="h-8 max-w-xs font-semibold"
						/>
						<Input
							name="descripcion"
							value={bloque.descripcion ?? ''}
							placeholder="Una línea sobre este tramo (opcional)"
							class="h-8 flex-1"
						/>
						<Button type="submit" variant="outline" size="sm">Guardar tramo</Button>
						{#if it.bloques.length > 1}
							<span class="flex items-center gap-0.5">
								<button
									type="button"
									disabled={ib === 0}
									class="toque inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-25"
									onclick={() => moverBloque(ib, -1)}
									aria-label="Subir este tramo"
								>
									<ChevronUp class="size-4" />
								</button>
								<button
									type="button"
									disabled={ib === it.bloques.length - 1}
									class="toque inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-25"
									onclick={() => moverBloque(ib, 1)}
									aria-label="Bajar este tramo"
								>
									<ChevronDown class="size-4" />
								</button>
							</span>
						{/if}
						{#if it.bloques.length > 1}
							<button
								type="button"
								class="toque inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
								onclick={() => accionSimple('?/borrarBloque', { id: bloque.id }, 'Tramo borrado')}
								aria-label="Borrar este tramo"
							>
								<Trash2 class="size-3.5" />
							</button>
						{/if}
					</form>
				{/if}

				{#if bloque.recursos.length === 0}
					<p class="px-1 py-3 text-sm text-muted-foreground">
						Sin recursos todavía. Búscalos abajo y se van poniendo en orden.
					</p>
				{:else}
					<ol class="flex flex-col">
						{#each bloque.recursos as r, i (r.id)}
							<li
								animate:flip={{ duration: 220 }}
								draggable="true"
								ondragstart={() => (arrastrando = { bloque: bloque.id, id: r.id })}
								ondragend={() => {
									arrastrando = null;
									encima = null;
								}}
								ondragover={(e) => {
									if (arrastrando?.bloque !== bloque.id) return;
									e.preventDefault();
									encima = r.id;
								}}
								ondragleave={() => encima === r.id && (encima = null)}
								ondrop={(e) => {
									e.preventDefault();
									soltarEn(bloque, r.id);
								}}
								class={[
									'group/fila flex items-center gap-2 border-b border-border/60 py-2 last:border-0 transition-colors',
									arrastrando?.id === r.id && 'opacity-40',
									encima === r.id && arrastrando?.id !== r.id && 'border-t-2 border-t-primary',
									recienAnadidos.includes(r.id) && 'bg-primary/[0.07]'
								]}
							>
								<!--
									El asa hace de agarre y de pista: sin algo que diga «esto se arrastra», el
									drag&drop es un secreto. Se ve al pasar por encima y siempre en táctil,
									donde además no funciona y las flechas son la vía.
								-->
								<span
									class="shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover/fila:opacity-100 active:cursor-grabbing max-sm:opacity-100"
									aria-hidden="true"
								>
									<GripVertical class="size-4" />
								</span>
								<span
									class="w-5 shrink-0 text-right font-display text-sm font-bold text-muted-foreground tabular-nums"
								>
									{i + 1}
								</span>
								<span class="shrink-0"><IconoFormato enlace={r.enlace} formato={r.formato} class="size-4" /></span>
								<span class="flex min-w-0 flex-1 flex-col leading-tight">
									<span class="truncate text-sm font-medium">{limpiarNombre(r.nombre)}</span>
									<span class="truncate text-[11.5px] text-muted-foreground">
										{r.tipo ?? 'Sin tipo'}{#if r.estado !== 'publicado'}
											· <span class="text-warm-foreground dark:text-warm">{r.estado}</span>
										{/if}
									</span>
								</span>

								<span class="flex shrink-0 items-center gap-0.5">
									<button
										type="button"
										disabled={i === 0}
										class="toque inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-25"
										onclick={() => mover(bloque, i, -1)}
										aria-label={`Subir ${limpiarNombre(r.nombre)}`}
									>
										<ChevronUp class="size-4" />
									</button>
									<button
										type="button"
										disabled={i === bloque.recursos.length - 1}
										class="toque inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-25"
										onclick={() => mover(bloque, i, 1)}
										aria-label={`Bajar ${limpiarNombre(r.nombre)}`}
									>
										<ChevronDown class="size-4" />
									</button>
									<button
										type="button"
										class="toque ml-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
										onclick={() => quitar(bloque.id, r.id, limpiarNombre(r.nombre))}
										aria-label={`Quitar ${limpiarNombre(r.nombre)} del itinerario`}
									>
										<X class="size-4" />
									</button>
								</span>
							</li>
						{/each}
					</ol>
				{/if}

				<!--
					Dos formas de añadir, y las dos hacen falta: el buscador va rapidísimo cuando sabes
					el nombre, y el selector es para cuando quieres ver qué hay y marcar unos cuantos.
				-->
				<div class="mt-1 flex items-start gap-2">
				<div class="relative flex-1">
					<Search
						class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						value={bloqueDestino === bloque.id ? busqueda : ''}
						oninput={(e) => {
							bloqueDestino = bloque.id;
							busqueda = e.currentTarget.value;
						}}
						placeholder="Añadir un recurso: escribe su nombre…"
						class="h-9 pl-9"
					/>
					{#if bloqueDestino === bloque.id && candidatos.length}
						<ul
							class="absolute z-20 mt-1 flex w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
						>
							{#each candidatos as c (c.id)}
								<li>
									<button
										type="button"
										class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
										onclick={() => anadir(bloque.id, c.id)}
									>
										<IconoFormato enlace={c.enlace} formato={c.formato} class="size-4 shrink-0" />
										<span class="min-w-0 flex-1 truncate">{limpiarNombre(c.nombre)}</span>
										<span class="shrink-0 text-xs text-muted-foreground">{c.tipo ?? ''}</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else if bloqueDestino === bloque.id && normalizarConsulta(busqueda).length >= 2}
						<p class="absolute mt-1 w-full rounded-xl border border-border bg-popover px-3 py-2 text-sm text-muted-foreground shadow-lg">
							Nada con ese nombre que no esté ya en el itinerario.
						</p>
					{/if}
				</div>
					<Button
						variant="outline"
						class="h-9 shrink-0"
						onclick={() => abrirSelector(bloque.id)}
						cargando={ocupado.cargando('anadir-varios')}
						textoCargando="Añadiendo…"
					>
						<LayoutList class="size-4" /> Elegir de la lista
					</Button>
				</div>
			</div>
		{/each}
	</section>
</div>

<SelectorRecursos
	bind:abierto={selectorAbierto}
	catalogo={data.catalogo}
	{yaPuestos}
	onanadir={anadirVarios}
/>
