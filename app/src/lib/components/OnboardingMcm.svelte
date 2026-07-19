<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { MapPin } from '@lucide/svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	let {
		supabase,
		perfilId,
		mcmLocales
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		perfilId: string;
		mcmLocales: { id: string; nombre: string }[];
	} = $props();

	const CLAVE_OMITIDO = 'mcm-onboarding-omitido';
	let abierto = $state(localStorage.getItem(CLAVE_OMITIDO) !== '1');
	let guardando = $state(false);

	async function elegir(id: string) {
		guardando = true;
		const { error } = await supabase.from('perfil').update({ mcm_local_id: id }).eq('id', perfilId);
		guardando = false;
		if (error) {
			toast.error('No se pudo guardar tu MCM local');
			return;
		}
		abierto = false;
		toast.success('¡Bienvenido/a! MCM local guardado.');
		invalidate('supabase:auth');
	}

	function omitir() {
		localStorage.setItem(CLAVE_OMITIDO, '1');
		abierto = false;
	}
</script>

<Dialog.Root bind:open={abierto} onOpenChange={(o) => !o && omitir()}>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title class="font-display text-xl">¿De qué MCM local eres?</Dialog.Title>
			<Dialog.Description>
				Nos ayuda a saber quién aporta cada recurso. Puedes cambiarlo más adelante.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex flex-col gap-2 py-1">
			{#each mcmLocales as local (local.id)}
				<Button
					variant="outline"
					class="justify-start"
					disabled={guardando}
					onclick={() => elegir(local.id)}
				>
					<MapPin class="size-4 text-primary" />
					{local.nombre}
				</Button>
			{/each}
		</div>
		<Dialog.Footer>
			<Button variant="ghost" size="sm" class="w-full text-muted-foreground" onclick={omitir}>
				Ahora no
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
