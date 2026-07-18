<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { BookOpen, Search, Heart, Send } from '@lucide/svelte';

	const pilares = [
		{
			icon: Search,
			titulo: 'Busca al instante',
			texto: 'Filtros combinables y búsqueda de texto sobre todo el catálogo, sin esperas.'
		},
		{
			icon: Heart,
			titulo: 'Valora y guarda',
			texto: 'Estrellas, favoritos y listas propias para preparar tu próxima actividad.'
		},
		{
			icon: Send,
			titulo: 'Aporta en segundos',
			texto: 'Envía tus recursos en un momento y el equipo editor los catalogará.'
		}
	];
</script>

<svelte:head>
	<title>Banco de Recursos MCM</title>
	<meta
		name="description"
		content="Catálogo de recursos de tiempo libre del Movimiento Consolación para el Mundo"
	/>
</svelte:head>

<main class="mx-auto flex min-h-svh max-w-4xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
	<div class="flex flex-col items-center gap-4">
		<div class="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
			<BookOpen class="size-8" />
		</div>
		<Badge variant="secondary">En construcción</Badge>
		<h1 class="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
			Banco de Recursos <span class="text-primary">MCM</span>
		</h1>
		<p class="max-w-xl text-lg text-muted-foreground text-pretty">
			Actividades, dinámicas y materiales de tiempo libre del Movimiento Consolación para el
			Mundo, catalogados y listos para encontrar.
		</p>
	</div>

	<div class="grid gap-4 sm:grid-cols-3">
		{#each pilares as pilar (pilar.titulo)}
			<Card class="text-left">
				<CardContent class="flex flex-col gap-2 pt-2">
					<pilar.icon class="size-5 text-primary" />
					<h2 class="font-semibold">{pilar.titulo}</h2>
					<p class="text-sm text-muted-foreground">{pilar.texto}</p>
				</CardContent>
			</Card>
		{/each}
	</div>

	<Button size="lg" disabled>Muy pronto</Button>
</main>
