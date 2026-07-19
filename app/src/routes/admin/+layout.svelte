<script lang="ts">
	import { page } from '$app/state';
	import { ClipboardCheck, Database, RefreshCw, Settings2, Users, ChartBar } from '@lucide/svelte';

	let { data, children } = $props();

	const secciones = $derived(
		[
			{ href: '/admin/revision', etiqueta: 'Revisión', icono: ClipboardCheck, activa: true },
			{ href: '/admin/recursos', etiqueta: 'Recursos', icono: Database, activa: true },
			...(data.rolPanel !== 'edicion_local'
				? [{ href: '/admin/sync', etiqueta: 'Sincronización', icono: RefreshCw, activa: true }]
				: []),
			...(data.rolPanel === 'administrador'
				? [
						{ href: '/admin/usuarios', etiqueta: 'Usuarios', icono: Users, activa: true },
						{ href: '/admin/config', etiqueta: 'Configuración', icono: Settings2, activa: false }
					]
				: []),
			...(data.rolPanel !== 'edicion_local'
				? [{ href: '/admin/stats', etiqueta: 'Estadísticas', icono: ChartBar, activa: true }]
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
			</a>
		{/each}
	</aside>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
