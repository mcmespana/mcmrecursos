<script lang="ts">
	import type { SupabaseClient, Session } from '@supabase/supabase-js';
	import type { Comentario } from '$lib/catalogo/tipos';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Avatar from '$lib/components/ui/avatar';
	import { toast } from 'svelte-sonner';
	import { Lightbulb, MessageCircle, Send, Trash2 } from '@lucide/svelte';

	let {
		supabase,
		session,
		recursoId,
		puedeModerar = false,
		onrequierelogin
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		session: Session | null;
		recursoId: string;
		puedeModerar?: boolean;
		onrequierelogin: () => void;
	} = $props();

	let comentarios = $state<Comentario[]>([]);
	let cargando = $state(true);
	let texto = $state('');
	let esSugerencia = $state(false);
	let enviando = $state(false);

	$effect(() => {
		const id = recursoId;
		cargando = true;
		(async () => {
			const { data: filas } = await supabase
				.from('comentario')
				.select('id, texto, tipo, created_at, perfil_id')
				.eq('recurso_id', id)
				.order('created_at', { ascending: false })
				.limit(50);
			const ids = [...new Set((filas ?? []).map((c) => c.perfil_id))];
			const { data: autores } = ids.length
				? await supabase.from('perfil_publico').select('id, nombre, avatar_url').in('id', ids)
				: { data: [] };
			const porId = new Map((autores ?? []).map((a) => [a.id, a]));
			if (recursoId !== id) return; // el usuario ya navegó a otro recurso
			comentarios = (filas ?? []).map((c) => ({ ...c, autor: porId.get(c.perfil_id) ?? null }));
			cargando = false;
		})();
	});

	async function publicar() {
		if (!session) {
			onrequierelogin();
			return;
		}
		const contenido = texto.trim();
		if (!contenido) return;
		enviando = true;
		const { data, error } = await supabase
			.from('comentario')
			.insert({
				recurso_id: recursoId,
				perfil_id: session.user.id,
				texto: contenido,
				tipo: esSugerencia ? 'sugerencia' : 'comentario'
			})
			.select('id, texto, tipo, created_at, perfil_id')
			.single();
		enviando = false;
		if (error || !data) {
			toast.error('No se pudo publicar el comentario');
			return;
		}
		comentarios = [
			{
				...data,
				autor: {
					nombre: (session.user.user_metadata?.given_name as string) ?? 'Tú',
					avatar_url: (session.user.user_metadata?.avatar_url as string) ?? null
				}
			},
			...comentarios
		];
		texto = '';
		esSugerencia = false;
	}

	async function borrar(id: string) {
		const previos = comentarios;
		comentarios = comentarios.filter((c) => c.id !== id);
		const { error } = await supabase.from('comentario').delete().eq('id', id);
		if (error) {
			comentarios = previos;
			toast.error('No se pudo borrar');
		}
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<div class="flex flex-col gap-3">
	<h4 class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
		Comentarios {#if comentarios.length}({comentarios.length}){/if}
	</h4>

	<div class="flex flex-col gap-2">
		<Textarea
			bind:value={texto}
			placeholder={session
				? '¿Cómo te funcionó? ¿Alguna mejora?'
				: 'Entra para comentar cómo te funcionó…'}
			rows={2}
			maxlength={2000}
			onclick={() => !session && onrequierelogin()}
		/>
		<div class="flex items-center justify-between gap-2">
			<button
				type="button"
				class={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors ${
					esSugerencia
						? 'bg-warm/20 font-medium text-warm-foreground dark:text-warm'
						: 'text-muted-foreground hover:bg-muted'
				}`}
				aria-pressed={esSugerencia}
				onclick={() => (esSugerencia = !esSugerencia)}
			>
				<Lightbulb class="size-3.5" />
				Sugerencia de mejora
			</button>
			<Button size="sm" disabled={enviando || !texto.trim()} onclick={publicar}>
				<Send class="size-3.5" /> Publicar
			</Button>
		</div>
	</div>

	{#if cargando}
		<p class="py-2 text-sm text-muted-foreground">Cargando comentarios…</p>
	{:else if !comentarios.length}
		<p class="flex items-center gap-2 py-2 text-sm text-muted-foreground">
			<MessageCircle class="size-4" /> Nadie ha comentado aún. Estrena la conversación.
		</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each comentarios as c (c.id)}
				<li class="flex gap-2.5">
					<Avatar.Root class="size-7 shrink-0">
						<Avatar.Image src={c.autor?.avatar_url ?? undefined} alt="" />
						<Avatar.Fallback class="bg-primary/15 text-[10px] text-primary">
							{(c.autor?.nombre ?? '?').charAt(0).toUpperCase()}
						</Avatar.Fallback>
					</Avatar.Root>
					<div class="flex min-w-0 flex-1 flex-col gap-0.5">
						<p class="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
							<span class="font-medium text-foreground">{c.autor?.nombre ?? 'Alguien'}</span>
							{fecha(c.created_at)}
							{#if c.tipo === 'sugerencia'}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-warm/20 px-1.5 py-0.5 text-[10px] font-medium text-warm-foreground dark:text-warm"
								>
									<Lightbulb class="size-2.5" /> Sugerencia
								</span>
							{/if}
						</p>
						<p class="text-sm leading-relaxed text-pretty">{c.texto}</p>
					</div>
					{#if session && (c.perfil_id === session.user.id || puedeModerar)}
						<button
							type="button"
							class="self-start rounded p-1 text-muted-foreground/50 hover:text-destructive"
							aria-label="Borrar comentario"
							onclick={() => borrar(c.id)}
						>
							<Trash2 class="size-3.5" />
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
