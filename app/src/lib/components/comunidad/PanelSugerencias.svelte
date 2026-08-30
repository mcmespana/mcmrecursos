<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { comunidad } from '$lib/comunidad/estado.svelte';
	import FormularioSugerencia from './FormularioSugerencia.svelte';

	/**
	 * El buzón, en diálogo. Solo pone marco y título: el formulario y todas sus decisiones
	 * viven en `FormularioSugerencia`, que es también el de la página `/sugerencias`.
	 */

	let formulario = $state<ReturnType<typeof FormularioSugerencia> | null>(null);

	function cerrar() {
		comunidad.cerrarSugerencias();
		// Se vacía DESPUÉS de la animación de salida: limpiarlo en el acto enseña el formulario
		// en blanco durante los 200 ms que el diálogo tarda en irse, que se lee como un fallo.
		setTimeout(() => formulario?.reiniciar(), 260);
	}
</script>

<Dialog.Root open={comunidad.sugerenciasAbierto} onOpenChange={(abierto) => !abierto && cerrar()}>
	<Dialog.Content class="gap-0 p-0 duration-200 sm:max-w-md">
		<div class="flex flex-col gap-4 p-6">
			<Dialog.Header class="gap-1.5 p-0 text-left">
				<Dialog.Title class="font-display text-xl font-bold">¿Qué nos quieres contar?</Dialog.Title>
				<Dialog.Description class="text-sm leading-relaxed">
					El banco está en obras y se nota. Cualquier cosa que veas —una idea, un fallo, un
					recurso que echas en falta— nos sirve.
				</Dialog.Description>
			</Dialog.Header>
			<FormularioSugerencia bind:this={formulario} />
		</div>
	</Dialog.Content>
</Dialog.Root>
