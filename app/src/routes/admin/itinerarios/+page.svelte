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
	import { ArrowRight, ListOrdered, Plus, Route, Trash2 } from '@lucide/svelte';

	/**
	 * Listado de itinerarios (SPEC-015).
	 *
	 * Crear cuesta una frase: se escribe el nombre y se entra directo a montarlo. Todo lo demás
	 * —descripción, etapas, publicar— se rellena dentro, sobre el itinerario ya creado, porque
	 * pedirlo antes de dejar empezar es el trámite que hace que nadie cree nada.
	 */
	let { data } = $props();

	const ocupado = crearOcupado();
	let nuevo = $state('');
	const borrados = $state(new Set<string>());
	const lista = $derived(data.itinerarios.filter((i: any) => !borrados.has(i.id)));

	function crear() {
		return ocupado.enhance(async ({ result }: any) => {
			if (result.type === 'success' && result.data?.id) {
				nuevo = '';
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

	<form method="POST" action="?/crear" use:enhance={crear()} class="flex max-w-xl gap-2">
		<Input
			name="nombre"
			bind:value={nuevo}
			placeholder="Nombre del itinerario, p. ej. «Buscad y encontraréis»"
			class="h-10"
		/>
		<Button type="submit" class="h-10 shrink-0" cargando={ocupado.activo} textoCargando="Creando…">
			<Plus class="size-4" /> Crear
		</Button>
	</form>

	{#if lista.length === 0}
		<div
			class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center"
		>
			<Route class="size-7 text-muted-foreground/50" />
			<p class="font-medium">Todavía no hay itinerarios</p>
			<p class="max-w-[42ch] text-sm text-muted-foreground">
				Un itinerario es un puñado de recursos en orden con una explicación delante: «estas veinte
				sesiones, en este orden, y por esto». Ponle nombre arriba y lo montas dentro.
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
