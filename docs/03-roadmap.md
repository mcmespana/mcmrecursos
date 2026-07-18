# Roadmap

## Fase 0 — Fundaciones ✅ (en curso)
- [x] Scaffold SvelteKit + Svelte 5 + Tailwind 4 + shadcn-svelte
- [x] Documentación spec-driven
- [ ] Proyecto Supabase creado y migración inicial aplicada (bloqueado: límite free)
- [ ] Login con Google + perfiles y roles (SPEC-001)

## Fase 1 — Catálogo y búsqueda
- [ ] Modelo de datos de `recurso` definido con el Sheet real (SPEC-002)
- [ ] Sync Google Sheet → BD con ID estable (SPEC-005)
- [ ] Buscador facetado con Orama + vista tarjetas + ficha de recurso
- [ ] Contador de accesos por recurso

## Fase 2 — Capa social
- [ ] Valoraciones (estrellas), corazones/favoritos, "lo he usado" (SPEC-003)
- [ ] Listas personales de recursos
- [ ] Comentarios y sugerencias de mejora

## Fase 3 — El banco vivo
- [ ] Envío rápido multi-recurso con revisión (SPEC-004)
- [ ] Panel admin: cola de revisión, gestión de usuarios, sync manual
- [ ] Nuevas versiones de un recurso

## Fase 4 — Estadísticas
- [ ] Dashboard con LayerChart: top recursos, accesos, valoraciones, autores

## Fase 5 — Búsqueda con IA
- [ ] Embeddings (pgvector) + búsqueda híbrida con Orama
- [ ] "Recomiéndame una actividad para…" conversacional
