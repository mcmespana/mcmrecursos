<script lang="ts">
	import type { SupabaseClient, Session } from '@supabase/supabase-js';
	import * as Popover from '$lib/components/ui/popover';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { toast } from 'svelte-sonner';
	import { Check, ListPlus, Plus } from '@lucide/svelte';

	let {
		supabase,
		session,
		recursoId,
		onrequierelogin
	}: {
		supabase: SupabaseClient<any, 'recursos'>;
		session: Session | null;
		recursoId: string;
		onrequierelogin: () => void;
	} = $props();

	let abierto = $state(false);
	let listas = $state<{ id: string; nombre: string; contiene: boolean }[]>([]);
	let cargando = $state(false);
	let nombreNueva = $state('');
	let creando = $state(false);

	async function cargar() {
		if (!session) return;
		cargando = true;
		const [{ data: mias }, { data: membresia }] = await Promise.all([
			supabase.from('lista').select('id, nombre').eq('perfil_id', session.user.id).order('nombre'),
			supabase.from('lista_recurso').select('lista_id').eq('recurso_id', recursoId)
		]);
		const dentro = new Set((membresia ?? []).map((m) => m.lista_id));
		listas = (mias ?? []).map((l) => ({ ...l, contiene: dentro.has(l.id) }));
		cargando = false;
	}

	function onOpenChange(o: boolean) {
		if (o && !session) {
			onrequierelogin();
			return;
		}
		abierto = o;
		if (o) cargar();
	}

	async function alternar(lista: { id: string; nombre: string; contiene: boolean }) {
		lista.contiene = !lista.contiene;
		const { error } = lista.contiene
			? await supabase.from('lista_recurso').insert({ lista_id: lista.id, recurso_id: recursoId })
			: await supabase
					.from('lista_recurso')
					.delete()
					.eq('lista_id', lista.id)
					.eq('recurso_id', recursoId);
		if (error) {
			lista.contiene = !lista.contiene;
			toast.error('No se pudo actualizar la lista');
		}
	}

	async function crear() {
		const nombre = nombreNueva.trim();
		if (!nombre || !session) return;
		creando = true;
		const { data, error } = await supabase
			.from('lista')
			.insert({ perfil_id: session.user.id, nombre })
			.select('id, nombre')
			.single();
		if (!error && data) {
			await supabase.from('lista_recurso').insert({ lista_id: data.id, recurso_id: recursoId });
			listas = [...listas, { ...data, contiene: true }];
			nombreNueva = '';
			toast.success(`Guardado en «${nombre}»`);
		} else {
			toast.error('No se pudo crear la lista');
		}
		creando = false;
	}
</script>

<Popover.Root open={abierto} {onOpenChange}>
	<Popover.Trigger
		class={buttonVariants({ variant: 'outline', size: 'lg' })}
		aria-label="Guardar en una lista"
	>
		<ListPlus class="size-4" />
	</Popover.Trigger>
	<Popover.Content class="w-64 p-2" align="end">
		<p class="px-2 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
			Guardar en lista
		</p>
		{#if cargando}
			<p class="px-2 py-2 text-sm text-muted-foreground">Cargando…</p>
		{:else}
			<div class="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
				{#each listas as lista (lista.id)}
					<button
						type="button"
						class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
						onclick={() => alternar(lista)}
					>
						<span
							class={`flex size-4 items-center justify-center rounded border ${
								lista.contiene ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
							}`}
						>
							{#if lista.contiene}<Check class="size-3" />{/if}
						</span>
						<span class="truncate">{lista.nombre}</span>
					</button>
				{:else}
					<p class="px-2 py-1 text-sm text-muted-foreground">Aún no tienes listas.</p>
				{/each}
			</div>
		{/if}
		<div class="mt-2 flex gap-1.5 border-t pt-2">
			<Input
				bind:value={nombreNueva}
				placeholder="Nueva lista (p. ej. Campamento 2026)"
				class="h-8 text-sm"
				onkeydown={(e) => e.key === 'Enter' && crear()}
			/>
			<Button size="sm" class="h-8" disabled={creando || !nombreNueva.trim()} onclick={crear}>
				<Plus class="size-3.5" />
			</Button>
		</div>
	</Popover.Content>
</Popover.Root>
