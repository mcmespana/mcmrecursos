# SPEC-015 · Itinerarios de recursos

> **Estado:** **implementada (2026-08-20)** — migración `00026` aplicada, `/admin/itinerarios`
> (listado + editor) y `/itinerarios` + `/itinerarios/[id]` en marcha. Ver §Lo construido al final.
> **Depende de:** SPEC-002 (catálogo), SPEC-006 §3 (la vista «Itinerario» ya prevista),
> SPEC-008 (el «editor visual de itinerarios» ya listado como pendiente en `/admin/config`)

## Objetivo

Un conjunto **ordenado** de recursos pensado para recorrerse en un orden concreto —el ejemplo
que lo dispara: veinte recursos de un campamento, con una explicación general de qué es el
itinerario y por qué esos veinte van en ese orden— en vez de una lista suelta.

Esto **no es una idea nueva sobre el papel**: la migración 00002 ya creó
`recursos.itinerario` + `itinerario_bloque` + `recurso_bloque` con el comentario literal
«estructura lista; contenido se definirá más adelante», SPEC-006 §3 ya describe una vista
«eliges etapa → itinerario → bloques en orden con sus recursos colgando», y SPEC-008 ya lista
un «editor visual de itinerarios» como pendiente. Nadie ha construido nunca una pantalla
encima — cero referencias en `app/src/`. Esta spec es la primera vez que se completa esa
promesa, no una entidad rival de `lista`.

## Por qué no es lo mismo que una `lista`

Ya existe `lista` + `lista_recurso` (SPEC-003): cualquiera con cuenta se hace una, la comparte
por enlace, y sirve perfectamente para «los recursos que he guardado». Un itinerario es otra
cosa en tres sentidos:

1. **Tiene orden narrativo**, no solo pertenencia. Una lista es un conjunto; un itinerario es
   una secuencia — el recurso 3 viene después del 2 a propósito.
2. **Tiene texto propio**, más allá del nombre: una explicación general de para qué sirve el
   itinerario entero, y opcionalmente una explicación por tramo (ver «bloques» abajo).
3. **Lo escribe el equipo editor, no cada usuario.** Una lista es personal; un itinerario es
   contenido editorial del banco, con su propia ficha pública, como un recurso más.

## Alcance

**Entra:**

- Página pública `/itinerarios` (listado) y `/itinerarios/[id]` (uno, con sus bloques y
  recursos en orden, navegable de principio a fin).
- Editor propio en **`/admin/itinerarios`** (SPEC-008 lo anunciaba en `/admin/config`, pero esto
  es contenido editorial, no un ajuste): crear/editar itinerarios y montar su lista ordenada.
- Una columna `orden` nueva en `recurso_bloque` — hoy es una tabla puente sin orden interno,
  y sin eso no se puede decir «este recurso va antes que aquel dentro del bloque».
- Decidir la relación con los «presets de mazo» pendientes de Descubre (ver más abajo):
  es la pregunta que más cambia el diseño, así que va primero, no al final.

**Fuera (por ahora):**

- Que el Sheet pueda asignar bloques por columna (`docs/02-modelo-datos.md` ya apunta la
  sintaxis `MIC>Itinerario X>Bloque 3`, pero `sync_filas` nunca la ha implementado). Se puede
  seguir asignando desde el editor web mientras tanto.
- Progreso personal («llevas 6 de 20») — necesitaría una tabla nueva de seguimiento por
  persona e itinerario. Si el primer uso real lo pide, es una vuelta corta sobre esta spec.
- Itinerarios privados o solo para un MCM local: nacen públicos, como los recursos publicados.

## La pregunta que más importa: ¿esto es también el «preset de mazo» de Descubre?

Pendiente desde Fase 3.5: presets configurables para `/descubre` («Adviento», «Para
monitores»). A primera vista parecen la misma idea —un conjunto con nombre y tema— pero el
mecanismo es distinto:

- Un **preset de mazo** hoy se pensaba como un **filtro con nombre**: «todo lo que tenga el
  tag Adviento», sin lista fija de ids ni orden — el mazo lo resuelve la búsqueda facetada
  que ya existe, no hace falta guardar nada nuevo más que la combinación de filtros.
- Un **itinerario** es una **lista explícita y ordenada** de recursos concretos, con
  narrativa. Recorrerlo no es barajar y descartar (el gesto de Descubre); es seguir un guion.

**Propuesta** (a validar): construir las dos cosas, pero como capas separadas que se pueden
combinar:

1. Esta spec construye el itinerario como entidad propia, con su ficha y su editor.
2. Desde la ficha de un itinerario, un botón **«Recorrerlo en Descubre»** lanza `/descubre`
   con ese itinerario como mazo, respetando su orden en vez de barajar — Descubre ya sabe
   sesgar y reordenar (SPEC-007 fase 2), así que es una fuente de mazo más, no un modo nuevo.
3. Los presets puramente por filtro («Adviento» = tag, sin lista fija) siguen siendo aparte y
   mucho más baratos de construir: una combinación de facetas guardada con un nombre, sin
   tocar ninguna tabla de esta spec. No todo preset merece ser un itinerario con narrativa.

Si prefieres que sean la misma entidad desde el principio, el modelo de datos de abajo lo
soporta igual (un itinerario con un solo bloque y sin narrativa por bloque *es* efectivamente
un preset); lo que cambia es si construimos también el atajo de filtro-sin-lista del punto 3.

## Modelo de datos

Reutiliza las tres tablas que ya existen vacías desde 00002 y les añade **lo mínimo que falta**.
Todo está en `supabase/migrations/00026_itinerarios.sql`, **aplicada** el 2026-08-20. En resumen:

| Cambio | Por qué |
| --- | --- |
| `recurso_bloque` + `orden int not null default 0` | Es LO que faltaba: era una puente de dos columnas, así que no se podía decir «este va antes que aquel». Sin esto no hay itinerario |
| `itinerario` + `estado text not null default 'borrador'` | Se monta en varias sentadas; un borrador no puede salir en `/itinerarios` |
| `itinerario.etapa text not null` → `itinerario.etapas text[]` | Decisión 3: mismo vocabulario y mismo `SelectorMultiple` que `recurso.etapas`. Opcional, porque hay itinerarios transversales |
| `itinerario_bloque.nombre` deja de ser `not null` | Un itinerario simple es **un solo bloque sin título**, y obligar a bautizarlo forzaba a inventarse un «Bloque 1» que luego se pinta |
| RLS de lectura acotada a `estado = 'publicado' or es_editor()`, en itinerario y en sus bloques | Era `true` a secas. Los bloques se acotan vía su itinerario, si no los tramos de un borrador quedaban a la vista |

**Lo que NO se toca:** la escritura, que ya era `es_editor()` en las tres tablas desde 00002 y es
justo lo que se quiere (decisión 5). Y no se crea **ninguna** tabla nueva: sin `imagen` (ver §El
editor) y sin progreso personal (decisión 2).

`itinerario.orden` se queda en la tabla pero el editor no lo enseña: con 10-12 no se numeran a mano.

## Experiencia de usuario

### `/itinerarios` (listado público)

Tarjetas como las del catálogo pero con su propia identidad: nombre, etapas, descripción corta y
número de recursos. Solo publicados. **Sin buscador ni paginación**: son 10-12 (decisión 4).

### `/itinerarios/[id]`

- Cabecera con el nombre y la **descripción general** (la explicación que pedías: para qué
  sirve el itinerario, no solo qué lleva dentro).
- Un bloque tras otro, cada uno con su propio nombre y descripción si la tiene, y sus
  recursos en fila, en orden, con su tarjeta habitual (miniatura, tipo, formato).
- Abrir un recurso desde aquí usa la misma ficha de siempre (`RecursoFicha`), con
  anterior/siguiente navegando **dentro del itinerario en su orden**, no del catálogo
  filtrado — reutiliza el mecanismo que ya tiene la ficha (`indice`/`total`/`onnavegar`),
  solo cambia de dónde sale la lista.
- «Recorrerlo en Descubre» queda para después de la v1 (decisión 1).

### Editor

> Reescrito al validar: ver §El editor más abajo, que manda sobre lo que sigue. Cambia de sitio
> (`/admin/itinerarios`, no `/admin/config`), se queda en cuatro campos y esconde los bloques
> hasta que alguien los pide.

- Crear/editar itinerario: nombre, etapas, descripción, estado (borrador/publicado).
- Bloques: añadir, nombrar, describir, **reordenar con flechas arriba/abajo** — el mismo
  patrón que ya usa `RecursoTabla.svelte` para reordenar columnas (`moverColumna`), no hace
  falta traer una librería de arrastrar y soltar para esto.
- Dentro de un bloque: buscador de recursos (reutiliza `normalizarConsulta` y el estilo del
  selector de temáticas) para añadir, y las mismas flechas arriba/abajo para el orden interno.
- Encaja de un lado con SPEC-014: una señal de salud podría avisar de «recursos sin ningún
  itinerario» si eso llega a importar, y de otro con las acciones en lote ya construidas
  (PR #26): «añadir al itinerario X» podría ser una operación de lote más el día que haga
  falta, sin rediseñar nada de lo que ya existe.

## Criterios de aceptación

- [ ] Un itinerario en `borrador` no aparece en `/itinerarios` ni es accesible por URL directa
      para quien no sea editor.
- [ ] Los bloques de un itinerario se ven en su `orden`, y los recursos dentro de cada bloque
      en el `orden` de `recurso_bloque`.
- [ ] Reordenar un bloque o un recurso desde el editor se refleja en la vista pública sin
      recargar toda la página.
- [ ] Un recurso puede estar en más de un bloque (del mismo itinerario o de otro) a la vez —
      `recurso_bloque` ya lo permite por ser una tabla puente.
- [ ] La navegación ←/→ de la ficha, abierta desde un itinerario, respeta el orden del
      itinerario y no el del catálogo general.
- [ ] Solo **editores y administradores** pueden crear y publicar itinerarios (decisión 5).
      Ojo, el borrador de esta spec decía que `edicion_local` también podría «porque `es_editor()`
      ya lo cubre», y **es falso**: `es_editor()` es `rol_actual() in ('editor','administrador')`,
      así que un `edicion_local` no entra. Como es justo lo que se ha decidido, no hay nada que
      cambiar en la RLS — pero que no quede escrito al revés.

## Decisiones (validadas 2026-08-20)

Las cinco preguntas que estaban abiertas, con su respuesta. Se conserva la numeración original.

1. **¿Itinerario y «preset de mazo» son lo mismo? → No lo son.** Se acepta la propuesta de la
   sección anterior: el itinerario es entidad propia (lista explícita y ordenada, con narrativa) y
   los presets por filtro siguen su camino aparte. El botón «Recorrerlo en Descubre» queda como
   añadido posterior, **no entra en la v1**.
2. **¿Progreso personal? → No.** Descartado sin más vueltas. Ninguna tabla de seguimiento.
3. **¿`etapa` texto libre o vocabulario cerrado? → Como en el resto de la app.** Es decir: el mismo
   vocabulario que `recurso.etapas` (lista `etapas` de `lista_valor`) y el mismo control
   (`SelectorMultiple`). Eso implica cambiar `itinerario.etapa text not null` por
   **`etapas text[]`** — mismo tipo, mismo selector, y de paso opcional, porque un itinerario
   transversal no tiene por qué inventarse una etapa. Va en la migración `00026`.
4. **¿Cuántos itinerarios? → 10-12 como techo.** Así que `/itinerarios` es una rejilla de tarjetas
   y punto: **sin buscador, sin paginación, sin filtros**. Y el editor puede permitirse cargar
   todo de golpe sin pensar en rendimiento.
5. **¿Quién publica? → Editores y administradores.** Que es exactamente la RLS que ya tienen las
   tres tablas desde 00002 (`es_editor()`): no hay nada que cambiar en escritura.

## El editor: pocos campos, y que se note

Petición explícita al validar: **un admin de los buenos, y sin marearse con campos**. Así que la
regla de esta spec es que el editor cabe en una pantalla y no pide nada que no haga falta.

**El itinerario tiene cuatro campos. Solo cuatro:**

| Campo | Obligatorio | Nota |
| --- | --- | --- |
| Nombre | sí | «Buscad y encontraréis» |
| Descripción | no | la explicación general, para qué sirve el itinerario |
| Etapas | no | `SelectorMultiple`, mismo vocabulario de siempre. Vacío = transversal |
| Estado | sí (con defecto) | borrador ⇄ publicado, un interruptor |

**Lo que se cae respecto al borrador de esta spec:**

- **`imagen`.** Un campo más que rellenar a cambio de poco: la portada se resuelve con el mismo
  fallback generado que ya usan los recursos (patrón + icono). Si con el itinerario delante se echa
  de menos, es una columna y un hueco, no un rediseño.
- **`orden` del itinerario como campo editable.** Con 10-12 se ordenan por nombre o por fecha y
  nadie los va a numerar a mano. La columna existe en la tabla; el editor no la enseña.
- **Nombre y descripción de bloque como algo que rellenar siempre.** Ver abajo.

**Los bloques son opcionales y no se ven hasta que hacen falta.** Esto es lo que más cambia
respecto al borrador. El caso normal —el que dispara la spec— es «veinte sesiones en orden», no
«tres tramos con título». Así que:

- Al crear un itinerario se crea **un bloque implícito sin título** y el editor enseña
  directamente **una sola lista ordenada de recursos**. Cero mención a la palabra «bloque».
- Solo si alguien pulsa **«Partir en tramos»** aparecen los títulos de sección y la posibilidad de
  añadir más. Un itinerario simple nunca se entera de que los bloques existen.
- Por eso `itinerario_bloque.nombre` pasa a admitir `NULL` en la migración: un bloque sin título no
  se pinta.

**Montar la lista:** buscador de recursos que reutiliza `normalizarConsulta` y el patrón del
selector de temáticas para añadir, y **flechas arriba/abajo** para ordenar — el mismo mecanismo que
`RecursoTabla.svelte` usa para sus columnas (`moverColumna`). Sin librería de arrastrar y soltar:
con listas de veinte y reordenaciones puntuales, las flechas son más precisas y accesibles, y no
traen 30 KB.

**Dónde vive.** No en `/admin/config` (que es la pantalla de ajustes y vocabularios, y esto no es
un ajuste) sino en **`/admin/itinerarios`**, con su entrada en la navegación del panel. Un itinerario
es contenido editorial, como un recurso.

## Alcance de la v1 (lo que se construye y en qué orden)

1. **Migración `00026`** — las cuatro cosas que le faltan al esquema. Escrita, sin aplicar.
2. **`/admin/itinerarios`** — listado, crear, editar los cuatro campos, montar la lista ordenada,
   publicar. Es el grueso del trabajo y lo que de verdad se ha pedido.
3. **`/itinerarios` y `/itinerarios/[id]`** — la parte pública: rejilla de tarjetas y la ficha del
   itinerario con sus recursos en orden, reutilizando `RecursoFicha` con anterior/siguiente
   navegando dentro del itinerario.

**Fuera de la v1, y a propósito:** progreso personal (descartado del todo), «Recorrerlo en
Descubre», presets por filtro, `imagen`, asignación de bloques desde el Sheet, itinerarios privados
o por MCM local, y cualquier buscador o paginación en la parte pública.


## Lo construido (2026-08-20)

**Migración `00026`**, aplicada en remoto: `orden` en `recurso_bloque`, `estado`
borrador/publicado, `etapa` → `etapas text[]`, nombre de bloque opcional y lectura acotada a lo
publicado (en el itinerario y en sus bloques).

**`/admin/itinerarios`** — listado. Crear cuesta escribir el nombre y pulsar: se entra directo a
montarlo, porque es lo único que se puede hacer con un itinerario vacío. Cada fila dice cuántos
recursos lleva y si está publicado. Borrar va con cuenta atrás (`accionRetardada`), y el aviso
aclara que los recursos en sí no se tocan.

**`/admin/itinerarios/[id]`** — el editor. Los cuatro campos arriba (nombre, de qué va, etapas con
el `SelectorMultiple` de siempre, y un interruptor de publicado) y debajo la lista numerada. Añadir
es un buscador por tramo que filtra en el cliente y descarta lo que ya está puesto; ordenar son
flechas ↑↓ que mandan el orden completo del bloque de una vez. La palabra «tramo» no aparece hasta
que se pulsa **«Partir en tramos»**: al crear el itinerario se hace un bloque implícito sin título,
y mientras solo haya uno el editor habla de «los recursos, en orden». No se puede borrar el último
tramo, porque sin bloque no hay dónde añadir.

**`/itinerarios` y `/itinerarios/[id]`** — la parte pública. Rejilla de tarjetas sin buscador
(decisión 4) y la ficha del itinerario con la explicación arriba y los recursos numerados de forma
continua (no por tramo: el orden es del itinerario entero). Cada fila abre el recurso registrando
el acceso, y su nombre lleva a la ficha de siempre vía `/?r=`. Un editor ve sus borradores con un
aviso de que solo los ve él.

**Entradas:** «Itinerarios» en la cabecera pública junto a Descubre —son la misma familia, mirar
sin buscar— y en la paleta de comandos. En el panel, entre Recursos y Sincronización.

### Lo que quedó fuera de esta vuelta

- **`RecursoFicha` con anterior/siguiente dentro del itinerario.** La ficha lo soporta
  (`indice`/`total`/`onnavegar`), pero montarla aquí obliga a duplicar toda la capa social que hoy
  vive en la portada (favoritos, usos, valoraciones, login diferido). Mientras tanto, el nombre del
  recurso lleva a `/?r=`, que abre esa misma ficha con todo funcionando — pero navegando por el
  catálogo, no por el itinerario.
- **Reordenar los tramos entre sí.** Se crean en orden y se pueden borrar; mover el tramo 3 al 1
  todavía no. Con dos o tres tramos se resuelve borrando y rehaciendo, y no ha parecido que
  justificara más botones en la primera versión.
- Todo lo demás que ya estaba fuera de alcance: progreso personal, «recorrerlo en Descubre»,
  presets por filtro, `imagen`, y asignar bloques desde el Sheet.
