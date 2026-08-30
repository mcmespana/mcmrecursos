<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import FormularioSugerencia from '$lib/components/comunidad/FormularioSugerencia.svelte';
	import { comunidad } from '$lib/comunidad/estado.svelte';
	import { BellRing, Bug, Lightbulb, Search, Send } from '@lucide/svelte';

	/**
	 * `/sugerencias` — el buzón con dirección propia (SPEC-017 §2).
	 *
	 * El botón flotante sirve para el impulso («esto no va, lo digo ahora»); esta página sirve
	 * para lo otro: pegarla en un grupo de WhatsApp de monitores y que quien entre sepa a qué
	 * viene. Por eso aquí sí hay contexto —qué se hace con lo que se manda— y no solo un
	 * formulario, y por eso el correo de la lista de espera está también, que es la otra cosa
	 * que se puede querer hacer al llegar por un enlace así.
	 */

	const QUE_SIRVE = [
		{
			icono: Lightbulb,
			titulo: 'Ideas',
			texto: 'Lo que te ayudaría a preparar una sesión más rápido. Aunque suene raro.'
		},
		{
			icono: Bug,
			titulo: 'Fallos',
			texto: 'Algo que no carga, un filtro que no filtra, un botón que no hace nada.'
		},
		{
			icono: Search,
			titulo: 'Lo que falta',
			texto: 'Qué buscaste y no encontraste. Es lo que más nos ordena el trabajo.'
		}
	];
</script>

<svelte:head>
	<title>Sugerencias · Banco de Recursos MCM</title>
	<meta
		name="description"
		content="Cuéntanos una idea, avísanos de un fallo o dinos qué recurso echas en falta en el Banco de Recursos del MCM."
	/>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
	<header class="flex flex-col gap-3">
		<p class="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">
			Buzón abierto
		</p>
		<h1 class="font-display text-4xl leading-tight font-extrabold text-balance">
			Esto lo estamos construyendo entre todos 🛠️
		</h1>
		<p class="max-w-xl text-[1.02rem] leading-relaxed text-pretty text-muted-foreground">
			El Banco de Recursos está recién montado y todavía tiene esquinas sin lijar. Si ves algo
			—una idea, un fallo, un recurso que echas en falta— cuéntanoslo aquí. No hace falta
			cuenta ni dejar el correo.
		</p>
	</header>

	<section class="grid gap-3 sm:grid-cols-3">
		{#each QUE_SIRVE as q (q.titulo)}
			<div class="flex flex-col gap-1.5 rounded-xl border bg-card p-4">
				<q.icono class="size-5 text-primary" />
				<p class="text-sm font-semibold">{q.titulo}</p>
				<p class="text-xs leading-relaxed text-muted-foreground">{q.texto}</p>
			</div>
		{/each}
	</section>

	<section class="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
		<h2 class="font-display text-xl font-bold">¿Qué nos quieres contar?</h2>
		<FormularioSugerencia enfocar={false} />
	</section>

	<!--
		Las otras dos cosas que se pueden querer hacer desde un enlace a esta página, en el orden
		en que aportan: enviar material vale mucho más que apuntarse a una lista, así que va
		primero y con el botón sólido.
	-->
	<section class="grid gap-3 sm:grid-cols-2">
		<div class="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 p-5">
			<p class="font-display text-lg font-bold">¿Tienes recursos?</p>
			<p class="text-sm leading-relaxed text-muted-foreground">
				No hace falta esperar a que el banco esté lleno: con el enlace a tu carpeta o a tu
				documento nos vale. Del resto —clasificarlo, ponerle etiquetas— nos encargamos.
			</p>
			<Button href="/enviar" class="mt-1 self-start">
				<Send class="size-4" /> Enviar un recurso
			</Button>
		</div>

		<div class="flex flex-col gap-2 rounded-xl border bg-muted/40 p-5">
			<p class="font-display text-lg font-bold">¿Prefieres que te avisemos?</p>
			<p class="text-sm leading-relaxed text-muted-foreground">
				Déjanos tu correo y te escribimos en cuanto empiece a entrar material de verdad. Ni un
				correo antes.
			</p>
			<Button
				variant="outline"
				class="mt-1 self-start"
				onclick={() => comunidad.abrirBienvenida('boton')}
			>
				<BellRing class="size-4" /> Avisadme
			</Button>
		</div>
	</section>
</div>
