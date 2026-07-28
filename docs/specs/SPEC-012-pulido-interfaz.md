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
3. **`/admin/recursos` y `/admin/revision`** (hecha, ver §bug de carga más abajo): un bug de
   correctitud mucho más gordo que lo estético, no solo la reordenación de columnas. El botón
   «Versión» de cada fila pasa a icono-solo (como ya era «Eliminar»), con `textoCargando=" "`
   para que durante la carga no se amontonen dos iconos en un botón pequeño.
4. `/admin/config` — pendiente de validar.

## Bug de carga permanente en `/admin/recursos` y `/admin/revision` (2026-07-28)

Al montar la tabla de prueba con datos de mentira para revisar el orden de columnas, TODAS
las filas aparecían con el select de Estado deshabilitado, `aria-busy="true"` y el botón
«Versión» mostrando «Creando…» — desde el primer render, sin haber tocado nada. Es el mismo
síntoma con el que arrancó la sesión («todos los botones... están en estado de carga
girando»), pero un origen distinto y bastante más extendido que el de `/admin/sync` que se
arregló al principio.

**Causa:** `use:enhance={resultadoEstado(r.id)}` **llama** a `resultadoEstado(r.id)`
inmediatamente al evaluar la plantilla (una vez por fila, al montar), no en cada envío. El
patrón correcto es que esa llamada devuelva la función que SvelteKit invocará en cada envío
real, y que el «poner ocupado» viva DENTRO de esa función devuelta:

```ts
// mal — el `= true` se ejecuta una vez, al montar, no en cada envío
function resultadoEstado(id: string) {
  cambiandoEstado.add(id);
  return () => async ({ result }) => { cambiandoEstado.delete(id); ... };
}

// bien — SvelteKit invoca esta función en cada envío real
function resultadoEstado(id: string) {
  return () => {
    cambiandoEstado.add(id);
    return async ({ result }) => { cambiandoEstado.delete(id); ... };
  };
}
```

Con el código «mal», pasa esto: (1) al montar, TODAS las filas/botones nacen «ocupados» sin
haberse enviado nada — selects deshabilitados, spinners falsos; (2) tras el primer envío
real, el `= true` no se vuelve a ejecutar nunca (vivía fuera de la función que SvelteKit
invoca en cada envío), así que **a partir del segundo clic el botón deja de mostrar su
estado de carga para siempre** — rompiendo en silencio justo lo que el roadmap presumía
tener resuelto (SPEC-011: «todos los botones de acción muestran su estado mientras el
servidor responde»).

**Alcance:** 7 funciones en `/admin/recursos` (`resultadoLote`, `resultadoReindexar`,
`resultadoFormatos`, `resultadoClasificar`, `resultadoEstado`, `resultadoNuevaVersion`,
`resultadoEliminar`) y 2 en `/admin/revision` (`resultadoClasificarEnvio`, `resultadoCierre`).
**No afectaba** a `/admin/sync`, `/admin/config` ni `/admin/usuarios`: esas usan el helper
`crearOcupado()` (`lib/acciones.svelte.ts`), que ya tenía el patrón correcto — de ahí que el
primer bug de la sesión (el de `/admin/sync`) fuera solo de falta de clave por fila, no este.

**Verificado** con Playwright montando la página real con datos de mentira y una ruta
interceptada con retraso artificial: antes del arreglo, el segundo envío de un mismo botón
nunca volvía a mostrar `aria-busy`; después, tanto el primer como el segundo envío muestran
`null → true → null` correctamente.

## Criterios de aceptación

- [x] El formulario de recurso tiene secciones con título y se lee sin buscar.
- [x] Estado y Visibilidad no parecen un campo más.
- [x] Edades ocupa menos alto sin perder los grupos.
- [x] La ficha separa «para quién» de «ficha técnica» en vez de una lista plana.
- [x] Los dos `Sheet.Content` de la app ocupan el ancho correcto en móvil y su propio
      `max-w-*` en escritorio (bug de cascada de Tailwind, no solo estético).
- [x] Ningún botón/fila de `/admin/recursos` o `/admin/revision` nace «cargando» sin haberse
      enviado nada, y el segundo envío de un botón vuelve a mostrar su estado (antes se
      perdía para siempre tras el primer clic).
- [ ] `/admin/config` revisado.
- [ ] Nada de esto cambia lo que se guarda: mismos `name`, mismas acciones.

## Preguntas abiertas

1. ¿El orden de secciones propuesto es el que tienes en la cabeza, o «De dónde viene» debería
   ir antes que «Dónde está»?
2. Las notas internas y «Pendiente de clasificar»: ¿son de publicación o merecen su propia
   sección de «uso interno»?
3. ¿Hay alguna pantalla que te chirríe y no esté en la lista?
