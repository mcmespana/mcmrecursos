# Roadmap

## Fase 0 — Fundaciones ✅ (en curso)
- [x] Scaffold SvelteKit + Svelte 5 + Tailwind 4 + shadcn-svelte
- [x] Documentación spec-driven
- [x] BD operativa: esquema `recursos` en el proyecto compartido mcmvotaciones, migración 00001 aplicada (AD-6)
- [x] App conectada a Supabase (@supabase/ssr, hooks + locals, callback OAuth)
- [ ] Google OAuth configurado en el dashboard de Supabase (client ID/secret) — acción del usuario
- [ ] Login con Google + perfiles y roles en la UI (SPEC-001)

## Fase 1 — Catálogo y búsqueda
- [x] Modelo de datos validado y aplicado (migración 00002: recurso, tags, autores, itinerarios, facetas, lista_valor)
- [x] Seeds para el Sheet: `docs/seed/recursos_seed.csv` + `docs/seed/listas_seed.csv`
- [x] Sistema de diseño definido (`docs/04-diseno.md`) y tokens aplicados (fuentes, paleta, modo oscuro)
- [x] Sync Google Sheet → BD con ID estable (SPEC-005): función `sync_filas` probada; falta crear el Sheet y pegar el Apps Script documentado
- [ ] Buscador facetado con Orama + vista tarjetas + ficha de recurso
- [ ] Contador de accesos por recurso

## Fase 2 — Capa social
- [x] Valoraciones (estrellas), corazones/favoritos, "lo he usado" y accesos (SPEC-003, BD + UI optimista)
- [ ] Probar flujo social con sesión real (bloqueado por Google OAuth en dashboard)
- [ ] Listas personales de recursos
- [ ] Comentarios y sugerencias de mejora

## Fase 3 — El banco vivo
- [ ] Envío rápido multi-recurso con revisión (SPEC-004)
- [ ] Panel admin: cola de revisión, gestión de usuarios, sync manual
- [ ] Nuevas versiones de un recurso

## Fase 3.5 — Descubre (el tinder de recursos) 🎴
- [ ] Modo swipe sin IA: mazo desde filtros/presets, ❤/✕/abrir, deshacer (SPEC-007)
- [ ] Con IA (tras fase 5): mazo por texto libre con embeddings y explicación por tarjeta

## Fase 4 — Estadísticas
- [ ] Dashboard con LayerChart: top recursos, accesos, valoraciones, autores

## Fase 5 — Búsqueda con IA
- [ ] Embeddings (pgvector) + búsqueda híbrida con Orama
- [ ] "Recomiéndame una actividad para…" conversacional
