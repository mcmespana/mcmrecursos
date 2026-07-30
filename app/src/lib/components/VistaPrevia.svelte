<script lang="ts">
	import { proporcionVistaPrevia, type ClaveFormato } from '$lib/catalogo/formatos';
	import { Button } from '$lib/components/ui/button';
	import { ExternalLink, X } from '@lucide/svelte';

	/**
	 * Vistazo al recurso sin salir del banco (SPEC-011 §Vista previa).
	 *
	 * Es deliberadamente un vistazo: sirve para decidir «sí, esta es la sesión que buscaba», no
	 * para leerla entera. De ahí que el botón de abrir en su sitio esté siempre a la vista, y que
	 * el marco no ocupe la pantalla completa.
	 *
	 * Si el sitio se negara a dejarse empotrar, el marco se queda en blanco: por eso hay un botón
	 * de abrir justo debajo, y por eso esto nunca sustituye al botón principal de la ficha. No se
	 * intenta detectar el bloqueo, porque un `<iframe>` a otro dominio no se puede inspeccionar y
	 * el `load` también salta con su página de error: cualquier detección sería mentira a medias.
	 */
	let {
		url,
		formato = null,
		nombre = 'el recurso',
		nombreTransicion = null,
		onabrir,
		oncerrar
	}: {
		/** URL empotrable, la que devuelve `urlVistaPrevia()`. */
		url: string;
		formato?: ClaveFormato | null;
		nombre?: string;
		/** `view-transition-name` del marco, para que la miniatura de la tarjeta aterrice aquí. */
		nombreTransicion?: string | null;
		onabrir: () => void;
		oncerrar?: () => void;
	} = $props();

	const proporcion = $derived(proporcionVistaPrevia(formato));
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center gap-2">
		<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Vista previa</p>
		{#if oncerrar}
			<button
				type="button"
				class="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
				onclick={oncerrar}
			>
				<X class="size-3" /> Ocultar
			</button>
		{/if}
	</div>

	<div
		class={`w-full overflow-hidden rounded-xl border bg-muted/40 ${proporcion}`}
		style={nombreTransicion ? `view-transition-name: ${nombreTransicion}` : undefined}
	>
		<!--
			Sin `referrerpolicy`: los visores de Google miran de dónde viene la petición, y
			cortarles el referente es la forma más tonta de romper justo esto. Con el `sandbox`,
			en cambio, se gana algo real — sin `allow-top-navigation`, lo empotrado no puede
			secuestrar la pestaña del banco. `allow-same-origin` es imprescindible (el visor
			necesita su propio origen para la sesión) y no debilita nada aquí, porque lo empotrado
			es de otro dominio.
		-->
		<iframe
			src={url}
			title={`Vista previa de ${nombre}`}
			class="size-full"
			loading="lazy"
			allow="fullscreen"
			sandbox="allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox"
		></iframe>
	</div>

	<!--
		El botón va DEBAJO del marco a propósito: ahí es donde acaban los ojos después de echar
		el vistazo, y en móvil el botón principal de la ficha ya se ha quedado muy arriba. Es
		además la salida cuando el marco sale en blanco porque el sitio no se deja empotrar.
	-->
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
		<Button variant="outline" size="sm" onclick={onabrir}>
			<ExternalLink class="size-3.5" /> Abrir para leerlo entero
		</Button>
		<p class="text-xs text-muted-foreground">
			Esto es solo un vistazo. Si no se ve nada, ábrelo aquí.
		</p>
	</div>
</div>
