<script lang="ts">
	import { navigating } from '$app/state';
	import { fade } from 'svelte/transition';

	/**
	 * Barra de progreso de navegación.
	 *
	 * Entre que pulsas un enlace y llega la página nueva hay un hueco en el que la app parece
	 * congelada: no cambia nada en pantalla. Esta barra llena ese hueco. No mide el progreso
	 * real (no se puede saber), avanza rápido al principio y se va frenando; al llegar la
	 * página, salta al 100 % y desaparece.
	 */
	let progreso = $state(0);
	let visible = $state(false);

	$effect(() => {
		if (!navigating.to) return;

		visible = true;
		progreso = 8;
		// arranque decidido y freno asintótico: nunca llega al 100 % por su cuenta
		const avance = setInterval(() => {
			progreso = Math.min(progreso + Math.max(0.4, (92 - progreso) / 12), 92);
		}, 120);

		return () => {
			clearInterval(avance);
			progreso = 100;
			const fin = setTimeout(() => {
				visible = false;
				progreso = 0;
			}, 260);
			return () => clearTimeout(fin);
		};
	});
</script>

{#if visible}
	<div
		class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
		role="progressbar"
		aria-label="Cargando página"
		aria-valuemin={0}
		aria-valuemax={100}
		aria-valuenow={Math.round(progreso)}
		out:fade={{ duration: 200 }}
	>
		<div
			class="h-full bg-primary shadow-[0_0_8px_var(--primary)] transition-[width] duration-200 ease-out"
			style={`width: ${progreso}%`}
		></div>
	</div>
{/if}
