<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { SvelteSet } from 'svelte/reactivity';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Sheet from '$lib/components/ui/sheet';
	import RecursoFormulario from '$lib/components/admin/RecursoFormulario.svelte';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { toast } from 'svelte-sonner';
	import { lanzarAccion } from '$lib/acciones.svelte';
	import { accionRetardada } from '$lib/deshacer';
	import { crearSeleccion } from '$lib/seleccion.svelte';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import {
		ArrowDownUp,
		Check,
		CloudAlert,
		FileSearch,
		GitBranch,
		Pencil,
		Plus,
		ScanSearch,
		Sparkles,
		Trash2,
		X
	} from '@lucide/svelte';

	let { data } = $props();

	let filtroTexto = $state('');
	let filtroEstado = $state('');
	let orden = $state<{ campo: string; asc: boolean }>({ campo: 'updated_at', asc: false });

	/** Títulos de señal para el aviso de «llegas desde /admin/salud», solo texto de pantalla. */
	const SENAL_TITULO: Record<string, string> = {
		sin_enlace: 'sin enlace',
		enlaces_repetidos: 'con el enlace repetido',
		sin_tematicas: 'sin temáticas',
		sin_etapa: 'sin etapa',
		olvidados: 'olvidados',
		fuera_del_banco: 'fuera del banco',
		sin_formato: 'sin formato',
		por_clasificar: 'por clasificar',
		sin_embedding: 'sin indexar semánticamente',
		sin_descripcion: 'sin descripción',
		sin_edades: 'sin edades',
		sin_tipo: 'sin tipo',
		editados_en_web: 'editados en la web'
	};
	// llega desde /admin/salud con ?pendiente=<señal>: se puede quitar sin recargar la página.
	// Vuelve a activarse si se navega a un ?pendiente= distinto (otro enlace «Ver los N»).
	let pendienteActivo = $state(false);
	$effect(() => {
		pendienteActivo = Boolean(data.pendiente);
	});

	/** Recurso abierto en el panel lateral; `'nuevo'` = alta desde cero. */
	let editando = $state<any>(null);
	let creando = $state(false);

	/**
	 * Recursos que acaban de eliminarse: fuera de la tabla al momento, pero intactos en la base
	 * de datos hasta que se agote la cuenta atrás. Antes esto era un diálogo de confirmación, que
	 * cobra el peaje a todo el mundo y no salva de lo único que pasa de verdad — pulsar en la
	 * fila de al lado (docs/04-diseno.md §5).
	 */
	const eliminados = new SvelteSet<string>();

	function eliminar(r: any) {
		if (!r || eliminados.has(r.id)) return;
		eliminados.add(r.id);
		if (editando?.id === r.id) cerrarPanel();
		accionRetardada({
			mensaje: `«${r.nombre}» eliminado`,
			descripcion:
				'Se va con sus temáticas, archivos, valoraciones y favoritos. Si solo querías que dejara de verse, deshaz y ponlo en «retirado».',
			ejecutar: () => lanzarAccion('?/eliminar', { id: r.id }),
			ondeshacer: () => eliminados.delete(r.id),
			onhecho: async () => {
				await invalidateAll();
				eliminados.delete(r.id);
			}
		});
	}

	// --- Autoclasificación con IA (SPEC-010) ---
	let analizando = $state(false);
	let loteAnalizando = $state(false);
	let reindexando = $state(false);
	let detectandoFormatos = $state(false);
	let sugerencia = $state<any>(null);
	// al abrir un recurso, precarga su última propuesta guardada (si la hay)
	$effect(() => {
		sugerencia = editando ? (data.sugerencias?.[editando.id] ?? null) : null;
	});

	// Acciones en curso por fila: mientras una está en marcha, su botón no acepta más clics.
	const cambiandoEstado = new SvelteSet<string>();
	const versionando = new SvelteSet<string>();

	// `use:enhance={resultadoLote()}` llama a esta función UNA VEZ al montar el formulario, no
	// en cada envío — por eso el estado «ocupado» se pone dentro de la función que SÍ se
	// invoca en cada envío real (la que se devuelve aquí), nunca antes del `return`.
	function resultadoLote() {
		return () => {
			loteAnalizando = true;
			return async ({ result }: any) => {
				loteAnalizando = false;
				if (result.type === 'success' && result.data?.ok) {
					await invalidateAll();
					const { procesados, restantes } = result.data;
					toast.success(`Analizados ${procesados} recurso${procesados === 1 ? '' : 's'}`, {
						description: restantes ? `Quedan ~${restantes}. Pulsa otra vez para seguir.` : 'No quedan pendientes.'
					});
				} else if (result.type === 'success' && result.data?.disponible === false) {
					toast.info('IA no configurada', {
						description: 'Añade GEMINI_API_KEY en el entorno para activar la autoclasificación.'
					});
				} else {
					toast.error('No se pudo analizar el lote', { description: result.data?.error });
				}
			};
		};
	}

	function resultadoReindexar() {
		return () => {
			reindexando = true;
			return async ({ result }: any) => {
				reindexando = false;
				if (result.type === 'success' && result.data?.ok) {
					const { procesados, restantes } = result.data;
					toast.success(`Indexados ${procesados} recurso${procesados === 1 ? '' : 's'}`, {
						description: restantes ? `Quedan ~${restantes}. Pulsa otra vez para seguir.` : 'Índice semántico al día.'
					});
				} else if (result.type === 'success' && result.data?.disponible === false) {
					toast.info('Búsqueda semántica no configurada', {
						description: 'Añade VOYAGE_API_KEY en el entorno para activar los embeddings.'
					});
				} else {
					toast.error('No se pudo reindexar', { description: result.data?.error });
				}
			};
		};
	}

	function resultadoFormatos() {
		return () => {
			detectandoFormatos = true;
			return async ({ result }: any) => {
				detectandoFormatos = false;
				if (result.type === 'success' && result.data?.ok) {
					await invalidateAll();
					const { procesados, restantes } = result.data;
					toast.success(`Formato detectado en ${procesados} recurso${procesados === 1 ? '' : 's'}`, {
						description: restantes
							? `Quedan ~${restantes}. Pulsa otra vez para seguir.`
							: 'Todos los enlaces tienen formato.'
					});
				} else {
					toast.error('No se pudieron detectar los formatos', { description: result.data?.error });
				}
			};
		};
	}

	function resultadoClasificar() {
		return () => {
			analizando = true;
			return async ({ result }: any) => {
				analizando = false;
				if (result.type === 'success' && result.data?.ok) {
					sugerencia = result.data.propuesta;
					toast.success('Sugerencia lista: revísala y aplica lo que encaje');
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

	// aplica la sugerencia sobre el formulario (el editor sigue pudiendo ajustar y guardar)
	function aplicarSugerencia() {
		if (!sugerencia || !editando) return;
		const s = sugerencia;
		editando = {
			...editando,
			tipo: s.tipo ?? editando.tipo,
			nivel: s.nivel ?? editando.nivel,
			idioma: s.idioma ?? editando.idioma,
			soporte: s.soporte ?? editando.soporte,
			etapas: s.etapas?.length ? s.etapas : editando.etapas,
			edades: s.edades?.length ? s.edades : editando.edades,
			// tags: fusiona las actuales con las sugeridas, sin duplicar
			tags: [...new Set([...(editando.tags ?? []), ...(s.tags ?? [])])],
			// descripción: solo rellena si estaba vacía, para no pisar lo escrito
			descripcion: editando.descripcion?.trim() ? editando.descripcion : (s.descripcion ?? '')
		};
		toast.success('Sugerencia aplicada al formulario');
	}

	const nombrePorId = $derived(new Map(data.recursos.map((r: any) => [r.id, r.nombre])));
	const listaRecursos = $derived(data.recursos.map((r: any) => ({ id: r.id, nombre: r.nombre })));

	const opciones = (lista: string) => data.listas.filter((l) => l.lista === lista);

	const ESTADO_PILL: Record<string, string> = {
		publicado: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300',
		borrador: 'bg-muted text-muted-foreground',
		pendiente_revision: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
		subido_usuario: 'bg-sky-500/12 text-sky-700 dark:text-sky-300',
		revisar_ia: 'bg-warm/25 text-warm-foreground dark:text-warm',
		retirado: 'bg-destructive/10 text-destructive'
	};

	const filtrados = $derived.by(() => {
		let lista = data.recursos.filter((r: any) => !eliminados.has(r.id));
		if (pendienteActivo && data.idsPendiente) {
			lista = lista.filter((r: any) => data.idsPendiente!.has(r.id));
		}
		if (filtroEstado) lista = lista.filter((r) => r.estado === filtroEstado);
		const q = normalizarConsulta(filtroTexto);
		if (q) {
			lista = lista.filter((r) =>
				normalizarConsulta(`${r.id} ${r.nombre} ${r.tags.join(' ')} ${r.mcm_local ?? ''}`).includes(q)
			);
		}
		const { campo, asc } = orden;
		return [...lista].sort((a: any, b: any) => {
			const va = a[campo] ?? '';
			const vb = b[campo] ?? '';
			const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb), 'es');
			return asc ? cmp : -cmp;
		});
	});

	function ordenarPor(campo: string) {
		orden = { campo, asc: orden.campo === campo ? !orden.asc : true };
	}

	/**
	 * La tabla pinta por tandas, igual que la del catálogo: 2.000 filas con sus selects y sus
	 * formularios son decenas de miles de nodos de DOM y el panel se arrastra. La ventana se aplica
	 * después de filtrar y ordenar, para que buscar y ordenar sigan mirando todo el catálogo.
	 */
	const PASO = 100;
	let ventana = $state(PASO);
	const visibles = $derived(filtrados.slice(0, ventana));
	const quedan = $derived(Math.max(0, filtrados.length - visibles.length));
	$effect(() => {
		void filtroTexto;
		void filtroEstado;
		ventana = PASO;
	});

	// --- selección y acciones en lote (SPEC-008 §2) ---
	/**
	 * Cuando entran treinta sesiones del mismo campamento por el Sheet, todas quieren el mismo MCM
	 * local, la misma temática y el mismo estado. Hacerlo de una en una son treinta paneles
	 * abiertos y cerrados; esto es un rato de tarde contra diez minutos.
	 *
	 * La mecánica de marcar (rango con shift, «marcar todo lo filtrado») vive en
	 * `$lib/seleccion.svelte.ts` para poder probarla sin sesión de administrador.
	 */
	const seleccion = crearSeleccion<any>({
		visibles: () => visibles,
		todos: () => filtrados,
		idDe: (r) => r.id
	});
	const seleccionados = $derived(seleccion.seleccionados);

	let loteEstado = $state('');
	let loteMcm = $state('');
	let loteTag = $state('');
	let loteEnMarcha = $state<string | null>(null);

	const NOMBRE_OPERACION: Record<string, string> = {
		estado: 'Estado cambiado',
		mcm_local: 'MCM local asignado',
		tag: 'Temática añadida',
		quitar_tag: 'Temática quitada'
	};

	/** Manda una operación en lote y refresca. No incluye el borrado, que va con cuenta atrás. */
	async function aplicarLote(operacion: string, valor: string) {
		const ids = seleccionados.map((r: any) => r.id);
		if (!ids.length || loteEnMarcha) return;
		loteEnMarcha = operacion;
		const cuerpo = new URLSearchParams();
		for (const id of ids) cuerpo.append('ids', id);
		cuerpo.append('operacion', operacion);
		cuerpo.append('valor', valor);
		try {
			const error = await lanzarAccion('?/lote', cuerpo);
			if (error) {
				toast.error('No se pudo aplicar', { description: error });
				return;
			}
			await invalidateAll();
			toast.success(`${NOMBRE_OPERACION[operacion] ?? 'Hecho'} en ${ids.length} recursos`);
			seleccion.limpiar();
			loteEstado = '';
			loteMcm = '';
			loteTag = '';
		} finally {
			loteEnMarcha = null;
		}
	}

	/** Borrado en lote: fuera de la tabla al momento y siete segundos para deshacerlo. */
	function eliminarLote() {
		const filas = seleccionados.slice();
		if (!filas.length) return;
		for (const r of filas) eliminados.add(r.id);
		seleccion.limpiar();
		if (editando && filas.some((r: any) => r.id === editando.id)) cerrarPanel();
		const cuerpo = new URLSearchParams();
		for (const r of filas) cuerpo.append('ids', r.id);
		cuerpo.append('operacion', 'eliminar');
		accionRetardada({
			mensaje: `${filas.length} recursos eliminados`,
			descripcion:
				'Se van con sus temáticas, archivos, valoraciones y favoritos. Si solo querías que dejaran de verse, deshaz y ponlos en «retirado».',
			ejecutar: () => lanzarAccion('?/lote', cuerpo),
			ondeshacer: () => {
				for (const r of filas) eliminados.delete(r.id);
			},
			onhecho: async () => {
				await invalidateAll();
				for (const r of filas) eliminados.delete(r.id);
			}
		});
	}

	function resultadoEstado(id: string) {
		return () => {
			cambiandoEstado.add(id);
			return async ({ result }: any) => {
				cambiandoEstado.delete(id);
				if (result.type === 'success') await invalidateAll();
				else toast.error('No se pudo cambiar el estado', { description: result.data?.error });
			};
		};
	}

	// Crear nueva versión: al volver, abre el borrador nuevo para completarlo (SPEC-009)
	function resultadoNuevaVersion(id: string) {
		return () => {
			versionando.add(id);
			return async ({ result }: any) => {
				versionando.delete(id);
				if (result.type === 'success') {
					await invalidateAll();
					const nuevo = data.recursos.find((r: any) => r.id === result.data?.nuevoId);
					if (nuevo) {
						editando = nuevo;
						toast.success('Nueva versión creada: completa el enlace y publícala');
					} else {
						toast.success('Nueva versión creada');
					}
				} else {
					toast.error('No se pudo crear la versión', { description: result.data?.error });
				}
			};
		};
	}

	async function alGuardar(result: any) {
		const creado = creando;
		editando = null;
		creando = false;
		await invalidateAll();
		toast.success(creado ? `Recurso ${result.data?.id ?? ''} creado` : 'Recurso guardado');
	}

	const fecha = (iso: string | null) =>
		iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';

	const panelAbierto = $derived(editando !== null || creando);
	function cerrarPanel() {
		editando = null;
		creando = false;
	}
</script>

<svelte:head><title>Recursos · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-4">
	{#if data.pendiente && pendienteActivo}
		<div
			class="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
		>
			<span
				>Mostrando solo los {data.idsPendiente?.size ?? 0}
				{SENAL_TITULO[data.pendiente] ?? data.pendiente} (desde Salud del banco)</span
			>
			<button
				type="button"
				class="toque ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				onclick={() => (pendienteActivo = false)}
			>
				<X class="size-3" /> Quitar filtro
			</button>
		</div>
	{/if}
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="font-display text-2xl font-bold">Recursos</h1>
		<p class="text-sm text-muted-foreground tabular-nums" aria-live="polite" aria-atomic="true">
			{filtrados.length} de {data.recursos.length - eliminados.size}
		</p>
		<div class="ml-auto flex flex-wrap items-center gap-2">
			<Button size="sm" class="h-8 gap-1.5" onclick={() => (creando = true)}>
				<Plus class="size-3.5" /> Nuevo recurso
			</Button>
			<form method="POST" action="?/clasificarPendientes" use:enhance={resultadoLote()}>
				<Button
					type="submit"
					variant="outline"
					size="sm"
					class="h-8 gap-1.5"
					cargando={loteAnalizando}
					textoCargando="Analizando…"
					title="Clasifica con IA los recursos pendientes sin propuesta"
				>
					<Sparkles class="size-3.5" /> Analizar pendientes
				</Button>
			</form>
			<form method="POST" action="?/detectarFormatos" use:enhance={resultadoFormatos()}>
				<Button
					type="submit"
					variant="outline"
					size="sm"
					class="h-8 gap-1.5"
					cargando={detectandoFormatos}
					textoCargando="Detectando…"
					title="Deduce el formato de cada enlace (Docs, PDF, Word, carpeta de Drive…)"
				>
					<FileSearch class="size-3.5" /> Detectar formatos
				</Button>
			</form>
			<form method="POST" action="?/reindexarSemantica" use:enhance={resultadoReindexar()}>
				<Button
					type="submit"
					variant="outline"
					size="sm"
					class="h-8 gap-1.5"
					cargando={reindexando}
					textoCargando="Indexando…"
					title="Genera los embeddings (Voyage) para la búsqueda por significado"
				>
					<ScanSearch class="size-3.5" /> Reindexar búsqueda
				</Button>
			</form>
			<Input bind:value={filtroTexto} placeholder="Buscar por id, nombre, tag…" class="h-8 w-56" />
			<select bind:value={filtroEstado} class="h-8 rounded-md border bg-background px-2 text-sm">
				<option value="">Todos los estados</option>
				{#each opciones('estado') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
			</select>
		</div>
	</div>

	<div class="overflow-x-auto rounded-xl border">
		<table class="w-full min-w-[960px] text-sm">
			<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
				<tr>
					<th class="w-9 px-3 py-2">
						<input
							type="checkbox"
							class="size-4 accent-primary"
							checked={seleccion.todosMarcados}
							indeterminate={seleccionados.length > 0 && !seleccion.todosMarcados}
							onchange={() => seleccion.alternarTodos()}
							aria-label={`Seleccionar los ${filtrados.length} recursos filtrados`}
							title={`Seleccionar los ${filtrados.length} recursos filtrados`}
						/>
					</th>
					{#each [['id', 'ID'], ['nombre', 'Nombre'], ['tipo', 'Tipo'], ['formato', 'Formato'], ['mcm_local', 'MCM'], ['estado', 'Estado'], ['anyo_publicacion', 'Año'], ['updated_at', 'Actualizado']] as [campo, etiqueta] (campo)}
						<th class="px-3 py-2">
							<button
								type="button"
								class="inline-flex items-center gap-1 font-medium tracking-wide uppercase hover:text-foreground"
								onclick={() => ordenarPor(campo)}
							>
								{etiqueta}
								{#if orden.campo === campo}<ArrowDownUp class="size-3" />{/if}
							</button>
						</th>
					{/each}
					<th class="px-3 py-2"></th>
				</tr>
			</thead>
			<tbody>
				{#each visibles as r, i (r.id)}
					{@const ocupada = cambiandoEstado.has(r.id) || versionando.has(r.id)}
					{@const marcada = seleccion.tiene(r.id)}
					<tr
						class={`h-11 border-t transition-all hover:bg-accent/40 ${ocupada ? 'animate-pulse opacity-60' : ''} ${marcada ? 'bg-primary/5' : ''}`}
						aria-busy={ocupada || undefined}
					>
						<td class="px-3">
							<!-- con shift se marca el rango desde la última fila tocada -->
							<input
								type="checkbox"
								class="size-4 accent-primary"
								checked={marcada}
								onclick={(e) => seleccion.fila(i, e)}
								aria-label={`Seleccionar ${r.nombre}`}
							/>
						</td>
						<td class="px-3 font-mono text-xs text-muted-foreground">{r.id}</td>
						<td class="max-w-72 px-3">
							<span class="flex items-center gap-1.5">
								<span class="truncate font-medium">{r.nombre.replace(/^\[EJEMPLO\]\s*/, '')}</span>
								{#if r.version_de}
									<span
										class="inline-flex shrink-0 items-center gap-0.5 rounded bg-muted px-1 text-[10px] font-medium text-muted-foreground"
										title={`Nueva versión de ${r.version_de} · ${nombrePorId.get(r.version_de) ?? ''}`}
									>
										<GitBranch class="size-3" /> versión
									</span>
								{/if}
								{#if r.editado_web_at}
									<span title="Editado en web: protegido del Sheet hasta resolver">
										<CloudAlert class="size-3.5 shrink-0 text-warm-foreground dark:text-warm" />
									</span>
								{/if}
								{#if data.sugerencias?.[r.id]}
									<span title="Hay una sugerencia de IA lista para revisar">
										<Sparkles class="size-3.5 shrink-0 text-primary" />
									</span>
								{/if}
							</span>
						</td>
						<td class="px-3 text-muted-foreground">{r.tipo ?? '—'}</td>
						<td class="px-3">
							{#if r.enlace}
								<span class="flex items-center gap-1.5 text-muted-foreground">
									<IconoFormato enlace={r.enlace} formato={r.formato} class="size-4 shrink-0" />
									{#if r.archivos.length}
										<span class="text-xs tabular-nums" title="Formatos alternativos">
											+{r.archivos.length}
										</span>
									{/if}
								</span>
							{:else}
								<span class="text-muted-foreground">—</span>
							{/if}
						</td>
						<td class="px-3 text-muted-foreground">{r.mcm_local ?? '—'}</td>
						<td class="px-3">
							<form method="POST" action="?/estado" use:enhance={resultadoEstado(r.id)}>
								<input type="hidden" name="id" value={r.id} />
								<select
									name="estado"
									value={r.estado}
									disabled={cambiandoEstado.has(r.id)}
									class={`rounded-full border-0 px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${ESTADO_PILL[r.estado] ?? ''}`}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									{#each opciones('estado') as o (o.valor)}
										<option value={o.valor}>{o.valor}</option>
									{/each}
								</select>
							</form>
						</td>
						<td class="px-3 text-muted-foreground tabular-nums">{r.anyo_publicacion ?? '—'}</td>
						<td class="px-3 text-muted-foreground tabular-nums">{fecha(r.updated_at)}</td>
						<td class="px-3 text-right whitespace-nowrap">
							<form
								method="POST"
								action="?/crearVersion"
								use:enhance={resultadoNuevaVersion(r.id)}
								class="inline"
							>
							<input type="hidden" name="id" value={r.id} />
								<Button
									type="submit"
									variant="ghost"
									size="icon-sm"
									cargando={versionando.has(r.id)}
									textoCargando=" "
									aria-label="Crear nueva versión"
									title="Crear nueva versión (duplica y enlaza)"
								>
									<GitBranch class="size-3.5" />
								</Button>
							</form>
							<Button variant="ghost" size="sm" onclick={() => (editando = r)}>
								<Pencil class="size-3.5" /> Editar
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								class="toque text-muted-foreground hover:text-destructive"
								aria-label={`Eliminar ${r.nombre}`}
								title="Eliminar (con siete segundos para deshacerlo)"
								onclick={() => eliminar(r)}
							>
								<Trash2 class="size-3.5" />
							</Button>
						</td>
					</tr>
				{:else}
					<tr><td colspan="10" class="px-3 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
				{/each}
				{#if quedan}
					<tr class="border-t">
						<td colspan="10" class="px-3 py-2 text-center">
							<Button variant="ghost" size="sm" onclick={() => (ventana += PASO)}>
								Ver {Math.min(PASO, quedan)} más
								<span class="text-muted-foreground tabular-nums">({quedan})</span>
							</Button>
						</td>
					</tr>
				{/if}
			</tbody>
		</table>
	</div>
</div>

<!--
	Barra de lote. Aparece pegada abajo solo cuando hay algo marcado: ocupar sitio con una barra
	vacía todo el rato sería peor que no tenerla. Los tres selects aplican al soltarlos —un paso, no
	dos— y el borrado va con cuenta atrás, como el de una fila.
-->
{#if seleccionados.length}
	<div
		class="sticky bottom-4 z-30 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-card/95 p-2 shadow-lg backdrop-blur"
		role="group"
		aria-label="Acciones sobre lo seleccionado"
	>
		<p class="px-2 text-sm font-medium tabular-nums">
			{seleccionados.length}
			{seleccionados.length === 1 ? 'seleccionado' : 'seleccionados'}
		</p>

		<select
			bind:value={loteEstado}
			disabled={loteEnMarcha !== null}
			class="h-8 rounded-md border bg-background px-2 text-sm"
			aria-label="Cambiar el estado de lo seleccionado"
			onchange={() => loteEstado && aplicarLote('estado', loteEstado)}
		>
			<option value="">Cambiar estado…</option>
			{#each opciones('estado') as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
		</select>

		<select
			bind:value={loteMcm}
			disabled={loteEnMarcha !== null}
			class="h-8 rounded-md border bg-background px-2 text-sm"
			aria-label="Asignar MCM local a lo seleccionado"
			onchange={() => loteMcm && aplicarLote('mcm_local', loteMcm === '__ninguno' ? '' : loteMcm)}
		>
			<option value="">Asignar MCM local…</option>
			{#each data.mcmLocales as m (m.id)}<option value={m.id}>{m.nombre}</option>{/each}
			<option value="__ninguno">— quitar el MCM local —</option>
		</select>

		<!-- temática: lista de las que ya existen (ordenadas por uso) y hueco para una nueva -->
		<div class="flex items-center gap-1">
			<input
				list="tags-lote"
				bind:value={loteTag}
				placeholder="Temática…"
				class="h-8 w-40 rounded-md border bg-background px-2 text-sm"
				aria-label="Temática para añadir o quitar en lote"
				onkeydown={(e) => {
					if (e.key === 'Enter' && loteTag.trim()) {
						e.preventDefault();
						aplicarLote('tag', loteTag.trim());
					}
				}}
			/>
			<datalist id="tags-lote">
				{#each data.tags as t (t)}<option value={t}></option>{/each}
			</datalist>
			<Button
				variant="outline"
				size="sm"
				class="h-8"
				disabled={!loteTag.trim() || loteEnMarcha !== null}
				cargando={loteEnMarcha === 'tag'}
				textoCargando="Añadiendo…"
				onclick={() => aplicarLote('tag', loteTag.trim())}
			>
				<Plus class="size-3.5" /> Añadir
			</Button>
			<Button
				variant="ghost"
				size="sm"
				class="h-8 text-muted-foreground"
				disabled={!loteTag.trim() || loteEnMarcha !== null}
				cargando={loteEnMarcha === 'quitar_tag'}
				textoCargando="Quitando…"
				title="Quitar esta temática de lo seleccionado"
				onclick={() => aplicarLote('quitar_tag', loteTag.trim())}
			>
				Quitar
			</Button>
		</div>

		<span class="mx-1 h-6 w-px bg-border"></span>

		<Button
			variant="ghost"
			size="sm"
			class="toque h-8 text-muted-foreground hover:text-destructive"
			disabled={loteEnMarcha !== null}
			title="Eliminar lo seleccionado (con siete segundos para deshacerlo)"
			onclick={eliminarLote}
		>
			<Trash2 class="size-3.5" /> Eliminar
		</Button>
		<Button
			variant="ghost"
			size="icon-sm"
			class="toque"
			aria-label="Quitar la selección"
			title="Quitar la selección"
			onclick={() => seleccion.limpiar()}
			disabled={loteEnMarcha !== null}
		>
			<X class="size-4" />
		</Button>
	</div>
{/if}

<Sheet.Root open={panelAbierto} onOpenChange={(o) => !o && cerrarPanel()}>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-xl">
		{#if creando}
			<Sheet.Header>
				<Sheet.Title class="font-display">Nuevo recurso</Sheet.Title>
				<Sheet.Description>
					El id se asigna solo (R####). Es el mismo formulario que al editar.
				</Sheet.Description>
			</Sheet.Header>

			<RecursoFormulario
				action="?/crear"
				modo="crear"
				valores={{ estado: 'borrador', visibilidad: 'publico' }}
				listas={data.listas}
				mcmLocales={data.mcmLocales}
				tagsExistentes={data.tags}
				textoBoton="Crear recurso"
				onguardado={alGuardar}
			/>
		{:else if editando}
			<Sheet.Header>
				<Sheet.Title class="font-display">Editar {editando.id}</Sheet.Title>
				<Sheet.Description>
					Al guardar queda protegido del Sheet hasta resolverlo en Sincronización.
				</Sheet.Description>
			</Sheet.Header>

			<div class="px-4">
				<form method="POST" action="?/clasificar" use:enhance={resultadoClasificar()}>
					<input type="hidden" name="id" value={editando.id} />
					<Button
						type="submit"
						variant="outline"
						size="sm"
						class="gap-1.5"
						cargando={analizando}
						textoCargando="Analizando…"
					>
						<Sparkles class="size-3.5" /> Analizar con IA
					</Button>
				</form>

				{#if sugerencia}
					<div class="mt-3 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
						<div class="flex items-center gap-1.5 font-medium text-primary">
							<Sparkles class="size-4" /> Sugerencia de la IA
							{#if sugerencia.confianza != null}
								<span class="ml-auto text-xs font-normal text-muted-foreground tabular-nums">
									confianza {Math.round(sugerencia.confianza * 100)}%
								</span>
							{/if}
						</div>
						<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
							{#each [['Tipo', sugerencia.tipo], ['Nivel', sugerencia.nivel], ['Idioma', sugerencia.idioma], ['Soporte', sugerencia.soporte], ['Etapas', sugerencia.etapas?.join(', ')], ['Edades', sugerencia.edades?.join(', ')], ['Temáticas', sugerencia.tags?.join(', ')]] as [k, v] (k)}
								{#if v}
									<dt class="text-muted-foreground">{k}</dt>
									<dd>{v}</dd>
								{/if}
							{/each}
						</dl>
						{#if sugerencia.descripcion}
							<p class="text-xs text-muted-foreground italic">«{sugerencia.descripcion}»</p>
						{/if}
						{#if sugerencia.avisos?.length}
							<ul class="flex flex-col gap-0.5 text-xs text-warm-foreground dark:text-warm">
								{#each sugerencia.avisos as aviso (aviso)}<li>⚠️ {aviso}</li>{/each}
							</ul>
						{/if}
						<div class="flex gap-2 pt-1">
							<Button type="button" size="sm" class="h-7 gap-1.5 text-xs" onclick={aplicarSugerencia}>
								<Check class="size-3.5" /> Aplicar al formulario
							</Button>
							<Button type="button" variant="ghost" size="sm" class="h-7 text-xs" onclick={() => (sugerencia = null)}>
								Descartar
							</Button>
						</div>
						<p class="text-[11px] text-muted-foreground">
							La IA solo propone; revisa y pulsa «Guardar cambios» para publicar.
						</p>
					</div>
				{/if}
			</div>

			<RecursoFormulario
				action="?/guardar"
				modo="editar"
				valores={editando}
				listas={data.listas}
				mcmLocales={data.mcmLocales}
				recursos={listaRecursos}
				tagsExistentes={data.tags}
				onguardado={alGuardar}
			>
				{#snippet ocultos()}
					<input type="hidden" name="id" value={editando.id} />
				{/snippet}
			</RecursoFormulario>

			<div class="flex justify-start px-4 pb-6">
				<Button variant="destructive" size="sm" onclick={() => eliminar(editando)}>
					<Trash2 class="size-3.5" /> Eliminar recurso
				</Button>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
