<script lang="ts">
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import { FAMILIA_BADGE, BADGE_NEUTRO } from '$lib/catalogo/tipos';
	import * as Sheet from '$lib/components/ui/sheet';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { ExternalLink, FolderSymlink, PackageOpen, ChevronLeft, ChevronRight } from '@lucide/svelte';

	let {
		recurso,
		familia,
		relacionados,
		onclose,
		onnavegar,
		onabrirrelacionado
	}: {
		recurso: RecursoCatalogo | null;
		familia: string | null;
		relacionados: RecursoCatalogo[];
		onclose: () => void;
		onnavegar: (direccion: 1 | -1) => void;
		onabrirrelacionado: (r: RecursoCatalogo) => void;
	} = $props();

	const badgeClase = $derived((familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO);
	const nombreLimpio = $derived(recurso?.nombre.replace(/^\[EJEMPLO\]\s*/, '') ?? '');

	const metadatos = $derived(
		recurso
			? ([
					['Etapa', recurso.etapas.join(', ')],
					['Edades', recurso.edades.join(', ')],
					['Nivel', recurso.nivel],
					['MCM Local', recurso.mcm_local],
					['Autoría', recurso.autores.join(', ')],
					['Idioma', recurso.idioma],
					['Soporte', recurso.soporte],
					['Ubicación', recurso.ubicacion],
					['Año', recurso.anyo_publicacion?.toString()],
					['Curso usado', recurso.curso_usado]
				].filter(([, v]) => v) as [string, string][])
			: []
	);

	function teclas(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') onnavegar(1);
		if (e.key === 'ArrowLeft') onnavegar(-1);
	}
</script>

<svelte:window onkeydown={recurso ? teclas : undefined} />

<Sheet.Root open={recurso !== null} onOpenChange={(abierto) => !abierto && onclose()}>
	<Sheet.Content side="right" class="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
		{#if recurso}
			<div class="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-accent">
				{#if recurso.imagen}
					<img
						src={recurso.imagen}
						alt={`${nombreLimpio} (${recurso.tipo ?? 'recurso'})`}
						class="size-full object-cover"
					/>
				{:else}
					<div
						class="flex size-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent to-warm/20"
					>
						<span class="font-display text-7xl font-bold text-primary/30">
							{(recurso.tipo ?? recurso.nombre).charAt(0).toUpperCase()}
						</span>
					</div>
				{/if}
			</div>

			<div class="flex flex-col gap-4 p-6">
				<Sheet.Header class="p-0">
					<div class="flex flex-wrap items-center gap-2">
						{#if recurso.tipo}
							<Badge class={`border-transparent ${badgeClase}`}>{recurso.tipo}</Badge>
						{/if}
						{#if recurso.nombre.startsWith('[EJEMPLO]')}
							<Badge variant="outline">Ejemplo</Badge>
						{/if}
						{#if recurso.visibilidad === 'privado'}
							<Badge variant="secondary">Privado</Badge>
						{/if}
					</div>
					<Sheet.Title class="font-display text-2xl leading-tight text-balance">
						{nombreLimpio}
					</Sheet.Title>
					{#if recurso.descripcion}
						<Sheet.Description class="text-sm leading-relaxed text-pretty">
							{recurso.descripcion}
						</Sheet.Description>
					{/if}
				</Sheet.Header>

				{#if recurso.enlace}
					<Button
						href={recurso.enlace}
						target="_blank"
						rel="noopener noreferrer"
						size="lg"
						class="w-full"
					>
						<ExternalLink class="size-4" />
						Abrir recurso
					</Button>
				{/if}

				{#if recurso.pendiente_clasificar || recurso.fuera_del_banco}
					<div class="flex flex-col gap-1.5 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
						{#if recurso.pendiente_clasificar}
							<span class="inline-flex items-center gap-1.5">
								<PackageOpen class="size-3.5" />
								Contenedor localizado, pendiente de trocear y clasificar.
							</span>
						{/if}
						{#if recurso.fuera_del_banco}
							<span class="inline-flex items-center gap-1.5">
								<FolderSymlink class="size-3.5" />
								El material vive en una carpeta local, aún fuera del banco.
							</span>
						{/if}
					</div>
				{/if}

				{#if recurso.tags.length}
					<div class="flex flex-wrap gap-1.5">
						{#each recurso.tags as tag (tag)}
							<span class="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
								>{tag}</span
							>
						{/each}
					</div>
				{/if}

				<Separator />

				<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
					{#each metadatos as [clave, valor] (clave)}
						<dt class="text-muted-foreground">{clave}</dt>
						<dd>{valor}</dd>
					{/each}
				</dl>

				{#if relacionados.length}
					<Separator />
					<div class="flex flex-col gap-2">
						<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Recursos relacionados
						</h4>
						{#each relacionados as rel (rel.id)}
							<button
								type="button"
								class="rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent"
								onclick={() => onabrirrelacionado(rel)}
							>
								{rel.nombre.replace(/^\[EJEMPLO\]\s*/, '')}
							</button>
						{/each}
					</div>
				{/if}

				<div class="flex items-center justify-between pt-2">
					<Button variant="ghost" size="sm" onclick={() => onnavegar(-1)}>
						<ChevronLeft class="size-4" /> Anterior
					</Button>
					<Button variant="ghost" size="sm" onclick={() => onnavegar(1)}>
						Siguiente <ChevronRight class="size-4" />
					</Button>
				</div>
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
