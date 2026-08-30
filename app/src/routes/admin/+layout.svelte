<script lang="ts">
	import { page } from '$app/state';
	import {
		Bell,
		ClipboardCheck,
		Database,
		Route,
		HeartPulse,
		RefreshCw,
		Settings2,
		Users,
		ChartBar,
		Megaphone
	} from '@lucide/svelte';
	import { buzon } from '$lib/avisos/estado.svelte';

	let { data, children } = $props();

	const secciones = $derived(
		[
			{
				href: '/admin/avisos',
				etiqueta: 'Avisos y tareas',
				icono: Bell,
				activa: true,
				// el conteo del cliente manda en cuanto el buzón está cargado: así cerrar una tarea
				// baja la pastilla sin recargar la página
				pastilla: (buzon.cargado ? buzon.abiertas : data.tareasAbiertas) || null
			},
			{
				href: '/admin/salud',
				etiqueta: 'Salud',
				icono: HeartPulse,
				activa: true,
				pastilla: null as number | null
			},
			{
				href: '/admin/revision',
				etiqueta: 'Revisión',
				icono: ClipboardCheck,
				activa: true,
				pastilla: null as number | null
			},
			{
				href: '/admin/recursos',
				etiqueta: 'Recursos',
				icono: Database,
				activa: true,
				pastilla: null as number | null
			},
			// Lo que llega de fuera (SPEC-017): correos de la lista de espera y sugerencias. Va
			// junto a Revisión y Recursos porque es del mismo oficio —atender lo que entra— y no
			// abajo con la configuración, que es donde se muere lo que no se mira.
			{
				href: '/admin/comunidad',
				etiqueta: 'Comunidad',
				icono: Megaphone,
				activa: true,
				pastilla: data.sugerenciasNuevas || null
			},
			// itinerarios: contenido editorial, no un ajuste — de ahí que no viva en /admin/config
			...(data.rolPanel !== 'edicion_local'
				? [
						{
							href: '/admin/itinerarios',
							etiqueta: 'Itinerarios',
							icono: Route,
							activa: true,
							pastilla: null as number | null
						}
					]
				: []),
			...(data.rolPanel !== 'edicion_local'
				? [
						{
							href: '/admin/sync',
							etiqueta: 'Sincronización',
							icono: RefreshCw,
							activa: true,
							pastilla: null as number | null
						}
					]
				: []),
			...(data.rolPanel === 'administrador'
				? [
						{
							href: '/admin/usuarios',
							etiqueta: 'Usuarios',
							icono: Users,
							activa: true,
							pastilla: null as number | null
						},
						{
							href: '/admin/config',
							etiqueta: 'Configuración',
							icono: Settings2,
							activa: true,
							pastilla: null as number | null
						}
					]
				: []),
			...(data.rolPanel !== 'edicion_local'
				? [
						{
							href: '/admin/stats',
							etiqueta: 'Estadísticas',
							icono: ChartBar,
							activa: true,
							pastilla: null as number | null
						}
					]
				: [])
		]
	);
</script>

<div class="mx-auto flex w-full max-w-[1600px] gap-6 px-4 py-6 sm:px-6">
	<aside class="hidden w-52 shrink-0 flex-col gap-1 md:flex">
		<p class="px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
			Administración
		</p>
		{#each secciones as s (s.href)}
			<a
				href={s.activa ? s.href : undefined}
				aria-disabled={!s.activa}
				class={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
					page.url.pathname.startsWith(s.href)
						? 'bg-primary/10 font-medium text-primary'
						: s.activa
							? 'text-foreground hover:bg-accent'
							: 'cursor-default text-muted-foreground/50'
				}`}
			>
				<s.icono class="size-4" />
				{s.etiqueta}
				{#if !s.activa}<span class="ml-auto text-[10px]">pronto</span>{/if}
				{#if s.pastilla}
					<span
						class="ml-auto rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-primary"
					>
						{s.pastilla}
					</span>
				{/if}
			</a>
		{/each}
	</aside>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
