<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Dialog from '$lib/components/ui/dialog';
	import { toast } from 'svelte-sonner';
	import { ExternalLink, Inbox, RefreshCw } from '@lucide/svelte';

	let { data } = $props();

	const PILL: Record<string, { texto: string; clase: string }> = {
		enviado: { texto: 'Enviado', clase: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
		en_revision: { texto: 'En revisión', clase: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
		revisar_ia: { texto: 'En revisión', clase: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
		publicado: { texto: 'Publicado', clase: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
		devuelto: { texto: 'Devuelto', clase: 'bg-warm/25 text-warm-foreground dark:text-warm' },
		descartado: { texto: 'Descartado', clase: 'bg-muted text-muted-foreground' }
	};

	let corrigiendo = $state<any>(null);
	let nuevoTitulo = $state('');
	let nuevoEnlace = $state('');

	function abrirCorreccion(envio: any) {
		corrigiendo = envio;
		nuevoTitulo = envio.titulo;
		nuevoEnlace = envio.enlace ?? '';
	}

	async function reenviar() {
		const { error } = await data.supabase
			.from('envio')
			.update({
				titulo: nuevoTitulo.trim(),
				enlace: nuevoEnlace.trim(),
				estado: 'enviado',
				motivo_devolucion: null
			})
			.eq('id', corrigiendo.id);
		if (error) {
			toast.error('No se pudo reenviar');
			return;
		}
		corrigiendo = null;
		toast.success('Reenviado para revisión');
		invalidateAll();
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
</script>

<svelte:head><title>Mis envíos · Banco de Recursos MCM</title></svelte:head>

<main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
	<div class="flex items-center justify-between gap-3">
		<h1 class="font-display text-3xl font-bold">Mis envíos</h1>
		<Button href="/enviar" size="sm">Enviar más</Button>
	</div>

	{#if !data.session}
		<p class="text-muted-foreground">Entra con tu cuenta para ver tus envíos.</p>
	{:else if !data.envios.length}
		<div class="flex flex-col items-start gap-3 rounded-xl border border-dashed p-8">
			<Inbox class="size-6 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">
				Todavía no has enviado nada. Si tienes materiales por tu Drive, compártelos en un minuto.
			</p>
			<Button href="/enviar" variant="outline" size="sm">Enviar mi primer recurso</Button>
		</div>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each data.envios as envio (envio.id)}
				{@const pill = PILL[envio.estado] ?? PILL.enviado}
				<li class="flex flex-col gap-2 rounded-xl border bg-card p-4">
					<div class="flex flex-wrap items-center gap-2">
						<span class="min-w-0 flex-1 truncate font-semibold">{envio.titulo}</span>
						<span class={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.clase}`}>
							{pill.texto}
						</span>
						<span class="text-xs text-muted-foreground">{fecha(envio.created_at)}</span>
					</div>
					{#if envio.estado === 'publicado' && envio.recurso_id}
						<a
							href={`/?r=${envio.recurso_id}`}
							class="inline-flex items-center gap-1 text-sm text-primary hover:underline"
						>
							<ExternalLink class="size-3.5" /> Ver la ficha publicada
						</a>
					{:else if envio.estado === 'devuelto'}
						<p class="rounded-lg bg-warm/15 px-3 py-2 text-sm text-pretty">
							{envio.motivo_devolucion ?? 'Necesita cambios.'}
						</p>
						<Button variant="outline" size="sm" class="self-start" onclick={() => abrirCorreccion(envio)}>
							<RefreshCw class="size-3.5" /> Corregir y reenviar
						</Button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</main>

<Dialog.Root open={corrigiendo !== null} onOpenChange={(o) => !o && (corrigiendo = null)}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="font-display">Corregir y reenviar</Dialog.Title>
			{#if corrigiendo?.motivo_devolucion}
				<Dialog.Description>{corrigiendo.motivo_devolucion}</Dialog.Description>
			{/if}
		</Dialog.Header>
		<div class="flex flex-col gap-2">
			<Input bind:value={nuevoTitulo} placeholder="Título" />
			<Input bind:value={nuevoEnlace} placeholder="Enlace" type="url" />
		</div>
		<Dialog.Footer>
			<Button disabled={!nuevoTitulo.trim() || !nuevoEnlace.trim()} onclick={reenviar}>
				Reenviar
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
