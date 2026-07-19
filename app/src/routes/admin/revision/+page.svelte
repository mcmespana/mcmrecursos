<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Avatar from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { Bot, ExternalLink, Inbox, Undo2 } from '@lucide/svelte';

	let { data } = $props();

	let revisando = $state<any>(null);
	let devolviendo = $state<any>(null);

	const opciones = (lista: string) => data.listas.filter((l) => l.lista === lista);

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

	function resultado(tipo: 'publicar' | 'devolver' | 'descartar') {
		return () =>
			async ({ result, update }: any) => {
				if (result.type === 'success') {
					toast.success(
						tipo === 'publicar'
							? `Publicado como ${result.data?.recurso_id}`
							: tipo === 'devolver'
								? 'Devuelto al remitente'
								: 'Envío descartado'
					);
					revisando = null;
					devolviendo = null;
					await invalidateAll();
				} else {
					toast.error('No se pudo completar', {
						description: result.data?.error ?? 'Inténtalo de nuevo'
					});
					await update();
				}
			};
	}
</script>

<svelte:head><title>Revisión · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-5">
	<div class="flex items-center justify-between">
		<h1 class="font-display text-2xl font-bold">Cola de revisión</h1>
		<p class="text-sm text-muted-foreground tabular-nums">
			{data.envios.length}
			{data.envios.length === 1 ? 'pendiente' : 'pendientes'}
		</p>
	</div>

	{#if !data.envios.length}
		<div class="flex flex-col items-start gap-2 rounded-xl border border-dashed p-8">
			<Inbox class="size-6 text-muted-foreground" />
			<p class="text-sm text-muted-foreground">Bandeja limpia. No hay envíos pendientes. 🎉</p>
		</div>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each data.envios as envio (envio.id)}
				<li class="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
					<Avatar.Root class="size-8">
						<Avatar.Image src={envio.remitente?.avatar_url ?? undefined} alt="" />
						<Avatar.Fallback class="bg-primary/15 text-xs text-primary">
							{(envio.remitente?.nombre ?? '?').charAt(0)}
						</Avatar.Fallback>
					</Avatar.Root>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="truncate font-semibold">{envio.titulo}</span>
						<span class="truncate text-xs text-muted-foreground">
							{envio.remitente?.nombre ?? 'Alguien'} · {fecha(envio.created_at)}
							{#if envio.notas}
								· «{envio.notas}»
							{/if}
						</span>
						{#if envio.estado === 'revisar_ia' && envio.motivo_ia}
							<span class="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-warm/15 px-2 py-1 text-xs">
								<Bot class="size-3.5" />
								{envio.motivo_ia}
							</span>
						{/if}
					</div>
					{#if envio.enlace}
						<Button
							variant="ghost"
							size="sm"
							href={envio.enlace}
							target="_blank"
							rel="noopener noreferrer"
						>
							<ExternalLink class="size-3.5" /> Ver
						</Button>
					{/if}
					<Button variant="outline" size="sm" onclick={() => (devolviendo = envio)}>
						<Undo2 class="size-3.5" /> Devolver
					</Button>
					<Button size="sm" onclick={() => (revisando = envio)}>Revisar y publicar</Button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<!-- publicar: formulario de catalogación -->
<Dialog.Root open={revisando !== null} onOpenChange={(o) => !o && (revisando = null)}>
	<Dialog.Content class="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
		{#if revisando}
			<Dialog.Header>
				<Dialog.Title class="font-display text-xl">Catalogar y publicar</Dialog.Title>
				<Dialog.Description>
					{#if revisando.enlace}
						<a
							href={revisando.enlace}
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center gap-1 text-primary hover:underline"
						>
							<ExternalLink class="size-3.5" /> Abrir lo enviado
						</a>
					{/if}
					{#if revisando.notas}
						· Notas del remitente: «{revisando.notas}»{/if}
				</Dialog.Description>
			</Dialog.Header>

			<form method="POST" action="?/publicar" use:enhance={resultado('publicar')} class="flex flex-col gap-4">
				<input type="hidden" name="envio_id" value={revisando.id} />
				<input type="hidden" name="enlace" value={revisando.enlace ?? ''} />

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="r-nombre">Nombre *</label>
					<Input id="r-nombre" name="nombre" value={revisando.titulo} required />
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="r-desc">Descripción</label>
					<Textarea id="r-desc" name="descripcion" rows={2} />
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="r-tipo">Tipo</label>
						<select id="r-tipo" name="tipo" class="h-9 rounded-md border bg-background px-2 text-sm">
							<option value="">—</option>
							{#each opciones('tipo') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="r-mcm">MCM Local</label>
						<select id="r-mcm" name="mcm_local_id" class="h-9 rounded-md border bg-background px-2 text-sm">
							<option value="">—</option>
							{#each data.mcmLocales as m (m.id)}<option value={m.id}>{m.nombre}</option>{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="r-idioma">Idioma</label>
						<select id="r-idioma" name="idioma" class="h-9 rounded-md border bg-background px-2 text-sm">
							<option value="">—</option>
							{#each opciones('idioma') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="r-soporte">Soporte</label>
						<select id="r-soporte" name="soporte" class="h-9 rounded-md border bg-background px-2 text-sm">
							<option value="">—</option>
							{#each opciones('soporte') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="r-nivel">Nivel</label>
						<select id="r-nivel" name="nivel" class="h-9 rounded-md border bg-background px-2 text-sm">
							<option value="">—</option>
							{#each opciones('nivel') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="r-vis">Visibilidad</label>
						<select id="r-vis" name="visibilidad" class="h-9 rounded-md border bg-background px-2 text-sm">
							<option value="publico">Público</option>
							<option value="privado">Privado (solo con login)</option>
						</select>
					</div>
				</div>

				<fieldset class="flex flex-col gap-2">
					<legend class="pb-1 text-sm font-medium">Etapas</legend>
					<div class="flex flex-wrap gap-3">
						{#each opciones('etapas') as o (o.valor)}
							<label class="inline-flex items-center gap-1.5 text-sm">
								<input type="checkbox" name="etapas" value={o.valor} class="accent-[var(--primary)]" />
								{o.valor}
							</label>
						{/each}
					</div>
				</fieldset>

				<fieldset class="flex flex-col gap-2">
					<legend class="pb-1 text-sm font-medium">Edades</legend>
					<div class="flex flex-wrap gap-x-3 gap-y-1.5">
						{#each opciones('edades') as o (o.valor)}
							<label class="inline-flex items-center gap-1.5 text-sm">
								<input type="checkbox" name="edades" value={o.valor} class="accent-[var(--primary)]" />
								{o.valor}
							</label>
						{/each}
					</div>
				</fieldset>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="r-tags">
						Temáticas <span class="font-normal text-muted-foreground">(separadas por comas)</span>
					</label>
					<Input id="r-tags" name="tags" placeholder="María, Adviento…" />
				</div>

				<Dialog.Footer class="gap-2">
					<Button type="submit" size="lg">Publicar recurso</Button>
				</Dialog.Footer>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

<!-- devolver -->
<Dialog.Root open={devolviendo !== null} onOpenChange={(o) => !o && (devolviendo = null)}>
	<Dialog.Content class="sm:max-w-md">
		{#if devolviendo}
			<Dialog.Header>
				<Dialog.Title class="font-display">Devolver «{devolviendo.titulo}»</Dialog.Title>
				<Dialog.Description>
					El remitente verá el motivo y podrá corregir y reenviar.
				</Dialog.Description>
			</Dialog.Header>
			<form
				id="form-devolver"
				method="POST"
				action="?/devolver"
				use:enhance={resultado('devolver')}
				class="flex flex-col gap-3"
			>
				<input type="hidden" name="envio_id" value={devolviendo.id} />
				<Textarea name="motivo" placeholder="Qué falta o qué hay que cambiar…" rows={3} required />
			</form>
			<form
				id="form-descartar"
				method="POST"
				action="?/descartar"
				use:enhance={resultado('descartar')}
			>
				<input type="hidden" name="envio_id" value={devolviendo.id} />
			</form>
			<Dialog.Footer class="gap-2">
				<Button type="submit" form="form-descartar" variant="ghost" class="text-muted-foreground">
					Descartar
				</Button>
				<Button type="submit" form="form-devolver">Devolver con motivo</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
