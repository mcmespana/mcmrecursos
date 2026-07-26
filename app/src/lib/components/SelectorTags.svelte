<script lang="ts">
	import { normalizarTags, partirTags, plano, slugTag } from '$lib/catalogo/tags';
	import { Check, Plus, Tags, X } from '@lucide/svelte';

	let {
		valor = $bindable([]),
		/** Temáticas que ya existen en el banco, de más usada a menos. */
		existentes = [],
		/** Nombre del campo oculto, para enviarlo dentro de un <form> normal. */
		nombre = undefined,
		placeholder = 'Escribe y pulsa Intro…',
		/** Cuántas temáticas populares se ofrecen de entrada. */
		populares = 12,
		id = undefined
	}: {
		valor?: string[];
		existentes?: string[];
		nombre?: string;
		placeholder?: string;
		populares?: number;
		id?: string;
	} = $props();

	let texto = $state('');
	let abierto = $state(false);
	let resaltado = $state(0);

	const slugsPuestos = $derived(new Set(valor.map(slugTag)));
	const canonico = $derived(new Map(existentes.map((t) => [slugTag(t), t])));

	// Sugerencias: filtradas por lo tecleado, sin las que ya están puestas.
	const coincidencias = $derived.by(() => {
		const q = plano(texto);
		return existentes
			.filter((t) => !slugsPuestos.has(slugTag(t)))
			.filter((t) => !q || plano(t).includes(q))
			.slice(0, q ? 8 : populares);
	});

	// ¿lo tecleado es una temática nueva de verdad, o ya existe con otra grafía?
	const yaExiste = $derived(!!texto.trim() && canonico.has(slugTag(texto)));
	const yaPuesta = $derived(!!texto.trim() && slugsPuestos.has(slugTag(texto)));
	const puedeCrear = $derived(!!texto.trim() && !yaExiste && !yaPuesta);

	function anadir(...nuevos: string[]) {
		valor = normalizarTags([...valor, ...nuevos], existentes);
		texto = '';
		resaltado = 0;
	}

	function quitar(tag: string) {
		const slug = slugTag(tag);
		valor = valor.filter((t) => slugTag(t) !== slug);
	}

	function confirmarTexto() {
		const partes = partirTags(texto);
		if (partes.length) anadir(...partes);
	}

	function teclas(e: KeyboardEvent) {
		if (e.key === 'Enter' || e.key === ',' || e.key === ';' || e.key === 'Tab') {
			// Tab solo captura si hay algo escrito, para no secuestrar la navegación del formulario
			if (e.key === 'Tab' && !texto.trim()) return;
			e.preventDefault();
			const elegida = coincidencias[resaltado];
			if (texto.trim() && elegida && plano(elegida).startsWith(plano(texto))) anadir(elegida);
			else if (texto.trim()) confirmarTexto();
			return;
		}
		if (e.key === 'Backspace' && !texto && valor.length) {
			valor = valor.slice(0, -1);
			return;
		}
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			abierto = true;
			resaltado = Math.min(resaltado + 1, coincidencias.length - 1);
		}
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			resaltado = Math.max(resaltado - 1, 0);
		}
		if (e.key === 'Escape') abierto = false;
	}

	function pegar(e: ClipboardEvent) {
		const bruto = e.clipboardData?.getData('text') ?? '';
		if (!/[,;\n]/.test(bruto)) return;
		e.preventDefault();
		anadir(...partirTags(bruto));
	}
</script>

<div class="flex flex-col gap-2">
	{#if nombre}
		<input type="hidden" name={nombre} value={valor.join(', ')} />
	{/if}

	<div
		class="flex flex-wrap items-center gap-1.5 rounded-lg border bg-background p-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
	>
		<Tags class="ml-1 size-4 shrink-0 text-muted-foreground" />
		{#each valor as tag (tag)}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-primary/12 py-1 pr-1 pl-2.5 text-sm font-medium text-primary"
			>
				{tag}
				<button
					type="button"
					class="rounded-full p-0.5 transition-colors hover:bg-primary/20"
					aria-label={`Quitar ${tag}`}
					onclick={() => quitar(tag)}
				>
					<X class="size-3" />
				</button>
			</span>
		{/each}
		<div class="relative min-w-40 flex-1">
			<input
				{id}
				bind:value={texto}
				type="text"
				autocomplete="off"
				class="w-full bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
				placeholder={valor.length ? 'Añadir otra…' : placeholder}
				onfocus={() => (abierto = true)}
				onblur={() => setTimeout(() => (abierto = false), 120)}
				oninput={() => {
					abierto = true;
					resaltado = 0;
				}}
				onkeydown={teclas}
				onpaste={pegar}
			/>

			{#if abierto && (coincidencias.length || puedeCrear || yaPuesta)}
				<div
					class="absolute top-full left-0 z-50 mt-1 flex max-h-64 w-full min-w-56 flex-col overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
				>
					{#if !texto.trim() && coincidencias.length}
						<p class="px-2 py-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
							Temáticas más usadas
						</p>
					{/if}
					{#each coincidencias as sugerencia, i (sugerencia)}
						<button
							type="button"
							class={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
								i === resaltado ? 'bg-accent' : 'hover:bg-accent/60'
							}`}
							onmousedown={(e) => {
								e.preventDefault();
								anadir(sugerencia);
							}}
						>
							<Check class="size-3.5 text-muted-foreground" />
							{sugerencia}
						</button>
					{/each}
					{#if yaPuesta}
						<p class="px-2 py-1.5 text-xs text-muted-foreground">Esa temática ya está puesta.</p>
					{:else if puedeCrear}
						<button
							type="button"
							class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent/60"
							onmousedown={(e) => {
								e.preventDefault();
								confirmarTexto();
							}}
						>
							<Plus class="size-3.5 text-primary" />
							Crear «{texto.trim()}»
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	{#if yaExiste && !yaPuesta}
		<p class="text-xs text-muted-foreground">
			Ya existe como «{canonico.get(slugTag(texto))}»: al pulsar Intro se usará esa.
		</p>
	{/if}
</div>
