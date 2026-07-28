# SPEC-012 · Pulido de interfaz: orden, densidad y formularios

> **Estado:** borrador — auditoría hecha, **pendiente de validar contigo** antes de tocar
> nada más allá de la rebanada 1 (ver §Rebanadas).
> **Depende de:** SPEC-008 (panel), SPEC-011 (formulario único), `docs/04-diseno.md`

## Objetivo

El banco se ha construido a rebanadas y cada una añadió campos donde cabían. El resultado es
que las pantallas con mucha información —sobre todo el formulario de recurso— han perdido
jerarquía: todo pesa lo mismo, nada agrupa por significado y no respira. Esta spec recoge la
auditoría y fija el orden al que hay que llevar cada pantalla.

No es un rediseño: el sistema de diseño (`docs/04-diseno.md`) se queda como está. Es ordenar
lo que ya hay.

## Auditoría (2026-07-28, medida en navegador)

### 1. Formulario de recurso (`RecursoFormulario`, el peor) 🔴

Es el mismo componente en tres sitios (crear, editar, catalogar-y-publicar), así que todo lo
que se arregle aquí se arregla tres veces. Medido dentro del panel lateral (576 px de ancho,
pantalla de 1440): **1.538 px de scroll, 22 campos, cero secciones**.

| Problema | Detalle |
|---|---|
| **Muro de 10 desplegables** | Tipo, Nivel, Idioma, Soporte, Ubicación, Estado, Visibilidad, MCM Local, Año y Curso usado van seguidos en una rejilla de 2 columnas, todos con el mismo aspecto. Mezcla catalogación (Tipo, Nivel), procedencia (MCM Local, Año, Curso) y publicación (Estado, Visibilidad) como si fueran lo mismo. **Es el «apilado» que se detectó.** |
| **Estado y Visibilidad escondidos** | Son las dos decisiones con consecuencias (¿se publica?, ¿lo ve todo el mundo?) y tienen exactamente la misma pinta que «Idioma». |
| **Edades ocupa 4 filas** | Los 4 grupos (Primaria/Secundaria/Jóvenes/Adultos) fuerzan una fila cada uno: 175 px sólo para Edades, el bloque más alto de la caja de clasificación (360 px en total). |
| **Sin respiración jerárquica** | 22 campos separados por el mismo `gap-5`. Nada dice dónde acaba un asunto y empieza otro. |
| **Cajón de sastre final** | Cuatro casillas sueltas sin marco («Contiene datos personales», «Creado con IA», «Fuera del banco», «Pendiente de clasificar») que además rompen a segunda línea desalineadas, y debajo «Notas internas» sin separación. |
| **Campos sin explicar** | «Imagen (URL)» y «Más imágenes (URL)» juntos y sin decir en qué se diferencian. |

### 2. Contraste útil: `/enviar` está bien ✅

El formulario público de envío (rehecho en SPEC-011) es justo lo contrario: tres campos, una
caja por asunto, lo opcional plegado («¿Nos ayudas a clasificar?») y el bloque de contacto
separado con borde discontinuo. **Ese es el patrón a llevar al panel**, no uno nuevo.

### 3. Resto de pantallas con mucha información (pendiente de auditar en detalle)

- **`/admin/recursos`**: tabla densa + panel lateral. Revisar el orden de columnas y que la
  fila de acciones (Versión / Editar / borrar) no compita con el contenido.
- **`/admin/config`**: cinco pestañas con formularios de alta al final de cada una; revisar
  que todas sigan el mismo esqueleto (lista → alta → explicación).
- **Ficha de recurso** (`RecursoFicha`): es la pantalla que más ve el público; comprobar el
  orden de bloques (qué es → cómo abrirlo → para quién → lo social).
- **`/admin/revision`**: la cola donde se decide; ver que la acción principal destaque.

## Cómo debe quedar el formulario de recurso

Cinco secciones con título, en el orden en que se piensa un recurso. Cada una en su caja, con
aire entre ellas:

1. **Qué es** — Nombre, Descripción, Tipo.
2. **Para quién** — Temáticas, Etapas, Edades, Nivel. (La caja de clasificación de ahora,
   ampliada con Nivel, que es de aquí y no del muro.)
3. **Dónde está** — Enlace principal, formatos alternativos, Imagen, Soporte, Ubicación.
4. **De dónde viene** — MCM Local, Año, Curso usado, Idioma, «Es nueva versión de…».
5. **Publicación** — Estado, Visibilidad y las casillas, **destacado al final** porque es lo
   último que se decide y lo que tiene consecuencias.

Y en `SelectorMultiple`, que Edades quepa en menos alto sin perder los grupos.

## Alcance

**Entra:** reordenar y agrupar lo que ya existe; densidad y espaciado; textos de ayuda donde
un campo no se explique solo.

**Fuera:** cambiar el sistema de diseño, añadir o quitar campos del modelo de datos, tocar la
lógica de guardado, y rediseñar el buscador público (que funciona y no es el problema).

## Modelo de datos

Ninguno. Es interfaz.

## Rebanadas

1. **Formulario de recurso** (hecha): secciones, Estado/Visibilidad destacados, Edades más
   compacto. Es el que se detectó y el que se repite en tres sitios.
2. **Ficha de recurso** (hecha): metadatos separados en «Para quién» (Etapa, Edades, Nivel)
   y «Ficha técnica» (Idioma, Soporte, Ubicación, MCM Local, Autoría, Año, Curso usado) —
   antes iban en una sola lista plana con el mismo problema del formulario. De paso, un bug
   real y más gordo: el `Sheet.Content` base (`lib/components/ui/sheet/sheet-content.svelte`)
   tenía `data-[side=right]:w-3/4` sin condicionar a `sm:`, así que en Tailwind esa variante
   de atributo se aplica **después** de cualquier `w-full` en la cascada — el panel se
   quedaba a 3/4 de ancho en móvil (con botones cortados, «Guardar en lista» invisible) **y**
   además a `max-w-sm` (384px) en vez de al `sm:max-w-lg`/`sm:max-w-xl` que pide cada
   pantalla, en escritorio también. Afectaba a los dos únicos `Sheet.Content` de la app (la
   ficha y el panel de edición de `/admin/recursos`) desde siempre, no algo introducido en
   esta sesión. Arreglado en el componente base: `w-full` sin condición + `sm:w-3/4`, y el
   `max-w-*` por defecto retirado (cada uso ya trae el suyo). Verificado con Playwright a
   390/768/1440 px: móvil 100%, ficha 512px (`max-w-lg`), panel de admin 576px (`max-w-xl`).
3. `/admin/recursos` y `/admin/revision` — pendiente de validar.
4. `/admin/config` — pendiente de validar.

## Criterios de aceptación

- [x] El formulario de recurso tiene secciones con título y se lee sin buscar.
- [x] Estado y Visibilidad no parecen un campo más.
- [x] Edades ocupa menos alto sin perder los grupos.
- [x] La ficha separa «para quién» de «ficha técnica» en vez de una lista plana.
- [x] Los dos `Sheet.Content` de la app ocupan el ancho correcto en móvil y su propio
      `max-w-*` en escritorio (bug de cascada de Tailwind, no solo estético).
- [ ] Las cuatro pantallas del punto 3 revisadas una a una.
- [ ] Nada de esto cambia lo que se guarda: mismos `name`, mismas acciones.

## Preguntas abiertas

1. ¿El orden de secciones propuesto es el que tienes en la cabeza, o «De dónde viene» debería
   ir antes que «Dónde está»?
2. Las notas internas y «Pendiente de clasificar»: ¿son de publicación o merecen su propia
   sección de «uso interno»?
3. ¿Hay alguna pantalla que te chirríe y no esté en la lista?
