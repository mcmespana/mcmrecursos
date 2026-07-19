<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import { toast } from 'svelte-sonner';
	import { Link2, Plus, Send, Trash2 } from '@lucide/svelte';

	let { data } = $props();

	interface Fila {
		titulo: string;
		enlace: string;
		notas: string;
	}
	let filas = $state<Fila[]>([{ titulo: '', enlace: '', notas: '' }]);
	let enviando = $state(false);
	let loginAbierto = $state(false);

	const validas = $derived(filas.filter((f) => f.titulo.trim() && f.enlace.trim()));

	async function entrarConGoogle() {
		await data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback?next=/enviar` }
		});
	}

	async function enviar() {
		if (!data.session) {
			loginAbierto = true;
			return;
		}
		if (!validas.length) return;
		enviando = true;
		const { error } = await data.supabase.from('envio').insert(
			validas.map((f) => ({
				perfil_id: data.session!.user.id,
				mcm_local_id: data.perfil?.mcm_local_id ?? null,
				titulo: f.titulo.trim(),
				enlace: f.enlace.trim(),
				notas: f.notas.trim() || null
			}))
		);
		enviando = false;
		if (error) {
			toast.error('No se pudieron enviar los recursos');
			return;
		}
		toast.success(
			validas.length === 1
				? 'Recurso enviado. ¡Gracias por aportar!'
				: `${validas.length} recursos enviados. ¡Gracias por aportar!`
		);
		goto('/envios');
	}
</script>

<svelte:head><title>Enviar recursos · Banco de Recursos MCM</title></svelte:head>

<main class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
	<div class="flex flex-col gap-2">
		<h1 class="font-display text-3xl font-bold">Envía tus recursos</h1>
		<p class="text-muted-foreground text-pretty">
			Pega el enlace (Drive, YouTube, web…), ponle título y listo — el equipo editor lo
			catalogará. Puedes enviar varios de golpe.
		</p>
	</div>

	<div class="flex flex-col gap-4">
		{#each filas as fila, i (i)}
			<div class="flex flex-col gap-2 rounded-xl border bg-card p-4">
				<div class="flex items-center gap-2">
					<Input bind:value={fila.titulo} placeholder="Título del recurso *" class="flex-1" />
					{#if filas.length > 1}
						<Button
							variant="ghost"
							size="icon"
							class="text-muted-foreground hover:text-destructive"
							aria-label="Quitar fila"
							onclick={() => (filas = filas.filter((_, j) => j !== i))}
						>
							<Trash2 class="size-4" />
						</Button>
					{/if}
				</div>
				<div class="relative">
					<Link2 class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input bind:value={fila.enlace} placeholder="Enlace (Drive, YouTube, web…) *" class="pl-9" type="url" />
				</div>
				<Textarea
					bind:value={fila.notas}
					placeholder="Notas para el equipo (edad, etapa, contexto…) — opcional"
					rows={2}
				/>
			</div>
		{/each}
	</div>

	<div class="flex items-center justify-between gap-3">
		<Button
			variant="outline"
			size="sm"
			onclick={() => (filas = [...filas, { titulo: '', enlace: '', notas: '' }])}
		>
			<Plus class="size-4" /> Otro recurso
		</Button>
		<Button size="lg" disabled={enviando || !validas.length} onclick={enviar}>
			<Send class="size-4" />
			Enviar {validas.length > 1 ? `${validas.length} recursos` : 'recurso'}
		</Button>
	</div>
</main>

<LoginDialog bind:open={loginAbierto} onentrar={entrarConGoogle} />
