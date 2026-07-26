<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import SelectorTags from '$lib/components/SelectorTags.svelte';
	import SelectorMultiple from '$lib/components/SelectorMultiple.svelte';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { FORMATOS, formatoEfectivo } from '$lib/catalogo/formatos';
	import { toast } from 'svelte-sonner';
	import { LoaderCircle, Plus, Trash2 } from '@lucide/svelte';
	import type { Snippet } from 'svelte';

	/**
	 * Un único formulario de recurso para crear, editar y catalogar-y-publicar (SPEC-008 §3).
	 *
	 * Antes había tres formularios distintos con campos distintos, y catalogar un envío te dejaba
	 * un recurso a medias que luego tocaba completar. Este es el mismo en los tres sitios: lo que
	 * cambia es la acción del servidor y algún campo que solo tiene sentido al editar.
	 */
	let {
		action,
		valores = {},
		listas = [],
		mcmLocales = [],
		recursos = [],
		tagsExistentes = [],
		modo = 'editar',
		textoBoton = 'Guardar cambios',
		ocultos,
		encabezado,
		onguardado
	}: {
		action: string;
		/** Valores de partida (fila de `recurso`, o los que propone la IA para un envío). */
		valores?: Record<string, any>;
		listas?: { lista: string; valor: string; grupo: string | null }[];
		mcmLocales?: { id: string; nombre: string }[];
		/** Para el desplegable «es nueva versión de…». */
		recursos?: { id: string; nombre: string }[];
		tagsExistentes?: string[];
		modo?: 'crear' | 'editar' | 'publicar';
		textoBoton?: string;
		ocultos?: Snippet;
		encabezado?: Snippet;
		onguardado?: (result: any) => void;
	} = $props();

	const opciones = (lista: string) => listas.filter((l) => l.lista === lista);

	// Estado editable de los campos compuestos. Se recarga cuando el padre cambia `valores`
	// (abrir otro recurso, o aplicar una sugerencia de la IA, que crea un objeto nuevo).
	let tags = $state<string[]>([]);
	let etapas = $state<string[]>([]);
	let edades = $state<string[]>([]);
	let enlace = $state('');
	let archivos = $state<{ enlace: string; etiqueta: string }[]>([]);

	$effect(() => {
		const v = valores;
		tags = [...(v.tags ?? [])];
		etapas = [...(v.etapas ?? [])];
		edades = [...(v.edades ?? [])];
		enlace = v.enlace ?? '';
		archivos = (v.archivos ?? []).map((a: any) => ({
			enlace: a.enlace ?? '',
			etiqueta: a.etiqueta ?? ''
		}));
	});

	const formatoPrincipal = $derived(
		formatoEfectivo(enlace, enlace === (valores.enlace ?? '') ? valores.formato : null)
	);

	let guardando = $state(false);

	function alEnviar() {
		guardando = true;
		return async ({ result, update }: any) => {
			guardando = false;
			if (result.type === 'success') {
				onguardado?.(result);
			} else {
				toast.error('No se pudo guardar', {
					description: result.data?.error ?? 'Revisa los campos e inténtalo de nuevo'
				});
				await update({ reset: false });
			}
		};
	}
</script>

<form method="POST" {action} use:enhance={alEnviar} class="flex flex-col gap-5 px-4 pb-6">
	{@render ocultos?.()}
	{@render encabezado?.()}

	<div class="flex flex-col gap-1.5">
		<label class="text-sm font-medium" for="f-nombre">Nombre *</label>
		<Input id="f-nombre" name="nombre" value={valores.nombre ?? ''} required />
	</div>

	<!-- Clasificación primero: es lo que de verdad hace encontrable un recurso -->
	<div class="flex flex-col gap-4 rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-tags">Temáticas</label>
			<SelectorTags id="f-tags" bind:valor={tags} existentes={tagsExistentes} nombre="tags" />
		</div>
		<SelectorMultiple etiqueta="Etapas" opciones={opciones('etapas')} bind:valor={etapas} nombre="etapas" />
		<SelectorMultiple etiqueta="Edades" opciones={opciones('edades')} bind:valor={edades} nombre="edades" />
	</div>

	<div class="flex flex-col gap-1.5">
		<label class="text-sm font-medium" for="f-desc">Descripción</label>
		<Textarea id="f-desc" name="descripcion" value={valores.descripcion ?? ''} rows={3} />
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		{#each [['tipo', 'Tipo'], ['nivel', 'Nivel'], ['idioma', 'Idioma'], ['soporte', 'Soporte'], ['ubicacion', 'Ubicación'], ['estado', 'Estado'], ['visibilidad', 'Visibilidad']] as [campo, etiqueta] (campo)}
			<div class="flex flex-col gap-1.5">
				<label class="text-sm font-medium" for={`f-${campo}`}>{etiqueta}</label>
				<select
					id={`f-${campo}`}
					name={campo}
					value={valores[campo] ?? (campo === 'estado' ? 'publicado' : campo === 'visibilidad' ? 'publico' : '')}
					class="h-9 rounded-md border bg-background px-2 text-sm"
				>
					{#if campo !== 'estado' && campo !== 'visibilidad'}<option value="">—</option>{/if}
					{#each opciones(campo) as o (o.valor)}<option value={o.valor}>{o.valor}</option>{/each}
				</select>
			</div>
		{/each}
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-mcm">MCM Local</label>
			<select
				id="f-mcm"
				name="mcm_local_id"
				value={valores.mcm_local_id ?? ''}
				class="h-9 rounded-md border bg-background px-2 text-sm"
			>
				<option value="">—</option>
				{#each mcmLocales as m (m.id)}<option value={m.id}>{m.nombre}</option>{/each}
			</select>
		</div>
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-anyo">Año</label>
			<Input id="f-anyo" name="anyo_publicacion" type="number" value={valores.anyo_publicacion ?? ''} />
		</div>
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-curso">Curso usado</label>
			<Input id="f-curso" name="curso_usado" placeholder="2024-2025" value={valores.curso_usado ?? ''} />
		</div>
	</div>

	<!-- Archivos: el enlace principal y los mismos contenidos en otros formatos (SPEC-011) -->
	<div class="flex flex-col gap-2">
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-enlace">Enlace principal</label>
			<div class="relative">
				{#if formatoPrincipal}
					<span class="absolute top-1/2 left-3 -translate-y-1/2">
						<IconoFormato
							enlace={enlace}
							formato={enlace === (valores.enlace ?? '') ? valores.formato : null}
							class="size-4"
						/>
					</span>
				{/if}
				<Input
					id="f-enlace"
					name="enlace"
					type="url"
					bind:value={enlace}
					class={formatoPrincipal ? 'pl-9' : ''}
				/>
			</div>
			{#if formatoPrincipal}
				<p class="text-xs text-muted-foreground">
					Formato detectado: {FORMATOS[formatoPrincipal].etiqueta}.
					{#if formatoPrincipal === 'drive-archivo'}
						Al guardar se consulta a Drive para afinar si es PDF, Word, imagen…
					{/if}
				</p>
			{/if}
		</div>

		{#each archivos as archivo, i (i)}
			<div class="flex items-center gap-2">
				<span class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
					<IconoFormato enlace={archivo.enlace} class="size-4" />
				</span>
				<Input
					bind:value={archivo.enlace}
					name="archivo_enlace"
					type="url"
					placeholder="Enlace del mismo recurso en otro formato"
					class="flex-1"
				/>
				<Input
					bind:value={archivo.etiqueta}
					name="archivo_etiqueta"
					placeholder="Etiqueta (opcional)"
					class="w-40"
				/>
				<Button
					variant="ghost"
					size="icon"
					class="text-muted-foreground hover:text-destructive"
					aria-label="Quitar archivo"
					onclick={() => (archivos = archivos.filter((_, j) => j !== i))}
				>
					<Trash2 class="size-4" />
				</Button>
			</div>
		{/each}
		<Button
			variant="outline"
			size="sm"
			class="self-start"
			onclick={() => (archivos = [...archivos, { enlace: '', etiqueta: '' }])}
		>
			<Plus class="size-3.5" /> Otro formato del mismo recurso
		</Button>
		<p class="text-xs text-muted-foreground">
			Por ejemplo el mismo documento en Word y en PDF, o la carpeta de Drive con el material
			suelto. El icono de cada uno se deduce del enlace.
		</p>
	</div>

	<div class="grid gap-3 sm:grid-cols-2">
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-imagen">Imagen (URL)</label>
			<Input id="f-imagen" name="imagen" type="url" value={valores.imagen ?? ''} />
		</div>
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-imgs">Más imágenes (URL)</label>
			<Input id="f-imgs" name="enlace_imagenes" type="url" value={valores.enlace_imagenes ?? ''} />
		</div>
	</div>

	{#if modo === 'editar'}
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="f-version">Es nueva versión de…</label>
			<select
				id="f-version"
				name="version_de"
				value={valores.version_de ?? ''}
				class="h-9 rounded-md border bg-background px-2 text-sm"
			>
				<option value="">— No es una versión —</option>
				{#each recursos.filter((r) => r.id !== valores.id) as r (r.id)}
					<option value={r.id}>{r.id} · {r.nombre.replace(/^\[EJEMPLO\]\s*/, '')}</option>
				{/each}
			</select>
			<p class="text-xs text-muted-foreground">
				Al publicarse, la versión anterior se ocultará del catálogo y su valoración/uso se heredan
				a esta.
			</p>
		</div>
	{/if}

	<div class="flex flex-wrap gap-x-4 gap-y-2">
		{#each [['datos_personales', 'Contiene datos personales'], ['creado_con_ia', 'Creado con IA'], ['fuera_del_banco', 'Fuera del banco (carpeta local)'], ['pendiente_clasificar', 'Pendiente de clasificar']] as [campo, etiqueta] (campo)}
			<label class="inline-flex items-center gap-1.5 text-sm">
				<input type="checkbox" name={campo} checked={!!valores[campo]} class="accent-[var(--primary)]" />
				{etiqueta}
			</label>
		{/each}
	</div>

	<div class="flex flex-col gap-1.5">
		<label class="text-sm font-medium" for="f-notas">Notas internas</label>
		<Textarea id="f-notas" name="notas_internas" value={valores.notas_internas ?? ''} rows={2} />
	</div>

	<div class="flex justify-end">
		<Button type="submit" size="lg" disabled={guardando}>
			{#if guardando}<LoaderCircle class="size-4 animate-spin" />{/if}
			{guardando ? 'Guardando…' : textoBoton}
		</Button>
	</div>
</form>
