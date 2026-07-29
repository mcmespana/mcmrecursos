<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Avatar from '$lib/components/ui/avatar';
	import RecursoFormulario from '$lib/components/admin/RecursoFormulario.svelte';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import VistaPrevia from '$lib/components/VistaPrevia.svelte';
	import { formatoEfectivo, urlVistaPrevia } from '$lib/catalogo/formatos';
	import { toast } from 'svelte-sonner';
	import { Bot, ExternalLink, Inbox, Sparkles, UserRound, Undo2 } from '@lucide/svelte';

	let { data } = $props();

	let revisando = $state<any>(null);
	let devolviendo = $state<any>(null);

	// --- Autoclasificación del envío (SPEC-010) ---
	let sug = $state<any>(null);
	let analizandoEnvio = $state(false);
	$effect(() => {
		void revisando?.id;
		sug = null;
	});

	/**
	 * Valores de partida del formulario: lo que escribió quien envió el recurso, encima lo que
	 * proponga la IA. Todo revisable antes de publicar.
	 */
	const valoresIniciales = $derived.by(() => {
		if (!revisando) return {};
		const c = revisando.clasificacion ?? {};
		return {
			nombre: revisando.titulo,
			enlace: revisando.enlace ?? '',
			descripcion: sug?.descripcion ?? '',
			tipo: sug?.tipo ?? c.tipo ?? '',
			nivel: sug?.nivel ?? '',
			idioma: sug?.idioma ?? c.idioma ?? '',
			soporte: sug?.soporte ?? '',
			etapas: sug?.etapas?.length ? sug.etapas : (c.etapas ?? []),
			edades: sug?.edades?.length ? sug.edades : (c.edades ?? []),
			tags: [...new Set([...(c.tags ?? []), ...(sug?.tags ?? [])])],
			mcm_local_id: revisando.mcm_local_id ?? '',
			estado: 'publicado',
			visibilidad: 'publico',
			fuera_del_banco: true
		};
	});

	// `use:enhance={resultadoClasificarEnvio()}` llama a esta función una vez al abrir el
	// panel, no en cada envío — el estado «ocupado» va dentro de la función que SÍ se invoca
	// en cada envío real (la que se devuelve aquí), nunca antes del `return`.
	function resultadoClasificarEnvio() {
		return () => {
			analizandoEnvio = true;
			return async ({ result }: any) => {
				analizandoEnvio = false;
				if (result.type === 'success' && result.data?.ok) {
					sug = result.data.propuesta;
					toast.success('Sugerencia lista: revisa y publica');
				} else if (result.type === 'success' && result.data?.disponible === false) {
					toast.info('IA no configurada', {
						description: 'Añade GEMINI_API_KEY en el entorno para activar la autoclasificación.'
					});
				} else {
					toast.error('No se pudo analizar', { description: result.data?.error });
				}
			};
		};
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

	// Revisar sin abrir seis pestañas: se ve lo enviado dentro del propio diálogo (SPEC-008 §1).
	const previa = $derived(revisando ? urlVistaPrevia(revisando.enlace) : null);
	const claveFormato = $derived(revisando ? formatoEfectivo(revisando.enlace) : null);

	async function alPublicar(result: any) {
		revisando = null;
		await invalidateAll();
		toast.success(`Publicado como ${result.data?.recurso_id}`);
	}

	// devolver / descartar: un clic, y el botón deja de aceptar más hasta que responde
	let cerrando = $state<'devolver' | 'descartar' | null>(null);
	function resultadoCierre(tipo: 'devolver' | 'descartar') {
		return () => {
			cerrando = tipo;
			return async ({ result }: any) => {
				cerrando = null;
				if (result.type === 'success') {
					devolviendo = null;
					await invalidateAll();
					toast.success(tipo === 'devolver' ? 'Devuelto al remitente' : 'Envío descartado');
				} else {
					toast.error('No se pudo completar', {
						description: result.data?.error ?? 'Inténtalo de nuevo'
					});
				}
			};
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
				{@const clasif = envio.clasificacion ?? {}}
				<li class="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
					<Avatar.Root class="size-8">
						<Avatar.Image src={envio.remitente?.avatar_url ?? undefined} alt="" />
						<Avatar.Fallback class="bg-primary/15 text-xs text-primary">
							{#if envio.anonimo && !envio.remitente}
								<UserRound class="size-4" />
							{:else}
								{(envio.remitente?.nombre ?? '?').charAt(0)}
							{/if}
						</Avatar.Fallback>
					</Avatar.Root>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="flex items-center gap-1.5 truncate font-semibold">
							{#if envio.enlace}
								<IconoFormato enlace={envio.enlace} class="size-4 shrink-0" />
							{/if}
							{envio.titulo}
						</span>
						<span class="truncate text-xs text-muted-foreground">
							{envio.remitente?.nombre ?? 'Alguien sin cuenta'} · {fecha(envio.created_at)}
							{#if envio.anonimo}· sin cuenta{/if}
							{#if envio.notas}
								· «{envio.notas}»
							{/if}
						</span>
						{#if clasif.tipo || clasif.tags?.length || clasif.etapas?.length || clasif.edades?.length}
							<span class="mt-1 text-xs text-muted-foreground">
								Sugerido por quien lo envía:
								{[
									clasif.tipo,
									clasif.etapas?.join(', '),
									clasif.edades?.join(', '),
									clasif.tags?.join(', ')
								]
									.filter(Boolean)
									.join(' · ')}
							</span>
						{/if}
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

<!-- publicar: el mismo formulario que crear y editar un recurso -->
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

			{#if previa}
					<VistaPrevia
						url={previa}
						formato={claveFormato}
						nombre={revisando.titulo}
						onabrir={() => window.open(revisando.enlace, '_blank', 'noopener,noreferrer')}
					/>
				{/if}

				<!-- Autoclasificación (SPEC-010): lee el enlace/Drive y prerrellena el formulario -->
			<form method="POST" action="?/clasificar" use:enhance={resultadoClasificarEnvio()}>
				<input type="hidden" name="envio_id" value={revisando.id} />
				<div
					class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed bg-primary/5 p-3"
				>
					<div class="flex items-center gap-2 text-sm">
						<Sparkles class="size-4 text-primary" />
						{#if sug}
							<span>
								Sugerencia lista{typeof sug.confianza === 'number'
									? ` · confianza ${Math.round(sug.confianza * 100)}%`
									: ''}. Revisa los campos y publica.
							</span>
						{:else}
							<span class="text-muted-foreground">
								¿Dejar que la IA proponga la catalogación leyendo el documento?
							</span>
						{/if}
					</div>
					<Button
						type="submit"
						variant="outline"
						size="sm"
						cargando={analizandoEnvio}
						textoCargando="Analizando…"
					>
						<Sparkles class="size-3.5" />
						{sug ? 'Reanalizar' : 'Analizar con IA'}
					</Button>
				</div>
				{#if sug?.avisos?.length}
					<ul class="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
						{#each sug.avisos as aviso (aviso)}
							<li>⚠️ {aviso}</li>
						{/each}
					</ul>
				{/if}
			</form>

			<RecursoFormulario
				action="?/publicar"
				modo="publicar"
				valores={valoresIniciales}
				listas={data.listas}
				mcmLocales={data.mcmLocales}
				tagsExistentes={data.tags}
				textoBoton="Publicar recurso"
				onguardado={alPublicar}
			>
				{#snippet ocultos()}
					<input type="hidden" name="envio_id" value={revisando.id} />
				{/snippet}
			</RecursoFormulario>
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
					{#if devolviendo.anonimo && !devolviendo.email_contacto}
						Se enviaron sin cuenta y sin correo: verán el motivo al volver a «Mis envíos» desde el
						mismo dispositivo.
					{:else}
						El remitente verá el motivo y podrá corregir y reenviar.
					{/if}
				</Dialog.Description>
			</Dialog.Header>
			<form
				id="form-devolver"
				method="POST"
				action="?/devolver"
				use:enhance={resultadoCierre('devolver')}
				class="flex flex-col gap-3"
			>
				<input type="hidden" name="envio_id" value={devolviendo.id} />
				<Textarea name="motivo" placeholder="Qué falta o qué hay que cambiar…" rows={3} required />
			</form>
			<form
				id="form-descartar"
				method="POST"
				action="?/descartar"
				use:enhance={resultadoCierre('descartar')}
			>
				<input type="hidden" name="envio_id" value={devolviendo.id} />
			</form>
			<Dialog.Footer class="gap-2">
				<Button
					type="submit"
					form="form-descartar"
					variant="ghost"
					class="text-muted-foreground"
					disabled={cerrando !== null}
					cargando={cerrando === 'descartar'}
					textoCargando="Descartando…"
				>
					Descartar
				</Button>
				<Button
					type="submit"
					form="form-devolver"
					disabled={cerrando !== null}
					cargando={cerrando === 'devolver'}
					textoCargando="Devolviendo…"
				>
					Devolver con motivo
				</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
