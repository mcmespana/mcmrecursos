<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { crearOcupado } from '$lib/acciones.svelte';
	import { lanzarAccion } from '$lib/acciones.svelte';
	import { avisoDeshacible } from '$lib/deshacer';
	import { Eye, EyeOff, Sparkles } from '@lucide/svelte';

	let { data } = $props();

	const ocupado = crearOcupado();

	/**
	 * Frase de cada señal (por qué duele, no solo qué falta — SPEC-014) y, para las tres que ya
	 * tienen quien las arregla en lote, el botón que dispara esa acción en `/admin/recursos`.
	 */
	const SENAL_META: Record<
		string,
		{
			titulo: string;
			frase: (n: number) => string;
			color?: 'warm' | 'destructive';
			accionPropia?: { etiqueta: string; accion: string };
		}
	> = {
		sin_enlace: {
			titulo: 'Sin enlace',
			frase: (n) => `${n} publicados sin enlace: no llevan a ninguna parte`,
			color: 'destructive'
		},
		enlaces_repetidos: {
			titulo: 'Enlaces repetidos',
			frase: (n) => `${n} grupos de recursos apuntan al mismo enlace`,
			color: 'destructive'
		},
		sin_tematicas: {
			titulo: 'Sin temáticas',
			frase: (n) => `${n} sin temáticas: no salen al filtrar por tema, que es lo más usado`
		},
		sin_etapa: {
			titulo: 'Sin etapa',
			frase: (n) => `${n} sin etapa: invisibles al filtro que más se usa`
		},
		olvidados: {
			titulo: 'Olvidados',
			frase: (n) => `${n} publicados hace más de 90 días sin ni un acceso`,
			color: 'warm'
		},
		envios_viejos: {
			titulo: 'Envíos parados',
			frase: (n) => `${n} envíos llevan más de 14 días sin revisar`,
			color: 'warm'
		},
		fuera_del_banco: {
			titulo: 'Fuera del banco',
			frase: (n) => `${n} marcados como fuera del banco`,
			color: 'warm'
		},
		sin_formato: {
			titulo: 'Sin formato',
			frase: (n) => `${n} sin formato detectado`,
			accionPropia: { etiqueta: 'Detectar formatos', accion: 'detectarFormatos' }
		},
		por_clasificar: {
			titulo: 'Por clasificar',
			frase: (n) => `${n} pendientes de que la IA proponga metadatos`,
			accionPropia: { etiqueta: 'Analizar pendientes', accion: 'clasificarPendientes' }
		},
		sin_embedding: {
			titulo: 'Sin indexar semánticamente',
			frase: (n) => `${n} publicados sin poder buscarse por significado`,
			accionPropia: { etiqueta: 'Reindexar búsqueda', accion: 'reindexarSemantica' }
		},
		sin_descripcion: { titulo: 'Sin descripción', frase: (n) => `${n} sin descripción` },
		sin_edades: { titulo: 'Sin edades', frase: (n) => `${n} sin edades` },
		sin_tipo: { titulo: 'Sin tipo', frase: (n) => `${n} sin tipo` },
		editados_en_web: {
			titulo: 'Editados en la web',
			frase: (n) => `${n} protegidos de la próxima sincronización`
		}
	};
	const ORDEN = Object.keys(SENAL_META);

	// `envios_viejos` es de la cola de revisión (tabla `envio`), no de `recurso`: no lo filtra
	// `ids_senal()` (00023), así que «Ver los N» va directo a esa cola en vez de a /admin/recursos.
	function rutaVer(key: string): string {
		if (key === 'envios_viejos') return '/admin/revision';
		return `/admin/recursos?pendiente=${key}`;
	}

	let verOcultas = $state(false);

	const tarjetas = $derived.by(() => {
		if (!data.senales) return [];
		return ORDEN.map((key) => ({
			key,
			n: data.senales![key] ?? 0,
			meta: SENAL_META[key],
			oculta: data.senalesOcultas.includes(key)
		})).filter((t) => t.n > 0 && (!t.oculta || verOcultas));
	});
	const hayOcultasConDatos = $derived(
		data.senalesOcultas.some((k: string) => (data.senales?.[k] ?? 0) > 0)
	);

	function perfil(id: string | null) {
		if (!id) return null;
		return data.perfiles.find((p: any) => p.id === id) ?? null;
	}
	function iniciales(p: { nombre?: string; apellidos?: string } | null) {
		if (!p) return '?';
		return `${p.nombre?.[0] ?? ''}${p.apellidos?.[0] ?? ''}`.toUpperCase() || '?';
	}

	async function apuntarSenal(key: string, n: number) {
		const meta = SENAL_META[key];
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/apuntarSenal', {
				senal: key,
				titulo: `${meta.titulo} (${n})`
			});
			if (error) {
				toast.error('No se pudo crear la tarea', { description: error });
				return;
			}
			await invalidateAll();
			toast.success('Tarea creada', { description: meta.titulo });
		}, `senal-${key}`);
	}

	async function correrAccionLote(ruta: string, accion: string, etiqueta: string) {
		await ocupado.envolver(async () => {
			const error = await lanzarAccion(`${ruta}?/${accion}`, {});
			if (error) {
				toast.error(`No se pudo: ${etiqueta}`, { description: error });
				return;
			}
			await invalidateAll();
			toast.success(etiqueta);
		}, `lote-${accion}`);
	}

	function ocultarSenal(key: string, mostrar: boolean) {
		return ocupado.envolver(async () => {
			const error = await lanzarAccion('?/ocultarSenal', { senal: key, mostrar: String(mostrar) });
			if (error) toast.error('No se pudo actualizar', { description: error });
			await invalidateAll();
		}, `ocultar-${key}`);
	}

	// --- Tareas ---

	let filtro = $state<'abiertas' | 'mias' | 'hechas'>('abiertas');
	let nuevoTitulo = $state('');

	const tareasFiltradas = $derived.by(() => {
		const todas = data.tareas.filter((t: any) => t.estado !== 'descartada');
		let base;
		if (filtro === 'hechas') base = todas.filter((t: any) => t.estado === 'hecha');
		else if (filtro === 'mias')
			base = todas.filter((t: any) => t.asignada_a === data.miId && t.estado !== 'descartada');
		else base = todas;

		const orden = { alta: 0, normal: 1, baja: 2 } as Record<string, number>;
		const abiertas = base
			.filter((t: any) => t.estado === 'abierta')
			.sort(
				(a: any, b: any) =>
					orden[a.prioridad] - orden[b.prioridad] ||
					a.created_at.localeCompare(b.created_at)
			);
		const hechas = base
			.filter((t: any) => t.estado === 'hecha')
			.sort((a: any, b: any) => (b.resuelta_at ?? '').localeCompare(a.resuelta_at ?? ''));
		return [...abiertas, ...hechas];
	});

	function crear() {
		return ocupado.enhance(async ({ result }: any) => {
			if (result.type === 'success') {
				nuevoTitulo = '';
				await invalidateAll();
			} else {
				toast.error('No se pudo crear la tarea', { description: result.data?.error });
			}
		});
	}

	function marcarEstado(t: any, estado: 'hecha' | 'abierta') {
		return ocupado.envolver(async () => {
			const error = await lanzarAccion('?/estado', { id: t.id, estado });
			if (error) {
				toast.error('No se pudo actualizar', { description: error });
				return;
			}
			await invalidateAll();
			if (estado === 'hecha') {
				avisoDeshacible({
					mensaje: 'Tarea marcada como hecha',
					descripcion: t.titulo,
					deshacer: () => marcarEstado(t, 'abierta')
				});
			}
		}, `tarea-${t.id}`);
	}

	function cambiarAsignacion(t: any, asignada_a: string) {
		return ocupado.envolver(async () => {
			const error = await lanzarAccion('?/asignar', { id: t.id, asignada_a });
			if (error) toast.error('No se pudo asignar', { description: error });
			await invalidateAll();
		}, `asignar-${t.id}`);
	}

	function cambiarPrioridad(t: any, prioridad: string) {
		return ocupado.envolver(async () => {
			const error = await lanzarAccion('?/prioridad', { id: t.id, prioridad });
			if (error) toast.error('No se pudo cambiar la prioridad', { description: error });
			await invalidateAll();
		}, `prioridad-${t.id}`);
	}

	function editarTitulo(t: any, event: Event) {
		const titulo = (event.currentTarget as HTMLElement).textContent?.trim() ?? '';
		if (!titulo || titulo === t.titulo) return;
		ocupado.envolver(async () => {
			const error = await lanzarAccion('?/titulo', { id: t.id, titulo });
			if (error) toast.error('No se pudo renombrar', { description: error });
			await invalidateAll();
		}, `titulo-${t.id}`);
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
</script>

<svelte:head><title>Salud del banco · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h1 class="font-display text-2xl font-bold">Salud del banco</h1>
		<p class="text-sm text-muted-foreground">Lo que se está pudriendo, y quién lo está arreglando.</p>
	</div>

	{#if data.conSenales}
		<section class="flex flex-col gap-3">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">Señales</h2>
			{#if tarjetas.length === 0}
				<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
					Nada que señalar por ahora. 🎉
				</p>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each tarjetas as t (t.key)}
						<div
							class={`relative flex flex-col gap-2 rounded-xl border p-4 ${
								t.meta.color === 'destructive'
									? 'border-destructive/30 bg-destructive/5'
									: t.meta.color === 'warm'
										? 'border-warm/30 bg-warm/5'
										: 'bg-card'
							} ${t.oculta ? 'opacity-60' : ''}`}
						>
							<div class="flex items-start justify-between gap-2">
								<span class="text-xs font-medium tracking-wide text-muted-foreground uppercase"
									>{t.meta.titulo}</span
								>
								{#if data.rol === 'administrador'}
									<button
										type="button"
										class="toque inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
										onclick={() => ocultarSenal(t.key, t.oculta)}
										title={t.oculta ? 'Dejar de ocultar' : 'Ocultar esta señal'}
									>
										{#if t.oculta}<Eye class="size-3" />{:else}<EyeOff class="size-3" />{/if}
									</button>
								{/if}
							</div>
							<p class="text-sm">{t.meta.frase(t.n)}</p>
							<div class="mt-auto flex flex-wrap items-center gap-2 pt-1">
								<a href={rutaVer(t.key)} class="text-xs font-medium text-primary hover:underline">
									Ver los {t.n}
								</a>
								{#if t.meta.accionPropia}
									<Button
										variant="outline"
										size="sm"
										disabled={ocupado.cargando(`lote-${t.meta.accionPropia.accion}`)}
										onclick={() =>
											correrAccionLote(
												'/admin/recursos',
												t.meta.accionPropia!.accion,
												t.meta.accionPropia!.etiqueta
											)}
									>
										<Sparkles class="size-3.5" />{t.meta.accionPropia.etiqueta}
									</Button>
								{:else}
									<Button
										variant="ghost"
										size="sm"
										disabled={ocupado.cargando(`senal-${t.key}`)}
										onclick={() => apuntarSenal(t.key, t.n)}
									>
										Apuntarlo como tarea
									</Button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
			{#if hayOcultasConDatos}
				<button
					type="button"
					class="toque self-start text-xs text-muted-foreground hover:underline"
					onclick={() => (verOcultas = !verOcultas)}
				>
					{verOcultas ? 'Ocultar de nuevo las señales silenciadas' : 'Ver señales silenciadas'}
				</button>
			{/if}
		</section>
	{/if}

	<section class="flex flex-col gap-3">
		<div class="flex flex-wrap items-center gap-3">
			<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">Tareas</h2>
			<div class="ml-auto flex gap-1 rounded-lg border bg-muted/40 p-0.5 text-xs">
				{#each [['abiertas', 'Abiertas'], ['mias', 'Mías'], ['hechas', 'Hechas']] as [valor, etiqueta] (valor)}
					<button
						type="button"
						class={`rounded-md px-2.5 py-1 transition-colors ${
							filtro === valor
								? 'bg-background font-medium shadow-sm'
								: 'text-muted-foreground hover:text-foreground'
						}`}
						onclick={() => (filtro = valor as typeof filtro)}
					>
						{etiqueta}
					</button>
				{/each}
			</div>
		</div>

		<form method="POST" action="?/crear" use:enhance={crear()} class="flex gap-2">
			<Input
				name="titulo"
				bind:value={nuevoTitulo}
				placeholder="Añadir tarea y pulsar Intro…"
				class="h-9"
			/>
		</form>

		{#if tareasFiltradas.length === 0}
			<p class="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
				{filtro === 'hechas' ? 'Nada hecho todavía.' : 'No hay tareas aquí.'}
			</p>
		{:else}
			<ul class="flex flex-col gap-1.5">
				{#each tareasFiltradas as t (t.id)}
					{@const asignado = perfil(t.asignada_a)}
					<li
						class={`flex flex-wrap items-center gap-2.5 rounded-xl border bg-card px-3 py-2 ${
							t.estado === 'hecha' ? 'opacity-50' : ''
						}`}
					>
						<input
							type="checkbox"
							checked={t.estado === 'hecha'}
							disabled={ocupado.cargando(`tarea-${t.id}`)}
							class="size-4 accent-primary"
							onchange={() => marcarEstado(t, t.estado === 'hecha' ? 'abierta' : 'hecha')}
						/>
						<span
							contenteditable={t.estado !== 'hecha'}
							role="textbox"
							tabindex="0"
							class={`min-w-0 flex-1 rounded px-1 text-sm outline-none focus:bg-accent ${
								t.estado === 'hecha' ? 'line-through' : ''
							}`}
							onblur={(e) => editarTitulo(t, e)}
						>{t.titulo}</span>

						{#if t.recurso_nombre}
							<Badge variant="outline" class="max-w-[10rem] truncate">{t.recurso_nombre}</Badge>
						{/if}

						<select
							value={t.prioridad}
							class="rounded-md border bg-background px-1.5 py-0.5 text-xs"
							onchange={(e) => cambiarPrioridad(t, e.currentTarget.value)}
						>
							<option value="alta">Alta</option>
							<option value="normal">Normal</option>
							<option value="baja">Baja</option>
						</select>

						<span class="flex items-center gap-1.5">
							<Avatar.Root class="size-6">
								<Avatar.Image src={asignado?.avatar_url ?? undefined} alt="" />
								<Avatar.Fallback class="bg-primary/15 text-[9px] text-primary">
									{iniciales(asignado)}
								</Avatar.Fallback>
							</Avatar.Root>
							<select
								value={t.asignada_a ?? ''}
								class="rounded-md border bg-background px-1.5 py-0.5 text-xs"
								onchange={(e) => cambiarAsignacion(t, e.currentTarget.value)}
							>
								<option value="">Sin asignar</option>
								{#each data.perfiles as p (p.id)}
									<option value={p.id}>{p.nombre} {p.apellidos}</option>
								{/each}
							</select>
						</span>

						<span class="text-xs text-muted-foreground">{fecha(t.created_at)}</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</div>
