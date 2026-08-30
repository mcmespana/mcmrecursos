<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { comunidad } from '$lib/comunidad/estado.svelte';
	import { socialLocal } from '$lib/social/local.svelte';
	import { fly, fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { ArrowRight, BellRing, Check, HandHeart, Lightbulb, Send, Sparkles } from '@lucide/svelte';

	/**
	 * «¡Has llegado muy pronto!» — la puerta de la lista de espera (SPEC-017 §1).
	 *
	 * El banco está entero y el catálogo todavía no. Quien entra hoy ve una herramienta que
	 * funciona sobre casi nada, y sin esto se va sin dejar rastro. Este modal convierte esa
	 * visita en un correo al que avisar, y de paso pregunta lo único que de verdad hace falta
	 * ahora mismo: si quiere echar una mano.
	 *
	 * **Un solo campo obligatorio, y es el correo.** Es la decisión de diseño que manda sobre
	 * todo lo demás: cada campo extra en un primer contacto tira la conversión abajo, así que
	 * el nombre no está y lo de «quiero ayudar» es un interruptor apagado que no bloquea nada.
	 * Lo que haga falta saber después se pregunta por correo, cuando ya hay conversación.
	 *
	 * Dos pasos y no dos diálogos: el «hecho» tiene trabajo que hacer —recordar que ya se
	 * pueden enviar recursos sin esperar a nadie— y encadenar un segundo modal para eso sería
	 * pedir dos veces la misma atención.
	 */

	let { total = 0 }: { total?: number } = $props();

	type Paso = 'formulario' | 'hecho';
	let paso = $state<Paso>('formulario');

	let email = $state('');
	let quiereAyudar = $state(false);
	let ayudas = $state<string[]>([]);
	let enviando = $state(false);
	let error = $state<string | null>(null);
	let yaEstaba = $state(false);
	let campo = $state<HTMLInputElement | null>(null);

	const AYUDAS = [
		{ clave: 'aportar', etiqueta: 'Aportando recursos míos', emoji: '📦' },
		{ clave: 'catalogar', etiqueta: 'Catalogando y ordenando', emoji: '🗂️' },
		{ clave: 'probar', etiqueta: 'Probando y dando caña', emoji: '🔍' },
		{ clave: 'difundir', etiqueta: 'Corriendo la voz', emoji: '📣' }
	];

	/**
	 * Validación mínima y a propósito: hay una arroba con algo a cada lado. La estricta rechaza
	 * direcciones legítimas, y el precio de dejar pasar una mala es un aviso que rebota — mucho
	 * más barato que decirle a alguien que su correo «no es válido» cuando lo es.
	 */
	const emailValido = $derived(/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()));

	/**
	 * La prueba social solo cuando suma. «Ya somos 3» resta: dice que no viene nadie. A partir
	 * de una docena, el número empieza a ser un argumento.
	 */
	const enseñarTotal = $derived(total >= 12);

	function alternarAyuda(clave: string) {
		ayudas = ayudas.includes(clave) ? ayudas.filter((a) => a !== clave) : [...ayudas, clave];
		// marcar una forma de ayudar ES decir que sí: obligar además a pulsar el interruptor
		// de arriba sería un paso que no informa de nada
		if (ayudas.length) quiereAyudar = true;
	}

	function alternarInteres() {
		quiereAyudar = !quiereAyudar;
		if (!quiereAyudar) ayudas = [];
	}

	async function apuntarse() {
		if (enviando || !emailValido) return;
		enviando = true;
		error = null;
		try {
			const res = await fetch('/api/espera', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: email.trim(),
					quiereAyudar,
					ayudas,
					origen: 'modal',
					dispositivo: socialLocal.dispositivo || null
				})
			});
			const cuerpo = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(cuerpo?.mensaje ?? 'No se ha podido guardar tu correo');
			yaEstaba = !!cuerpo.yaEstaba;
			comunidad.marcarApuntado();
			paso = 'hecho';
		} catch (e) {
			error = (e as Error).message;
		} finally {
			enviando = false;
		}
	}

	// El foco al campo, pero solo en el paso del formulario y solo con teclado de verdad: en
	// móvil, enfocar de entrada levanta el teclado y tapa el texto que explica por qué se pide
	// el correo, que es justo lo que hay que leer antes de escribirlo.
	$effect(() => {
		if (paso !== 'formulario' || !campo) return;
		if (window.matchMedia('(pointer: coarse)').matches) return;
		campo.focus();
	});

	function cerrar() {
		comunidad.cerrarBienvenida();
	}
</script>

<Dialog.Root
	open={comunidad.bienvenidaAbierta}
	onOpenChange={(abierto) => !abierto && cerrar()}
>
	<Dialog.Content
		class="overflow-hidden p-0 duration-300 sm:max-w-lg"
		showCloseButton={paso === 'formulario'}
	>
		<!--
			Cabecera. Es el único sitio de la app con licencia para celebrar: se ve una vez por
			persona (el nivel «raro / primera vez» del presupuesto de movimiento), así que aquí
			cabe el degradado, el emoji grande y las chispas. En la herramienta —rejilla, filtros,
			ficha— nada de esto tendría sitio.
		-->
		<div class="relative overflow-hidden bg-gradient-to-br from-primary/15 via-accent to-warm/25 px-6 pt-7 pb-6">
			<div class="chispas" aria-hidden="true">
				<span style="--x: 12%; --d: 0ms">✨</span>
				<span style="--x: 33%; --d: 900ms">🌱</span>
				<span style="--x: 68%; --d: 400ms">✨</span>
				<span style="--x: 87%; --d: 1300ms">📚</span>
			</div>

			<div class="relative flex flex-col items-center gap-3 text-center">
				<div
					class="flex size-14 items-center justify-center rounded-2xl bg-background/85 text-3xl shadow-sm ring-1 ring-foreground/5 backdrop-blur"
				>
					{paso === 'formulario' ? '🌱' : '🎉'}
				</div>
				<div class="flex flex-col gap-1.5">
					<p class="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
						Banco de Recursos MCM
					</p>
					<Dialog.Title class="font-display text-[1.75rem] leading-tight font-extrabold text-balance">
						{#if paso === 'formulario'}
							¡Has llegado muy pronto!
						{:else if yaEstaba}
							¡Ya te teníamos!
						{:else}
							¡Hecho! Te avisamos
						{/if}
					</Dialog.Title>
				</div>
			</div>
		</div>

		<!--
			Los dos pasos comparten celda de rejilla para que el que sale y el que entra se
			solapen en vez de empujarse: sin esto, el alto del diálogo pega un salto a mitad de
			la transición. La salida es rápida (110 ms) y la entrada llega un pelo después, así
			que lo que se ve es un relevo, no un parpadeo.
		-->
		<div class="grid px-6 pt-1 pb-6">
			{#key paso}
				<div
					class="col-start-1 row-start-1 flex flex-col gap-4"
					in:fly={{ y: 10, duration: 260, delay: 110, easing: cubicOut }}
					out:fade={{ duration: 110 }}
				>
					{#if paso === 'formulario'}
						<Dialog.Description class="text-center text-[0.95rem] leading-relaxed text-pretty">
							Ya tenemos la estructura del banco montada… <strong class="text-foreground"
								>solo falta el contenido</strong
							>. En las próximas semanas publicaremos todo el material. Si quieres enterarte en
							el primer minuto, deja tu correo y te escribiremos.
						</Dialog.Description>

						<form
							class="flex flex-col gap-2"
							onsubmit={(e) => {
								e.preventDefault();
								apuntarse();
							}}
						>
							<div class="flex gap-2">
								<Input
									bind:ref={campo}
									bind:value={email}
									type="email"
									name="email"
									autocomplete="email"
									inputmode="email"
									placeholder="tu@correo.com"
									aria-label="Tu correo electrónico"
									aria-invalid={error ? 'true' : undefined}
									class="h-11 flex-1 text-base"
									oninput={() => (error = null)}
								/>
								<Button
									type="submit"
									size="lg"
									class="h-11 px-4"
									disabled={!emailValido}
									cargando={enviando}
									textoCargando="Apuntando…"
								>
									Avísame
									<ArrowRight class="size-4" />
								</Button>
							</div>
							{#if error}
								<p class="text-sm text-destructive" transition:fly={{ y: -4, duration: 160 }}>
									{error}
								</p>
							{/if}
						</form>

						<!--
							La segunda pregunta, y va debajo del envío a propósito: quien solo quiere que le
							avisen ya ha terminado arriba. Marcar una casilla de estas no obliga a nada más
							—el correo ya está escrito— así que ampliar aquí no cuesta un paso, cuesta un
							clic.
						-->
						<div class="rounded-xl border bg-muted/40 p-3">
							<button
								type="button"
								class="flex w-full items-start gap-3 text-left"
								aria-pressed={quiereAyudar}
								onclick={alternarInteres}
							>
								<span
									class={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
										quiereAyudar
											? 'border-primary bg-primary text-primary-foreground'
											: 'border-input bg-background'
									}`}
								>
									{#if quiereAyudar}
										<Check class="size-3.5" strokeWidth={3} />
									{/if}
								</span>
								<span class="flex flex-col gap-0.5">
									<span class="flex items-center gap-1.5 text-sm font-semibold">
										<HandHeart class="size-4 text-primary" />
										¿Quieres ayudarnos a construir el banco?
									</span>
									<span class="text-xs leading-relaxed text-muted-foreground">
										Te escribimos a ese mismo correo y lo preparamos juntos.
									</span>
								</span>
							</button>

							{#if quiereAyudar}
								<div
									class="mt-3 flex flex-wrap gap-1.5 border-t pt-3"
									transition:fly={{ y: -6, duration: 200, easing: cubicOut }}
								>
									{#each AYUDAS as a (a.clave)}
										<button
											type="button"
											aria-pressed={ayudas.includes(a.clave)}
											class={`chip ${ayudas.includes(a.clave) ? 'chip-activo' : ''}`}
											onclick={() => alternarAyuda(a.clave)}
										>
											<span aria-hidden="true">{a.emoji}</span>
											{a.etiqueta}
										</button>
									{/each}
								</div>
							{/if}
						</div>

						<div class="flex flex-col gap-2">
							<p class="text-center text-[11px] leading-relaxed text-muted-foreground">
								Solo lo usamos para avisarte del banco. Ni spam, ni terceros, y te puedes borrar
								cuando quieras.
								{#if enseñarTotal}
									<span class="font-medium text-foreground">
										Ya somos {total} esperando.
									</span>
								{/if}
							</p>
							<Button variant="ghost" size="sm" class="self-center" onclick={cerrar}>
								Ahora no, quiero echar un vistazo
							</Button>
						</div>
					{:else}
						<div class="flex flex-col gap-4">
							<p class="text-center text-[0.95rem] leading-relaxed text-pretty">
								{#if yaEstaba}
									Ese correo ya estaba en la lista, así que no hay nada más que hacer: en cuanto
									haya material, eres de los primeros en saberlo.
								{:else}
									Te escribiremos a <strong class="text-foreground">{email.trim()}</strong> en
									cuanto empiece a entrar material. Ni un correo antes.
								{/if}
								{#if quiereAyudar}
									<br />
									<span class="text-primary">
										Y como quieres echar una mano, te escribiremos también para prepararlo
										juntos. 🙌
									</span>
								{/if}
							</p>

							<!--
								El recordatorio que pidió el encargo, y no es un detalle: quien acaba de decir
								«avísame» es exactamente quien más probabilidades tiene de tener ya una carpeta
								de recursos. Enviarlos no depende de que el banco esté lleno — el formulario
								lleva funcionando desde el primer día.
							-->
							<div class="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 p-4">
								<p class="flex items-center gap-1.5 text-sm font-semibold">
									<Sparkles class="size-4 text-primary" />
									¿Y si el material lo tienes tú?
								</p>
								<p class="text-sm leading-relaxed text-muted-foreground">
									No hace falta esperar a nadie: si tienes sesiones, oraciones o vídeos, se
									pueden enviar ahora mismo. Basta con el enlace — del resto nos encargamos.
								</p>
								<div class="flex flex-wrap gap-2 pt-0.5">
									<Button size="sm" href="/enviar" onclick={cerrar}>
										<Send class="size-3.5" /> Enviar un recurso
									</Button>
									<Button
										variant="outline"
										size="sm"
										onclick={() => {
											cerrar();
											comunidad.abrirSugerencias();
										}}
									>
										<Lightbulb class="size-3.5" /> Contarnos una idea
									</Button>
								</div>
							</div>

							<Button variant="ghost" size="sm" class="self-center" onclick={cerrar}>
								<BellRing class="size-3.5" /> Listo, a mirar el banco
							</Button>
						</div>
					{/if}
				</div>
			{/key}
		</div>
	</Dialog.Content>
</Dialog.Root>

<style>
	/* Chispas de fondo: decoración pura, y por eso son las primeras en desaparecer cuando
	   alguien pide menos movimiento. Suben muy despacio y a distintas alturas para que no se
	   lea el patrón. */
	.chispas {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
	}
	.chispas span {
		position: absolute;
		bottom: -1.5rem;
		left: var(--x);
		font-size: 0.95rem;
		opacity: 0;
		animation: subir 7s var(--d) infinite;
	}
	@keyframes subir {
		0% {
			transform: translateY(0) scale(0.8);
			opacity: 0;
		}
		18% {
			opacity: 0.55;
		}
		75% {
			opacity: 0.25;
		}
		100% {
			transform: translateY(-9rem) scale(1.05);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.chispas {
			display: none;
		}
	}

	/* Chips de «cómo quieres ayudar». Sin :hover con dedo: en móvil un toque deja el estado
	   de hover pegado y el chip parece seleccionado sin estarlo. */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--background);
		padding: 0.3rem 0.7rem;
		font-size: 0.78rem;
		line-height: 1.2;
		transition:
			background-color 150ms var(--ease-brio),
			border-color 150ms var(--ease-brio),
			transform 150ms var(--ease-brio);
	}
	.chip:active {
		transform: scale(0.96);
	}
	@media (hover: hover) and (pointer: fine) {
		.chip:hover {
			background: var(--accent);
		}
	}
	.chip-activo {
		border-color: color-mix(in oklab, var(--primary) 45%, transparent);
		background: color-mix(in oklab, var(--primary) 12%, transparent);
		color: var(--primary);
		font-weight: 600;
	}
</style>
