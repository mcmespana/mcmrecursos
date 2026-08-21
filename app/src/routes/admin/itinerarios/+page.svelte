<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Badge } from '$lib/components/ui/badge';
	import { crearOcupado } from '$lib/acciones.svelte';
	import { accionRetardada } from '$lib/deshacer';
	import { lanzarAccion } from '$lib/acciones.svelte';
	import { slide } from 'svelte/transition';
	import { ArrowRight, ListOrdered, Plus, Route, Trash2, X } from '@lucide/svelte';

	/**
	 * Listado de itinerarios (SPEC-015).
	 *
	 * Crear cuesta una frase: se escribe el nombre y se entra directo a montarlo. Todo lo demás
	 * —descripción, etapas, publicar— se rellena dentro, sobre el itinerario ya creado, porque
	 * pedirlo antes de dejar empezar es el trámite que hace que nadie cree nada.
	 */
	let { data } = $props();

	const ocupado = crearOcupado();
	/**
	 * El campo de nombre está plegado hasta que se pide crear.
	 *
	 * Un campo de texto permanente en la cabecera obliga a todo el que entra a mirar sus
	 * itinerarios a pasar por delante de un formulario que no ha pedido. Se despliega al pulsar
	 * «Nuevo itinerario», con el foco ya dentro: escribes y Enter.
	 */
	let creando = $state(false);
	let nuevo = $state('');
	let campoNuevo = $state<HTMLInputElement | null>(null);

	function abrirCreacion() {
		creando = true;
		queueMicrotask(() => campoNuevo?.focus());
	}
	function cerrarCreacion() {
		creando = false;
		nuevo = '';
	}
	const borrados = $state(new Set<string>());
	const lista = $derived(data.itinerarios.filter((i: any) => !borrados.has(i.id)));

	function crear() {
		return ocupado.enhance(async ({ result }: any) => {
			if (result.type === 'success' && result.data?.id) {
				cerrarCreacion();
				// al crear se entra a montarlo: es lo único que se puede hacer con un itinerario vacío
				await goto(`/admin/itinerarios/${result.data.id}`);
				return;
			}
			toast.error('No se pudo crear', { description: result.data?.error });
		});
	}

	function borrar(i: { id: string; nombre: string; recursos: number }) {
		borrados.add(i.id);
		accionRetardada({
			mensaje: `Itinerario «${i.nombre}» borrado`,
			descripcion: i.recursos
				? `Se van también sus ${i.recursos} recursos del itinerario. Los recursos en sí no se tocan.`
				: undefined,
			ejecutar: () => lanzarAccion('?/borrar', { id: i.id }),
			ondeshacer: () => borrados.delete(i.id),
			onhecho: () => invalidateAll()
		});
	}
</script>

<svelte:head><title>Itinerarios · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h1 class="font-display text-2xl font-bold">Itinerarios</h1>
		<p class="text-sm text-muted-foreground">
			Recursos en un orden pensado, con su explicación. Para recorrerlos de principio a fin.
		</p>
	</div>

	{#if !creando}
		<Button class="h-10 w-fit" onclick={abrirCreacion}>
			<Plus class="size-4" /> Nuevo itinerario
		</Button>
	{:else}
		<form
			method="POST"
			action="?/crear"
			use:enhance={crear()}
			transition:slide={{ duration: 220 }}
			class="flex max-w-xl flex-col gap-2 rounded-2xl border border-primary/40 bg-card p-3 ring-4 ring-primary/10"
		>
			<label class="flex flex-col gap-1.5">
				<span class="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
					¿Cómo se llama?
				</span>
				<Input
					bind:ref={campoNuevo}
					name="nombre"
					bind:value={nuevo}
					placeholder="p. ej. «Buscad y encontraréis»"
					class="h-10"
					onkeydown={(e) => e.key === 'Escape' && cerrarCreacion()}
				/>
			</label>
			<div class="flex items-center gap-2">
				<Button
					type="submit"
					class="h-9"
					disabled={!nuevo.trim()}
					cargando={ocupado.activo}
					textoCargando="Creando…"
				>
					Crear y montarlo
				</Button>
				<Button type="button" variant="ghost" size="sm" onclick={cerrarCreacion}>
					<X class="size-3.5" /> Cancelar
				</Button>
				<span class="ml-auto text-[11px] text-muted-foreground">Intro para crear · Esc para salir</span>
			</div>
		</form>
	{/if}

	{#if lista.length === 0}
		<div
			class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center"
		>
			<Route class="size-7 text-muted-foreground/50" />
			<p class="font-medium">Todavía no hay itinerarios</p>
			<p class="max-w-[42ch] text-sm text-muted-foreground">
				Un itinerario es un puñado de recursos en orden con una explicación delante: «estas veinte
				sesiones, en este orden, y por esto». Pulsa «Nuevo itinerario» y lo montas dentro.
			</p>
		</div>
	{:else}
		<div class="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
			{#each lista as i (i.id)}
				<div class="group/itin flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
					<a href={`/admin/itinerarios/${i.id}`} class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="flex flex-wrap items-center gap-2">
							<span class="font-semibold hover:underline">{i.nombre}</span>
							{#if i.estado === 'publicado'}
								<Badge class="bg-emerald-600/15 text-emerald-700 dark:text-emerald-500"
									>Publicado</Badge
								>
							{:else}
								<Badge variant="outline" class="text-muted-foreground">Borrador</Badge>
							{/if}
							{#each i.etapas as e (e)}
								<Badge variant="secondary" class="font-normal">{e}</Badge>
							{/each}
						</span>
						{#if i.descripcion}
							<span class="line-clamp-1 text-[13px] text-muted-foreground">{i.descripcion}</span>
						{/if}
					</a>

					<span class="flex items-center gap-1.5 text-[13px] text-muted-foreground tabular-nums">
						<ListOrdered class="size-3.5" />
						{i.recursos}
						{i.recursos === 1 ? 'recurso' : 'recursos'}
						{#if i.bloques > 1}
							<span class="text-muted-foreground/60">· {i.bloques} tramos</span>
						{/if}
					</span>

					<div class="flex items-center gap-1">
						<Button variant="outline" size="sm" href={`/admin/itinerarios/${i.id}`}>
							Montar <ArrowRight class="size-3.5" />
						</Button>
						<button
							type="button"
							class="toque inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
							onclick={() => borrar(i)}
							aria-label={`Borrar «${i.nombre}»`}
						>
							<Trash2 class="size-3.5" />
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
