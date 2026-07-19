<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Heart, Star, ListChecks } from '@lucide/svelte';

	let {
		open = $bindable(false),
		onentrar
	}: {
		open?: boolean;
		onentrar: () => void;
	} = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-sm">
		<Dialog.Header>
			<Dialog.Title class="font-display text-xl">Entra para guardar lo tuyo</Dialog.Title>
			<Dialog.Description>
				Con tu cuenta de Google puedes valorar recursos, marcarlos como favoritos y llevar la
				cuenta de lo que ya has usado.
			</Dialog.Description>
		</Dialog.Header>
		<ul class="flex flex-col gap-2 py-1 text-sm text-muted-foreground">
			<li class="flex items-center gap-2">
				<Star class="size-4 text-warm" /> Valora con estrellas lo que te funcionó
			</li>
			<li class="flex items-center gap-2">
				<Heart class="size-4 text-destructive" /> Guarda favoritos para tu próxima sesión
			</li>
			<li class="flex items-center gap-2">
				<ListChecks class="size-4 text-primary" /> Marca lo que ya has usado con tu grupo
			</li>
		</ul>
		<Dialog.Footer class="flex-col gap-2 sm:flex-col">
			<Button class="w-full" size="lg" onclick={onentrar}>Entrar con Google</Button>
			<p class="text-center text-xs text-muted-foreground">
				Solo usamos tu nombre, correo y foto de Google.
			</p>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
