<script lang="ts">
	import { Check } from '@lucide/svelte';

	let {
		etiqueta,
		opciones = [],
		valor = $bindable([]),
		/** Nombre del campo: se emite un input oculto por cada valor marcado. */
		nombre = undefined,
		ayuda = undefined
	}: {
		etiqueta: string;
		opciones?: { valor: string; grupo?: string | null }[];
		valor?: string[];
		nombre?: string;
		ayuda?: string;
	} = $props();

	const todos = $derived(opciones.map((o) => o.valor));
	const puestos = $derived(new Set(valor));
	const todasPuestas = $derived(todos.length > 0 && todos.every((v) => puestos.has(v)));

	// Agrupación por `lista_valor.grupo` (Primaria, Secundaria, Jóvenes…), respetando el orden.
	const grupos = $derived.by(() => {
		const mapa = new Map<string, string[]>();
		for (const o of opciones) {
			const clave = o.grupo ?? '';
			if (!mapa.has(clave)) mapa.set(clave, []);
			mapa.get(clave)!.push(o.valor);
		}
		return [...mapa.entries()];
	});

	const alternar = (v: string) =>
		(valor = puestos.has(v) ? valor.filter((x) => x !== v) : [...valor, v]);

	const marcarTodas = () => (valor = [...todos]);
	const marcarNinguna = () => (valor = []);

	function alternarGrupo(valores: string[]) {
		const completo = valores.every((v) => puestos.has(v));
		valor = completo
			? valor.filter((v) => !valores.includes(v))
			: [...new Set([...valor, ...valores])];
	}
</script>

<fieldset class="flex flex-col gap-2">
	<div class="flex flex-wrap items-center gap-2">
		<legend class="text-sm font-medium">{etiqueta}</legend>
		<!-- Atajos: rellenar el apartado entero o dejarlo explícitamente vacío -->
		<div class="ml-auto flex items-center gap-1">
			<button
				type="button"
				class={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
					todasPuestas
						? 'border-primary bg-primary/12 text-primary'
						: 'text-muted-foreground hover:bg-accent'
				}`}
				onclick={marcarTodas}
			>
				Todas
			</button>
			<button
				type="button"
				class={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
					valor.length === 0
						? 'border-primary bg-primary/12 text-primary'
						: 'text-muted-foreground hover:bg-accent'
				}`}
				title="No aplica: dejar este apartado sin rellenar"
				onclick={marcarNinguna}
			>
				N/A
			</button>
		</div>
	</div>

	{#if ayuda}
		<p class="text-xs text-muted-foreground">{ayuda}</p>
	{/if}

	<!--
		Los grupos van todos en el mismo contenedor y fluyen: con listas cortas (Etapas) se
		leen igual, y con las largas (Edades: Primaria/Secundaria/Jóvenes/Adultos) dos grupos
		comparten fila cuando caben en vez de gastar una línea cada uno. La etiqueta del grupo
		no se separa nunca de sus valores.
	-->
	<div class="flex flex-wrap items-center gap-x-1.5 gap-y-1">
		{#each grupos as [grupo, valores] (grupo)}
			<div class="flex flex-wrap items-center gap-1.5">
				{#if grupo}
					<button
						type="button"
						class="rounded px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase hover:text-primary"
						title={`Marcar o desmarcar ${grupo}`}
						onclick={() => alternarGrupo(valores)}
					>
						{grupo}
					</button>
				{/if}
				{#each valores as v (v)}
					<button
						type="button"
						aria-pressed={puestos.has(v)}
						class={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[13px] transition-colors ${
							puestos.has(v)
								? 'border-primary bg-primary/12 font-medium text-primary'
								: 'hover:bg-accent'
						}`}
						onclick={() => alternar(v)}
					>
						{#if puestos.has(v)}<Check class="size-3" />{/if}
						{v}
					</button>
				{/each}
			</div>
		{/each}
	</div>

	{#if nombre}
		{#each valor as v (v)}
			<input type="hidden" name={nombre} value={v} />
		{/each}
	{/if}
</fieldset>
