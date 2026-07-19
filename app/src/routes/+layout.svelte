<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { invalidate } from '$app/navigation';
	import { ModeWatcher, toggleMode } from 'mode-watcher';
	import { toast } from 'svelte-sonner';
	import { Toaster } from '$lib/components/ui/sonner';
	import { Button } from '$lib/components/ui/button';
	import * as Avatar from '$lib/components/ui/avatar';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { BookOpen, Inbox, ListChecks, LogOut, Moon, Send, Shield, Sun } from '@lucide/svelte';
	import OnboardingMcm from '$lib/components/OnboardingMcm.svelte';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

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

	const usuario = $derived(data.session?.user);
	const avatarUrl = $derived(usuario?.user_metadata?.avatar_url as string | undefined);
	const nombreUsuario = $derived(
		(usuario?.user_metadata?.full_name as string | undefined) ?? usuario?.email ?? ''
	);

	async function entrarConGoogle() {
		const { error } = await data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback` }
		});
		if (error) toast.error('No se pudo iniciar sesión', { description: error.message });
	}

	async function salir() {
		await data.supabase.auth.signOut();
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<ModeWatcher />
<Toaster richColors position="bottom-center" />

{#if browser && data.perfil && !data.perfil.mcm_local_id && data.mcmLocales.length}
	<OnboardingMcm
		supabase={data.supabase}
		perfilId={data.perfil.id}
		mcmLocales={data.mcmLocales}
	/>
{/if}

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
			<div class="ml-auto flex items-center gap-2">
				<Button variant="ghost" size="sm" href="/enviar" class="hidden sm:inline-flex">
					<Send class="size-4" /> Enviar recurso
				</Button>
				<Button variant="ghost" size="icon" onclick={toggleMode} aria-label="Cambiar tema">
					<Sun class="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
					<Moon
						class="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0"
					/>
				</Button>
				{#if usuario}
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							class="rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
						>
							<Avatar.Root class="size-8">
								<Avatar.Image src={avatarUrl} alt={nombreUsuario} />
								<Avatar.Fallback class="bg-primary/15 text-xs text-primary">
									{nombreUsuario.charAt(0).toUpperCase()}
								</Avatar.Fallback>
							</Avatar.Root>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end" class="min-w-48">
							<DropdownMenu.Label class="flex flex-col">
								<span class="truncate">{nombreUsuario}</span>
								<span class="truncate text-xs font-normal text-muted-foreground">
									{usuario.email}
								</span>
							</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={() => goto('/listas')}>
								<ListChecks class="size-4" /> Mis listas
							</DropdownMenu.Item>
							<DropdownMenu.Item onclick={() => goto('/envios')}>
								<Inbox class="size-4" /> Mis envíos
							</DropdownMenu.Item>
							{#if data.perfil && ['edicion_local', 'editor', 'administrador'].includes(data.perfil.rol)}
								<DropdownMenu.Item onclick={() => goto('/admin')}>
									<Shield class="size-4" /> Administración
								</DropdownMenu.Item>
							{/if}
							<DropdownMenu.Separator />
							<DropdownMenu.Item onclick={salir}>
								<LogOut class="size-4" /> Salir
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				{:else}
					<Button size="sm" onclick={entrarConGoogle}>Entrar</Button>
				{/if}
			</div>
		</div>
	</header>

	<div class="flex-1">
		{@render children()}
	</div>

	<footer class="border-t py-6">
		<p class="text-center text-xs text-muted-foreground">
			Banco de Recursos · Movimiento Consolación para el Mundo
		</p>
	</footer>
</div>
