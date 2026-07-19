<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import * as Avatar from '$lib/components/ui/avatar';
	import { Input } from '$lib/components/ui/input';
	import { toast } from 'svelte-sonner';
	import { normalizarConsulta } from '$lib/catalogo/filtros';

	let { data } = $props();

	let filtro = $state('');

	const ROL_ETIQUETA: Record<string, string> = {
		consulta: 'Consulta',
		edicion_local: 'Edición local',
		editor: 'Editor',
		administrador: 'Administrador',
		consulta_externa: 'Consulta externa'
	};

	const filtrados = $derived.by(() => {
		const q = normalizarConsulta(filtro);
		if (!q) return data.usuarios;
		return data.usuarios.filter((u) =>
			normalizarConsulta(`${u.nombre} ${u.apellidos} ${u.email}`).includes(q)
		);
	});

	function alGuardar() {
		return () =>
			async ({ result }: any) => {
				if (result.type === 'success') {
					toast.success('Actualizado');
					await invalidateAll();
				} else {
					toast.error('No se pudo actualizar', { description: result.data?.error });
					await invalidateAll();
				}
			};
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head><title>Usuarios · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center gap-3">
		<h1 class="font-display text-2xl font-bold">Usuarios</h1>
		<p class="text-sm text-muted-foreground tabular-nums">{data.usuarios.length}</p>
		<Input bind:value={filtro} placeholder="Buscar por nombre o email…" class="ml-auto h-8 w-64" />
	</div>

	<div class="overflow-x-auto rounded-xl border">
		<table class="w-full min-w-[760px] text-sm">
			<thead class="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
				<tr>
					<th class="px-3 py-2">Persona</th>
					<th class="px-3 py-2">MCM local</th>
					<th class="px-3 py-2">Rol</th>
					<th class="px-3 py-2">Alta</th>
					<th class="px-3 py-2">Activo</th>
				</tr>
			</thead>
			<tbody>
				{#each filtrados as u (u.id)}
					<tr class={`h-12 border-t ${u.activo ? '' : 'opacity-50'}`}>
						<td class="px-3">
							<span class="flex items-center gap-2.5">
								<Avatar.Root class="size-7">
									<Avatar.Image src={u.avatar_url ?? undefined} alt="" />
									<Avatar.Fallback class="bg-primary/15 text-[10px] text-primary">
										{(u.nombre || u.email).charAt(0).toUpperCase()}
									</Avatar.Fallback>
								</Avatar.Root>
								<span class="flex min-w-0 flex-col">
									<span class="truncate font-medium">{u.nombre} {u.apellidos}</span>
									<span class="truncate text-xs text-muted-foreground">{u.email}</span>
								</span>
							</span>
						</td>
						<td class="px-3">
							<form method="POST" action="?/actualizar" use:enhance={alGuardar()}>
								<input type="hidden" name="id" value={u.id} />
								<input type="hidden" name="campo" value="mcm_local_id" />
								<select
									name="valor"
									value={u.mcm_local_id ?? ''}
									class="rounded-md border bg-background px-2 py-1 text-xs"
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									<option value="">—</option>
									{#each data.mcmLocales as m (m.id)}<option value={m.id}>{m.nombre}</option>{/each}
								</select>
							</form>
						</td>
						<td class="px-3">
							<form method="POST" action="?/actualizar" use:enhance={alGuardar()}>
								<input type="hidden" name="id" value={u.id} />
								<input type="hidden" name="campo" value="rol" />
								<select
									name="valor"
									value={u.rol}
									class="rounded-md border bg-background px-2 py-1 text-xs"
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								>
									{#each data.roles as r (r)}<option value={r}>{ROL_ETIQUETA[r] ?? r}</option>{/each}
								</select>
							</form>
						</td>
						<td class="px-3 text-xs text-muted-foreground tabular-nums">{fecha(u.created_at)}</td>
						<td class="px-3">
							<form method="POST" action="?/actualizar" use:enhance={alGuardar()}>
								<input type="hidden" name="id" value={u.id} />
								<input type="hidden" name="campo" value="activo" />
								<input type="hidden" name="valor" value={(!u.activo).toString()} />
								<button
									type="submit"
									role="switch"
									aria-checked={u.activo}
									aria-label={u.activo ? 'Desactivar usuario' : 'Activar usuario'}
									class={`h-5 w-9 rounded-full p-0.5 transition-colors ${u.activo ? 'bg-primary' : 'bg-muted-foreground/30'}`}
								>
									<span
										class={`block size-4 rounded-full bg-white shadow transition-transform ${u.activo ? 'translate-x-4' : ''}`}
									></span>
								</button>
							</form>
						</td>
					</tr>
				{:else}
					<tr><td colspan="5" class="px-3 py-8 text-center text-muted-foreground">Sin resultados</td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
