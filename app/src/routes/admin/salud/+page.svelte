<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { crearOcupado, lanzarAccion } from '$lib/acciones.svelte';
	import { ArrowRight, Bell } from '@lucide/svelte';
	import { buzon } from '$lib/avisos/estado.svelte';
	import RejillaSenales, { SENAL_META } from '$lib/components/admin/RejillaSenales.svelte';

	let { data } = $props();

	const ocupado = crearOcupado();

	async function apuntarSenal(key: string, n: number) {
		const meta = SENAL_META[key];
		await ocupado.envolver(async () => {
			const error = await lanzarAccion('?/apuntarSenal', {
				senal: key,
				titulo: `${meta.titulo} (${n})`
			});
			if (error) {
				toast.error('No se pudo apuntar', { description: error });
				return;
			}
			// el buzón vive en el cliente y hay que releerlo para que la campana lo cuente ya
			await buzon.cargar(data.supabase, data.miId, true);
			await invalidateAll();
			toast.success('Apuntado en el buzón', { description: meta.titulo });
		}, `senal-${key}`);
	}

	async function correrAccionLote(accion: string, etiqueta: string) {
		await ocupado.envolver(async () => {
			const error = await lanzarAccion(`/admin/recursos?/${accion}`, {});
			if (error) {
				toast.error(`No se pudo: ${etiqueta}`, { description: error });
				return;
			}
			await invalidateAll();
			toast.success(etiqueta);
		}, `lote-${accion}`);
	}

	function ocultarSenal(key: string, mostrar: boolean) {
		return ocupado.envolver(async () => {
			const error = await lanzarAccion('?/ocultarSenal', { senal: key, mostrar: String(mostrar) });
			if (error) toast.error('No se pudo actualizar', { description: error });
			await invalidateAll();
		}, `ocultar-${key}`);
	}
</script>

<svelte:head><title>Salud del banco · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-col gap-1">
		<h1 class="font-display text-2xl font-bold">Salud del banco</h1>
		<p class="text-sm text-muted-foreground">
			Lo que le falta al catálogo, ordenado por lo que más duele.
		</p>
	</div>

	{#if data.conSenales}
		<RejillaSenales
			senales={data.senales}
			ocultas={data.senalesOcultas}
			esAdmin={data.rol === 'administrador'}
			cargando={(c) => ocupado.cargando(c)}
			onapuntar={apuntarSenal}
			onlote={correrAccionLote}
			onocultar={ocultarSenal}
		/>
	{/if}

	<!--
		Las tareas ya no viven aquí: se fueron al buzón del equipo (SPEC-016), que está en la campana
		de la cabecera y en /admin/avisos. Tenerlas en dos sitios era pedir que se desincronizaran, y
		esta pantalla es para mirar el catálogo, no para gestionar recados.
	-->
	<a
		href="/admin/avisos"
		class="toque flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
	>
		<Bell class="size-4 shrink-0 text-muted-foreground" />
		<span class="flex flex-col">
			<span class="font-medium">Avisos y tareas del equipo</span>
			<span class="text-xs text-muted-foreground">
				Lo que apuntes desde estas señales aparece ahí, y también en la campana de arriba.
			</span>
		</span>
		<ArrowRight class="ml-auto size-4 shrink-0 text-muted-foreground" />
	</a>
</div>
