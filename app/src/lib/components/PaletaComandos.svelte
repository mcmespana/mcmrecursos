<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Search } from '@lucide/svelte';

	/**
	 * Paleta de comandos (⌘K / Ctrl+K / `/`): el disparador.
	 *
	 * Este componente vive en la cabecera de TODAS las páginas, así que se queda con lo mínimo —dos
	 * botones y el atajo de teclado— y el diálogo de verdad (`PaletaDialogo.svelte`, con la
	 * primitiva `Command` y la lista de recursos) se carga con `import()` la primera vez que alguien
	 * la abre. Antes viajaba en el paquete del layout: lo descargaba todo el mundo en cada visita,
	 * incluido quien no ha pulsado ⌘K en su vida.
	 */
	let {
		supabase,
		puedeAdministrar = false
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		puedeAdministrar?: boolean;
	} = $props();

	let abierta = $state(false);
	let Dialogo = $state<typeof import('./PaletaDialogo.svelte').default | null>(null);
	let pidiendo = false;

	async function abrir() {
		if (!Dialogo && !pidiendo) {
			pidiendo = true;
			try {
				Dialogo = (await import('./PaletaDialogo.svelte')).default;
			} finally {
				pidiendo = false;
			}
		}
		abierta = true;
	}

	function teclas(e: KeyboardEvent) {
		// ⌘K en Mac, Ctrl+K en el resto. La barra `/` también abre, como en tantos buscadores,
		// pero solo si no estabas escribiendo en un campo.
		if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			if (abierta) abierta = false;
			else abrir();
			return;
		}
		if (e.key === '/' && !abierta) {
			const donde = e.target as HTMLElement | null;
			if (donde?.closest('input, textarea, select, [contenteditable]')) return;
			e.preventDefault();
			abrir();
		}
	}
</script>

<svelte:window onkeydown={teclas} />

<!-- Disparador visible: sin él, un atajo de teclado es un secreto -->
<button
	type="button"
	class="hidden items-center gap-2 rounded-lg border bg-muted/40 py-1.5 pr-2 pl-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
	onclick={abrir}
>
	<Search class="size-3.5" />
	<span>Buscar…</span>
	<kbd
		class="rounded border bg-background px-1.5 py-0.5 font-sans text-[11px] font-medium text-muted-foreground"
	>
		⌘K
	</kbd>
</button>
<button
	type="button"
	class="toque flex items-center justify-center text-muted-foreground hover:text-foreground sm:hidden"
	aria-label="Buscar en el banco"
	onclick={abrir}
>
	<Search class="size-4" />
</button>

{#if Dialogo}
	<Dialogo {supabase} {puedeAdministrar} bind:abierta />
{/if}
