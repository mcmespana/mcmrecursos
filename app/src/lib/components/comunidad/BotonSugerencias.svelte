<script lang="ts">
	import { comunidad } from '$lib/comunidad/estado.svelte';
	import { MessageCirclePlus } from '@lucide/svelte';

	/**
	 * El botón flotante del buzón. Un buzón que no se ve no recibe nada, y el enlace del pie
	 * solo lo encuentra quien ya baja hasta el pie — que no es quien acaba de tropezar con algo
	 * raro a media pantalla.
	 *
	 * Cómo se gana el sitio que ocupa, que es la única pregunta que importa en un flotante:
	 *
	 * · **Es un círculo**, no una pastilla con texto. El texto solo aparece al pasar el ratón
	 *   (con ratón de verdad: `hover: hover`), donde no le quita el sitio a nada. En móvil,
	 *   donde el ancho es oro, son 44 px y ya está.
	 * · **Se aparta al hacer scroll hacia abajo** y vuelve al subir, como la cabecera de tantas
	 *   apps: mientras se recorre la rejilla no estorba la esquina, y en cuanto se para o se
	 *   sube —que es cuando alguien decide contar algo— está ahí.
	 * · **No sale en el panel**: el equipo tiene su propio buzón de avisos y tareas (SPEC-016),
	 *   y este va a otra bandeja. Eso lo decide quien lo monta, en el layout.
	 */

	let escondido = $state(false);
	let ultimoY = 0;

	function alScroll() {
		const y = window.scrollY;
		// el umbral de 8 px evita el parpadeo con los rebotes del scroll en móvil
		if (Math.abs(y - ultimoY) > 8) {
			escondido = y > ultimoY && y > 240;
			ultimoY = y;
		}
	}
</script>

<svelte:window onscroll={alScroll} />

<button
	type="button"
	class={`flotante ${escondido ? 'flotante-fuera' : ''}`}
	aria-label="Enviar una sugerencia o avisar de un problema"
	onclick={() => comunidad.abrirSugerencias()}
>
	<MessageCirclePlus class="size-[18px] shrink-0" />
	<span class="etiqueta">Sugerencias</span>
</button>

<style>
	.flotante {
		position: fixed;
		right: 1rem;
		bottom: 1rem;
		z-index: 30;
		display: inline-flex;
		align-items: center;
		gap: 0;
		height: 2.75rem;
		min-width: 2.75rem;
		padding: 0 0.8rem;
		border-radius: 999px;
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		background: var(--card);
		color: var(--primary);
		box-shadow: 0 6px 20px -8px color-mix(in oklab, var(--foreground) 45%, transparent);
		/* Entrar/salir y comprimir: `--ease-brio`, 200 ms. Se nombran las propiedades una a una
		   porque `transition: all` acaba animando cosas que nadie pidió (el color del foco, el
		   ancho al cambiar de idioma) y cuesta cuadros. */
		transition:
			transform 220ms var(--ease-brio),
			opacity 220ms var(--ease-brio),
			background-color 150ms var(--ease-brio),
			gap 200ms var(--ease-brio);
	}
	.flotante:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}
	.flotante:active {
		transform: scale(0.94);
	}
	.flotante-fuera {
		transform: translateY(5rem);
		opacity: 0;
		pointer-events: none;
	}

	/* La etiqueta se despliega desde ancho cero: sin `hidden`, para que el lector de pantalla
	   la siga leyendo y el botón tenga nombre accesible también con el texto plegado. */
	.etiqueta {
		max-width: 0;
		overflow: hidden;
		white-space: nowrap;
		font-size: 0.82rem;
		font-weight: 600;
		opacity: 0;
		transition:
			max-width 200ms var(--ease-brio),
			opacity 160ms var(--ease-brio);
	}

	@media (hover: hover) and (pointer: fine) {
		.flotante:hover {
			background: color-mix(in oklab, var(--primary) 10%, var(--card));
			gap: 0.45rem;
		}
		.flotante:hover .etiqueta {
			max-width: 8rem;
			opacity: 1;
		}
	}

	/* Con el teclado también se despliega: si no, quien tabula hasta aquí ve un círculo mudo. */
	.flotante:focus-visible {
		gap: 0.45rem;
	}
	.flotante:focus-visible .etiqueta {
		max-width: 8rem;
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.flotante,
		.etiqueta {
			transition: none;
		}
	}
</style>
