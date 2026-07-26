<script lang="ts">
	import { FORMATOS, formatoEfectivo, type ClaveFormato } from '$lib/catalogo/formatos';
	import { cn } from '$lib/utils';

	let {
		enlace = null,
		formato = null,
		neutro = false,
		class: className = 'size-4'
	}: {
		/** Enlace del archivo: si no se pasa `formato`, se deduce de aquí. */
		enlace?: string | null;
		/** Formato ya conocido (columna `formato`), que manda sobre la deducción. */
		formato?: string | null;
		/** true = hereda el color del contenedor (sobre fondos de color, p. ej. un botón). */
		neutro?: boolean;
		class?: string;
	} = $props();

	const clave = $derived(formatoEfectivo(enlace, formato) as ClaveFormato | null);
	const info = $derived(clave ? FORMATOS[clave] : null);
</script>

{#if info?.marcaDrive}
	<!-- Marca de Google Drive: el triángulo partido en tres. -->
	<svg
		viewBox="0 0 24 24"
		class={className}
		role="img"
		aria-label="Google Drive"
		fill="none"
		stroke="none"
	>
		<path d="M8.6 2.5h6.8l6.6 11.4h-6.8L8.6 2.5Z" fill="#FBBC04" />
		<path d="M8.6 2.5 2 13.9l3.4 5.9 6.6-11.4-3.4-5.9Z" fill="#4285F4" />
		<path d="M5.4 19.8h13.2l3.4-5.9H8.8l-3.4 5.9Z" fill="#34A853" />
	</svg>
{:else if info}
	{@const Icono = info.icono}
	<Icono class={cn(neutro ? '' : info.color, className)} aria-label={info.etiqueta} />
{/if}
