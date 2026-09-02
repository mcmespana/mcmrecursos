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

**Orden recomendado:** `003` → `004` → `002` → `005` → `001`.

## Estado

| Plan | Título | Superficie | Estado |
|------|--------|------------|--------|
| [001](001-alturas-de-control.md) | Documentar y cerrar la escala de altura de control | global | TODO |
| [002](002-estanterias-y-drawer-o-fuera.md) | Las estanterías de portada y el drawer de facetas: construir o retirar del doc | portada, móvil | TODO |
| [003](003-heroe-que-se-aparta.md) | El héroe no se aparta nunca (F1) | portada, catálogo | TODO |
| [004](004-dos-recuentos-contradictorios.md) | Dos recuentos que se contradicen a 140 px (F2) | catálogo | TODO |
| [005](005-paleta-de-familias-como-tokens.md) | Publicar la paleta categórica de familias validada, como tokens | global | TODO |

Estados: TODO | IN PROGRESS | DONE (fecha) | BLOCKED (motivo en una línea)
