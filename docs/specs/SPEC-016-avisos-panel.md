# SPEC-016 · Avisos y tareas: el buzón del equipo

> **Estado:** implementada (2026-08-15) — migración `00025`, campana en la cabecera y `/admin/avisos`
> **Depende de:** SPEC-014 (de donde sale la tabla `tarea`), SPEC-001 (roles)
> **Sustituye a:** la mitad «Tareas del equipo» de SPEC-014 §Abajo

## Objetivo

Que apuntar un recado y enterarse de lo que ha apuntado otro cueste lo mismo que mirar el móvil,
desde cualquier pantalla del banco.

SPEC-014 dejó la lista de tareas dentro de `/admin/salud`. Funcionaba, pero tenía dos defectos que
la condenaban a no usarse: **hay que acordarse de ir**, y una vez allí la lista era una fila de
casillas con selectores al lado, sin decir de un vistazo qué corría prisa ni de quién era. Un buzón
compartido que hay que ir a buscar es un buzón que nadie mira, y el WhatsApp sigue ganando.

## Alcance

**Entra:**

- **Campana en la cabecera**, en todas las pantallas, con el número de avisos sin leer.
- **Panel flotante** colgando de la campana (hoja inferior en móvil) con filtros, el compositor y
  la lista.
- **`/admin/avisos`**: la misma lista en grande, agrupada por urgencia, con búsqueda y filtro por
  persona.
- Distinguir **aviso** (se lee) de **tarea** (se hace), y darle a cada fila **responsable** y
  **fecha límite** como campos de verdad.
- **Leído por persona**: el buzón es compartido, así que el «sin leer» es de cada quien.

**Fuera (por ahora):**

- **Avisar por correo.** El diseño de referencia lo lleva (un interruptor «avisar a este buzón» con
  el correo a la vista antes de enviar) y encaja aquí el día que haga falta: una columna
  `avisado_a`/`avisado_at` en `tarea` y un acuse en la tarjeta. Hoy el equipo son cuatro personas
  que ya se ven; meter correo transaccional ahora es infraestructura, rebotes y bajas por gestionar
  a cambio de nada.
- Comentarios o hilos dentro de un aviso. Si hace falta discutir, se habla.
- Tiempo real entre pestañas (Realtime). Se refresca al abrir el panel y tras cada acción.
- Adjuntar un recurso desde el buscador al apuntar (hoy solo llega puesto desde las señales de
  salud).

## Modelo de datos (migración `00025`)

Sobre la `recursos.tarea` que ya existía (SPEC-014):

| Columna | Tipo | Notas |
| --- | --- | --- |
| `tipo` | `text not null default 'tarea'` | `tarea` \| `aviso` |
| `vence_at` | `timestamptz` | fecha límite opcional |

Y una tabla nueva:

```sql
create table recursos.tarea_visto (
  tarea_id uuid references recursos.tarea (id) on delete cascade,
  perfil_id uuid references recursos.perfil (id) on delete cascade,
  visto_at timestamptz not null default now(),
  primary key (tarea_id, perfil_id)
);
```

**Por qué una tabla y no una columna `leida`.** El buzón es compartido: que Marta lea un aviso no
puede apagárselo a Ana. Con RLS de `perfil_id = auth.uid()` cada quien solo ve y escribe sus
propias marcas — quién ha leído qué no es algo que el panel necesite, y sí algo que incomoda tener
a la vista.

**Dos funciones**, las dos `security invoker` para que la RLS de `tarea` siga acotando por rol:

- `recursos.avisos_resumen()` → `jsonb` con `sin_leer`, `abiertas`, `mias`, `vencidas`. La campana
  sale en **todas** las pantallas, así que el número tiene que costar una consulta diminuta y no
  traerse la lista entera en cada navegación.
- `recursos.marcar_avisos_leidos()` → marca de golpe lo abierto que aún no habías leído, en vez de
  mandar N inserts desde el cliente.

## Arquitectura en el cliente

Un único store de módulo, `$lib/avisos/estado.svelte.ts`, compartido por la campana y la pantalla
completa. Es la única copia de la verdad en el cliente: si cierras una tarea en el panel flotante,
el número de la campana y la pastilla de la navegación bajan en el mismo fotograma, sin recargar.

- Mientras no se abra el panel, los conteos vienen de `avisos_resumen()`. En cuanto la lista está
  cargada, los conteos **se derivan de lo que hay en pantalla** — eso es lo que hace que las
  acciones optimistas se noten al instante.
- Todas las acciones son optimistas con reversión si el servidor dice que no.
- Las acciones viven aparte, en `$lib/avisos/acciones.ts`, para que el panel y la pantalla completa
  se comporten igual por construcción y no por disciplina.

## Experiencia de usuario

### La campana

Va en la cabecera, junto a la cuenta — **no** como burbuja flotante en una esquina. El catálogo es
una rejilla que usa todo el ancho, y un botón fijo encima tapa recursos en cada pantalla de la app
para servir a algo que se mira tres veces al día. Arriba es donde el ojo ya busca lo que es «tuyo».

- Badge con el número de **sin leer**; a partir de 9, `9+`.
- Si no hay nada sin leer pero algo se ha pasado de fecha, un **punto rojo** sin número: informa sin
  alarmar.
- Solo se enseña a quien tiene rol de panel.

### El panel

Popover anclado a la campana en escritorio (27 rem), hoja inferior en móvil — el mismo gesto que ya
usa la ficha de recurso. Mismo contenido escrito una vez.

- **Cabecera**: «Avisos y tareas» y, debajo, el estado en una línea («7 sin cerrar · 2 vencidas»).
  A la derecha, «Marcar leído» (solo si hay algo sin leer) y **«En grande»**, que lleva a
  `/admin/avisos`.
- **Filtros** como píldoras con contador: **Sin leer · Míos · Todo · Hechas**. Al abrir, si hay algo
  sin leer se entra por ahí; si no, por «Todo».
- **Orden**: lo urgente arriba y, dentro de cada prioridad, lo que vence antes.

### La tarjeta

Lo que ordena el dibujo: **quién responde y para cuándo son campos, no texto suelto dentro del
título**.

- Fila de etiquetas: `TAREA` (ámbar `--warm`) o `AVISO` (teal `--primary`), `URGENTE`
  (`--destructive`) y, si nació de una señal, `SALUD`. A la derecha, «Sin leer» con punto teal.
- El texto, y debajo la **tira de responsable** con marco propio: avatar, etiqueta `RESPONSABLE` y
  el nombre. **El nombre es el selector** — enseñar «Lucía» y al lado un desplegable que también
  pone «Lucía» era decir lo mismo dos veces. Sin nadie asignado, la tira va punteada: un hueco que
  se ve como hueco pide que alguien lo coja mejor que la palabra «sin asignar».
- **La píldora de fecha es el control**: lleva encima un `input[type=date]` invisible que abre el
  selector nativo. Así se edita sin meter un campo con su `dd/mm/aaaa` en la fila de acciones.
  En rojo si venció, ámbar si vence esta semana, gris si queda lejos. El texto es relativo cuando
  eso es el dato («venció hace 2 días»), porque «13 ago» ahí se confunde con el «hace 2 h» de la
  línea de abajo.
- Acciones: **Marcar hecha** (o **Archivar** en un aviso), «Leído» si estaba sin leer, y borrar.

Lo que solo se usa de vez en cuando —marcar sin leer otra vez, marcar urgente— aparece **al pasar
por encima**, y siempre en táctil, donde no hay hover. Un «urgente» punteado en cada tarjeta llenaba
la rejilla de ruido a cambio de algo que se usa poco.

### El compositor

Plegado a una línea punteada mientras no se usa: el buzón es para leer, y un formulario permanente
con cuatro campos le roba la mitad del panel a la lista.

Al abrirlo solo hay una cosa obligatoria —qué pasa— y **responsable, fecha y urgencia son chips que
se rellenan si hacen falta**. Pedirlos siempre convierte «apuntar una cosa» en un trámite, que es
justo lo que hace que la gente siga usando el WhatsApp. Intro envía, Mayús+Intro hace párrafo, y al
enviar **se conserva el tipo** para apuntar varias cosas seguidas.

### En grande (`/admin/avisos`)

La misma tarjeta con `grande` puesto: que las dos vistas se vean igual es lo que hace que saltar de
una a otra no desoriente. Lo que aquí cambia es lo que solo se puede hacer con sitio:

- **Agrupación por urgencia**: Vencidas · Esta semana · Más adelante · Sin fecha. Un buzón ordenado
  por fecha de creación esconde justo lo que había que mirar primero. Los grupos vacíos no se
  pintan.
- Búsqueda en el texto y filtro por responsable.
- Dos columnas en pantalla ancha: las tarjetas son autónomas y el ancho se usa.

## Qué se quitó

La sección «Tareas» de `/admin/salud`, con su lista de casillas y sus cinco acciones de servidor
(`crear`, `estado`, `titulo`, `prioridad`, `asignar`). Tenerlas en dos sitios era pedir que se
desincronizaran. Esa pantalla se queda solo con las señales del catálogo y un enlace al buzón;
«Apuntarlo como tarea» sigue funcionando y ahora alimenta el buzón.

## Criterios de aceptación

- [x] La campana sale en todas las pantallas para quien tiene rol de panel, y su número no obliga a
      traerse la lista entera.
- [x] Abrir el panel, apuntar algo con Intro y verlo en la lista sin recargar.
- [x] Marcar hecha ofrece «Deshacer»; borrar espera siete segundos con la base de datos intacta.
- [x] Lo leído por una persona no se marca como leído para el resto.
- [x] El panel y `/admin/avisos` enseñan lo mismo y se comportan igual.
- [x] Claro y oscuro verificados en navegador.
- [ ] `edicion_local` ve las tareas generales y las de su MCM, y no las de otro MCM (RLS de
      SPEC-014, sin cambios; sin verificar con una sesión de ese rol).

## Decisiones

1. **Campana en la cabecera, no burbuja flotante.** El diseño de referencia usa un FAB abajo a la
   derecha, que en una app de banca con formularios estrechos no molesta; sobre una rejilla de
   recursos a todo ancho, sí.
2. **Aviso ≠ tarea.** Convivían mal en una sola lista porque «marcar hecha» no significa nada en un
   «ojo, el lunes no hay reunión».
3. **Leído por persona**, no una bandera global. Ver arriba.
4. **Sin correo por ahora**, con el hueco pensado. Ver §Alcance.
5. **Prioridad de tres valores, pero un solo interruptor en la interfaz**: `alta` se marca y se
   desmarca; `baja` existe en la base de datos y ordena, pero no se ofrece — un desplegable de tres
   opciones que nadie usa entero es peor que un chip que sí se entiende.
