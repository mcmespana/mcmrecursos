<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Check, MapPin } from '@lucide/svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	/**
	 * «¿De qué MCM local eres?», una sola vez y sin insistir.
	 *
	 * Tres cosas que estaban mal y se arreglan aquí:
	 *
	 * 1. **`localStorage` se leía al inicializar el componente**, que corre también en el
	 *    servidor: bastaba con que algo lo renderizara en SSR para tumbar la página entera con
	 *    `ReferenceError: localStorage is not defined`. Ahora no se toca `localStorage` en ningún
	 *    momento.
	 * 2. **El «ahora no» se recordaba por dispositivo.** Decías que no en el portátil y te lo
	 *    preguntaba otra vez en el móvil, y de nuevo al vaciar el navegador. Una preferencia sobre
	 *    si molestar a alguien vive con la persona, así que va a `perfil.onboarding_mcm_omitido`
	 *    (migración 00027).
	 * 3. **El cierre dependía de que el refresco llegara.** Se cerraba y se volvía a abrir en
	 *    cuanto el `load` devolvía el perfil sin actualizar todavía, y desde fuera eso se ve como
	 *    «le doy al botón y no pasa nada». Ahora se cierra en el acto y el refresco solo confirma.
	 */
	let {
		supabase,
		perfilId,
		mcmLocales
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		perfilId: string;
		mcmLocales: { id: string; nombre: string }[];
	} = $props();

	/**
	 * Manda la decisión de quien mira, no el `load`. En cuanto se pulsa algo esto se pone a false
	 * y el diálogo no vuelve, pase lo que pase con el refresco.
	 */
	let cerrado = $state(false);
	let guardando = $state<string | null>(null);

	async function elegir(id: string, nombre: string) {
		guardando = id;
		const { error } = await supabase
			.from('perfil')
			.update({ mcm_local_id: id, onboarding_mcm_omitido: true })
			.eq('id', perfilId);
		guardando = null;
		if (error) {
			toast.error('No se pudo guardar tu MCM local', { description: error.message });
			return;
		}
		cerrado = true;
		toast.success(`Guardado: ${nombre}`);
		invalidate('supabase:auth');
	}

	/** «Ahora no» = no volver a preguntar. Nunca más, en ningún dispositivo. */
	async function ahoraNo() {
		cerrado = true;
		const { error } = await supabase
			.from('perfil')
			.update({ onboarding_mcm_omitido: true })
			.eq('id', perfilId);
		if (error) {
			// que no se pueda guardar la preferencia no es motivo para volver a dar la lata ahora
			console.warn('No se pudo guardar «ahora no»', error.message);
			return;
		}
		invalidate('supabase:auth');
	}
</script>

<Dialog.Root open={!cerrado} onOpenChange={(o) => !o && ahoraNo()}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="font-display text-xl">¿De qué MCM local eres?</Dialog.Title>
			<Dialog.Description>
				Solo sirve para saber de dónde viene cada recurso. Se cambia cuando quieras desde tu cuenta.
			</Dialog.Description>
		</Dialog.Header>

		<!--
			«Ahora no» va PRIMERO y con el mismo peso que las demás: es una pregunta que nadie ha
			pedido responder, aparece nada más entrar y lo que más se quiere hacer con ella es
			quitársela de encima. Enterrada abajo en gris era una turra.
		-->
		<div class="flex flex-col gap-2">
			<Button variant="outline" class="justify-start" onclick={ahoraNo}>
				<Check class="size-4 text-muted-foreground" />
				Ahora no, y no me lo preguntes más
			</Button>

			<div class="flex items-center gap-2 py-0.5">
				<span class="h-px flex-1 bg-border"></span>
				<span class="text-[11px] tracking-wide text-muted-foreground uppercase">o elige</span>
				<span class="h-px flex-1 bg-border"></span>
			</div>

			{#each mcmLocales as local (local.id)}
				<Button
					variant="outline"
					class="justify-start"
					disabled={!!guardando}
					cargando={guardando === local.id}
					textoCargando="Guardando…"
					onclick={() => elegir(local.id, local.nombre)}
				>
					<MapPin class="size-4 text-primary" />
					{local.nombre}
				</Button>
			{/each}
		</div>
	</Dialog.Content>
</Dialog.Root>
