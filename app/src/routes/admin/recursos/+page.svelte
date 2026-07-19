<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Sheet from '$lib/components/ui/sheet';
	import { toast } from 'svelte-sonner';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import { ArrowDownUp, CloudAlert, Pencil } from '@lucide/svelte';

	let { data } = $props();

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

	const fecha = (iso: string | null) =>
		iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—';
</script>

<svelte:head><title>Recursos · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="font-display text-2xl font-bold">Recursos</h1>
		<p class="text-sm text-muted-foreground tabular-nums">{filtrados.length} de {data.recursos.length}</p>
		<div class="ml-auto flex items-center gap-2">
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
								{#if r.editado_web_at}
									<span title="Editado en web: protegido del Sheet hasta resolver">
										<CloudAlert class="size-3.5 shrink-0 text-warm-foreground dark:text-warm" />
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
						<td class="px-3 text-right">
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
