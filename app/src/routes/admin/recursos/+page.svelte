<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Sheet from '$lib/components/ui/sheet';
	import { toast } from 'svelte-sonner';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import { ArrowDownUp, CloudAlert, GitBranch, Pencil, Sparkles, Check } from '@lucide/svelte';

	let { data } = $props();

	// --- Autoclasificación con IA (SPEC-010) ---
	let analizando = $state(false);
	let loteAnalizando = $state(false);
	let sugerencia = $state<any>(null);
	// al abrir un recurso, precarga su última propuesta guardada (si la hay)
	$effect(() => {
		sugerencia = editando ? (data.sugerencias?.[editando.id] ?? null) : null;
	});

	function resultadoLote() {
		loteAnalizando = true;
		return () =>
			async ({ result }: any) => {
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
	}

	function resultadoClasificar() {
		analizando = true;
		return () =>
			async ({ result }: any) => {
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

	let filtroTexto = $state('');
	let filtroEstado = $state('');
	let orden = $state<{ campo: string; asc: boolean }>({ campo: 'updated_at', asc: false });
	let editando = $state<any>(null);

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
		let lista = data.recursos;
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

	function resultadoGuardar() {
		return () =>
			async ({ result, update }: any) => {
				if (result.type === 'success') {
					toast.success('Recurso guardado');
					editando = null;
					await invalidateAll();
				} else {
					toast.error('No se pudo guardar', { description: result.data?.error });
					await update();
				}
			};
	}

	// Crear nueva versión: al volver, abre el borrador nuevo para completarlo (SPEC-009)
	function resultadoNuevaVersion() {
		return () =>
			async ({ result }: any) => {
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
	}

	const fecha = (iso: string | null) =>
		iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';
</script>

<svelte:head><title>Recursos · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="font-display text-2xl font-bold">Recursos</h1>
		<p class="text-sm text-muted-foreground tabular-nums">{filtrados.length} de {data.recursos.length}</p>
		<div class="ml-auto flex items-center gap-2">
			<form method="POST" action="?/clasificarPendientes" use:enhance={resultadoLote()}>
				<Button
					type="submit"
					variant="outline"
					size="sm"
					class="h-8 gap-1.5"
					disabled={loteAnalizando}
					title="Clasifica con IA los recursos pendientes sin propuesta"
				>
					<Sparkles class="size-3.5" />
					{loteAnalizando ? 'Analizando…' : 'Analizar pendientes'}
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
		<table class="w-full min-w-[900px] text-sm">
			<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
				<tr>
					{#each [['id', 'ID'], ['nombre', 'Nombre'], ['tipo', 'Tipo'], ['mcm_local', 'MCM'], ['estado', 'Estado'], ['anyo_publicacion', 'Año'], ['updated_at', 'Actualizado']] as [campo, etiqueta] (campo)}
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
				{#each filtrados as r (r.id)}
					<tr class="h-11 border-t transition-colors hover:bg-accent/40">
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
						<td class="px-3 text-muted-foreground">{r.mcm_local ?? '—'}</td>
						<td class="px-3">
							<form method="POST" action="?/estado" use:enhance={resultadoGuardar()}>
								<input type="hidden" name="id" value={r.id} />
								<select
									name="estado"
									value={r.estado}
									class={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${ESTADO_PILL[r.estado] ?? ''}`}
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
								use:enhance={resultadoNuevaVersion()}
								class="inline"
							>
								<input type="hidden" name="id" value={r.id} />
								<Button
									type="submit"
									variant="ghost"
									size="sm"
									title="Crear nueva versión (duplica y enlaza)"
								>
									<GitBranch class="size-3.5" /> Versión
								</Button>
							</form>
							<Button variant="ghost" size="sm" onclick={() => (editando = r)}>
								<Pencil class="size-3.5" /> Editar
							</Button>
						</td>
					</tr>
				{:else}
					<tr><td colspan="8" class="px-3 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<Sheet.Root open={editando !== null} onOpenChange={(o) => !o && (editando = null)}>
	<Sheet.Content side="right" class="w-full overflow-y-auto sm:max-w-xl">
		{#if editando}
			<Sheet.Header>
				<Sheet.Title class="font-display">Editar {editando.id}</Sheet.Title>
				<Sheet.Description>
					Al guardar queda protegido del Sheet hasta resolverlo en Sincronización.
				</Sheet.Description>
			</Sheet.Header>

			<div class="px-4">
				<form method="POST" action="?/clasificar" use:enhance={resultadoClasificar()}>
					<input type="hidden" name="id" value={editando.id} />
					<Button type="submit" variant="outline" size="sm" class="gap-1.5" disabled={analizando}>
						<Sparkles class="size-3.5" />
						{analizando ? 'Analizando…' : 'Analizar con IA'}
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
			<form
				method="POST"
				action="?/guardar"
				use:enhance={resultadoGuardar()}
				class="flex flex-col gap-4 px-4 pb-6"
			>
				<input type="hidden" name="id" value={editando.id} />

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="e-nombre">Nombre *</label>
					<Input id="e-nombre" name="nombre" value={editando.nombre} required />
				</div>
				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="e-desc">Descripción</label>
					<Textarea id="e-desc" name="descripcion" value={editando.descripcion ?? ''} rows={3} />
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					{#each [['tipo', 'Tipo'], ['nivel', 'Nivel'], ['idioma', 'Idioma'], ['soporte', 'Soporte'], ['ubicacion', 'Ubicación'], ['estado', 'Estado'], ['visibilidad', 'Visibilidad']] as [campo, etiqueta] (campo)}
						<div class="flex flex-col gap-1.5">
							<label class="text-sm font-medium" for={`e-${campo}`}>{etiqueta}</label>
							<select
								id={`e-${campo}`}
								name={campo}
								value={editando[campo] ?? ''}
								class="h-9 rounded-md border bg-background px-2 text-sm"
							>
								{#if campo !== 'estado' && campo !== 'visibilidad'}<option value="">—</option>{/if}
								{#each opciones(campo) as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
							</select>
						</div>
					{/each}
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="e-mcm">MCM Local</label>
						<select
							id="e-mcm"
							name="mcm_local_id"
							value={editando.mcm_local_id ?? ''}
							class="h-9 rounded-md border bg-background px-2 text-sm"
						>
							<option value="">—</option>
							{#each data.mcmLocales as m (m.id)}<option value={m.id}>{m.nombre}</option>{/each}
						</select>
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="e-anyo">Año</label>
						<Input id="e-anyo" name="anyo_publicacion" type="number" value={editando.anyo_publicacion ?? ''} />
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="e-curso">Curso usado</label>
						<Input id="e-curso" name="curso_usado" placeholder="2024-2025" value={editando.curso_usado ?? ''} />
					</div>
					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<label class="text-sm font-medium" for="e-version">Es nueva versión de…</label>
						<select
							id="e-version"
							name="version_de"
							value={editando.version_de ?? ''}
							class="h-9 rounded-md border bg-background px-2 text-sm"
						>
							<option value="">— No es una versión —</option>
							{#each data.recursos.filter((r: any) => r.id !== editando.id) as r (r.id)}
								<option value={r.id}>{r.id} · {r.nombre.replace(/^\[EJEMPLO\]\s*/, '')}</option>
							{/each}
						</select>
						<p class="text-xs text-muted-foreground">
							Al publicarse, la versión anterior se ocultará del catálogo y su valoración/uso se
							heredan a esta.
						</p>
					</div>
				</div>

				<fieldset class="flex flex-col gap-1.5">
					<legend class="pb-1 text-sm font-medium">Etapas</legend>
					<div class="flex flex-wrap gap-3">
						{#each opciones('etapas') as o (o.valor)}
							<label class="inline-flex items-center gap-1.5 text-sm">
								<input type="checkbox" name="etapas" value={o.valor} checked={editando.etapas?.includes(o.valor)} class="accent-[var(--primary)]" />
								{o.valor}
							</label>
						{/each}
					</div>
				</fieldset>
				<fieldset class="flex flex-col gap-1.5">
					<legend class="pb-1 text-sm font-medium">Edades</legend>
					<div class="flex flex-wrap gap-x-3 gap-y-1.5">
						{#each opciones('edades') as o (o.valor)}
							<label class="inline-flex items-center gap-1.5 text-sm">
								<input type="checkbox" name="edades" value={o.valor} checked={editando.edades?.includes(o.valor)} class="accent-[var(--primary)]" />
								{o.valor}
							</label>
						{/each}
					</div>
				</fieldset>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="e-tags">Temáticas (comas)</label>
					<Input id="e-tags" name="tags" value={editando.tags?.join(', ') ?? ''} />
				</div>

				<div class="grid gap-3 sm:grid-cols-2">
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="e-enlace">Enlace</label>
						<Input id="e-enlace" name="enlace" type="url" value={editando.enlace ?? ''} />
					</div>
					<div class="flex flex-col gap-1.5">
						<label class="text-sm font-medium" for="e-imagen">Imagen (URL)</label>
						<Input id="e-imagen" name="imagen" type="url" value={editando.imagen ?? ''} />
					</div>
					<div class="flex flex-col gap-1.5 sm:col-span-2">
						<label class="text-sm font-medium" for="e-imgs">Más imágenes (URL)</label>
						<Input id="e-imgs" name="enlace_imagenes" type="url" value={editando.enlace_imagenes ?? ''} />
					</div>
				</div>

				<div class="flex flex-wrap gap-x-4 gap-y-2">
					{#each [['datos_personales', 'Contiene datos personales'], ['creado_con_ia', 'Creado con IA'], ['fuera_del_banco', 'Fuera del banco (carpeta local)'], ['pendiente_clasificar', 'Pendiente de clasificar']] as [campo, etiqueta] (campo)}
						<label class="inline-flex items-center gap-1.5 text-sm">
							<input type="checkbox" name={campo} checked={editando[campo]} class="accent-[var(--primary)]" />
							{etiqueta}
						</label>
					{/each}
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="text-sm font-medium" for="e-notas">Notas internas</label>
					<Textarea id="e-notas" name="notas_internas" value={editando.notas_internas ?? ''} rows={2} />
				</div>

				<Sheet.Footer class="px-0">
					<Button type="submit" size="lg">Guardar cambios</Button>
				</Sheet.Footer>
			</form>
		{/if}
	</Sheet.Content>
</Sheet.Root>
