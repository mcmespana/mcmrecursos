<script lang="ts">
	import { browser } from '$app/environment';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import IconoFormato from '$lib/components/IconoFormato.svelte';
	import RecursoFicha from '$lib/components/RecursoFicha.svelte';
	import LoginDialog from '$lib/components/LoginDialog.svelte';
	import { socialLocal } from '$lib/social/local.svelte';
	import { limpiarNombre } from '$lib/catalogo/tipos';
	import type { RecursoCatalogo } from '$lib/catalogo/tipos';
	import { ArrowLeft, ExternalLink, ListOrdered, PanelRight } from '@lucide/svelte';

	/**
	 * Recorrer un itinerario (SPEC-015).
	 *
	 * Numerado y de arriba abajo: el orden **es** el contenido, así que cada fila lleva su número y
	 * no hay rejilla que invite a picotear. Los tramos solo aparecen si el itinerario está partido.
	 *
	 * Cada fila abre la **ficha de siempre** en el panel lateral, y ahí el anterior/siguiente
	 * recorre el itinerario en SU orden, no el catálogo — que es justo lo que convierte esto en un
	 * recorrido y no en una lista de enlaces. Los «relacionados» se apagan a propósito: aquí lo que
	 * viene después no es lo que se parece, es lo siguiente del guion.
	 */
	let { data } = $props();
	const it = $derived(data.itinerario);
	const simple = $derived(it.bloques.length === 1 && !it.bloques[0].nombre);

	/** Lista plana en el orden del itinerario: es la que gobierna el anterior/siguiente. */
	const enOrden = $derived(it.bloques.flatMap((b: any) => b.recursos) as RecursoCatalogo[]);
	const total = $derived(enOrden.length);

	let abierto = $state<RecursoCatalogo | null>(null);
	let loginAbierto = $state(false);
	const indice = $derived(abierto ? enOrden.findIndex((r) => r.id === abierto!.id) : -1);

	function navegar(direccion: 1 | -1) {
		if (indice < 0) return;
		const siguiente = enOrden[indice + direccion];
		if (siguiente) abierto = siguiente;
	}

	function primerNumero(indiceBloque: number) {
		let n = 1;
		for (let i = 0; i < indiceBloque; i++) n += it.bloques[i].recursos.length;
		return n;
	}

	// --- capa social, igual que en el catálogo y en Descubre: optimista, y local sin sesión ---
	const favoritos = new SvelteSet<string>();
	const usos = new SvelteSet<string>();
	const valoraciones = new SvelteMap<string, number>();
	$effect(() => {
		if (browser) socialLocal.cargar();
	});
	const esFavorito = (id: string) =>
		data.session ? favoritos.has(id) : socialLocal.favoritos.has(id);
	const esUsado = (id: string) => (data.session ? usos.has(id) : socialLocal.usos.has(id));
	const miValoracionDe = (id: string) =>
		(data.session ? valoraciones.get(id) : socialLocal.valoraciones.get(id)) ?? null;

	async function toggleFavorito(r: RecursoCatalogo) {
		if (!data.session) return socialLocal.toggleFavorito(r.id);
		const tenia = favoritos.has(r.id);
		if (tenia) favoritos.delete(r.id);
		else favoritos.add(r.id);
		const { error } = tenia
			? await data.supabase.from('favorito').delete().eq('recurso_id', r.id)
			: await data.supabase
					.from('favorito')
					.insert({ recurso_id: r.id, perfil_id: data.session.user.id });
		if (error) {
			if (tenia) favoritos.add(r.id);
			else favoritos.delete(r.id);
			toast.error('No se pudo guardar el favorito');
		}
	}

	async function toggleUsado(r: RecursoCatalogo) {
		if (!data.session) return socialLocal.toggleUso(r.id);
		const tenia = usos.has(r.id);
		if (tenia) usos.delete(r.id);
		else usos.add(r.id);
		const { error } = tenia
			? await data.supabase.from('uso').delete().eq('recurso_id', r.id)
			: await data.supabase.from('uso').insert({ recurso_id: r.id, perfil_id: data.session.user.id });
		if (error) {
			if (tenia) usos.add(r.id);
			else usos.delete(r.id);
			toast.error('No se pudo registrar el uso');
		}
	}

	async function valorar(r: RecursoCatalogo, estrellas: number) {
		if (!data.session) {
			socialLocal.valorar(r.id, estrellas);
			await data.supabase.rpc('valorar_anon', {
				rid: r.id,
				estrellas_in: estrellas,
				dispositivo: socialLocal.dispositivo
			});
			return;
		}
		valoraciones.set(r.id, estrellas);
		const { error } = await data.supabase
			.from('valoracion')
			.upsert({ recurso_id: r.id, perfil_id: data.session.user.id, estrellas });
		if (error) toast.error('No se pudo guardar la valoración');
	}

	async function entrarConGoogle() {
		const { error } = await data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: { redirectTo: `${location.origin}/auth/callback` }
		});
		if (error) toast.error('No se pudo iniciar sesión', { description: error.message });
	}

	const registrarAcceso = (r: RecursoCatalogo) =>
		data.supabase.rpc('registrar_acceso', { rid: r.id });

	function abrirRecurso(r: RecursoCatalogo, enlace?: string) {
		const destino = enlace ?? r.enlace;
		if (!destino) return;
		registrarAcceso(r);
		window.open(destino, '_blank', 'noopener,noreferrer');
	}
</script>

<svelte:head>
	<title>{it.nombre} · Itinerarios · Banco de Recursos MCM</title>
	{#if it.descripcion}<meta name="description" content={it.descripcion} />{/if}
</svelte:head>

<main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-8 pb-12 sm:px-6">
	<a
		href="/itinerarios"
		class="toque inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
	>
		<ArrowLeft class="size-4" /> Todos los itinerarios
	</a>

	<header class="flex flex-col gap-3">
		{#if it.borrador}
			<Badge variant="outline" class="w-fit text-muted-foreground">
				Borrador — solo lo ves porque tienes permisos
			</Badge>
		{/if}
		{#if it.imagen}
			<img
				src={it.imagen}
				alt=""
				class="aspect-[3/1] w-full rounded-2xl border border-border object-cover"
			/>
		{/if}
		<h1 class="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
			{it.nombre}
		</h1>
		{#if it.descripcion}
			<p class="max-w-[65ch] text-[17px]/[1.6] text-muted-foreground [text-wrap:pretty]">
				{it.descripcion}
			</p>
		{/if}
		<div class="flex flex-wrap items-center gap-2">
			<span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
				<ListOrdered class="size-4" />
				{total}
				{total === 1 ? 'recurso' : 'recursos'}
				{#if !simple}<span class="text-muted-foreground/60">· {it.bloques.length} tramos</span>{/if}
			</span>
			{#each it.etapas as e (e)}
				<Badge variant="secondary" class="font-normal">{e}</Badge>
			{/each}
			{#each it.edades as e (e)}
				<Badge variant="outline" class="font-normal text-muted-foreground">{e}</Badge>
			{/each}
		</div>
	</header>

	{#if total === 0}
		<p
			class="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground"
		>
			Este itinerario todavía no tiene recursos.
		</p>
	{/if}

	{#each it.bloques as bloque, ib (bloque.id)}
		{#if bloque.recursos.length}
			<section class="flex flex-col gap-3">
				{#if bloque.nombre}
					<div class="flex flex-col gap-0.5 border-b border-border pb-2">
						<h2 class="font-display text-xl font-bold">{bloque.nombre}</h2>
						{#if bloque.descripcion}
							<p class="text-sm text-muted-foreground [text-wrap:pretty]">{bloque.descripcion}</p>
						{/if}
					</div>
				{/if}

				<ol class="flex flex-col gap-2">
					{#each bloque.recursos as r, i (r.id)}
						<li
							class="group flex items-start gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-primary/30"
						>
							<span
								class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary tabular-nums"
							>
								{primerNumero(ib) + i}
							</span>

							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<button
									type="button"
									class="flex items-center gap-2 text-left font-semibold underline-offset-4 hover:underline"
									onclick={() => (abierto = r)}
								>
									<IconoFormato enlace={r.enlace} formato={r.formato} class="size-4 shrink-0" />
									<span class="min-w-0 truncate">{limpiarNombre(r.nombre)}</span>
								</button>
								{#if r.descripcion}
									<p class="line-clamp-2 text-[13px]/[1.5] text-muted-foreground [text-wrap:pretty]">
										{r.descripcion}
									</p>
								{/if}
								<p class="flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
									{#if r.tipo}<span>{r.tipo}</span>{/if}
									{#if r.edades?.length}
										<span class="text-muted-foreground/60">
											para {r.edades.slice(0, 3).join(', ')}
										</span>
									{/if}
								</p>
							</div>

							<!--
								Dos acciones y las dos importan: «Ver detalles» abre la ficha —que es donde
								está la vista previa, la valoración y el anterior/siguiente del itinerario— y
								«Abrir» va directo al material para quien ya sabe lo que busca.
							-->
							<div class="flex shrink-0 flex-col gap-1.5 sm:flex-row">
								<Button variant="outline" size="sm" onclick={() => (abierto = r)}>
									<PanelRight class="size-3.5" /> <span class="hidden sm:inline">Ver detalles</span>
								</Button>
								{#if r.enlace}
									<Button size="sm" onclick={() => abrirRecurso(r)}>
										<ExternalLink class="size-3.5" /> Abrir
									</Button>
								{/if}
							</div>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/each}
</main>

<!--
	La ficha de siempre, pero recorriendo el itinerario: `indice`/`total` salen de la lista plana en
	su orden, así que el anterior/siguiente del panel avanza por el guion. `relacionados` va vacío
	a propósito (ver la nota de arriba).
-->
<RecursoFicha
	supabase={data.supabase}
	session={data.session}
	conEstadoEditorial={!!data.perfil &&
		['edicion_local', 'editor', 'administrador'].includes(data.perfil.rol)}
	puedeModerar={data.perfil?.rol === 'editor' || data.perfil?.rol === 'administrador'}
	onrequierelogin={() => (loginAbierto = true)}
	recurso={abierto}
	familia={null}
	relacionados={[]}
	favorito={abierto ? esFavorito(abierto.id) : false}
	usado={abierto ? esUsado(abierto.id) : false}
	miValoracion={abierto ? miValoracionDe(abierto.id) : null}
	{indice}
	{total}
	onclose={() => (abierto = null)}
	onnavegar={navegar}
	onabrirrelacionado={(r) => (abierto = r)}
	onfavorito={toggleFavorito}
	onusado={toggleUsado}
	onvalorar={valorar}
	onabrir={abrirRecurso}
	onacceso={registrarAcceso}
/>

<LoginDialog bind:open={loginAbierto} onentrar={entrarConGoogle} />
