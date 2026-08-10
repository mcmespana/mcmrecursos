# SPEC-015 · Itinerarios de recursos

> **Estado:** borrador (pendiente de validar contigo)
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
- Editor en `/admin/config` (ya anunciado en SPEC-008, nunca construido): crear/editar
  itinerarios y bloques, y decidir qué recursos lleva cada bloque y en qué orden.
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

Reutiliza lo que ya existe y le añade lo mínimo que falta (migración a numerar cuando se
implemente — mirar el último número en `supabase/migrations/`, no fiarse de uno fijo aquí):

```sql
-- Orden de los recursos DENTRO de un bloque: hoy recurso_bloque no tiene ninguno.
alter table recursos.recurso_bloque add column if not exists orden int not null default 0;

-- Portada + estado editorial, igual que un recurso: un itinerario a medio escribir
-- no debería aparecer en /itinerarios hasta que el editor lo publique.
alter table recursos.itinerario add column if not exists imagen text;
alter table recursos.itinerario add column if not exists estado text not null default 'borrador';
  -- borrador | publicado, mismo vocabulario que recurso.estado

-- lectura pública ya existe para 'itinerario' e 'itinerario_bloque' (migración 00002);
-- hay que acotarla a los publicados para que un borrador no se cuele en /itinerarios
drop policy if exists "lectura publica" on recursos.itinerario;
create policy "lectura publica" on recursos.itinerario for select
  using (estado = 'publicado' or recursos.es_editor());
```

`itinerario_bloque` y `recurso_bloque` no necesitan más columnas: `bloque.orden` ya ordena los
bloques dentro del itinerario, y el `orden` nuevo de `recurso_bloque` ordena los recursos
dentro de cada bloque. Un itinerario simple (sin necesidad real de tramos) es solo un
itinerario con un único bloque sin nombre visible.

`etapa` en `itinerario` queda como está (texto libre por ahora, alineado con `lista_valor`
`etapas` si conviene homogeneizarlo — pregunta abierta más abajo).

## Experiencia de usuario

### `/itinerarios` (listado público)

Tarjetas como las del catálogo pero con su propia identidad: nombre, etapa, descripción
corta, número de recursos, y quizá cuántos bloques. Solo publicados. Sin buscador propio al
principio — se espera que sean pocos (decenas, no cientos).

### `/itinerarios/[id]`

- Cabecera con el nombre y la **descripción general** (la explicación que pedías: para qué
  sirve el itinerario, no solo qué lleva dentro).
- Un bloque tras otro, cada uno con su propio nombre y descripción si la tiene, y sus
  recursos en fila, en orden, con su tarjeta habitual (miniatura, tipo, formato).
- Abrir un recurso desde aquí usa la misma ficha de siempre (`RecursoFicha`), con
  anterior/siguiente navegando **dentro del itinerario en su orden**, no del catálogo
  filtrado — reutiliza el mecanismo que ya tiene la ficha (`indice`/`total`/`onnavegar`),
  solo cambia de dónde sale la lista.
- Botón «Recorrerlo en Descubre» si se valida la propuesta de la sección anterior.

### Editor en `/admin/config`

- Crear/editar itinerario: nombre, etapa, descripción, estado (borrador/publicado), imagen.
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
- [ ] `edicion_local` puede editar itinerarios (rol `es_editor()` ya cubre esto vía la RLS
      existente) — confirmar que el alcance por MCM local, si hace falta alguno, se decide
      aquí y no se da por hecho.

## Preguntas abiertas

1. **¿Itinerario como entidad propia + «recorrerlo en Descubre», o fusionar del todo con los
   presets de mazo desde el primer día?** Ver la sección dedicada arriba; es la decisión que
   más cambia el alcance de esta spec y de SPEC-007.
2. **¿Hace falta progreso personal** («llevas 6 de 20», marcar bloques completados)? Se ha
   dejado fuera de alcance por ahora; si el primer itinerario real lo pide, es una vuelta
   corta con una tabla de seguimiento por persona.
3. **`etapa` como texto libre o como `lista_valor`** (mismo vocabulario cerrado que ya usan
   `tipo`, `idioma`, etc., editable desde `/admin/config`)? Homogeneizarlo evita que un
   itinerario diga «MIC» y otro «Infancia» para lo mismo.
4. **¿Cuántos itinerarios se esperan al principio?** Decenas hace innecesaria cualquier
   paginación o buscador en `/itinerarios`; si la cifra real es mayor, esa pantalla necesita
   más que una rejilla de tarjetas.
5. **¿Quién puede publicar un itinerario?** La RLS propuesta usa `es_editor()`, igual que las
   tablas ya existentes — así que cualquier editor o administrador, no solo `administrador`.
   Confirmar que eso es lo que se quiere, en vez de restringirlo más.
