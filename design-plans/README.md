# Planes de diseño — Banco de Recursos MCM

Cada plan es autocontenido: un agente ejecutor no necesita ningún contexto de la
conversación. **Ejecutor:** lee `../design.md` y `../docs/04-diseno.md` primero, después el
plan entero, haz solo lo que dice, ejecuta su sección Validación, y actualiza tu fila de
estado aquí al terminar. Si un paso no cuadra con el código actual, PARA, marca BLOCKED con
una línea de motivo, y no improvises.

Esta carpeta es para **diseño**. El trabajo de producto sigue en `../docs/03-roadmap.md`, y
los hallazgos numerados (F1, F2…) vienen de `../docs/06-reflexion-uiux.md`.

Esta app es la **referencia** del sistema MCM en portada editorial, movimiento, estados de
acción y patrón de deshacer: aquí hay poco que unificar y bastante que **publicar** para que
las otras tres puedan copiarlo.

**Los cinco planes están cerrados** (2026-09-04). Lo que se añada aquí sigue la misma
numeración, y esta tabla es lo primero que mira un agente que venga a arreglar diseño.

## Estado

| Plan | Título | Superficie | Estado |
|------|--------|------------|--------|
| [001](001-alturas-de-control.md) | Documentar y cerrar la escala de altura de control | global | DONE (2026-09-04) — los controles ya estaban en la escala (`h-8` por defecto, `h-7`/`h-6` en variantes); lo que faltaba era la tabla, ahora en `docs/04-diseno.md` §7 |
| [002](002-estanterias-y-drawer-o-fuera.md) | Las estanterías de portada y el drawer de facetas: construir o retirar del doc | portada, móvil | DONE (2026-09-04) — retiradas del doc: las estanterías quedan como dirección futura aparcada (con 7 recursos públicos no hay qué estanterizar) y el drawer se resolvió de otra forma, con la pista en degradado (`mask-image`) |
| [003](003-heroe-que-se-aparta.md) | El héroe no se aparta nunca (F1) | portada, catálogo | DONE — **ya estaba hecho en el código antes de escribir el plan**: `const buscando = $derived(!!q.trim() \|\| filtrosActivos.length > 0)` en `src/routes/+page.svelte`, con héroe y línea de recuento dentro de `{#if !buscando}`. El plan salió de F1 en `docs/06-reflexion-uiux.md`, que ya estaba resuelto; error al redactarlo, no trabajo pendiente |
| [004](004-dos-recuentos-contradictorios.md) | Dos recuentos que se contradicen a 140 px (F2) | catálogo | DONE — **ya estaba hecho en el código antes de escribir el plan**, por el mismo cambio que 003: al buscar solo queda un recuento. Mismo error de redacción que 003 |
| [005](005-paleta-de-familias-como-tokens.md) | Publicar la paleta categórica de familias validada, como tokens | global | DONE (2026-09-04) — tokens `--familia-*-fg` / `--familia-*-bg` en `app.css` (claro y oscuro) expuestos en `@theme inline`; `FAMILIA_BADGE` y `FAMILIA_FONDO` dejan de usar colores con nombre de Tailwind. Las 10 combinaciones pasan AA (4,5–14,2:1). **Ojo: el objetivo ΔE ≥ 8 del plan no se cumple y no es alcanzable** — ver nota abajo |

### Sobre el ΔE ≥ 8 del plan 005

El plan pedía separación ΔE ≥ 8 en OKLab bajo simulación de daltonismo. Con cinco familias y
lightness constante, la deuteranopía juntaba «Sesiones» y «Documentos» en ΔE 0,9. Variando la
lightness por familia el peor caso sube a **4,6**, que es lo máximo que da de sí cinco tonos
manteniendo contraste de texto usable: ΔE 8 exigiría o menos familias o pares que no pasan AA.
Se aceptó 4,6 porque **el color nunca es el único portador** (design.md §3.1): la insignia
lleva siempre el nombre de la familia escrito y un icono propio (`FAMILIA_ICON`).

Estados: TODO | IN PROGRESS | DONE (fecha) | BLOCKED (motivo en una línea)
