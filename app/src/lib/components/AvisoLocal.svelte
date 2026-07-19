<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { HardDrive, X } from '@lucide/svelte';
	import { fly } from 'svelte/transition';

	let { onentrar }: { onentrar: () => void } = $props();

	const CLAVE = 'mcm-aviso-local-cerrado';
	let cerrado = $state(sessionStorage.getItem(CLAVE) === '1');

	function cerrar() {
		cerrado = true;
		sessionStorage.setItem(CLAVE, '1');
	}
</script>

{#if !cerrado}
	<div
		transition:fly={{ y: 24, duration: 250 }}
		class="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-warm/40 bg-card p-4 shadow-xl"
		role="status"
	>
		<span class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warm/20">
			<HardDrive class="size-5 text-warm-foreground dark:text-warm" />
		</span>
		<div class="flex min-w-0 flex-1 flex-col gap-0.5">
			<p class="text-sm font-semibold">Guardado solo en este dispositivo</p>
			<p class="text-xs text-muted-foreground text-pretty">
				Tus corazones, estrellas y listas viven en este navegador. Entra con Google para
				llevarlos a tu cuenta y no perderlos.
			</p>
		</div>
		<Button size="sm" onclick={onentrar}>Entrar</Button>
		<button
			type="button"
			class="rounded p-1 text-muted-foreground hover:text-foreground"
			aria-label="Cerrar aviso"
			onclick={cerrar}
		>
			<X class="size-4" />
		</button>
	</div>
{/if}
