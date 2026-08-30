<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { socialLocal } from '$lib/social/local.svelte';
	import { page } from '$app/state';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Check, Send } from '@lucide/svelte';

	/**
	 * El formulario del buzón (SPEC-017 §2), sin envoltorio: lo usan tal cual el panel flotante
	 * y la página `/sugerencias`. Un solo sitio donde arreglar el día que cambie algo.
	 *
	 * Tres decisiones que son el componente entero:
	 *
	 * 1. **El correo es opcional.** Pedirlo para avisar de que un botón no funciona es el peaje
	 *    que hace que nadie avise. Quien quiera respuesta lo deja; quien solo quiera contarlo,
	 *    no. El aviso llega igual.
	 * 2. **El tipo se elige primero y abre el resto.** No es un desplegable escondido entre
	 *    campos: es la pregunta que decide qué se está contando, y saberlo cambia el marcador
	 *    de posición del texto, la prioridad con la que entra en el buzón del equipo y qué se
	 *    contesta. Elegirlo revela el área de texto, así que el formulario empieza teniendo un
	 *    solo elemento y no cinco.
	 * 3. **La ruta viaja sola.** Un «esto no va» sin saber desde qué pantalla se envió obliga a
	 *    escribir de vuelta para preguntarlo. Va en el envío y no se le pide a nadie.
	 */

	type Tipo = 'idea' | 'problema' | 'falta' | 'otro';

	let {
		/** Enfocar el área de texto al elegir tipo. Se apaga en la página, donde no hay prisa. */
		enfocar = true,
		onhecho
	}: { enfocar?: boolean; onhecho?: () => void } = $props();

	const TIPOS: { clave: Tipo; emoji: string; etiqueta: string; pista: string }[] = [
		{
			clave: 'idea',
			emoji: '💡',
			etiqueta: 'Una idea',
			pista: '«Estaría bien poder filtrar por duración…» — cuenta qué te ayudaría y para qué.'
		},
		{
			clave: 'problema',
			emoji: '🐛',
			etiqueta: 'Algo no funciona',
			pista: '¿Qué hiciste y qué esperabas que pasara? Con eso solemos tener bastante.'
		},
		{
			clave: 'falta',
			emoji: '🔎',
			etiqueta: 'Falta un recurso',
			pista: '¿Qué buscabas y no encontraste? Nos sirve para saber por dónde seguir.'
		},
		{
			clave: 'otro',
			emoji: '💬',
			etiqueta: 'Otra cosa',
			pista: 'Lo que sea. Se lee todo.'
		}
	];

	let tipo = $state<Tipo | null>(null);
	let mensaje = $state('');
	let email = $state('');
	let quiereRespuesta = $state(false);
	let enviando = $state(false);
	let hecho = $state(false);
	let error = $state<string | null>(null);
	let area = $state<HTMLTextAreaElement | null>(null);

	const elegido = $derived(TIPOS.find((t) => t.clave === tipo) ?? null);
	const listo = $derived(!!tipo && mensaje.trim().length >= 3);
	const emailValido = $derived(!email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()));

	function elegir(t: Tipo) {
		tipo = t;
		error = null;
		if (enfocar) queueMicrotask(() => area?.focus());
	}

	export function reiniciar() {
		tipo = null;
		mensaje = '';
		email = '';
		quiereRespuesta = false;
		hecho = false;
		error = null;
	}

	async function enviar() {
		if (enviando || !listo || !emailValido) return;
		enviando = true;
		error = null;
		try {
			const res = await fetch('/api/sugerencias', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					tipo,
					mensaje: mensaje.trim(),
					email: quiereRespuesta && email.trim() ? email.trim() : null,
					ruta: page.url.pathname + page.url.search,
					dispositivo: socialLocal.dispositivo || null
				})
			});
			const cuerpo = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(cuerpo?.mensaje ?? 'No se ha podido enviar');
			hecho = true;
			onhecho?.();
		} catch (e) {
			error = (e as Error).message;
		} finally {
			enviando = false;
		}
	}
</script>

{#if !hecho}
	<div class="flex flex-col gap-4">
		<div class="grid grid-cols-2 gap-2">
			{#each TIPOS as t (t.clave)}
				<button
					type="button"
					class={`tarjeta ${tipo === t.clave ? 'tarjeta-activa' : ''}`}
					aria-pressed={tipo === t.clave}
					onclick={() => elegir(t.clave)}
				>
					<span class="text-lg leading-none" aria-hidden="true">{t.emoji}</span>
					<span class="text-[0.82rem] leading-tight font-medium">{t.etiqueta}</span>
				</button>
			{/each}
		</div>

		{#if elegido}
			<div class="flex flex-col gap-3" transition:fly={{ y: -8, duration: 220, easing: cubicOut }}>
				<Textarea
					bind:ref={area}
					bind:value={mensaje}
					rows={4}
					maxlength={4000}
					placeholder={elegido.pista}
					aria-label="Tu sugerencia"
					class="resize-none text-sm leading-relaxed"
					oninput={() => (error = null)}
				/>

				{#if quiereRespuesta}
					<div class="flex flex-col gap-1" transition:fly={{ y: -6, duration: 180, easing: cubicOut }}>
						<Input
							bind:value={email}
							type="email"
							autocomplete="email"
							placeholder="tu@correo.com"
							aria-label="Tu correo, para responderte"
							aria-invalid={!emailValido ? 'true' : undefined}
							class="h-9"
						/>
						<p class="text-[11px] text-muted-foreground">
							Solo para contestarte a esto. Si lo dejas en blanco, lo leemos igual.
						</p>
					</div>
				{:else}
					<button
						type="button"
						class="self-start text-xs text-primary underline-offset-4 hover:underline"
						onclick={() => (quiereRespuesta = true)}
					>
						Quiero que me contestéis
					</button>
				{/if}

				{#if error}
					<p class="text-sm text-destructive" transition:fade={{ duration: 140 }}>{error}</p>
				{/if}

				<div class="flex items-center justify-between gap-2">
					<span class="text-[11px] tabular-nums text-muted-foreground">
						{mensaje.trim().length ? `${mensaje.trim().length} caracteres` : ''}
					</span>
					<Button
						disabled={!listo || !emailValido}
						cargando={enviando}
						textoCargando="Enviando…"
						onclick={enviar}
					>
						<Send class="size-4" /> Enviar
					</Button>
				</div>
			</div>
		{/if}
	</div>
{:else}
	<!--
		El «hecho». Aquí sí hay celebración: mandar una sugerencia es un acto raro y generoso, y
		el silencio después de pulsar «Enviar» es lo que hace pensar que no ha servido de nada.
	-->
	<div
		class="flex flex-col items-center gap-3 py-4 text-center"
		in:fly={{ y: 8, duration: 260, easing: cubicOut }}
	>
		<span class="marca-hecho">
			<Check class="size-6" strokeWidth={3} />
		</span>
		<p class="font-display text-xl font-bold">¡Recibido! Gracias 🙌</p>
		<p class="max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground">
			Lo leemos todo, de verdad: el buzón cae en la misma pantalla en la que trabajamos.
			{#if quiereRespuesta && email.trim()}
				Te contestamos a <strong class="text-foreground">{email.trim()}</strong>.
			{/if}
		</p>
		<Button variant="outline" size="sm" onclick={reiniciar}>Contar otra cosa</Button>
	</div>
{/if}

<style>
	.tarjeta {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.4rem;
		border-radius: var(--radius-lg);
		border: 1px solid var(--border);
		background: var(--card);
		padding: 0.7rem 0.75rem;
		text-align: left;
		transition:
			border-color 150ms var(--ease-brio),
			background-color 150ms var(--ease-brio),
			transform 150ms var(--ease-brio);
	}
	.tarjeta:active {
		transform: scale(0.975);
	}
	@media (hover: hover) and (pointer: fine) {
		.tarjeta:hover {
			background: var(--accent);
		}
	}
	.tarjeta-activa {
		border-color: color-mix(in oklab, var(--primary) 55%, transparent);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		color: var(--primary);
	}

	/* El check entra creciendo desde 0.6, no desde 0: nada aparece de la nada. */
	.marca-hecho {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--primary) 14%, transparent);
		color: var(--primary);
		animation: brote 320ms var(--ease-brio) both;
	}
	@keyframes brote {
		from {
			transform: scale(0.6);
			opacity: 0;
		}
		to {
			transform: scale(1);
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.marca-hecho {
			animation: none;
		}
	}
</style>
