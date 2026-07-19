<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { toast } from 'svelte-sonner';
	import { CloudAlert, FileSpreadsheet, ShieldCheck } from '@lucide/svelte';

	let { data } = $props();

	const fecha = (iso: string | null) =>
		iso
			? new Date(iso).toLocaleString('es-ES', {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				})
			: 'nunca';

	function alResolver() {
		return () =>
			async ({ result }: any) => {
				if (result.type === 'success') {
					toast.success('En la próxima sincronización se aplicará la versión del Sheet');
					await invalidateAll();
				} else {
					toast.error('No se pudo resolver', { description: result.data?.error });
				}
			};
	}

	const erroresDe = (log: any) =>
		Array.isArray(log.errores) ? log.errores.filter((e: any) => e.fila) : [];
</script>

<svelte:head><title>Sincronización · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-6">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="font-display text-2xl font-bold">Sincronización</h1>
		<p class="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
			<FileSpreadsheet class="size-4" /> Última sync del Sheet: {fecha(data.ultimaSync)}
		</p>
	</div>

	<!-- conflictos -->
	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
			Conflictos Sheet ↔ web ({data.conflictos.length})
		</h2>
		{#if !data.conflictos.length}
			<p class="flex items-center gap-2 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
				<ShieldCheck class="size-4 text-emerald-600" /> Sin conflictos: nada editado en la web
				está esperando resolución.
			</p>
		{:else}
			<ul class="flex flex-col gap-2">
				{#each data.conflictos as c (c.id)}
					<li class="flex flex-wrap items-center gap-3 rounded-xl border border-warm/40 bg-warm/5 p-4">
						<CloudAlert class="size-4 shrink-0 text-warm-foreground dark:text-warm" />
						<div class="flex min-w-0 flex-1 flex-col">
							<span class="truncate font-medium">
								<span class="font-mono text-xs text-muted-foreground">{c.id}</span>
								{c.nombre.replace(/^\[EJEMPLO\]\s*/, '')}
							</span>
							<span class="text-xs text-muted-foreground">
								Editado en web el {fecha(c.editado_web_at)} — el Sheet no lo pisará hasta que
								resuelvas.
							</span>
						</div>
						<Button variant="outline" size="sm" href={`/?r=${c.id}`} target="_blank">Ver ficha</Button>
						<form method="POST" action="?/aplicar_sheet" use:enhance={alResolver()}>
							<input type="hidden" name="id" value={c.id} />
							<Button type="submit" variant="outline" size="sm">
								Aplicar versión del Sheet
							</Button>
						</form>
					</li>
				{/each}
			</ul>
			<p class="text-xs text-muted-foreground text-pretty">
				💡 «Mantener la versión web» no requiere acción: el recurso queda protegido
				indefinidamente. Si quieres que el Sheet vuelva a mandar sobre él, actualiza su fila en
				la hoja y pulsa «Aplicar versión del Sheet».
			</p>
		{/if}
	</section>

	<!-- historial -->
	<section class="flex flex-col gap-3">
		<h2 class="text-sm font-medium tracking-wide text-muted-foreground uppercase">
			Historial de sincronizaciones
		</h2>
		{#if !data.log.length}
			<p class="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">
				Aún no se ha sincronizado nunca. El Sheet dispara la sync desde su menú
				«Banco de Recursos → Sincronizar ahora» (ver SPEC-005).
			</p>
		{:else}
			<div class="overflow-x-auto rounded-xl border">
				<table class="w-full min-w-[560px] text-sm">
					<thead class="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
						<tr>
							<th class="px-3 py-2">Cuándo</th>
							<th class="px-3 py-2 text-right">Filas</th>
							<th class="px-3 py-2 text-right">Creadas</th>
							<th class="px-3 py-2 text-right">Actualizadas</th>
							<th class="px-3 py-2 text-right">Retiradas</th>
							<th class="px-3 py-2">Errores</th>
						</tr>
					</thead>
					<tbody>
						{#each data.log as log (log.id)}
							{@const errores = erroresDe(log)}
							<tr class="h-10 border-t">
								<td class="px-3 text-muted-foreground">{fecha(log.created_at)}</td>
								<td class="px-3 text-right tabular-nums">{log.procesadas}</td>
								<td class="px-3 text-right tabular-nums">{log.creadas}</td>
								<td class="px-3 text-right tabular-nums">{log.actualizadas}</td>
								<td class="px-3 text-right tabular-nums">{log.retiradas}</td>
								<td class="px-3">
									{#if errores.length}
										<details class="text-xs">
											<summary class="cursor-pointer text-destructive">{errores.length}</summary>
											<ul class="mt-1 flex flex-col gap-0.5 text-muted-foreground">
												{#each errores as e (e.fila)}
													<li>Fila {e.fila}: {e.error}</li>
												{/each}
											</ul>
										</details>
									{:else}
										<span class="text-xs text-emerald-600">0</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>
