<script lang="ts">
	import { buzon, type Prioridad, type TipoAviso } from '$lib/avisos/estado.svelte';
	import { toast } from 'svelte-sonner';
	import { Calendar, Flag, MessageSquare, Plus, SendHorizonal, SquareCheckBig, User, X } from '@lucide/svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	/**
	 * Escribir un aviso (SPEC-016 §compositor).
	 *
	 * Está plegado a una línea punteada mientras no se usa, porque el buzón es para leer: un
	 * formulario permanente con cuatro campos le robaría la mitad del panel a la lista. Al abrirlo
	 * solo hay una cosa obligatoria —qué pasa— y responsable, fecha y urgencia son chips que se
	 * rellenan **si hacen falta**; pedirlos siempre convertiría «apuntar una cosa» en un trámite,
	 * que es exactamente lo que hace que la gente siga usando el WhatsApp.
	 *
	 * Al enviar se conserva el tipo, para apuntar varias cosas seguidas sin recolocar nada.
	 */
	let {
		supabase,
		autofoco = false
	}: { supabase: SupabaseClient<any, 'recursos'>; autofoco?: boolean } = $props();

	let abierto = $state(false);
	let texto = $state('');
	let tipo = $state<TipoAviso>('tarea');
	let prioridad = $state<Prioridad>('normal');
	let responsable = $state<string | null>(null);
	let vence = $state('');
	let enviando = $state(false);
	let campo = $state<HTMLTextAreaElement | null>(null);

	const puedeEnviar = $derived(texto.trim().length > 0 && !enviando);

	function abrir() {
		abierto = true;
		queueMicrotask(() => campo?.focus());
	}

	function cerrar() {
		abierto = false;
		texto = '';
		prioridad = 'normal';
		responsable = null;
		vence = '';
	}

	async function enviar() {
		if (!puedeEnviar) return;
		enviando = true;
		const error = await buzon.crear(supabase, {
			titulo: texto.trim(),
			tipo,
			prioridad,
			asignada_a: responsable,
			// la BD guarda timestamptz; una fecha suelta se ancla al final del día que se eligió
			vence_at: vence ? new Date(`${vence}T23:59:59`).toISOString() : null
		});
		enviando = false;
		if (error) {
			toast.error('No se pudo apuntar', { description: error });
			return;
		}
		// se conserva `tipo` a propósito: apuntar tres tareas seguidas no debería costar tres clics
		texto = '';
		prioridad = 'normal';
		responsable = null;
		vence = '';
		campo?.focus();
	}

	function alTeclear(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			enviar();
		} else if (e.key === 'Escape' && !texto.trim()) {
			cerrar();
		}
	}

	$effect(() => {
		if (autofoco) abrir();
	});

	const nombreResponsable = $derived(buzon.persona(responsable)?.nombre ?? null);
	const chipBase =
		'toque inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs transition-colors';
</script>

{#if !abierto}
	<button
		type="button"
		class="toque flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3.5 py-3 text-left text-[13.5px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground"
		onclick={abrir}
	>
		<Plus class="size-4" /> Apuntar algo para el equipo…
	</button>
{:else}
	<div
		class="flex flex-col rounded-2xl border border-primary/45 bg-card ring-4 ring-primary/10"
	>
		<!-- Tipo: lo que decide si esto se hace o solo se lee -->
		<div class="flex items-center gap-1 px-2.5 pt-2.5">
			<button
				type="button"
				class={[
					chipBase,
					tipo === 'tarea'
						? 'bg-warm/20 font-semibold text-warm-foreground dark:text-warm'
						: 'font-medium text-muted-foreground hover:bg-accent'
				]}
				onclick={() => (tipo = 'tarea')}
			>
				<SquareCheckBig class="size-3.5" /> Tarea
			</button>
			<button
				type="button"
				class={[
					chipBase,
					tipo === 'aviso'
						? 'bg-primary/12 font-semibold text-primary'
						: 'font-medium text-muted-foreground hover:bg-accent'
				]}
				onclick={() => (tipo = 'aviso')}
			>
				<MessageSquare class="size-3.5" /> Aviso
			</button>
			<button
				type="button"
				class="toque ml-auto inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				onclick={cerrar}
				aria-label="Cerrar el compositor"
			>
				<X class="size-4" />
			</button>
		</div>

		<textarea
			bind:this={campo}
			bind:value={texto}
			onkeydown={alTeclear}
			rows="2"
			placeholder={tipo === 'tarea' ? 'Qué hay que hacer…' : 'Qué tiene que saber el equipo…'}
			class="resize-none bg-transparent px-3.5 pt-2 pb-1 text-[13.5px]/[1.55] outline-none placeholder:text-muted-foreground/60"
		></textarea>

		<!-- Chips opcionales: solo se rellenan si hacen falta -->
		<div class="flex flex-wrap items-center gap-1.5 px-3 pb-1">
			<label class={[chipBase, responsable ? 'bg-muted' : 'border border-dashed border-border']}>
				<User class="size-3.5 text-muted-foreground" />
				<span class="sr-only">Responsable</span>
				<select
					bind:value={responsable}
					class="cursor-pointer bg-transparent text-xs outline-none"
					class:font-semibold={!!responsable}
				>
					<option value={null}>Responsable</option>
					{#each buzon.equipo as p (p.id)}
						<option value={p.id}>{p.nombre} {p.apellidos}</option>
					{/each}
				</select>
			</label>

			<label class={[chipBase, vence ? 'bg-muted' : 'border border-dashed border-border']}>
				<Calendar class="size-3.5 text-muted-foreground" />
				<span class="sr-only">Fecha límite</span>
				<input
					type="date"
					bind:value={vence}
					class="cursor-pointer bg-transparent text-xs outline-none"
					class:font-semibold={!!vence}
				/>
			</label>

			<button
				type="button"
				class={[
					chipBase,
					prioridad === 'alta'
						? 'bg-destructive/12 font-semibold text-destructive'
						: 'border border-dashed border-border text-muted-foreground'
				]}
				aria-pressed={prioridad === 'alta'}
				onclick={() => (prioridad = prioridad === 'alta' ? 'normal' : 'alta')}
			>
				<Flag class="size-3.5" /> Urgente
			</button>
		</div>

		<div
			class="mt-1.5 flex items-center gap-2 rounded-b-[15px] border-t border-border bg-primary/[0.04] px-3 py-2"
		>
			<p class="text-[11.5px] leading-tight text-muted-foreground">
				{#if nombreResponsable}
					Para <span class="font-semibold text-foreground">{nombreResponsable}</span>
				{:else}
					Lo verá todo el equipo
				{/if}
				<span class="text-muted-foreground/60"> · Intro para enviar</span>
			</p>
			<button
				type="button"
				disabled={!puedeEnviar}
				class="toque ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
				onclick={enviar}
			>
				<SendHorizonal class="size-3.5" />
				{enviando ? 'Apuntando…' : 'Apuntar'}
			</button>
		</div>
	</div>
{/if}
