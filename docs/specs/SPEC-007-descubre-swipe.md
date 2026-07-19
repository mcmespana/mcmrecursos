# SPEC-007 · "Descubre" — el tinder de recursos

> **Estado:** v1 (sin IA) IMPLEMENTADA en `/descubre` — mazo desde los filtros del buscador
> (misma sintaxis de URL), sesgo a mejor valorados con favoritos/usados al final, gestos
> táctiles con física (pointer events, solo `transform`), botones ✕/❤/ver, atajos ←/→/↑ y
> Z para deshacer, descartes por sesión (`sessionStorage`), «volver a barajar», misma ficha
> del buscador; sin login el ❤ cae en la capa local (SPEC-003) y el aviso invita a entrar.
> PENDIENTE: variante con IA (fase 5) y presets de mazo.
> **Depende de:** SPEC-002, SPEC-003 (favoritos); fase IA para la variante conversacional

## Objetivo

Modo de exploración lúdico: dices qué buscas ("sesión para 1º ESO sobre confianza, 45
min") y la app te va proponiendo recursos de uno en uno, a pantalla completa, estilo
swipe — descartar / guardar / abrir. Para cuando no sabes ni qué buscar: descubrimiento,
no búsqueda.

## Fases

1. **Sin IA (v1):** el "mazo" sale de los filtros normales (o de un preset) barajado con
   sesgo a mejor valorados / menos vistos por ti. Swipe izquierda = descartar (no repetir
   en esa sesión), derecha = ❤ favorito, arriba = abrir ficha completa. Contador de mazo,
   deshacer último swipe.
2. **Con IA (fase 5):** describes lo que necesitas en texto libre; embeddings (pgvector)
   arman el mazo por similitud + popularidad, y cada tarjeta explica en una línea por qué
   te lo propone ("María + 1º ESO + 45 min"). El feedback de swipes afina el mazo en vivo.

## Experiencia

- Gestos táctiles reales en móvil (arrastre con física, rotación sutil), botones en
  escritorio (✕ / ❤ / ver), atajos ← → ↑. Animaciones de salida con la firma de la app.
- Cada guardado cae en favoritos o en una lista elegida ("Campamento 2026").
- Requiere login para guardar; sin login se puede jugar pero invita a entrar al primer ❤.

## Criterios de aceptación (borrador)

- [x] Un mazo nunca repite recurso descartado en la misma sesión (sessionStorage, por pestaña).
- [x] Deshacer funciona (restaura la tarjeta y revierte el ❤ si lo hubo). El swipe anima
      solo con `transform` y sin transición durante el arrastre; pendiente de validar
      60 fps en un móvil de gama media real.
- [x] Lo guardado aparece en favoritos al instante (optimista; en local sin sesión). El
      guardado directo a una lista elegida queda para una iteración posterior (la ficha
      ya permite «Guardar en lista»).
