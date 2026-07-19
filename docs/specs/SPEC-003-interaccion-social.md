# SPEC-003 · Capa social: valoraciones, favoritos, listas, comentarios

> **Estado:** implementada en su núcleo (migración 00004: valoracion, favorito, uso,
> acceso, vista recurso_stats, RPC registrar_acceso; UI optimista en tarjeta y ficha).
> Pendiente: listas, comentarios, y probar el flujo con sesión real cuando Google OAuth
> esté configurado en el dashboard.
> **Depende de:** SPEC-001, SPEC-002

## Objetivo

Que la comunidad haga emerger los mejores recursos: estrellas, corazones, "lo he usado",
listas personales, comentarios y sugerencias de mejora.

## Modelo de datos (borrador)

- `valoracion` (perfil, recurso, estrellas 1-5, opcional texto) — única por usuario+recurso.
- `favorito` (perfil, recurso) — el "corazón".
- `uso` (perfil, recurso, fecha) — "lo he usado", repetible.
- `lista` + `lista_recurso` — listas personales, opcionalmente compartibles por enlace.
- `comentario` (perfil, recurso, texto, tipo: comentario | sugerencia).
- `acceso` (recurso, perfil nullable, timestamp) — clics al enlace, también de anónimos.

## Criterios de aceptación

- [ ] Media y nº de valoraciones visibles en tarjeta y ficha, actualizadas al valorar.
- [ ] Favoritos y listas accesibles desde el menú del usuario.
- [ ] Anon que interactúa → invitación a login sin perder el contexto.

## Preguntas abiertas

- ¿Comentarios moderados a posteriori o pre-aprobados?
- ¿Las listas pueden ser públicas/destacadas (p. ej. "Campamento 2026")?
