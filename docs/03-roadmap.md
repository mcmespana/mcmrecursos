# Roadmap

## Fase 0 — Fundaciones ✅ (en curso)
- [x] Scaffold SvelteKit + Svelte 5 + Tailwind 4 + shadcn-svelte
- [x] Documentación spec-driven
- [x] BD operativa: esquema `recursos` en el proyecto compartido mcmvotaciones, migración 00001 aplicada (AD-6)
- [x] App conectada a Supabase (@supabase/ssr, hooks + locals, callback OAuth)
- [x] Google OAuth configurado en el dashboard de Supabase
- [x] Login con Google + perfiles, onboarding de MCM local (SPEC-001)

## Fase 1 — Catálogo y búsqueda
- [x] Modelo de datos validado y aplicado (migración 00002: recurso, tags, autores, itinerarios, facetas, lista_valor)
- [x] Seeds para el Sheet: `docs/seed/recursos_seed.csv` + `docs/seed/listas_seed.csv`
- [x] Sistema de diseño definido (`docs/04-diseno.md`) y tokens aplicados (fuentes, paleta, modo oscuro)
- [x] Sync Google Sheet → BD con ID estable (SPEC-005): función `sync_filas` probada; falta crear el Sheet y pegar el Apps Script documentado
- [ ] Buscador facetado con Orama + vista tarjetas + ficha de recurso
- [ ] Contador de accesos por recurso

## Fase 2 — Capa social
- [x] Valoraciones (estrellas), corazones/favoritos, "lo he usado" y accesos (SPEC-003, BD + UI optimista)
- [x] Modo sin cuenta: valorar anónimo (BD, por dispositivo), corazones/usos/listas en localStorage con aviso, y migración automática a la cuenta al hacer login
- [x] Candado en recursos privados (los anónimos ni los ven, vía RLS)
- [x] Listas personales (crear desde la ficha, compartir por enlace público, /listas)
- [x] Comentarios y sugerencias de mejora (borrado por autor/editor)
- [x] Miniaturas automáticas desde Drive/YouTube con respaldo por familia

## Fase 3 — El banco vivo
- [x] SPEC-008 del panel de administración validada (revisión, edición con conflictos Sheet/web, usuarios, emails Resend)
- [x] Migración 00007: envio, editado_web_at, perfil.activo, conflictos en sync_filas (probados)
- [x] Envío rápido multi-recurso + "Mis envíos" con corregir-y-reenviar
- [x] /admin: shell con guard por rol + cola de revisión (publicar/devolver/descartar)
- [x] Emails Resend (plantillas listas; pegar RESEND_API_KEY cuando exista)
- [ ] /admin/recursos (tabla + formulario de edición), /admin/sync (conflictos visuales), /admin/usuarios, config y stats
- [ ] Nuevas versiones de un recurso

## Fase 3.5 — Descubre (el tinder de recursos) 🎴
- [ ] Modo swipe sin IA: mazo desde filtros/presets, ❤/✕/abrir, deshacer (SPEC-007)
- [ ] Con IA (tras fase 5): mazo por texto libre con embeddings y explicación por tarjeta

## Fase 4 — Estadísticas
- [ ] Dashboard con LayerChart: top recursos, accesos, valoraciones, autores

## Fase 5 — Búsqueda con IA
- [ ] Embeddings (pgvector) + búsqueda híbrida con Orama
- [ ] "Recomiéndame una actividad para…" conversacional
