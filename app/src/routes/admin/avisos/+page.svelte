<script lang="ts">
	import { browser } from '$app/environment';
	import { toast } from 'svelte-sonner';
	import { Input } from '$lib/components/ui/input';
	import * as Avatar from '$lib/components/ui/avatar';
	import TarjetaAviso from '$lib/components/avisos/TarjetaAviso.svelte';
	import Compositor from '$lib/components/avisos/Compositor.svelte';
	import { buzon, type Aviso } from '$lib/avisos/estado.svelte';
	import { crearAcciones } from '$lib/avisos/acciones';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import { CheckCheck, Inbox, Users } from '@lucide/svelte';

	/**
	 * El buzón en grande (SPEC-016).
	 *
	 * No es «otra pantalla» sino la misma en otra escala: las tarjetas son el mismo componente que
	 * el panel flotante, con `grande` puesto. Lo que aquí cambia es lo que solo se puede hacer con
	 * sitio — buscar, filtrar por persona, y sobre todo **ver el trabajo repartido por urgencia**
	 * en vez de una lista plana: vencido, esta semana, más adelante y sin fecha. Un buzón ordenado
	 * por fecha de creación esconde justo lo que había que mirar primero.
	 */
	let { data } = $props();

	const uid = $derived(data.perfil?.id ?? '');
	const accion = $derived(crearAcciones(data.supabase, uid));

	let filtro = $state<'abiertas' | 'sinleer' | 'mios' | 'hechas'>('abiertas');
	let quien = $state('');
	let busca = $state('');

	$effect(() => {
		if (browser && uid) buzon.cargar(data.supabase, uid);
	});

	const ORDEN = { alta: 0, normal: 1, baja: 2 } as Record<string, number>;

	const filtrados = $derived.by(() => {
		let base = buzon.avisos;
		if (filtro === 'hechas') base = base.filter((a) => a.estado === 'hecha');
		else {
			base = base.filter((a) => a.estado === 'abierta');
			if (filtro === 'sinleer') base = base.filter((a) => !a.leido);
			if (filtro === 'mios') base = base.filter((a) => a.asignada_a === uid);
		}
		if (quien) base = base.filter((a) => a.asignada_a === quien);

		const q = normalizarConsulta(busca);
		if (q) {
			base = base.filter((a) =>
				normalizarConsulta(`${a.titulo} ${a.detalle ?? ''} ${a.recurso_nombre ?? ''}`).includes(q)
			);
		}
		return [...base].sort(
			(a, b) =>
				ORDEN[a.prioridad] - ORDEN[b.prioridad] ||
				(a.vence_at ?? '9999').localeCompare(b.vence_at ?? '9999') ||
				b.created_at.localeCompare(a.created_at)
		);
	});

	/**
	 * Reparto por urgencia. Los grupos vacíos no se pintan: una columna de encabezados con nada
	 * debajo dice «no tienes trabajo» con mucho más ruido del necesario.
	 */
	const grupos = $derived.by(() => {
		if (filtro === 'hechas') {
			return [
				{
					id: 'hechas',
					titulo: 'Hechas',
					nota: 'Lo cerrado, de lo más reciente a lo más antiguo',
					items: [...filtrados].sort((a, b) =>
						(b.resuelta_at ?? '').localeCompare(a.resuelta_at ?? '')
					)
				}
			].filter((g) => g.items.length);
		}
		const ahora = Date.now();
		const semana = ahora + 7 * 86400000;
		const en = (a: Aviso) => (a.vence_at ? Date.parse(a.vence_at) : null);
		const cubos = [
			{
				id: 'vencidas',
				titulo: 'Vencidas',
				nota: 'Se pasó la fecha y siguen abiertas',
				items: filtrados.filter((a) => { const t = en(a); return t !== null && t < ahora; })
			},
			{
				id: 'semana',
				titulo: 'Esta semana',
				nota: 'Vencen en los próximos siete días',
				items: filtrados.filter((a) => { const t = en(a); return t !== null && t >= ahora && t <= semana; })
			},
			{
				id: 'despues',
				titulo: 'Más adelante',
				nota: 'Con fecha, pero sin prisa todavía',
				items: filtrados.filter((a) => { const t = en(a); return t !== null && t > semana; })
			},
			{
				id: 'sinfecha',
				titulo: 'Sin fecha',
				nota: 'Ordenadas por urgencia',
				items: filtrados.filter((a) => en(a) === null)
			}
		];
		return cubos.filter((g) => g.items.length);
	});

	const FILTROS = $derived([
		{ id: 'abiertas' as const, etiqueta: 'Abiertas', n: buzon.abiertas },
		{ id: 'sinleer' as const, etiqueta: 'Sin leer', n: buzon.sinLeer },
		{ id: 'mios' as const, etiqueta: 'Míos', n: buzon.mias },
		{ id: 'hechas' as const, etiqueta: 'Hechas', n: 0 }
	]);

	async function marcarTodoLeido() {
		await buzon.marcarTodoLeido(data.supabase);
		toast.success('Todo marcado como leído');
	}
</script>

<svelte:head><title>Avisos y tareas · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
		<div class="flex flex-col gap-1">
			<h1 class="font-display text-2xl font-bold">Avisos y tareas</h1>
			<p class="text-sm text-muted-foreground">
				El buzón del equipo. Lo que no cabe en ninguna otra pantalla se apunta aquí.
			</p>
		</div>
		<div class="flex items-center gap-2">
			{#if buzon.vencidas > 0}
				<span
					class="inline-flex h-8 items-center gap-1.5 rounded-full bg-destructive/12 px-3 text-xs font-semibold text-destructive"
				>
					{buzon.vencidas} vencid{buzon.vencidas === 1 ? 'a' : 'as'}
				</span>
			{/if}
			{#if buzon.sinLeer > 0}
				<button
					type="button"
					class="toque inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-accent"
					onclick={marcarTodoLeido}
				>
					<CheckCheck class="size-3.5" /> Marcar todo leído
				</button>
			{/if}
		</div>
	</div>

	<!-- Escribir va arriba: en grande hay sitio, y es el gesto que trae a la mayoría aquí -->
	<div class="max-w-2xl"><Compositor supabase={data.supabase} /></div>

	<!-- Filtros -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="flex flex-wrap items-center gap-1.5">
			{#each FILTROS as f (f.id)}
				<button
					type="button"
					class={[
						'toque inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors',
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

		<label class="ml-auto flex items-center gap-2">
			<span class="sr-only">Filtrar por responsable</span>
			<span class="flex items-center gap-1.5 text-xs text-muted-foreground">
				<Users class="size-3.5" />
			</span>
			<select
				bind:value={quien}
				class="h-8 rounded-lg border border-border bg-background px-2 text-[13px]"
			>
				<option value="">Toda la gente</option>
				{#each buzon.equipo as p (p.id)}
					<option value={p.id}>{p.nombre} {p.apellidos}</option>
				{/each}
			</select>
		</label>
		<Input bind:value={busca} placeholder="Buscar en el buzón…" class="h-8 w-56" />
	</div>

	{#if buzon.cargando && !buzon.cargado}
		<div class="grid gap-3 lg:grid-cols-2">
			{#each { length: 4 } as _, i (i)}
				<div class="h-36 animate-pulse rounded-2xl border border-border bg-muted/40"></div>
			{/each}
		</div>
	{:else if grupos.length === 0}
		<div
			class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-16 text-center"
		>
			<Inbox class="size-8 text-muted-foreground/50" />
			<p class="font-medium">
				{#if busca || quien}Nada con esos filtros{:else if filtro === 'hechas'}Todavía nada hecho{:else}El buzón está vacío{/if}
			</p>
			<p class="max-w-[38ch] text-sm text-muted-foreground">
				{#if busca || quien}
					Prueba a quitar la búsqueda o a mirar el buzón de todo el equipo.
				{:else}
					Aquí van los recados que hoy se pierden en un WhatsApp: «pedirle a Marta las fotos del
					campamento», «revisar si las oraciones de Adviento están duplicadas».
				{/if}
			</p>
		</div>
	{:else}
		<div class="flex flex-col gap-7">
			{#each grupos as g (g.id)}
				<section class="flex flex-col gap-3">
					<div class="flex items-baseline gap-2.5">
						<h2
							class={[
								'text-sm font-semibold tracking-wide uppercase',
								g.id === 'vencidas' ? 'text-destructive' : 'text-muted-foreground'
							]}
						>
							{g.titulo}
						</h2>
						<span class="text-sm text-muted-foreground tabular-nums">{g.items.length}</span>
						<span class="hidden text-xs text-muted-foreground/70 sm:inline">{g.nota}</span>
					</div>
					<!-- Dos columnas en pantalla ancha: las tarjetas son autónomas y el ancho se usa -->
					<div class="grid items-start gap-3 lg:grid-cols-2">
						{#each g.items as a (a.id)}
							<TarjetaAviso aviso={a} grande onaccion={(que, valor) => accion(a, que, valor)} />
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</div>
