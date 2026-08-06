<script lang="ts">
	import { CircleAlert, ExternalLink } from '@lucide/svelte';

	/**
	 * «Esto ya está en el banco» (SPEC-008 §2).
	 *
	 * El error más fácil de cometer en un banco de enlaces es meter dos veces el mismo material: uno
	 * entra por el Sheet y otro por un envío, con el nombre escrito de otra forma, y nadie se da
	 * cuenta hasta que hay tres «Oración de la mañana». Este aviso pregunta al servidor mientras se
	 * escribe y enseña lo que se parece, con enlace para ir a mirarlo.
	 *
	 * **Nunca bloquea.** Puede ser una versión nueva, o un recurso legítimamente parecido: quien
	 * cataloga decide. Por eso es un aviso ámbar y no un error, y por eso el formulario sigue
	 * funcionando igual con el aviso puesto.
	 */
	let {
		enlace = '',
		titulo = '',
		excluir = null,
		soloExactos = false,
		/** Cómo se abre lo que ya existe: en la ficha pública o en el panel. */
		enlaceDe = (id: string) => `/?r=${id}`
	}: {
		enlace?: string;
		titulo?: string;
		excluir?: string | null;
		/**
		 * Solo avisar de coincidencias exactas (mismo archivo o mismo nombre), sin los «se parece».
		 * Se usa al EDITAR algo que ya está catalogado: ahí un 70 % de parecido con otro recurso es
		 * ruido que no se puede accionar, mientras que al dar de alta material nuevo sí interesa.
		 */
		soloExactos?: boolean;
		enlaceDe?: (id: string) => string;
	} = $props();

	interface Duplicado {
		id: string;
		nombre: string;
		estado: string;
		motivo: 'enlace' | 'nombre' | 'parecido';
		parecido: number;
	}

	let duplicados = $state<Duplicado[]>([]);
	let consultando = $state(false);

	const MOTIVO: Record<string, string> = {
		enlace: 'apunta al mismo archivo',
		nombre: 'se llama igual',
		parecido: 'se llama parecido'
	};

	/**
	 * Se pregunta 600 ms después de dejar de escribir. Sin retardo, pegar un enlace de Drive largo
	 * dispararía una petición por carácter.
	 */
	$effect(() => {
		const e = enlace.trim();
		const t = titulo.trim();
		if (!e && t.length < 6) {
			duplicados = [];
			return;
		}

		let vigente = true;
		const temporizador = setTimeout(async () => {
			consultando = true;
			try {
				const res = await fetch('/api/duplicados', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ enlace: e, titulo: t, excluir })
				});
				const json = await res.json();
				const encontrados = (json?.duplicados ?? []) as Duplicado[];
				if (vigente) {
					duplicados = soloExactos
						? encontrados.filter((d) => d.motivo !== 'parecido')
						: encontrados;
				}
			} catch {
				// si falla, simplemente no se avisa: es una ayuda, no un requisito
				if (vigente) duplicados = [];
			} finally {
				if (vigente) consultando = false;
			}
		}, 600);

		return () => {
			vigente = false;
			clearTimeout(temporizador);
		};
	});
</script>

{#if duplicados.length}
	<div
		class="flex flex-col gap-2 rounded-xl border border-warm/50 bg-warm/10 p-3 text-sm"
		role="status"
		aria-live="polite"
	>
		<p class="flex items-center gap-2 font-medium text-warm-foreground dark:text-warm">
			<CircleAlert class="size-4 shrink-0" />
			{duplicados[0].motivo === 'enlace'
				? 'Esto ya está en el banco'
				: 'Puede que esto ya esté en el banco'}
		</p>
		<ul class="flex flex-col gap-1">
			{#each duplicados as d (d.id)}
				<li class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
					<a
						href={enlaceDe(d.id)}
						target="_blank"
						rel="noopener noreferrer"
						class="inline-flex items-center gap-1 font-medium text-primary hover:underline"
					>
						{d.nombre.replace(/^\[EJEMPLO\]\s*/, '')}
						<ExternalLink class="size-3" />
					</a>
					<span class="text-xs text-muted-foreground">
						{MOTIVO[d.motivo] ?? 'se parece'}
						{#if d.motivo === 'parecido'}({Math.round(d.parecido * 100)}%){/if}
						{#if d.estado !== 'publicado'}· {d.estado}{/if}
					</span>
				</li>
			{/each}
		</ul>
		<p class="text-xs text-muted-foreground text-pretty">
			Si es una versión nueva o algo distinto, sigue adelante: esto es solo un aviso.
		</p>
	</div>
{/if}
