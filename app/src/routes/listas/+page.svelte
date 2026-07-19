<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { toast } from 'svelte-sonner';
	import { Globe, ListChecks, Lock, Trash2 } from '@lucide/svelte';

	let { data } = $props();

	async function alternarPublica(lista: { id: string; publica: boolean; nombre: string }) {
		const { error } = await data.supabase
			.from('lista')
			.update({ publica: !lista.publica })
			.eq('id', lista.id);
		if (error) {
			toast.error('No se pudo cambiar la visibilidad');
			return;
		}
		if (!lista.publica) {
			await navigator.clipboard
				.writeText(`${location.origin}/listas/${lista.id}`)
				.catch(() => {});
			toast.success('Lista pública — enlace copiado al portapapeles');
		} else {
			toast.success('Lista privada de nuevo');
		}
		invalidateAll();
	}

	async function borrar(lista: { id: string; nombre: string }) {
		if (!confirm(`¿Borrar la lista «${lista.nombre}»? Los recursos no se tocan.`)) return;
		const { error } = await data.supabase.from('lista').delete().eq('id', lista.id);
		if (error) toast.error('No se pudo borrar');
		else invalidateAll();
	}
</script>

<svelte:head><title>Mis listas · Banco de Recursos MCM</title></svelte:head>

<main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
	<h1 class="font-display text-3xl font-bold">Mis listas</h1>

	{#if !data.session}
		<p class="text-muted-foreground">Entra con tu cuenta para crear y ver tus listas.</p>
	{:else if !data.listas.length}
		<div class="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
			<ListChecks class="size-6 text-muted-foreground" />
			<p class="text-sm text-muted-foreground text-pretty">
				Aún no tienes listas. Abre cualquier recurso y usa el botón de guardar en lista para
				empezar una — «Campamento 2026» se monta solo.
			</p>
			<Button href="/" variant="outline" size="sm">Ir al catálogo</Button>
		</div>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each data.listas as lista (lista.id)}
				<li
					class="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40"
				>
					<a href={`/listas/${lista.id}`} class="flex min-w-0 flex-1 flex-col gap-0.5">
						<span class="flex items-center gap-2 font-semibold">
							{lista.nombre}
							{#if lista.publica}
								<Badge variant="secondary" class="gap-1 text-[10px]"
									><Globe class="size-2.5" /> Pública</Badge
								>
							{/if}
						</span>
						<span class="text-xs text-muted-foreground tabular-nums">
							{lista.num_recursos}
							{lista.num_recursos === 1 ? 'recurso' : 'recursos'}
						</span>
					</a>
					<Button
						variant="ghost"
						size="icon"
						aria-label={lista.publica ? 'Hacer privada' : 'Hacer pública y copiar enlace'}
						onclick={() => alternarPublica(lista)}
					>
						{#if lista.publica}<Lock class="size-4" />{:else}<Globe class="size-4" />{/if}
					</Button>
					<Button
						variant="ghost"
						size="icon"
						class="text-muted-foreground hover:text-destructive"
						aria-label="Borrar lista"
						onclick={() => borrar(lista)}
					>
						<Trash2 class="size-4" />
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</main>
