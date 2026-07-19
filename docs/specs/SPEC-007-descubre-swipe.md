# SPEC-007 · "Descubre" — el tinder de recursos

> **Estado:** idea anotada (fase divertida, tras el buscador y la capa social)
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

- [ ] Un mazo nunca repite recurso descartado en la misma sesión.
- [ ] Swipe fluido a 60 fps en móvil de gama media; deshacer funciona.
- [ ] Lo guardado aparece en favoritos/lista al instante.
