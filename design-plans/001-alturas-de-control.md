# 001 · Documentar y cerrar la escala de altura de control

**Superficie:** global · **Riesgo:** bajo · **Depende de:** nada

## Contexto

`design.md` §3.3 fija para las cuatro apps: `sm` 28 px · `default` 32 px · `lg` 36 px en
escritorio, con la zona sensible ampliada a 44 px en punteros gruesos mediante `.toque`.

Esta app **ya está prácticamente ahí**: `app/src/lib/components/ui/button/button.svelte` tiene
`default: h-8`, `sm: h-7`, `lg: h-9`, `xs: h-6`, y `.toque` / `.toque-encima` viven en
`app/src/app.css`. Es, de hecho, de donde sale la regla. Lo que falta es cerrarla y dejarla
escrita para que las otras tres la copien sin tener que leer el código.

## Qué hacer

1. Revisar que los demás controles siguen la misma escala:
   ```bash
   grep -rn "h-9\|h-10\|h-11\|h-12" app/src/lib/components/ui
   ```
   `input`, `select`, `combobox`, `trigger` de faceta y `tabs` deben coincidir con `button`.
   Donde no coincidan, ajustar al valor equivalente.
2. Comprobar que **todo control interactivo por debajo de 44 px lleva `.toque`** (o
   `.toque-encima` si es `absolute`):
   ```bash
   grep -rLn "toque" $(grep -rl "onclick\|on:click" app/src/lib/components --include=*.svelte)
   ```
   Revisar la lista a mano; no todo lo que tiene click es un control táctil pequeño.
3. Añadir a `docs/04-diseno.md` §7 la tabla de alturas, junto a la explicación de `.toque`
   que ya está. Es la pieza que falta para que sea copiable.

## Qué NO tocar

`.toque` solo debe activarse dentro de `@media (pointer: coarse)`. No lo saques de ahí: con
ratón, ampliar la zona solo roba clics a lo que tiene al lado.

## Validación

`cd app && npm run check && npm run build`. A 390 px, comprobar con las herramientas de
desarrollo que ningún control interactivo tiene una zona sensible menor de 44×44.
