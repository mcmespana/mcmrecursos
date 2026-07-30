<script lang="ts">
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import {
		FAMILIA_BADGE,
		FAMILIA_FONDO,
		BADGE_NEUTRO,
		FONDO_NEUTRO,
		iconoDeTipo,
		limpiarNombre,
		esEjemplo
	} from '$lib/catalogo/tipos';
	import {
		FORMATOS,
		descargasDe,
		formatoEfectivo,
		urlCopia,
		urlFavicon,
		urlVistaPrevia
	} from '$lib/catalogo/formatos';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import { toast } from 'svelte-sonner';
	import VistaPrevia from '$lib/components/VistaPrevia.svelte';
	import * as Sheet from '$lib/components/ui/sheet';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import Estrellas from '$lib/components/Estrellas.svelte';
	import ComentariosRecurso from '$lib/components/ComentariosRecurso.svelte';
	import GuardarEnLista from '$lib/components/GuardarEnLista.svelte';
	import { miniatura } from '$lib/catalogo/tipos';
	import type { SupabaseClient, Session } from '@supabase/supabase-js';
	import {
		Check,
		ChevronLeft,
		ChevronRight,
		Copy,
		Download,
		Eye,
		Link2,
		ScanEye,
		FolderSymlink,
		Heart,
		History,
		PackageOpen
	} from '@lucide/svelte';

	let {
		supabase,
		session,
		puedeModerar = false,
		onrequierelogin,
		recurso,
		familia,
		relacionados,
		favorito,
		usado,
		miValoracion,
		indice = -1,
		total = 0,
		versionActual = null,
		versionesAnteriores = [],
		nombreTransicion = null,
		onclose,
		onnavegar,
		onabrirrelacionado,
		onfavorito,
		onusado,
		onvalorar,
		onabrir,
		onacceso
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		session: Session | null;
		puedeModerar?: boolean;
		onrequierelogin: () => void;
		recurso: RecursoCatalogo | null;
		familia: string | null;
		relacionados: RecursoCatalogo[];
		favorito: boolean;
		usado: boolean;
		miValoracion: number | null;
		/** posición 0-based del recurso en la lista que estás viendo (-1 si no aplica). */
		indice?: number;
		/** tamaño de esa lista, para «i / total» y el estado disabled. */
		total?: number;
		/** versión vigente del linaje, si este recurso es una anterior (SPEC-009). */
		versionActual?: RecursoCatalogo | null;
		/** versiones anteriores del linaje (si este es el vigente). */
		versionesAnteriores?: RecursoCatalogo[];
		/**
		 * `view-transition-name` que trae la miniatura de la tarjeta. Aterriza en el héroe, o en
		 * el marco de la vista previa cuando el héroe está colapsado: así el nombre nunca queda
		 * desparejado, que es lo que aborta una View Transition.
		 */
		nombreTransicion?: string | null;
		onclose: () => void;
		onnavegar: (direccion: 1 | -1) => void;
		onabrirrelacionado: (r: RecursoCatalogo) => void;
		onfavorito: (r: RecursoCatalogo) => void;
		onusado: (r: RecursoCatalogo) => void;
		onvalorar: (r: RecursoCatalogo, estrellas: number) => void;
		onabrir: (r: RecursoCatalogo, enlace?: string) => void;
		/** Registra un acceso sin navegar: para descargas y copias, que ya abren su propio enlace. */
		onacceso?: (r: RecursoCatalogo) => void;
	} = $props();

	const puedeAnterior = $derived(indice > 0);
	const puedeSiguiente = $derived(indice >= 0 && indice < total - 1);

	const badgeClase = $derived((familia && FAMILIA_BADGE[familia]) || BADGE_NEUTRO);
	const fondoClase = $derived((familia && FAMILIA_FONDO[familia]) || FONDO_NEUTRO);
	const Icono = $derived(iconoDeTipo(recurso?.tipo, familia));
	const nombre = $derived(recurso ? limpiarNombre(recurso.nombre) : '');

	/**
	 * Todo lo que se puede abrir de este recurso: el enlace principal y los formatos
	 * alternativos (SPEC-011). Cada uno con su formato ya resuelto para pintar el icono.
	 */
	const archivos = $derived.by(() => {
		if (!recurso) return [];
		const lista: { enlace: string; etiqueta: string; formato: string | null; principal: boolean }[] =
			[];
		if (recurso.enlace) {
			const clave = formatoEfectivo(recurso.enlace, recurso.formato);
			lista.push({
				enlace: recurso.enlace,
				etiqueta: clave ? FORMATOS[clave].corto : 'Abrir recurso',
				formato: recurso.formato,
				principal: true
			});
		}
		for (const a of recurso.archivos) {
			const clave = formatoEfectivo(a.enlace, a.formato);
			lista.push({
				enlace: a.enlace,
				etiqueta: a.etiqueta || (clave ? FORMATOS[clave].corto : 'Abrir'),
				formato: a.formato,
				principal: false
			});
		}
		return lista;
	});

	/**
	 * Vista previa empotrada (SPEC-011). Viene abierta: la ficha se abre de una en una y a
	 * propósito, así que ver el recurso es justo lo que se venía a hacer. Quien prefiera no
	 * verla la oculta y se recuerda en este dispositivo.
	 */
	const CLAVE_PREVIA = 'mcm-vista-previa';
	const previa = $derived(recurso ? urlVistaPrevia(recurso.enlace, recurso.formato) : null);
	const claveFormato = $derived(recurso ? formatoEfectivo(recurso.enlace, recurso.formato) : null);
	let previaVisible = $state(true);
	$effect(() => {
		previaVisible = localStorage.getItem(CLAVE_PREVIA) !== 'oculta';
	});
	function alternarPrevia(visible: boolean) {
		previaVisible = visible;
		localStorage.setItem(CLAVE_PREVIA, visible ? 'visible' : 'oculta');
	}
	const previaAbierta = $derived(!!previa && previaVisible);

	// Descargas por URL y copia editable, solo para documentos de Google (SPEC-011).
	const descargas = $derived(recurso ? descargasDe(recurso.enlace) : []);
	const copia = $derived(recurso ? urlCopia(recurso.enlace) : null);

	// Si el recurso es una web sin miniatura, su favicon dice más que un globo genérico.
	const favicon = $derived(
		recurso && formatoEfectivo(recurso.enlace, recurso.formato) === 'web'
			? urlFavicon(recurso.enlace, 128)
			: null
	);

	// Copiar el enlace de la ficha: hasta ahora había que ir a la barra del navegador.
	let copiado = $state(false);
	async function copiarEnlace() {
		if (!recurso) return;
		try {
			await navigator.clipboard.writeText(`${location.origin}/?r=${recurso.id}`);
			copiado = true;
			setTimeout(() => (copiado = false), 1600);
		} catch {
			toast.error('Tu navegador no ha dejado copiar el enlace');
		}
	}

	let imgFallo = $state(false);
	let faviconFallo = $state(false);
	$effect(() => {
		void recurso?.id;
		imgFallo = false;
		faviconFallo = false;
	});
	const srcMiniatura = $derived(recurso && !imgFallo ? miniatura(recurso) : null);

	// Separado en dos: «para quién» es lo primero que se busca en un recurso, y «ficha
	// técnica» es todo lo demás (procedencia, idioma, soporte…). Antes iba todo en una
	// sola lista plana sin distinguir qué es audiencia y qué es procedencia.
	const paraQuien = $derived(
		recurso
			? ([
					['Etapa', recurso.etapas.join(', ')],
					['Edades', recurso.edades.join(', ')],
					['Nivel', recurso.nivel]
				].filter(([, v]) => v) as [string, string][])
			: []
	);
	const fichaTecnica = $derived(
		recurso
			? ([
					['Idioma', recurso.idioma],
					['Soporte', recurso.soporte],
					['Ubicación', recurso.ubicacion],
					['MCM Local', recurso.mcm_local],
					['Autoría', recurso.autores.join(', ')],
					['Año', recurso.anyo_publicacion?.toString()],
					['Curso usado', recurso.curso_usado]
				].filter(([, v]) => v) as [string, string][])
			: []
	);

	function teclas(e: KeyboardEvent) {
		const objetivo = e.target as HTMLElement;
		if (objetivo?.closest('input, textarea, select, [contenteditable]')) return;
		// Escape cerrando a mano: la primitiva del panel no lo hacía, y una ficha de la que solo
		// se sale con el ratón es una trampa (bug de antes, no de la View Transition).
		if (e.key === 'Escape') {
			e.preventDefault();
			onclose();
			return;
		}
		if (e.key === 'ArrowRight' && puedeSiguiente) onnavegar(1);
		if (e.key === 'ArrowLeft' && puedeAnterior) onnavegar(-1);
	}

	const fmtVersion = (r: RecursoCatalogo) =>
		r.curso_usado || r.anyo_publicacion?.toString() || 'sin fecha';
</script>

<svelte:window onkeydown={recurso ? teclas : undefined} />

<Sheet.Root open={recurso !== null} onOpenChange={(abierto) => !abierto && onclose()}>
	<Sheet.Content side="right" class="w-full gap-0 overflow-y-auto p-0 sm:max-w-lg">
		{#if recurso}
			<!--
				Héroe. Con la vista previa abierta se reduce a la fila de etiquetas: la miniatura de
				un documento es su primera página, o sea lo mismo que ya se está viendo debajo.
			-->
			{#if previaAbierta}
				<div class="flex flex-wrap items-center gap-2 px-6 pt-6">
					{#if recurso.tipo}
						<Badge class={`border-transparent ${badgeClase}`}>{recurso.tipo}</Badge>
					{/if}
					{#if esEjemplo(recurso.nombre)}
						<Badge variant="outline">Ejemplo</Badge>
					{/if}
					{#if recurso.visibilidad === 'privado'}
						<Badge variant="secondary">Privado</Badge>
					{/if}
				</div>
			{:else}
			<div
				class="relative aspect-[16/9] w-full shrink-0 overflow-hidden"
				style={nombreTransicion ? `view-transition-name: ${nombreTransicion}` : undefined}
			>
				{#if srcMiniatura}
					<img
						src={srcMiniatura}
						alt={`${nombre} (${recurso.tipo ?? 'recurso'})`}
						class="size-full object-cover"
						onerror={() => (imgFallo = true)}
					/>
				{:else}
					<div class={`flex size-full items-center justify-center bg-gradient-to-br ${fondoClase}`}>
						{#if favicon && !faviconFallo}
							<img
								src={favicon}
								alt=""
								class="size-16 rounded-xl bg-background/70 p-3 shadow-sm"
								onerror={() => (faviconFallo = true)}
							/>
						{:else}
							<Icono class="size-20 text-foreground/12" strokeWidth={1.25} />
						{/if}
					</div>
				{/if}
				<div
					class="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-background/90 to-transparent"
				></div>
				<div class="absolute bottom-3 left-6 flex flex-wrap items-center gap-2">
					{#if recurso.tipo}
						<Badge class={`border-transparent shadow-sm ${badgeClase}`}>{recurso.tipo}</Badge>
					{/if}
					{#if esEjemplo(recurso.nombre)}
						<Badge variant="outline" class="bg-background/80 backdrop-blur">Ejemplo</Badge>
					{/if}
					{#if recurso.visibilidad === 'privado'}
						<Badge variant="secondary">Privado</Badge>
					{/if}
				</div>
			</div>
			{/if}

			<div class="flex flex-col gap-5 p-6">
				<Sheet.Header class="gap-2 p-0">
					<Sheet.Title class="font-display text-[1.7rem] leading-tight font-bold text-balance">
						{nombre}
					</Sheet.Title>
					<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
						<Estrellas media={recurso.valoracion_media} num={recurso.num_valoraciones} />
						<span class="inline-flex items-center gap-1 tabular-nums" title="Accesos">
							<Eye class="size-3.5" />
							{recurso.num_accesos}
						</span>
						{#if recurso.num_usos}
							<span class="inline-flex items-center gap-1 tabular-nums" title="Veces usado">
								<Check class="size-3.5" />
								{recurso.num_usos}
							</span>
						{/if}
						{#if recurso.num_favoritos}
							<span class="inline-flex items-center gap-1 tabular-nums" title="En favoritos">
								<Heart class="size-3.5" />
								{recurso.num_favoritos}
							</span>
						{/if}
					</div>
				</Sheet.Header>

				{#if versionActual}
					<button
						type="button"
						class="flex items-center gap-2 rounded-xl border border-warm/40 bg-warm/10 px-3 py-2 text-left text-sm text-warm-foreground transition-colors hover:bg-warm/20 dark:text-warm"
						onclick={() => onabrirrelacionado(versionActual!)}
					>
						<History class="size-4 shrink-0" />
						<span>
							Versión anterior ({fmtVersion(recurso)}). Ver la actual ({fmtVersion(versionActual)})
							<ChevronRight class="inline size-3.5" />
						</span>
					</button>
				{/if}

				{#if recurso.descripcion}
					<p class="text-sm leading-relaxed text-pretty text-muted-foreground">
						{recurso.descripcion}
					</p>
				{/if}

				<!-- acciones -->
				<div class="flex items-stretch gap-2">
					{#if archivos.length}
						<Button size="lg" class="flex-1" onclick={() => onabrir(recurso!, archivos[0].enlace)}>
							<IconoFormato
								enlace={archivos[0].enlace}
								formato={archivos[0].formato}
								neutro
								class="size-4"
							/>
							Abrir {archivos.length > 1 ? archivos[0].etiqueta.toLowerCase() : 'recurso'}
						</Button>
					{/if}
					<Tooltip.Provider delayDuration={300}>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant={favorito ? 'default' : 'outline'}
										size="lg"
										class={favorito ? 'bg-destructive text-white hover:bg-destructive/90' : ''}
										aria-pressed={favorito}
										aria-label={favorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
										onclick={() => onfavorito(recurso!)}
									>
										<Heart class={`size-4 ${favorito ? 'fill-current' : ''}`} />
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content>{favorito ? 'En tus favoritos' : 'Guardar en favoritos'}</Tooltip.Content>
						</Tooltip.Root>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant={usado ? 'secondary' : 'outline'}
										size="lg"
										aria-pressed={usado}
										aria-label={usado ? 'Marcado como usado' : 'Marcar como usado'}
										onclick={() => onusado(recurso!)}
									>
										<Check class={`size-4 ${usado ? 'text-primary' : ''}`} />
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content>{usado ? 'Lo has usado' : 'Marcar «lo he usado»'}</Tooltip.Content>
						</Tooltip.Root>
						<Tooltip.Root>
							<Tooltip.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="outline"
										size="lg"
										hecho={copiado}
										aria-label="Copiar el enlace de este recurso"
										onclick={copiarEnlace}
									>
										{#if !copiado}<Link2 class="size-4" />{/if}
									</Button>
								{/snippet}
							</Tooltip.Trigger>
							<Tooltip.Content>{copiado ? '¡Copiado!' : 'Copiar enlace del recurso'}</Tooltip.Content>
						</Tooltip.Root>
					</Tooltip.Provider>
					<GuardarEnLista {supabase} {session} recursoId={recurso.id} {onrequierelogin} />
				</div>

				<!-- vistazo sin salir del banco (SPEC-011 §Vista previa) -->
				{#if previa && previaVisible}
					<VistaPrevia
						url={previa}
						formato={claveFormato}
						{nombre}
						{nombreTransicion}
						onabrir={() => onabrir(recurso!)}
						oncerrar={() => alternarPrevia(false)}
					/>
				{:else if previa}
					<Button
						variant="outline"
						size="sm"
						class="self-start"
						onclick={() => alternarPrevia(true)}
					>
						<ScanEye class="size-3.5" /> Ver una vista previa
					</Button>
				{/if}

				<!-- otros formatos del mismo recurso (SPEC-011) -->
				{#if archivos.length > 1}
					<div class="flex flex-col gap-1.5">
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							También disponible en
						</p>
						<div class="flex flex-wrap gap-2">
							{#each archivos.slice(1) as archivo (archivo.enlace)}
								<button
									type="button"
									class="toque inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
									onclick={() => onabrir(recurso!, archivo.enlace)}
								>
									<IconoFormato enlace={archivo.enlace} formato={archivo.formato} class="size-4" />
									{archivo.etiqueta}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!--
					Llevárselo: descargar en otro formato o hacerse una copia editable. Los editores
					de Google lo dan por URL, sin API ni credenciales (SPEC-011 §URLs de Google), así
					que estos son enlaces normales: se abren con los permisos de quien los pulsa.
				-->
				{#if descargas.length}
					<div class="flex flex-col gap-1.5">
						<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Llevártelo
						</p>
						<div class="flex flex-wrap gap-2">
							{#each descargas as descarga (descarga.extension)}
								<a
									href={descarga.url}
									target="_blank"
									rel="noopener noreferrer"
									class="toque inline-flex items-center gap-1.5 rounded-lg border bg-card px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
									title={`Descargar en ${descarga.etiqueta}`}
									onclick={() => onacceso?.(recurso!)}
								>
									<Download class="size-3.5 text-muted-foreground" />
									<IconoFormato formato={descarga.formato} class="size-4" />
									{descarga.etiqueta}
								</a>
							{/each}
							{#if copia}
								<a
									href={copia}
									target="_blank"
									rel="noopener noreferrer"
									class="toque inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 px-2.5 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
									title="Crea una copia en tu Drive para adaptarlo; el original del banco no se toca"
									onclick={() => onacceso?.(recurso!)}
								>
									<Copy class="size-3.5" />
									Hacer una copia
								</a>
							{/if}
						</div>
						<p class="text-xs text-muted-foreground">
							La copia se crea en tu Drive y la puedes editar a tu gusto: el original del banco
							queda intacto.
						</p>
					</div>
				{/if}

				<!-- tu valoración -->
				<div class="flex items-center justify-between rounded-xl border bg-muted/40 px-4 py-3">
					<p class="text-sm font-medium">Tu valoración</p>
					<Estrellas
						interactiva
						mia={miValoracion}
						onvalorar={(estrellas) => onvalorar(recurso!, estrellas)}
					/>
				</div>

				{#if recurso.pendiente_clasificar || recurso.fuera_del_banco}
					<div class="flex flex-col gap-1.5 rounded-xl bg-muted p-3 text-xs text-muted-foreground">
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

				{#if paraQuien.length}
					<Separator />
					<div class="flex flex-col gap-2">
						<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Para quién
						</h4>
						<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
							{#each paraQuien as [clave, valor] (clave)}
								<dt class="text-muted-foreground">{clave}</dt>
								<dd>{valor}</dd>
							{/each}
						</dl>
					</div>
				{/if}

				{#if fichaTecnica.length}
					<Separator />
					<div class="flex flex-col gap-2">
						<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Ficha técnica
						</h4>
						<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
							{#each fichaTecnica as [clave, valor] (clave)}
								<dt class="text-muted-foreground">{clave}</dt>
								<dd>{valor}</dd>
							{/each}
						</dl>
					</div>
				{/if}

				{#if versionesAnteriores.length}
					<Separator />
					<div class="flex flex-col gap-2">
						<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Versiones anteriores
						</h4>
						{#each versionesAnteriores as ver (ver.id)}
							<button
								type="button"
								class="flex items-center gap-3 rounded-xl border p-2 text-left text-sm transition-colors hover:bg-accent"
								onclick={() => onabrirrelacionado(ver)}
							>
								<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
									<History class="size-4 text-muted-foreground" />
								</span>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate font-medium">{fmtVersion(ver)}</span>
									<span class="text-xs text-muted-foreground">
										{ver.num_valoraciones ? `⭐ ${ver.valoracion_media} · ` : ''}{ver.num_accesos} aperturas
									</span>
								</span>
								<ChevronRight class="size-4 shrink-0 text-muted-foreground" />
							</button>
						{/each}
					</div>
				{/if}

				{#if relacionados.length}
					<Separator />
					<div class="flex flex-col gap-2">
						<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
							Recursos relacionados
						</h4>
						{#each relacionados as rel (rel.id)}
							<button
								type="button"
								class="flex items-center gap-3 rounded-xl border p-2 text-left text-sm transition-colors hover:bg-accent"
								onclick={() => onabrirrelacionado(rel)}
							>
								<span
									class={`flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br ${FONDO_NEUTRO}`}
								>
									{#if rel.imagen}
										<img src={rel.imagen} alt="" class="size-full object-cover" />
									{:else}
										<span class="font-display text-sm font-bold text-primary/50">
											{(rel.tipo ?? rel.nombre).charAt(0)}
										</span>
									{/if}
								</span>
								<span class="flex min-w-0 flex-col">
									<span class="truncate font-medium">{limpiarNombre(rel.nombre)}</span>
									{#if rel.tipo}
										<span class="text-xs text-muted-foreground">{rel.tipo}</span>
									{/if}
								</span>
							</button>
						{/each}
					</div>
				{/if}

				<Separator />

				<ComentariosRecurso
					{supabase}
					{session}
					recursoId={recurso.id}
					{puedeModerar}
					{onrequierelogin}
				/>

				{#if indice >= 0 && total > 1}
					<div class="flex items-center justify-between pt-1">
						<Button
							variant="ghost"
							size="sm"
							disabled={!puedeAnterior}
							onclick={() => onnavegar(-1)}
						>
							<ChevronLeft class="size-4" /> Anterior
						</Button>
						<span class="text-xs text-muted-foreground tabular-nums">
							{indice + 1} / {total}
						</span>
						<Button
							variant="ghost"
							size="sm"
							disabled={!puedeSiguiente}
							onclick={() => onnavegar(1)}
						>
							Siguiente <ChevronRight class="size-4" />
						</Button>
					</div>
				{/if}
			</div>
		{/if}
	</Sheet.Content>
</Sheet.Root>
