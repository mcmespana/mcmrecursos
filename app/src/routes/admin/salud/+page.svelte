<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { crearOcupado } from '$lib/acciones.svelte';
	import { lanzarAccion } from '$lib/acciones.svelte';
	import { ArrowRight, Bell, Eye, EyeOff, Sparkles } from '@lucide/svelte';
	import { buzon } from '$lib/avisos/estado.svelte';

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

	async function apuntarSenal(key: string, n: number) {
		const meta = SENAL_META[key];
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/apuntarSenal', {
				senal: key,
				titulo: `${meta.titulo} (${n})`
			});
			if (error) {
				toast.error('No se pudo apuntar', { description: error });
				return;
			}
			// el buzón vive en el cliente y hay que releerlo para que la campana lo cuente ya
			await buzon.cargar(data.supabase, data.miId, true);
			await invalidateAll();
			toast.success('Apuntado en el buzón', { description: meta.titulo });
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

	<!--
		Las tareas ya no viven aquí: se fueron al buzón del equipo (SPEC-016), que está en la campana
		de la cabecera y en /admin/avisos. Tenerlas en dos sitios era pedir que se desincronizaran, y
		esta pantalla es para mirar el catálogo, no para gestionar recados.
	-->
	<a
		href="/admin/avisos"
		class="toque flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
	>
		<Bell class="size-4 shrink-0 text-muted-foreground" />
		<span class="flex flex-col">
			<span class="font-medium">Avisos y tareas del equipo</span>
			<span class="text-xs text-muted-foreground">
				Lo que apuntes desde estas señales aparece ahí, y también en la campana de arriba.
			</span>
		</span>
		<ArrowRight class="ml-auto size-4 shrink-0 text-muted-foreground" />
	</a>
</div>
