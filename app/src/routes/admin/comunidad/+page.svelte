<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Input } from '$lib/components/ui/input';
	import * as Tabs from '$lib/components/ui/tabs';
	import { toast } from 'svelte-sonner';
	import { crearOcupado } from '$lib/acciones.svelte';
	import { normalizarConsulta } from '$lib/catalogo/filtros';
	import {
		Bug,
		Check,
		ClipboardCheck,
		Copy,
		Download,
		HandHeart,
		Lightbulb,
		Mail,
		MessageSquare,
		Search
	} from '@lucide/svelte';

	/**
	 * Lo que llega de fuera: la lista de espera y el buzón de sugerencias (SPEC-017 §4).
	 *
	 * Es una pantalla de trabajo, no un panel de métricas: lo que hay que poder hacer aquí es
	 * copiar los correos para escribirles y convertir una sugerencia en tarea del equipo. Todo
	 * lo demás —gráficas, evolución, embudos— sobra mientras la lista quepa en una pantalla.
	 */

	let { data } = $props();
	const ocupado = crearOcupado();

	let filtroEspera = $state('');
	let filtroSug = $state('');
	let soloAyudantes = $state(false);
	let soloPendientes = $state(true);

	const TIPO = {
		idea: { icono: Lightbulb, etiqueta: 'Idea', clase: 'bg-primary/12 text-primary' },
		problema: {
			icono: Bug,
			etiqueta: 'Problema',
			clase: 'bg-destructive/12 text-destructive'
		},
		falta: {
			icono: Search,
			etiqueta: 'Falta un recurso',
			clase: 'bg-warm/20 text-warm-foreground dark:text-warm'
		},
		otro: { icono: MessageSquare, etiqueta: 'Otra cosa', clase: 'bg-muted text-muted-foreground' }
	} as const;

	const AYUDA = {
		aportar: 'Aportar recursos',
		catalogar: 'Catalogar',
		probar: 'Probar',
		difundir: 'Difundir'
	} as const;

	const esperaFiltrada = $derived.by(() => {
		const q = normalizarConsulta(filtroEspera);
		return data.espera.filter((e: any) => {
			if (soloAyudantes && !e.quiere_ayudar) return false;
			if (!q) return true;
			return normalizarConsulta(`${e.email} ${e.nombre ?? ''}`).includes(q);
		});
	});

	const sugerenciasFiltradas = $derived.by(() => {
		const q = normalizarConsulta(filtroSug);
		return data.sugerencias.filter((s: any) => {
			if (soloPendientes && (s.estado === 'resuelta' || s.estado === 'descartada')) return false;
			if (!q) return true;
			return normalizarConsulta(`${s.mensaje} ${s.email ?? ''} ${s.ruta ?? ''}`).includes(q);
		});
	});

	const ayudantes = $derived(data.espera.filter((e: any) => e.quiere_ayudar).length);
	const sinContactar = $derived(data.espera.filter((e: any) => !e.contactado_at).length);
	const nuevas = $derived(data.sugerencias.filter((s: any) => s.estado === 'nueva').length);

	/** `clave` es la fila: así el pulso de «ocupado» sale solo en la que se ha pulsado. */
	function alGuardar(exito: string, clave: string) {
		return ocupado.enhance(async ({ result }: any) => {
			if (result.type === 'success') {
				toast.success(exito);
				await invalidateAll();
			} else {
				toast.error('No se pudo guardar', { description: result.data?.error });
			}
		}, clave);
	}

	/** Todos los correos de un tirón, que es como se pega una lista en el gestor de envíos. */
	async function copiarCorreos() {
		const correos = esperaFiltrada.map((e: any) => e.email).join(', ');
		if (!correos) return;
		try {
			await navigator.clipboard.writeText(correos);
			toast.success(
				`${esperaFiltrada.length} ${esperaFiltrada.length === 1 ? 'correo copiado' : 'correos copiados'}`
			);
		} catch {
			toast.error('Tu navegador no ha dejado copiar');
		}
	}

	const fecha = (iso: string) =>
		new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
</script>

<svelte:head><title>Comunidad · Admin · Banco de Recursos MCM</title></svelte:head>

<div class="flex flex-col gap-4">
	<header class="flex flex-col gap-1">
		<h1 class="font-display text-2xl font-bold">Comunidad</h1>
		<p class="text-sm text-muted-foreground">
			Quién espera a que el banco tenga contenido y qué nos está contando la gente que entra.
		</p>
	</header>

	<Tabs.Root value={data.veEspera ? 'espera' : 'sugerencias'}>
		<Tabs.List>
			{#if data.veEspera}
				<Tabs.Trigger value="espera">
					Lista de espera
					{#if data.espera.length}
						<span class="ml-1.5 tabular-nums opacity-70">{data.espera.length}</span>
					{/if}
				</Tabs.Trigger>
			{/if}
			<Tabs.Trigger value="sugerencias">
				Sugerencias
				{#if nuevas}
					<span
						class="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-medium tabular-nums text-primary"
					>
						{nuevas}
					</span>
				{/if}
			</Tabs.Trigger>
		</Tabs.List>

		{#if data.veEspera}
			<Tabs.Content value="espera" class="flex flex-col gap-3 pt-3">
				{#if !data.espera.length}
					<div class="rounded-xl border border-dashed p-10 text-center">
						<Mail class="mx-auto size-8 text-muted-foreground/40" />
						<p class="mt-3 font-medium">Todavía no se ha apuntado nadie</p>
						<p class="mt-1 text-sm text-muted-foreground">
							El modal de bienvenida sale en la portada. Aquí irán apareciendo los correos.
						</p>
					</div>
				{:else}
					<div class="flex flex-wrap items-center gap-2">
						<Input
							bind:value={filtroEspera}
							placeholder="Buscar por correo o nombre…"
							class="h-8 max-w-xs"
						/>
						<Button
							variant={soloAyudantes ? 'secondary' : 'outline'}
							size="sm"
							aria-pressed={soloAyudantes}
							onclick={() => (soloAyudantes = !soloAyudantes)}
						>
							<HandHeart class="size-3.5" /> Solo quien quiere ayudar ({ayudantes})
						</Button>
						<div class="ml-auto flex items-center gap-2">
							<span class="text-xs text-muted-foreground tabular-nums">
								{sinContactar} sin escribir
							</span>
							<Button variant="outline" size="sm" onclick={copiarCorreos}>
								<Copy class="size-3.5" /> Copiar correos
							</Button>
							<form
								method="POST"
								action="?/exportar"
								use:enhance={() =>
									async ({ result }: any) => {
										if (result.type !== 'success' || !result.data?.csv) {
											toast.error('No se pudo exportar');
											return;
										}
										const blob = new Blob([result.data.csv], {
											type: 'text/csv;charset=utf-8'
										});
										const url = URL.createObjectURL(blob);
										const a = document.createElement('a');
										a.href = url;
										a.download = `lista-espera-${new Date().toISOString().slice(0, 10)}.csv`;
										a.click();
										URL.revokeObjectURL(url);
									}}
							>
								<Button type="submit" variant="outline" size="sm">
									<Download class="size-3.5" /> CSV
								</Button>
							</form>
						</div>
					</div>

					<div class="overflow-hidden rounded-xl border">
						<table class="w-full text-sm">
							<thead class="bg-muted/50 text-xs text-muted-foreground">
								<tr>
									<th class="px-3 py-2 text-left font-medium">Correo</th>
									<th class="px-3 py-2 text-left font-medium">Quiere ayudar</th>
									<th class="px-3 py-2 text-left font-medium">Se apuntó</th>
									<th class="px-3 py-2 text-right font-medium">Escrito</th>
								</tr>
							</thead>
							<tbody>
								{#each esperaFiltrada as e (e.id)}
									<tr
										class={`border-t transition-opacity ${ocupado.cargando(e.id) ? 'animate-pulse opacity-60' : ''}`}
										aria-busy={ocupado.cargando(e.id) || undefined}
									>
										<td class="px-3 py-2">
											<div class="flex flex-col">
												<a
													href={`mailto:${e.email}`}
													class="font-medium break-all hover:text-primary hover:underline"
												>
													{e.email}
												</a>
												{#if e.nombre}
													<span class="text-xs text-muted-foreground">{e.nombre}</span>
												{/if}
											</div>
										</td>
										<td class="px-3 py-2">
											{#if e.quiere_ayudar}
												<div class="flex flex-wrap items-center gap-1">
													<Badge class="border-transparent bg-primary/12 text-primary">
														<HandHeart class="size-3" /> Sí
													</Badge>
													{#each e.ayudas ?? [] as a (a)}
														<Badge variant="outline" class="text-[10px]">
															{AYUDA[a as keyof typeof AYUDA] ?? a}
														</Badge>
													{/each}
												</div>
											{:else}
												<span class="text-muted-foreground">—</span>
											{/if}
										</td>
										<td class="px-3 py-2 text-muted-foreground tabular-nums">
											{fecha(e.created_at)}
										</td>
										<td class="px-3 py-2 text-right">
											<form method="POST" action="?/contactado" use:enhance={alGuardar('Actualizado', e.id)}>
												<input type="hidden" name="id" value={e.id} />
												<input type="hidden" name="valor" value={e.contactado_at ? 'false' : 'true'} />
												<Button
													type="submit"
													variant={e.contactado_at ? 'secondary' : 'ghost'}
													size="sm"
													title={e.contactado_at
														? `Escrito el ${fecha(e.contactado_at)} · pulsa para desmarcar`
														: 'Marcar como escrito'}
												>
													<Check class={`size-3.5 ${e.contactado_at ? 'text-primary' : ''}`} />
													{e.contactado_at ? 'Hecho' : 'Marcar'}
												</Button>
											</form>
										</td>
									</tr>
								{:else}
									<tr>
										<td colspan="4" class="px-3 py-8 text-center text-muted-foreground">
											Nadie coincide con ese filtro.
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</Tabs.Content>
		{/if}

		<Tabs.Content value="sugerencias" class="flex flex-col gap-3 pt-3">
			{#if !data.sugerencias.length}
				<div class="rounded-xl border border-dashed p-10 text-center">
					<MessageSquare class="mx-auto size-8 text-muted-foreground/40" />
					<p class="mt-3 font-medium">El buzón está vacío</p>
					<p class="mt-1 text-sm text-muted-foreground">
						El botón flotante de sugerencias está en todas las pantallas menos en el panel.
					</p>
				</div>
			{:else}
				<div class="flex flex-wrap items-center gap-2">
					<Input bind:value={filtroSug} placeholder="Buscar en las sugerencias…" class="h-8 max-w-xs" />
					<Button
						variant={soloPendientes ? 'secondary' : 'outline'}
						size="sm"
						aria-pressed={soloPendientes}
						onclick={() => (soloPendientes = !soloPendientes)}
					>
						Solo las abiertas
					</Button>
				</div>

				<div class="flex flex-col gap-2">
					{#each sugerenciasFiltradas as s (s.id)}
						{@const t = TIPO[s.tipo as keyof typeof TIPO] ?? TIPO.otro}
						<article
							class={`flex flex-col gap-2 rounded-xl border bg-card p-4 transition-opacity ${
								ocupado.cargando(s.id) ? 'animate-pulse opacity-60' : ''
							} ${s.estado === 'resuelta' || s.estado === 'descartada' ? 'opacity-60' : ''}`}
							aria-busy={ocupado.cargando(s.id) || undefined}
						>
							<div class="flex flex-wrap items-center gap-2">
								<Badge class={`border-transparent ${t.clase}`}>
									<t.icono class="size-3" />
									{t.etiqueta}
								</Badge>
								{#if s.estado !== 'nueva'}
									<Badge variant="outline" class="text-[10px] capitalize">{s.estado}</Badge>
								{/if}
								{#if s.tarea_id}
									<Badge variant="outline" class="text-[10px]">
										<ClipboardCheck class="size-3" /> En tareas
									</Badge>
								{/if}
								<span class="ml-auto text-xs text-muted-foreground tabular-nums">
									{fecha(s.created_at)}
								</span>
							</div>

							<p class="text-sm leading-relaxed whitespace-pre-wrap">{s.mensaje}</p>

							<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
								{#if s.email}
									<a href={`mailto:${s.email}`} class="hover:text-primary hover:underline">
										<Mail class="mr-1 inline size-3" />{s.email}
									</a>
								{/if}
								{#if s.ruta}
									<span title="Pantalla desde la que se envió">
										<code class="rounded bg-muted px-1 py-0.5">{s.ruta}</code>
									</span>
								{/if}
							</div>

							<div class="flex flex-wrap gap-2 border-t pt-2">
								{#if !s.tarea_id}
									<form method="POST" action="?/aTarea" use:enhance={alGuardar('Apuntada como tarea', s.id)}>
										<input type="hidden" name="id" value={s.id} />
										<Button type="submit" variant="outline" size="sm">
											<ClipboardCheck class="size-3.5" /> Convertir en tarea
										</Button>
									</form>
								{/if}
								{#each [['vista', 'Vista'], ['resuelta', 'Resuelta'], ['descartada', 'Descartar']] as [valor, etiqueta] (valor)}
									{#if s.estado !== valor}
										<form method="POST" action="?/estado" use:enhance={alGuardar('Actualizada', s.id)}>
											<input type="hidden" name="id" value={s.id} />
											<input type="hidden" name="estado" value={valor} />
											<Button type="submit" variant="ghost" size="sm">{etiqueta}</Button>
										</form>
									{/if}
								{/each}
							</div>
						</article>
					{:else}
						<p class="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
							Nada coincide con ese filtro.
						</p>
					{/each}
				</div>
			{/if}
		</Tabs.Content>
	</Tabs.Root>
</div>
