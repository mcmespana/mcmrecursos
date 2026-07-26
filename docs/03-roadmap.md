# Roadmap

## Fase 0 — Fundaciones ✅ (en curso)
- [x] Scaffold SvelteKit + Svelte 5 + Tailwind 4 + shadcn-svelte
- [x] Documentación spec-driven
- [x] BD operativa: esquema `recursos` en el proyecto compartido mcmvotaciones, migración 00001 aplicada (AD-6)
- [x] App conectada a Supabase (@supabase/ssr, hooks + locals, callback OAuth)
- [ ] Google OAuth configurado en el dashboard de Supabase (pendiente: falta client ID/secret
      de Google Cloud; mientras tanto, login alternativo por email+contraseña en `/entrar`)
- [x] Login con Google + perfiles, onboarding de MCM local (SPEC-001)

## Fase 1 — Catálogo y búsqueda
- [x] Modelo de datos validado y aplicado (migración 00002: recurso, tags, autores, itinerarios, facetas, lista_valor)
- [x] Seeds para el Sheet: `docs/seed/recursos_seed.csv` + `docs/seed/listas_seed.csv`
- [x] Sistema de diseño definido (`docs/04-diseno.md`) y tokens aplicados (fuentes, paleta, modo oscuro)
- [x] Sync Google Sheet → BD con ID estable (SPEC-005): función `sync_filas` probada; falta crear el Sheet y pegar el Apps Script documentado
- [x] Buscador facetado con Orama + vista tarjetas + ficha de recurso
- [x] Contador de accesos por recurso

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
- [x] /admin/recursos: tabla densa ordenable con filtro y edición completa (estado inline)
- [x] /admin/sync: última sync, historial con errores y resolución de conflictos (protección web persistente)
- [x] /admin/usuarios: roles, MCM local y activar/desactivar (con salvaguardas)
- [x] /admin/stats: tiles + más abiertos + mejor valorados + por estado
- [x] 13 MCM locales reales + acceso preautorizado (3 admins, 10 delegaciones como edición local)
- [x] Vista tabla para usuarios (SPEC-006 §2b): toggle galería/tabla (`?vista=tabla`),
      filas ~40 px sin imagen (miniatura de 32 px opcional), columnas configurables y
      reordenables recordadas en `localStorage`, ordenable por columna, misma ficha,
      facetas y URL que la galería
- [x] Facetas del buscador dirigidas por BD: el buscador público lee `recursos.faceta`
      (etiqueta, orden, visible, protegida) — añadir/renombrar filtros ya no toca código
- [x] /admin/config (SPEC-008 §config, solo admin) con pestañas: listas cerradas
      (`lista_valor`), facetas (`faceta`, incluye promocionar campos nuevos), MCM locales
      (`mcm_local`) y accesos preautorizados (`acceso_previo`, aplica al perfil si ya existe)
- [ ] Confirmar email limpio de Caravaca y preautorizarlo (única delegación sin editor;
      ya se puede dar de alta desde /admin/config → Accesos preautorizados)
- [x] Nuevas versiones de un recurso (SPEC-009, migración 00012): linaje `version_de`,
      la vigente oculta a las anteriores y hereda su valoración/uso/accesos; ficha con
      «versiones anteriores» y banner en las viejas; «Crear nueva versión» en /admin/recursos
- [x] Relacionados de verdad (afinidad por tags/tipo/etapas) y navegación ←/→ de la ficha
      dentro del filtro/mazo con posición y estado disabled

## 👉 SIGUIENTE

IA (SPEC-010, autoclasificación + búsqueda semántica) y dashboard de estadísticas (Fase 4)
ya están implementados — ver `docs/05-configuracion-servicios.md` para las claves pendientes
de configurar (Gemini, Voyage, cuenta de servicio de Drive, OAuth de Google).

### ⚠️ Estado de la rama ahora mismo (2026-07-26)

Todo el trabajo de esta sesión (versiones de recurso, IA, login, Drive, búsqueda semántica
y el dashboard de LayerChart) está **commiteado y pusheado** en la rama
`claude/tabla-admin-config-85va91`, verificado con `npm run check` + `npm run build` (0
errores) y, en el caso del dashboard, probado en navegador con capturas en claro/oscuro.
**No hay ningún PR abierto ni mergeado a `main` con el dashboard de estadísticas** — el
agente se detuvo ahí a propósito (el CLAUDE.md de este repo dice "no crear PRs sin que se
pidan") esperando confirmación. Si retomas esto sin ese contexto: revisa primero si la
rama ya se mergeó o sigue esperando `create_pull_request` + `merge_pull_request` (squash)
contra `main`.

La migración `supabase/migrations/00014_busqueda_semantica.sql` **ya está aplicada** en
remoto (proyecto `sjhxhsdckvungsrbquve`, esquema `recursos`) — no reaplicar.

Existe un usuario de servicio en Supabase Auth para entrar sin OAuth por `/entrar`
(enlace discreto en el `·` del footer): `asistente@movimientoconsolacion.com`, rol
`administrador`. La contraseña se entregó una sola vez por chat (no está en ningún
fichero del repo, y así debe seguir) — si se ha perdido, resetéala desde el dashboard de
Supabase (Authentication → Users).

**Librería de gráficas: LayerChart** (`layerchart@2.0.2`), instalada y en uso en
`/admin/stats`. Se evaluó **evilcharts.com** como alternativa a petición del usuario y se
descartó (2026-07-26): es una colección de componentes exclusiva de React/Next.js
(envuelve Recharts/ECharts), incompatible con Svelte sin reescribirla entera — detalle
completo y motivo en `docs/04-diseno.md` §6. Seguir con LayerChart para cualquier
gráfica nueva.

### Próximos pasos

1. Decidir si se abre/mergea el PR del dashboard (ver estado de la rama arriba).
2. Configurar Google OAuth en el dashboard de Supabase (sigue pendiente, Fase 0).
3. Confirmar email de Caravaca y preautorizarlo (Fase 3).
4. "Recomiéndame una actividad para…" conversacional en Descubre (Fase 5, requiere Voyage).
5. Más adelante: presets de mazo para Descubre y editor visual de itinerarios en /admin/config.

## Fase 3.5 — Descubre (el tinder de recursos) 🎴
- [x] Modo swipe sin IA (SPEC-007 v1): `/descubre` con mazo desde los filtros del buscador,
      sesgo a mejor valorados, gestos táctiles + botones + atajos de teclado, descartes por
      sesión, deshacer, volver a barajar y enlace en cabecera
- [ ] Presets de mazo configurables ("Adviento", "Para monitores"…)
- [ ] Con IA (tras fase 5): mazo por texto libre con embeddings y explicación por tarjeta

## Fase 4 — Estadísticas
- [x] Dashboard con LayerChart: serie de accesos (30 días), top recursos, mejor valorados
      y autores con más aperturas, sobre los tiles ya existentes en /admin/stats

## Fase 5 — IA (SPEC-010; motor Google Gemini)
- [x] Autoclasificación v1: botón «Analizar con IA» en /admin/recursos (Gemini Flash) que
      propone tipo/etapas/edades/nivel/idioma/soporte/tags/descripción + avisos; el editor
      aplica y publica (la IA nunca publica sola). Migración 00013 (`no_ia`, `clasificacion_ia`)
- [x] Leer el documento de Drive (cuenta de servicio) para clasificar con más contexto
- [x] «Analizar todo lo pendiente» en lote y en la cola de revisión
- [x] Embeddings (pgvector, Voyage 200M gratis) + búsqueda híbrida con Orama (etiqueta «por
      significado» en el buscador; migración 00014, «Reindexar búsqueda» en /admin/recursos)
- [ ] "Recomiéndame una actividad para…" conversacional en Descubre
