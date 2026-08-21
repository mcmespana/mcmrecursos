<script lang="ts">
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import SelectorTags from '$lib/components/SelectorTags.svelte';
	import SelectorMultiple from '$lib/components/SelectorMultiple.svelte';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import AvisoDuplicados from '$lib/components/AvisoDuplicados.svelte';
	import { FORMATOS, formatoEfectivo } from '$lib/catalogo/formatos';
	import { socialLocal } from '$lib/social/local.svelte';
	import { toast } from 'svelte-sonner';
	import { ChevronDown, Link2, Plus, Send, Sparkles, Trash2 } from '@lucide/svelte';

	let { data } = $props();

	interface Fila {
		titulo: string;
		enlace: string;
		notas: string;
		// clasificación opcional: pistas para el equipo editor, todo prescindible
		tipo: string;
		idioma: string;
		etapas: string[];
		edades: string[];
		tags: string[];
		abierta: boolean;
	}

	const filaVacia = (): Fila => ({
		titulo: '',
		enlace: '',
		notas: '',
		tipo: '',
		idioma: '',
		etapas: [],
		edades: [],
		tags: [],
		abierta: false
	});

	let filas = $state<Fila[]>([filaVacia()]);
	let enviando = $state(false);
	let nombreContacto = $state('');
	let emailContacto = $state('');

	const opciones = (lista: string) => data.listas.filter((l: any) => l.lista === lista);

	// El borrador se conserva en este dispositivo y se recupera al volver, con o sin cuenta.
	const CLAVE_BORRADOR = 'mcm-envios-borrador';
	$effect(() => {
		try {
			const guardado = JSON.parse(localStorage.getItem(CLAVE_BORRADOR) ?? 'null');
			if (Array.isArray(guardado) && guardado.length) {
				filas = guardado.map((f: Partial<Fila>) => ({ ...filaVacia(), ...f }));
			}
		} catch {
			// borrador corrupto: se ignora
		}
	});
	$effect(() => {
		if (!browser) return;
		if (filas.some((f) => f.titulo || f.enlace || f.notas)) {
			localStorage.setItem(CLAVE_BORRADOR, JSON.stringify(filas));
		}
	});
	$effect(() => {
		if (browser) socialLocal.cargar();
	});

	// Basta con el enlace: el título, si falta, lo pone el equipo al catalogar.
	const validas = $derived(filas.filter((f) => f.enlace.trim() || f.titulo.trim()));

	const clasificacionDe = (f: Fila) => {
		const c: Record<string, unknown> = {};
		if (f.tipo) c.tipo = f.tipo;
		if (f.idioma) c.idioma = f.idioma;
		if (f.etapas.length) c.etapas = f.etapas;
		if (f.edades.length) c.edades = f.edades;
		if (f.tags.length) c.tags = f.tags;
		return c;
	};

	const cuentaClasificacion = (f: Fila) =>
		(f.tipo ? 1 : 0) +
		(f.idioma ? 1 : 0) +
		(f.etapas.length ? 1 : 0) +
		(f.edades.length ? 1 : 0) +
		(f.tags.length ? 1 : 0);

	async function enviar() {
		if (enviando || !validas.length) return;
		enviando = true;
		try {
			for (const f of validas) {
				const { error } = await data.supabase.rpc('crear_envio', {
					titulo_in: f.titulo.trim() || null,
					enlace_in: f.enlace.trim() || null,
					notas_in: f.notas.trim() || null,
					dispositivo: socialLocal.dispositivo || null,
					nombre_contacto_in: data.session ? null : nombreContacto.trim() || null,
					email_contacto_in: data.session ? null : emailContacto.trim() || null,
					clasificacion_in: clasificacionDe(f),
					mcm_local_in: data.perfil?.mcm_local_id ?? null
				});
				if (error) throw error;
			}
			localStorage.removeItem(CLAVE_BORRADOR);
			toast.success(
				validas.length === 1
					? 'Recurso enviado. ¡Gracias por aportar!'
					: `${validas.length} recursos enviados. ¡Gracias por aportar!`
			);
			goto('/envios');
		} catch (e) {
			toast.error('No se pudieron enviar los recursos', {
				description: (e as Error)?.message
			});
		} finally {
			enviando = false;
		}
	}
</script>

<svelte:head><title>Enviar recursos · Banco de Recursos MCM</title></svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
	<div class="flex flex-col gap-2">
		<h1 class="font-display text-3xl font-bold">Envía tus recursos</h1>
		<p class="text-pretty text-muted-foreground">
			Pega el enlace (Drive, YouTube, web…) y listo — el equipo editor lo catalogará. No hace
			falta cuenta ni rellenar nada más. Puedes enviar varios de golpe.
		</p>
	</div>

	<div class="flex flex-col gap-4">
		{#each filas as fila, i (i)}
			{@const formato = formatoEfectivo(fila.enlace)}
			{@const puestos = cuentaClasificacion(fila)}
			<div class="flex flex-col gap-2 rounded-xl border bg-card p-4">
				<!--
					El enlace va PRIMERO porque es lo único que hace falta de verdad: la página promete
					«pega el enlace y listo», y tener el título encima contaba otra historia. El título
					se marca «(opcional)» como el resto de campos que lo son — sin la marca parecía
					obligatorio por comparación (F14 de docs/06-reflexion-uiux.md).
				-->
				<div class="flex items-center gap-2">
					<div class="relative flex-1">
						{#if fila.enlace.trim() && formato}
							<span class="absolute top-1/2 left-3 -translate-y-1/2">
								<IconoFormato enlace={fila.enlace} class="size-4" />
							</span>
						{:else}
							<Link2 class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						{/if}
						<Input
							bind:value={fila.enlace}
							placeholder="Enlace (Drive, YouTube, web…)"
							class="pl-9"
							type="url"
						/>
					</div>
					{#if filas.length > 1}
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground hover:text-destructive"
							aria-label="Quitar fila"
							onclick={() => (filas = filas.filter((_, j) => j !== i))}
						>
							<Trash2 class="size-4" />
						</Button>
					{/if}
				</div>
				<Input bind:value={fila.titulo} placeholder="Título (opcional, ya lo ponemos nosotros)" />
				{#if fila.enlace.trim() && formato}
					<p class="text-xs text-muted-foreground">
						Detectado: {FORMATOS[formato].etiqueta}
					</p>
				{/if}

				<!--
					Aviso de si eso ya está en el banco. Se enseña aquí, antes de enviar, porque es el
					único momento en que sirve de algo: después, el duplicado ya está en la cola de
					revisión y le cuesta el rato a otra persona. Nunca impide enviar.
				-->
				<AvisoDuplicados enlace={fila.enlace} titulo={fila.titulo} />
				<Textarea
					bind:value={fila.notas}
					placeholder="Notas para el equipo (contexto, para qué lo usaste…) — opcional"
					rows={2}
				/>

				<!-- clasificación opcional: nada de esto es obligatorio -->
				<button
					type="button"
					class="-mx-1 flex items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
					aria-expanded={fila.abierta}
					onclick={() => (fila.abierta = !fila.abierta)}
				>
					<Sparkles class="size-4 text-primary" />
					<span>¿Nos ayudas a clasificar tu recurso? <em class="not-italic">(opcional)</em></span>
					{#if puestos}
						<span class="rounded-full bg-primary/12 px-1.5 text-xs font-medium text-primary tabular-nums">
							{puestos}
						</span>
					{/if}
					<ChevronDown
						class={`ml-auto size-4 transition-transform ${fila.abierta ? 'rotate-180' : ''}`}
					/>
				</button>

				{#if fila.abierta}
					<div class="flex flex-col gap-4 rounded-lg bg-muted/40 p-3">
						<div class="flex flex-col gap-1.5">
							<span class="text-sm font-medium">Temáticas</span>
							<SelectorTags bind:valor={fila.tags} existentes={data.tags} populares={10} />
						</div>
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="flex flex-col gap-1.5 text-sm font-medium">
								Tipo
								<select
									bind:value={fila.tipo}
									class="h-9 rounded-md border bg-background px-2 text-sm font-normal"
								>
									<option value="">No lo sé</option>
									{#each opciones('tipo') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
								</select>
							</label>
							<label class="flex flex-col gap-1.5 text-sm font-medium">
								Idioma
								<select
									bind:value={fila.idioma}
									class="h-9 rounded-md border bg-background px-2 text-sm font-normal"
								>
									<option value="">No lo sé</option>
									{#each opciones('idioma') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
								</select>
							</label>
						</div>
						<SelectorMultiple etiqueta="Etapas" opciones={opciones('etapas')} bind:valor={fila.etapas} />
						<SelectorMultiple etiqueta="Edades" opciones={opciones('edades')} bind:valor={fila.edades} />
					</div>
				{/if}
			</div>
		{/each}
	</div>

	{#if !data.session}
		<div class="flex flex-col gap-3 rounded-xl border border-dashed p-4">
			<p class="text-sm text-muted-foreground text-pretty">
				Estás enviando sin cuenta, y no pasa nada. Si nos dejas un correo te avisamos cuando se
				publique o si hace falta algún cambio. También es opcional.
			</p>
			<div class="grid gap-2 sm:grid-cols-2">
				<Input bind:value={nombreContacto} placeholder="Tu nombre (opcional)" />
				<Input bind:value={emailContacto} placeholder="Tu correo (opcional)" type="email" />
			</div>
		</div>
	{/if}

	<div class="flex items-center justify-between gap-3">
		<Button
			variant="outline"
			size="sm"
			disabled={enviando}
			onclick={() => (filas = [...filas, filaVacia()])}
		>
			<Plus class="size-4" /> Otro recurso
		</Button>
		<Button
			size="lg"
			disabled={!validas.length}
			cargando={enviando}
			textoCargando="Enviando…"
			onclick={enviar}
		>
			<Send class="size-4" />
			Enviar {validas.length > 1 ? `${validas.length} recursos` : 'recurso'}
		</Button>
	</div>
</main>
