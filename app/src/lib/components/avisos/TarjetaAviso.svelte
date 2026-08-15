<script lang="ts">
	import * as Avatar from '$lib/components/ui/avatar';
	import { buzon, haceCuanto, vencimiento, type Aviso } from '$lib/avisos/estado.svelte';
	import {
		Bell,
		Calendar,
		Check,
		CircleCheck,
		Flag,
		RotateCcw,
		Trash2,
		User,
		UserPlus
	} from '@lucide/svelte';

	/**
	 * Una fila del buzón (SPEC-016).
	 *
	 * La idea que ordena la tarjeta: **quién responde y para cuándo son campos, no texto suelto
	 * dentro del título**. Por eso el responsable tiene su propia tira con marco propio en vez de
	 * ser un avatar perdido en una esquina — es lo primero que se busca al mirar un buzón
	 * compartido («¿esto es mío o de alguien?»), y cuando no hay nadie asignado la tira sale
	 * punteada, que es una forma de pedir que alguien lo coja sin escribir «pendiente de asignar».
	 *
	 * `grande` es la misma tarjeta en `/admin/avisos`: mismo dibujo, más aire y con los selectores
	 * en línea. No es un componente distinto a propósito — que el panel y la pantalla completa se
	 * vean igual es justo lo que hace que saltar de uno a otra no desoriente.
	 */
	let {
		aviso,
		grande = false,
		onaccion
	}: {
		aviso: Aviso;
		grande?: boolean;
		/** Para que quien manda decida el aviso de «deshacer» y el refresco. */
		onaccion: (
			que: 'hecha' | 'reabrir' | 'leido' | 'borrar' | 'asignar' | 'prioridad' | 'vence',
			valor?: string | null
		) => void;
	} = $props();

	const persona = $derived(buzon.persona(aviso.asignada_a));
	const autor = $derived(buzon.persona(aviso.creada_por));
	const vence = $derived(vencimiento(aviso.vence_at));
	const hecha = $derived(aviso.estado === 'hecha');
	const sinLeer = $derived(!aviso.leido && aviso.estado === 'abierta');
	const urgente = $derived(aviso.prioridad === 'alta' && aviso.estado === 'abierta');
	const esTarea = $derived(aviso.tipo === 'tarea');
	const ocupado = $derived(buzon.ocupado(aviso.id));

	const iniciales = (p: { nombre?: string; apellidos?: string } | null) =>
		p ? `${p.nombre?.[0] ?? ''}${p.apellidos?.[0] ?? ''}`.toUpperCase() || '?' : '?';

	/** `datetime-local` quiere `YYYY-MM-DD`; la BD guarda un timestamptz completo. */
	const fechaInput = $derived(aviso.vence_at ? aviso.vence_at.slice(0, 10) : '');
</script>

<article
	class={[
		'group/aviso relative flex flex-col gap-2.5 rounded-2xl border p-3.5 transition-colors',
		grande && 'gap-3 p-4',
		hecha
			? 'border-border/70 bg-muted/30'
			: sinLeer
				? 'border-primary/30 bg-primary/[0.045]'
				: 'border-border bg-card',
		ocupado && 'pointer-events-none animate-pulse opacity-60'
	]}
	aria-busy={ocupado}
>
	<!-- Fila de etiquetas: qué es, si corre prisa y si ya lo has visto -->
	<div class="flex items-center gap-1.5">
		<span
			class={[
				'inline-flex h-5 items-center rounded-md px-2 text-[10.5px] font-bold tracking-[0.05em] uppercase',
				esTarea ? 'bg-warm/20 text-warm-foreground dark:text-warm' : 'bg-primary/12 text-primary'
			]}
		>
			{esTarea ? 'Tarea' : 'Aviso'}
		</span>
		<!--
			En grande la etiqueta de urgencia es además el interruptor: mismo dibujo y mismo
			vocabulario que el chip «Urgente» del compositor, en vez de un desplegable de tres
			opciones que nadie usaba entero.
		-->
		{#if urgente || (grande && !hecha)}
			<svelte:element
				this={grande && !hecha ? 'button' : 'span'}
				type={grande && !hecha ? 'button' : undefined}
				role={grande && !hecha ? 'switch' : undefined}
				aria-checked={grande && !hecha ? urgente : undefined}
				onclick={grande && !hecha
					? () => onaccion('prioridad', urgente ? 'normal' : 'alta')
					: undefined}
				class={[
					'inline-flex h-5 items-center gap-1 rounded-md px-2 text-[10.5px] font-bold tracking-[0.05em] uppercase transition-colors',
					urgente
						? 'bg-destructive/12 text-destructive'
						: // sin marcar, solo aparece al pasar por encima: un «urgente» punteado en cada
							// tarjeta llenaba la rejilla de ruido para ofrecer algo que se usa poco
							'border border-dashed border-border text-muted-foreground/70 opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover/aviso:opacity-100 max-sm:opacity-100',
					grande && !hecha && 'toque cursor-pointer'
				]}
			>
				<Flag class="size-2.5" /> Urgente
			</svelte:element>
		{/if}
		{#if aviso.origen === 'salud'}
			<span
				class="inline-flex h-5 items-center rounded-md bg-muted px-2 text-[10.5px] font-semibold tracking-[0.04em] text-muted-foreground uppercase"
			>
				Salud
			</span>
		{/if}

		<span class="ml-auto flex items-center gap-1.5">
			{#if hecha}
				<span class="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
					<CircleCheck class="size-3.5 text-emerald-600 dark:text-emerald-500" />
					{aviso.resuelta_at ? haceCuanto(aviso.resuelta_at) : 'hecha'}
				</span>
			{:else if sinLeer}
				<span class="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
					<span class="size-1.5 rounded-full bg-primary"></span> Sin leer
				</span>
			{:else}
				<!--
					Volver a marcar sin leer es una salida de emergencia, no una etiqueta: va sin
					texto para no competir con el «Sin leer» de verdad de las otras tarjetas, y solo
					aparece al pasar por encima (en táctil, siempre: ahí no hay hover).
				-->
				<button
					type="button"
					class="toque inline-flex size-6 items-center justify-center rounded-lg text-muted-foreground/60 opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus-visible:opacity-100 group-hover/aviso:opacity-100 max-sm:opacity-100"
					onclick={() => onaccion('leido', 'no')}
					aria-label={`Marcar «${aviso.titulo}» como sin leer`}
					title="Marcar como sin leer"
				>
					<RotateCcw class="size-3" />
				</button>
			{/if}
		</span>
	</div>

	<!-- El texto. `pretty` evita la palabra huérfana en tarjetas estrechas -->
	<div class="flex flex-col gap-1">
		<p
			class={[
				'font-medium [text-wrap:pretty]',
				grande ? 'text-[15px]/[1.45]' : 'text-sm/[1.45]',
				hecha && 'text-muted-foreground line-through decoration-muted-foreground/40'
			]}
		>
			{aviso.titulo}
		</p>
		{#if aviso.detalle}
			<p class="text-[13px]/[1.5] text-muted-foreground [text-wrap:pretty]">{aviso.detalle}</p>
		{/if}
	</div>

	<!--
		Tira de responsable. Con nadie asignado va punteada: un hueco que se ve como hueco pide que
		alguien lo llene mucho mejor que la palabra «sin asignar» en gris.
	-->
	{#if !hecha && (esTarea || persona)}
		<div
			class={[
				'flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl px-2.5 py-2',
				persona
					? 'border border-border bg-background'
					: 'border border-dashed border-border bg-muted/40'
			]}
		>
			<Avatar.Root class="size-6.5">
				<Avatar.Image src={persona?.avatar_url ?? undefined} alt="" />
				<Avatar.Fallback
					class={persona
						? 'bg-primary/15 text-[9px] font-semibold text-primary'
						: 'bg-transparent text-muted-foreground'}
				>
					{#if persona}{iniciales(persona)}{:else}<UserPlus class="size-3.5" />{/if}
				</Avatar.Fallback>
			</Avatar.Root>

			<!--
				El nombre ES el selector, no un texto con un selector al lado: enseñar «Lucía» y
				debajo un desplegable que también pone «Lucía» era decir lo mismo dos veces y
				duplicaba el ancho de la tira.
			-->
			<span class="flex min-w-0 flex-col leading-tight">
				{#if persona}
					<span class="text-[10.5px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
						Responsable
					</span>
				{/if}
				<label>
					<span class="sr-only">Responsable de «{aviso.titulo}»</span>
					<select
						value={aviso.asignada_a ?? ''}
						class={[
							'-mx-1 max-w-[11rem] cursor-pointer truncate rounded-md bg-transparent px-1 py-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring',
							persona ? 'text-[13px] font-semibold' : 'text-[12.5px] text-muted-foreground'
						]}
						onchange={(e) => onaccion('asignar', e.currentTarget.value || null)}
					>
						<option value="">Sin responsable</option>
						{#each buzon.equipo as p (p.id)}
							<option value={p.id}>{p.nombre} {p.apellidos}</option>
						{/each}
					</select>
				</label>
			</span>

			<!--
				La píldora ES el control: lleva encima un `input[type=date]` invisible que abre el
				selector nativo al pulsarla. Así se edita la fecha sin meter un campo nativo con su
				`dd/mm/aaaa` en la fila de acciones, que era lo que afeaba la tarjeta grande y
				además repetía un dato que ya estaba aquí.
			-->
			{#if vence}
				<label
					class={[
						'relative ml-auto inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-semibold',
						vence.vencida
							? 'bg-destructive/12 text-destructive'
							: vence.pronto
								? 'bg-warm/20 text-warm-foreground dark:text-warm'
								: 'bg-muted text-muted-foreground',
						grande && 'cursor-pointer focus-within:ring-2 focus-within:ring-ring'
					]}
					title={aviso.vence_at
						? new Date(aviso.vence_at).toLocaleDateString('es-ES', {
								day: 'numeric',
								month: 'long',
								year: 'numeric'
							})
						: undefined}
				>
					<Calendar class="size-3" />
					<!--
						En una fecha pasada o inminente el texto relativo es el dato («venció hace 2
						días»); una fecha suelta como «13 ago» ahí se lee mal y encima se confunde
						con el «hace 2 h» de la línea de abajo.
					-->
					{grande || vence.pronto ? vence.texto : vence.corto}
					{#if grande}
						<span class="sr-only">Cambiar la fecha límite de «{aviso.titulo}»</span>
						<input
							type="date"
							value={fechaInput}
							class="absolute inset-0 cursor-pointer opacity-0"
							onclick={(e) => (e.currentTarget as any).showPicker?.()}
							onchange={(e) => onaccion('vence', e.currentTarget.value || null)}
						/>
					{/if}
				</label>
			{:else if grande}
				<label
					class="relative ml-auto inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-border px-2.5 text-[11.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-within:ring-2 focus-within:ring-ring"
				>
					<Calendar class="size-3" />
					Poner fecha
					<span class="sr-only">Fecha límite de «{aviso.titulo}»</span>
					<input
						type="date"
						class="absolute inset-0 cursor-pointer opacity-0"
						onclick={(e) => (e.currentTarget as any).showPicker?.()}
						onchange={(e) => onaccion('vence', e.currentTarget.value || null)}
					/>
				</label>
			{/if}
		</div>
	{/if}

	<!-- Procedencia: quién lo apuntó, sobre qué, y cuándo -->
	<div
		class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-none text-muted-foreground"
	>
		{#if autor}<span class="font-medium text-foreground/75">{autor.nombre}</span>
			<span class="text-muted-foreground/40">·</span>{/if}
		{#if aviso.recurso_nombre}
			<a
				href={`/admin/recursos?buscar=${encodeURIComponent(aviso.recurso_id ?? '')}`}
				class="max-w-[14rem] truncate underline-offset-2 hover:text-foreground hover:underline"
			>
				{aviso.recurso_nombre}
			</a>
			<span class="text-muted-foreground/40">·</span>
		{:else if aviso.senal}
			<a
				href={`/admin/recursos?pendiente=${aviso.senal}`}
				class="underline-offset-2 hover:text-foreground hover:underline"
			>
				ver los afectados
			</a>
			<span class="text-muted-foreground/40">·</span>
		{/if}
		<span>{haceCuanto(aviso.created_at)}</span>
	</div>

	<!-- Acciones. La principal es cerrar la fila; lo demás se aparta -->
	<div class="flex flex-wrap items-center gap-1.5">
		{#if hecha}
			<button
				type="button"
				class="toque inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12.5px] font-medium transition-colors hover:bg-accent"
				onclick={() => onaccion('reabrir')}
			>
				<RotateCcw class="size-3.5" /> Reabrir
			</button>
		{:else}
			<button
				type="button"
				class="toque inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3.5 text-[12.5px] font-semibold text-background transition-opacity hover:opacity-90"
				onclick={() => onaccion('hecha')}
			>
				<Check class="size-3.5" />
				{esTarea ? 'Marcar hecha' : 'Archivar'}
			</button>
			{#if sinLeer}
				<button
					type="button"
					class="toque inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-[12.5px] font-medium transition-colors hover:bg-accent"
					onclick={() => onaccion('leido', 'si')}
				>
					<Bell class="size-3.5" /> Leído
				</button>
			{/if}
		{/if}

		<button
			type="button"
			class="toque ml-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
			onclick={() => onaccion('borrar')}
			aria-label={`Borrar «${aviso.titulo}»`}
		>
			<Trash2 class="size-3.5" />
		</button>
	</div>
</article>
