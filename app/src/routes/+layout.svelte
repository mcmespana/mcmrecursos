<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { invalidate } from '$app/navigation';
	import { ModeWatcher, toggleMode } from 'mode-watcher';
	import { Button } from '$lib/components/ui/button';
	import { BookOpen, Moon, Sun } from '@lucide/svelte';

	let { data, children } = $props();

	// Reejecuta los load que dependen de 'supabase:auth' cuando cambia la sesión.
	$effect(() => {
		const { data: authData } = data.supabase.auth.onAuthStateChange((_event, newSession) => {
			if (newSession?.expires_at !== data.session?.expires_at) {
				invalidate('supabase:auth');
			}
		});
		return () => authData.subscription.unsubscribe();
	});
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />

<div class="flex min-h-svh flex-col">
	<header class="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
		<div class="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4 sm:px-6">
			<a href="/" class="flex items-center gap-2 font-display text-lg font-bold">
				<span
					class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
				>
					<BookOpen class="size-4" />
				</span>
				<span class="hidden sm:inline">Banco de Recursos</span>
				<span class="text-primary">MCM</span>
			</a>
			<div class="ml-auto flex items-center gap-1">
				<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Cambiar tema">
					<Sun class="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
					<Moon
						class="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
					/>
				</Button>
			</div>
		</div>
	</header>

	<div class="flex-1">
		{@render children()}
	</div>
</div>
