# 002 · Las estanterías de portada y el drawer de facetas: construir o retirar del doc

**Superficie:** portada, catálogo en móvil · **Riesgo:** medio · **Depende de:** nada

## Contexto

`docs/04-diseno.md` §4 describe dos piezas marcadas «🔜 no construido» desde 2026-08-20:

1. **Top / Descubrir**: estadísticas-héroe y estanterías horizontales con scroll-snap
   («Mejor valorados», «Más usados», «Novedades», tag de temporada).
2. **Drawer de facetas en móvil** con botón «Ver N recursos». Hoy hay un carrusel horizontal
   de chips que **se corta sin pista visual** de que hay más a la derecha.

Un documento de diseño con dos piezas descritas como si existieran es una trampa: cada
agente que lo lee da por hechas cosas que no están. Hay que resolver la contradicción en un
sentido o en el otro (`design.md` §0.5).

## Qué hacer

**Primero, decidir con la persona responsable**, porque las dos opciones son legítimas y una
de ellas es "no hacerlo":

- **El drawer de facetas sí conviene hacerlo.** El corte sin pista es un fallo real de
  descubribilidad y afecta al camino más transitado en móvil. Mínimo viable: los indicadores
  de desbordamiento que ya usa `FilterTabs` de MCM Bank (degradado a izquierda y derecha
  sobre el carrusel). El drawer completo, después, si sigue haciendo falta.
- **Las estanterías de portada, probablemente no todavía.** Según
  `docs/06-reflexion-uiux.md`, el banco tiene **siete recursos públicos**. Cuatro estanterías
  horizontales enseñando los mismos siete recursos cuatro veces se ve peor que no tenerlas
  (`design.md` §5: cualquier decisión que solo luzca con doscientos recursos hoy resta).

**Después, ejecutar la decisión y — pase lo que pase — dejar `docs/04-diseno.md` §4 diciendo
la verdad:** o se quitan los «🔜 no construido» porque ya están, o la sección se reescribe
como «dirección futura» claramente separada de lo que hay.

## Qué NO tocar

No construyas las estanterías "a medias" con datos de relleno. Un carrusel con tres tarjetas
repetidas es peor que su ausencia.

## Validación

`cd app && npm run check && npm run build`. Si haces el drawer o los indicadores: probar a
390 px con más facetas de las que caben y comprobar que se ve que hay más. Y releer
`docs/04-diseno.md` §4 de arriba abajo comprobando que cada frase describe algo que existe.
