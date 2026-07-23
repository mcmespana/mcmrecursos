<script lang="ts">
	import { enhance } from '$app/forms';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { BookOpen, Lock } from '@lucide/svelte';

	let { form } = $props();
	let enviando = $state(false);
</script>

<svelte:head><title>Entrar · Banco de Recursos MCM</title></svelte:head>

<main class="mx-auto flex min-h-[70svh] w-full max-w-sm flex-col justify-center gap-6 px-6">
	<div class="flex flex-col items-center gap-2 text-center">
		<span class="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
			<BookOpen class="size-5" />
		</span>
		<h1 class="font-display text-2xl font-bold">Acceso al panel</h1>
		<p class="text-sm text-muted-foreground">
			Entra con tu email y contraseña de administración.
		</p>
	</div>

	<form
		method="POST"
		use:enhance={() => {
			enviando = true;
			return async ({ update }) => {
				enviando = false;
				await update();
			};
		}}
		class="flex flex-col gap-3"
	>
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="email">Email</label>
			<Input id="email" name="email" type="email" autocomplete="username" required value={form?.email ?? ''} />
		</div>
		<div class="flex flex-col gap-1.5">
			<label class="text-sm font-medium" for="password">Contraseña</label>
			<Input id="password" name="password" type="password" autocomplete="current-password" required />
		</div>
		{#if form?.error}
			<p class="text-sm text-destructive">{form.error}</p>
		{/if}
		<Button type="submit" size="lg" class="mt-1 gap-2" disabled={enviando}>
			<Lock class="size-4" />
			{enviando ? 'Entrando…' : 'Entrar'}
		</Button>
	</form>

	<p class="text-center text-xs text-muted-foreground">
		¿Solo quieres explorar el banco? <a href="/" class="text-primary hover:underline">Ir al catálogo</a>
	</p>
</main>
