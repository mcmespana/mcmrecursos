<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import { toast } from 'svelte-sonner';
	import { crearOcupado } from '$lib/acciones.svelte';
	import { describirFiltros } from '$lib/catalogo/presets';
	import {
		ExternalLink,
		Eye,
		EyeOff,
		Lock,
		LockOpen,
		Plus,
		Power,
		Save,
		Sparkles,
		Trash2
	} from '@lucide/svelte';

	let { data } = $props();

	// mientras el servidor responde, ningún botón de la pantalla acepta otro clic
	const ocupado = crearOcupado();

	const listasNombres = $derived([...new Set(data.listas.map((l: any) => l.lista))] as string[]);
	let listaActiva = $state('');
	const listaSeleccionada = $derived(listaActiva || listasNombres[0] || '');
	const valoresLista = $derived(data.listas.filter((l: any) => l.lista === listaSeleccionada));

	function alGuardar(mensaje = 'Guardado', clave = '') {
		return ocupado.enhance(async ({ result, update }: any) => {
			if (result.type === 'success') {
				toast.success(mensaje);
				await invalidateAll();
				// los formularios de alta se limpian; los de edición se rehidratan del load
				await update({ reset: true });
			} else {
				toast.error('No se pudo guardar', { description: result.data?.error });
				await update({ reset: false });
			}
		}, clave);
	}

	const ROL_ETIQUETA: Record<string, string> = {
		consulta: 'Consulta',
		edicion_local: 'Edición local',
		editor: 'Editor',
		administrador: 'Administrador',
		consulta_externa: 'Consulta externa'
	};
</script>

<svelte:head><title>Configuración · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-4">
	<div>
		<h1 class="font-display text-2xl font-bold">Configuración</h1>
		<p class="text-sm text-muted-foreground">
			Listas cerradas, facetas del buscador, atajos de filtros, MCM locales, accesos
			preautorizados y funciones.
		</p>
	</div>

	<Tabs.Root value="listas">
		<Tabs.List>
			<Tabs.Trigger value="listas">Listas cerradas</Tabs.Trigger>
			<Tabs.Trigger value="facetas">Facetas</Tabs.Trigger>
			<Tabs.Trigger value="presets">Atajos</Tabs.Trigger>
			<Tabs.Trigger value="mcm">MCM locales</Tabs.Trigger>
			<Tabs.Trigger value="accesos">Accesos preautorizados</Tabs.Trigger>
			<Tabs.Trigger value="funciones">Funciones</Tabs.Trigger>
		</Tabs.List>

		<!-- ═══ Listas cerradas (lista_valor) ═══ -->
		<Tabs.Content value="listas" class="flex flex-col gap-3 pt-3">
			<div class="flex flex-wrap items-center gap-2">
				<label class="text-sm text-muted-foreground" for="cfg-lista">Lista</label>
				<select
					id="cfg-lista"
					class="h-8 rounded-md border bg-background px-2 text-sm"
					value={listaSeleccionada}
					onchange={(e) => (listaActiva = e.currentTarget.value)}
				>
					{#each listasNombres as nombre (nombre)}
						<option value={nombre}>{nombre}</option>
					{/each}
				</select>
				<p class="text-sm text-muted-foreground tabular-nums">
					{valoresLista.length} valores · alimentan los selects del alta, la validación del sync y
					los dropdowns del Sheet
				</p>
			</div>

			<div class="overflow-x-auto rounded-xl border">
				<table class="w-full min-w-[640px] text-sm">
					<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
						<tr>
							<th class="px-3 py-2">Valor</th>
							<th class="px-3 py-2">Grupo</th>
							<th class="w-20 px-3 py-2">Orden</th>
							<th class="w-24 px-3 py-2">Activo</th>
							<th class="w-24 px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each valoresLista as v (v.id)}
							<tr class={`border-t ${v.activo ? '' : 'opacity-50'}`}>
								<td class="px-3 py-1.5" colspan="3">
									<form
										method="POST"
										action="?/listaGuardar"
										use:enhance={alGuardar('Valor guardado', `lista-${v.id}`)}
										class="flex items-center gap-2"
										id={`lista-${v.id}`}
									>
										<input type="hidden" name="id" value={v.id} />
										<Input name="valor" value={v.valor} required class="h-8 flex-1" />
										<Input name="grupo" value={v.grupo ?? ''} placeholder="Grupo (opcional)" class="h-8 flex-1" />
										<Input name="orden" type="number" value={v.orden} class="h-8 w-20 tabular-nums" />
									</form>
								</td>
								<td class="px-3 py-1.5">
									<form method="POST" action="?/listaActivo" use:enhance={alGuardar(v.activo ? 'Desactivado' : 'Activado')}>
										<input type="hidden" name="id" value={v.id} />
										<input type="hidden" name="activo" value={String(!v.activo)} />
										<Button type="submit" disabled={ocupado.activo} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											{#if v.activo}
												<Eye class="size-3.5 text-primary" /> Sí
											{:else}
												<EyeOff class="size-3.5" /> No
											{/if}
										</Button>
									</form>
								</td>
								<td class="px-3 py-1.5 text-right">
									<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho(`lista-${v.id}`)} form={`lista-${v.id}`} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
										<Save class="size-3.5" /> Guardar
									</Button>
								</td>
							</tr>
						{:else}
							<tr><td colspan="5" class="px-3 py-8 text-center text-muted-foreground">Sin valores</td></tr>
						{/each}
					</tbody>
				</table>
			</div>

			<form
				method="POST"
				action="?/listaGuardar"
				use:enhance={alGuardar('Valor añadido', 'nuevo-valor')}
				class="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3"
			>
				<input type="hidden" name="lista" value={listaSeleccionada} />
				<div class="flex min-w-44 flex-1 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nl-valor">Nuevo valor en «{listaSeleccionada}»</label>
					<Input id="nl-valor" name="valor" required class="h-8" />
				</div>
				<div class="flex min-w-36 flex-1 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nl-grupo">Grupo</label>
					<Input id="nl-grupo" name="grupo" class="h-8" />
				</div>
				<div class="flex w-24 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nl-orden">Orden</label>
					<Input id="nl-orden" name="orden" type="number" value={valoresLista.length + 1} class="h-8 tabular-nums" />
				</div>
				<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho('nuevo-valor')} size="sm" class="h-8 gap-1.5"><Plus class="size-3.5" /> Añadir</Button>
			</form>
			<p class="text-xs text-muted-foreground">
				Los valores no se borran para no romper recursos existentes: se desactivan y dejan de
				ofrecerse en formularios y filtros.
			</p>
		</Tabs.Content>

		<!-- ═══ Facetas del buscador ═══ -->
		<Tabs.Content value="facetas" class="flex flex-col gap-3 pt-3">
			<div class="overflow-x-auto rounded-xl border">
				<table class="w-full min-w-[760px] text-sm">
					<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
						<tr>
							<th class="px-3 py-2">Campo</th>
							<th class="px-3 py-2">Etiqueta</th>
							<th class="w-20 px-3 py-2">Orden</th>
							<th class="px-3 py-2">Tipo · Origen</th>
							<th class="w-24 px-3 py-2">Visible</th>
							<th class="w-32 px-3 py-2">Solo con login</th>
							<th class="w-24 px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.facetas as fa (fa.id)}
							<tr class={`border-t ${fa.visible ? '' : 'opacity-50'}`}>
								<td class="px-3 py-1.5 font-mono text-xs text-muted-foreground">{fa.campo}</td>
								<td class="px-3 py-1.5" colspan="2">
									<form
										method="POST"
										action="?/facetaGuardar"
										use:enhance={alGuardar('Faceta guardada', `faceta-${fa.id}`)}
										class="flex items-center gap-2"
										id={`faceta-${fa.id}`}
									>
										<input type="hidden" name="id" value={fa.id} />
										<Input name="etiqueta" value={fa.etiqueta} required class="h-8 flex-1" />
										<Input name="orden" type="number" value={fa.orden} class="h-8 w-20 tabular-nums" />
									</form>
								</td>
								<td class="px-3 py-1.5 text-xs text-muted-foreground">{fa.tipo} · {fa.origen}</td>
								<td class="px-3 py-1.5">
									<form method="POST" action="?/facetaFlag" use:enhance={alGuardar(fa.visible ? 'Faceta oculta' : 'Faceta visible')}>
										<input type="hidden" name="id" value={fa.id} />
										<input type="hidden" name="campo" value="visible" />
										<input type="hidden" name="valor" value={String(!fa.visible)} />
										<Button type="submit" disabled={ocupado.activo} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											{#if fa.visible}
												<Eye class="size-3.5 text-primary" /> Sí
											{:else}
												<EyeOff class="size-3.5" /> No
											{/if}
										</Button>
									</form>
								</td>
								<td class="px-3 py-1.5">
									<form method="POST" action="?/facetaFlag" use:enhance={alGuardar('Faceta actualizada')}>
										<input type="hidden" name="id" value={fa.id} />
										<input type="hidden" name="campo" value="protegida" />
										<input type="hidden" name="valor" value={String(!fa.protegida)} />
										<Button type="submit" disabled={ocupado.activo} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											{#if fa.protegida}
												<Lock class="size-3.5 text-warm-foreground dark:text-warm" /> Sí
											{:else}
												<LockOpen class="size-3.5" /> No
											{/if}
										</Button>
									</form>
								</td>
								<td class="px-3 py-1.5 text-right">
									<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho(`faceta-${fa.id}`)} form={`faceta-${fa.id}`} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
										<Save class="size-3.5" /> Guardar
									</Button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<form
				method="POST"
				action="?/facetaGuardar"
				use:enhance={alGuardar('Faceta añadida', 'nueva-faceta')}
				class="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3"
			>
				<div class="flex w-40 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nf-campo">Campo</label>
					<Input id="nf-campo" name="campo" required placeholder="curso_usado" class="h-8 font-mono text-xs" />
				</div>
				<div class="flex min-w-36 flex-1 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nf-etiqueta">Etiqueta</label>
					<Input id="nf-etiqueta" name="etiqueta" required placeholder="Curso" class="h-8" />
				</div>
				<div class="flex w-32 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nf-origen">Origen</label>
					<select id="nf-origen" name="origen" class="h-8 rounded-md border bg-background px-2 text-sm">
						<option value="columna">columna</option>
						<option value="extra">extra</option>
						<option value="tag">tag</option>
						<option value="autor">autor</option>
						<option value="mcm_local">mcm_local</option>
					</select>
				</div>
				<div class="flex w-24 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nf-orden">Orden</label>
					<Input id="nf-orden" name="orden" type="number" value={data.facetas.length + 1} class="h-8 tabular-nums" />
				</div>
				<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho('nueva-faceta')} size="sm" class="h-8 gap-1.5"><Plus class="size-3.5" /> Añadir faceta</Button>
			</form>
			<p class="text-xs text-muted-foreground">
				El buscador público pinta las facetas visibles de tipo select/multiselect en este orden,
				sin necesidad de desplegar código. «Solo con login» la oculta a quien no tiene sesión.
			</p>
		</Tabs.Content>

		<!-- ═══ Atajos (presets de filtros) ═══ -->
		<Tabs.Content value="presets" class="flex flex-col gap-3 pt-3">
			<div class="overflow-x-auto rounded-xl border">
				<table class="w-full min-w-[720px] text-sm">
					<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
						<tr>
							<th class="px-3 py-2">Nombre</th>
							<th class="w-20 px-3 py-2">Orden</th>
							<th class="px-3 py-2">Filtros que lleva</th>
							<th class="w-24 px-3 py-2">Se enseña</th>
							<th class="w-36 px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.presets as pr (pr.id)}
							<tr class={`border-t ${pr.activo ? '' : 'opacity-50'}`}>
								<td class="px-3 py-1.5" colspan="2">
									<form
										method="POST"
										action="?/presetGuardar"
										use:enhance={alGuardar('Atajo guardado', `preset-${pr.id}`)}
										class="flex items-center gap-2"
										id={`preset-${pr.id}`}
									>
										<input type="hidden" name="id" value={pr.id} />
										<Input name="nombre" value={pr.nombre} required maxlength={40} class="h-8 flex-1" />
										<Input name="orden" type="number" value={pr.orden} class="h-8 w-20 tabular-nums" />
									</form>
								</td>
								<td class="px-3 py-1.5 text-xs text-muted-foreground">
									{describirFiltros(pr.filtros, data.facetas)}
								</td>
								<td class="px-3 py-1.5">
									<form
										method="POST"
										action="?/presetActivo"
										use:enhance={alGuardar(pr.activo ? 'Atajo retirado' : 'Atajo publicado')}
									>
										<input type="hidden" name="id" value={pr.id} />
										<input type="hidden" name="activo" value={String(!pr.activo)} />
										<Button type="submit" disabled={ocupado.activo} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											{#if pr.activo}
												<Eye class="size-3.5 text-primary" /> Sí
											{:else}
												<EyeOff class="size-3.5" /> No
											{/if}
										</Button>
									</form>
								</td>
								<td class="px-3 py-1.5">
									<div class="flex items-center justify-end gap-1">
										<!--
											Los filtros no se editan aquí: se abre el atajo en el buscador, se retoca
											tocando facetas y se vuelve a guardar. Allí se ve cuántos recursos deja.
										-->
										<Button href={`/?${pr.filtros}`} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs" title="Abrirlo en el buscador">
											<ExternalLink class="size-3.5" /> Ver
										</Button>
										<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho(`preset-${pr.id}`)} form={`preset-${pr.id}`} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											<Save class="size-3.5" /> Guardar
										</Button>
										<form method="POST" action="?/presetBorrar" use:enhance={alGuardar('Atajo eliminado')}>
											<input type="hidden" name="id" value={pr.id} />
											<Button
												type="submit"
												variant="ghost"
												size="sm"
												class="h-7 px-2 text-xs text-destructive hover:text-destructive"
												aria-label={`Eliminar el atajo ${pr.nombre}`}
											>
												<Trash2 class="size-3.5" />
											</Button>
										</form>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="5" class="px-3 py-8 text-center text-muted-foreground">
									Todavía no hay atajos
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="text-xs text-muted-foreground">
				Los atajos se <strong>crean desde el buscador</strong>: pon los filtros que quieras y
				pulsa «Guardar como atajo». Salen como chips en la portada y como mazos en Descubre, así
				que un atajo es la misma cosa en las dos pantallas. Retirar uno lo esconde sin borrarlo
				— para los de temporada, tipo «Adviento».
			</p>
		</Tabs.Content>

		<!-- ═══ MCM locales ═══ -->
		<Tabs.Content value="mcm" class="flex flex-col gap-3 pt-3">
			<div class="overflow-x-auto rounded-xl border">
				<table class="w-full min-w-[560px] text-sm">
					<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
						<tr>
							<th class="px-3 py-2">Nombre</th>
							<th class="px-3 py-2">Slug</th>
							<th class="w-24 px-3 py-2">Activo</th>
							<th class="w-24 px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.mcmLocales as m (m.id)}
							<tr class={`border-t ${m.activo ? '' : 'opacity-50'}`}>
								<td class="px-3 py-1.5">
									<form
										method="POST"
										action="?/mcmGuardar"
										use:enhance={alGuardar('MCM local guardado', `mcm-${m.id}`)}
										id={`mcm-${m.id}`}
									>
										<input type="hidden" name="id" value={m.id} />
										<Input name="nombre" value={m.nombre} required class="h-8 max-w-72" />
									</form>
								</td>
								<td class="px-3 py-1.5 font-mono text-xs text-muted-foreground">{m.slug}</td>
								<td class="px-3 py-1.5">
									<form method="POST" action="?/mcmActivo" use:enhance={alGuardar(m.activo ? 'Desactivado' : 'Activado')}>
										<input type="hidden" name="id" value={m.id} />
										<input type="hidden" name="activo" value={String(!m.activo)} />
										<Button type="submit" disabled={ocupado.activo} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											{#if m.activo}
												<Eye class="size-3.5 text-primary" /> Sí
											{:else}
												<EyeOff class="size-3.5" /> No
											{/if}
										</Button>
									</form>
								</td>
								<td class="px-3 py-1.5 text-right">
									<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho(`mcm-${m.id}`)} form={`mcm-${m.id}`} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
										<Save class="size-3.5" /> Guardar
									</Button>
								</td>
							</tr>
						{:else}
							<tr><td colspan="4" class="px-3 py-8 text-center text-muted-foreground">Sin MCM locales</td></tr>
						{/each}
					</tbody>
				</table>
			</div>

			<form
				method="POST"
				action="?/mcmGuardar"
				use:enhance={alGuardar('MCM local añadido', 'nuevo-mcm')}
				class="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3"
			>
				<div class="flex min-w-56 flex-1 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="nm-nombre">Nuevo MCM local</label>
					<Input id="nm-nombre" name="nombre" required placeholder="MCM Valencia" class="h-8" />
				</div>
				<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho('nuevo-mcm')} size="sm" class="h-8 gap-1.5"><Plus class="size-3.5" /> Añadir</Button>
			</form>
			<p class="text-xs text-muted-foreground">
				Desactivar un MCM lo quita de los selects (alta de recursos, onboarding) sin tocar los
				recursos ni perfiles que ya lo tienen.
			</p>
		</Tabs.Content>

		<!-- ═══ Accesos preautorizados (acceso_previo) ═══ -->
		<Tabs.Content value="accesos" class="flex flex-col gap-3 pt-3">
			<div class="overflow-x-auto rounded-xl border">
				<table class="w-full min-w-[720px] text-sm">
					<thead class="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
						<tr>
							<th class="px-3 py-2">Email</th>
							<th class="w-44 px-3 py-2">Rol</th>
							<th class="w-52 px-3 py-2">MCM local</th>
							<th class="w-40 px-3 py-2"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.accesos as a (a.email)}
							<tr class="border-t">
								<td class="px-3 py-1.5 font-medium">{a.email}</td>
								<td class="px-3 py-1.5" colspan="2">
									<form
										method="POST"
										action="?/accesoGuardar"
										use:enhance={alGuardar('Acceso actualizado', `acceso-${a.email}`)}
										class="flex items-center gap-2"
										id={`acceso-${a.email}`}
									>
										<input type="hidden" name="email" value={a.email} />
										<select name="rol" value={a.rol} class="h-8 w-40 rounded-md border bg-background px-2 text-sm">
											{#each data.roles as rol (rol)}
												<option value={rol}>{ROL_ETIQUETA[rol] ?? rol}</option>
											{/each}
										</select>
										<select name="mcm_local_id" value={a.mcm_local_id ?? ''} class="h-8 w-48 rounded-md border bg-background px-2 text-sm">
											<option value="">—</option>
											{#each data.mcmLocales.filter((m: any) => m.activo || m.id === a.mcm_local_id) as m (m.id)}
												<option value={m.id}>{m.nombre}</option>
											{/each}
										</select>
									</form>
								</td>
								<td class="px-3 py-1.5">
									<div class="flex items-center justify-end gap-1">
										<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho(`acceso-${a.email}`)} form={`acceso-${a.email}`} variant="ghost" size="sm" class="h-7 gap-1.5 px-2 text-xs">
											<Save class="size-3.5" /> Guardar
										</Button>
										<form method="POST" action="?/accesoBorrar" use:enhance={alGuardar('Acceso eliminado')}>
											<input type="hidden" name="email" value={a.email} />
											<Button
												type="submit"
												variant="ghost"
												size="sm"
												class="h-7 px-2 text-xs text-destructive hover:text-destructive"
												aria-label={`Eliminar acceso de ${a.email}`}
											>
												<Trash2 class="size-3.5" />
											</Button>
										</form>
									</div>
								</td>
							</tr>
						{:else}
							<tr><td colspan="4" class="px-3 py-8 text-center text-muted-foreground">Sin accesos preautorizados</td></tr>
						{/each}
					</tbody>
				</table>
			</div>

			<form
				method="POST"
				action="?/accesoGuardar"
				use:enhance={alGuardar('Acceso preautorizado', 'nuevo-acceso')}
				class="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3"
			>
				<div class="flex min-w-64 flex-1 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="na-email">Email</label>
					<Input id="na-email" name="email" type="email" required placeholder="caravaca@movimientoconsolacion.com" class="h-8" />
				</div>
				<div class="flex w-44 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="na-rol">Rol</label>
					<select id="na-rol" name="rol" value="edicion_local" class="h-8 rounded-md border bg-background px-2 text-sm">
						{#each data.roles as rol (rol)}
							<option value={rol}>{ROL_ETIQUETA[rol] ?? rol}</option>
						{/each}
					</select>
				</div>
				<div class="flex w-52 flex-col gap-1">
					<label class="text-xs font-medium text-muted-foreground" for="na-mcm">MCM local</label>
					<select id="na-mcm" name="mcm_local_id" class="h-8 rounded-md border bg-background px-2 text-sm">
						<option value="">—</option>
						{#each data.mcmLocales.filter((m: any) => m.activo) as m (m.id)}
							<option value={m.id}>{m.nombre}</option>
						{/each}
					</select>
				</div>
				<Button type="submit" disabled={ocupado.activo} hecho={ocupado.hecho('nuevo-acceso')} size="sm" class="h-8 gap-1.5"><Plus class="size-3.5" /> Preautorizar</Button>
			</form>
			<p class="text-xs text-muted-foreground">
				Al hacer su primer login con Google, estos emails nacen ya con su rol y MCM local. Si el
				perfil ya existe, el cambio se aplica al momento.
			</p>
		</Tabs.Content>

		<!-- ═══ Funciones apagables (ajuste) ═══ -->
		<Tabs.Content value="funciones" class="flex flex-col gap-3 pt-3">
			<p class="text-sm text-pretty text-muted-foreground">
				Interruptores para apagar una función al momento, sin tocar código ni desplegar. Lo que se
				apaga desaparece de la interfaz y el resto del banco sigue funcionando igual. El cambio
				tarda unos segundos en llegar a todos los servidores.
			</p>

			<div class="flex flex-col gap-2 rounded-xl border p-4">
				<div class="flex flex-wrap items-center gap-2">
					<Sparkles class="size-4 text-primary" />
					<span class="font-medium">«Recomiéndame…» en Descubre</span>
					<span
						class={`rounded-full px-2 py-0.5 text-xs font-medium ${
							data.funciones.descubreIa
								? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
								: 'bg-muted text-muted-foreground'
						}`}
					>
						{data.funciones.descubreIa ? 'Encendida' : 'Apagada'}
					</span>
					<form
						method="POST"
						action="?/ajusteFlag"
						class="ml-auto"
						use:enhance={alGuardar(
							data.funciones.descubreIa ? 'Recomendaciones apagadas' : 'Recomendaciones encendidas',
							'descubre_ia'
						)}
					>
						<input type="hidden" name="clave" value="descubre_ia" />
						<input type="hidden" name="valor" value={String(!data.funciones.descubreIa)} />
						<Button
							type="submit"
							size="sm"
							variant={data.funciones.descubreIa ? 'outline' : 'default'}
							class="h-8 gap-1.5"
							disabled={ocupado.activo || data.funciones.descubreIaForzado}
							hecho={ocupado.hecho('descubre_ia')}
						>
							<Power class="size-3.5" />
							{data.funciones.descubreIa ? 'Apagar' : 'Encender'}
						</Button>
					</form>
				</div>

				<p class="text-sm text-pretty text-muted-foreground">
					El cuadro de texto de <a href="/descubre" class="text-primary hover:underline">/descubre</a>
					donde se cuenta qué se necesita («una dinámica de confianza para 1º ESO, 45 min») y la IA
					sube al principio del mazo lo que encaja, explicando cada tarjeta. Si un día falla, se
					pone caro o recomienda mal, apágalo aquí: el mazo normal de Descubre no se entera.
				</p>

				<div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
					<span>
						Gemini (redacta y elige):
						<strong class={data.funciones.gemini ? 'text-emerald-600' : 'text-destructive'}>
							{data.funciones.gemini ? 'clave puesta' : 'sin clave'}
						</strong>
					</span>
					<span>
						Voyage (busca por significado):
						<strong class={data.funciones.voyage ? 'text-emerald-600' : 'text-muted-foreground'}>
							{data.funciones.voyage ? 'clave puesta' : 'sin clave (irá por palabras)'}
						</strong>
					</span>
				</div>

				{#if data.funciones.descubreIaForzado}
					<p class="rounded-lg bg-warm/15 px-3 py-2 text-xs text-pretty">
						⚠️ La variable <code>DESCUBRE_IA</code> del entorno manda sobre este botón. Quítala en
						Vercel para volver a decidirlo desde aquí.
					</p>
				{:else if !data.funciones.gemini}
					<p class="rounded-lg bg-muted px-3 py-2 text-xs text-pretty">
						Sin <code>GEMINI_API_KEY</code> la función no aparece en Descubre aunque esté encendida.
					</p>
				{/if}
			</div>
		</Tabs.Content>
	</Tabs.Root>
</div>
