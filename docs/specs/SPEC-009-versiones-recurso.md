# SPEC-009 · Nuevas versiones de un recurso

> **Estado:** borrador (pendiente de validar con el usuario antes de codificar)
> **Depende de:** SPEC-002 (catálogo), SPEC-004 (envíos), SPEC-005 (sync), SPEC-008 (panel)

## Objetivo

Los recursos del banco se rehacen curso tras curso: la «Sesión sobre María en Adviento»
de 2023 se adapta para 2025, con un PDF nuevo y algún ajuste. Hoy solo se puede **editar
en el sitio** (pisando lo anterior) o crear un recurso suelto sin relación con el original.
Esta funcionalidad permite **publicar una versión nueva conservando la anterior**: el
catálogo muestra por defecto la versión vigente, y desde su ficha se llega a las anteriores,
cada una con su enlace, su año y su propia valoración.

## Alcance

**Entra:**
- Enlazar recursos en un **linaje de versiones** (v1 → v2 → v3…), lineal.
- Catálogo/buscador: por defecto muestra solo la **versión vigente** de cada linaje.
- Ficha: navegación entre versiones (banner «hay una más reciente» / lista «versiones
  anteriores»), con año/curso como discriminador visible.
- Crear versión desde: el **panel** (duplicar y enlazar), el **Sheet** (columna `version_de`)
  y, opcionalmente, la **revisión de un envío** (publicar como nueva versión).

**Fuera (fases posteriores):**
- Diff visual entre versiones o changelog por campo.
- Migrar/heredar valoraciones y favoritos de una versión a otra (se quedan por versión).
- Notificar a quien guardó una versión que hay una nueva (ver «Preguntas abiertas» y SPEC
  de notificaciones, aún inexistente).
- Ramas de versión (dos sucesoras de la misma v2). El modelo lo tolera pero la UI asume
  linaje lineal.

## Decisión de diseño (por qué linaje y no historial de la misma fila)

Por **AD-1**, cada recurso es una fila con `id` estable (`R####`) que nunca se recicla y
que el Sheet actualiza por ID; por **SPEC-003**, valoraciones, favoritos, usos y accesos
cuelgan de ese `recurso_id`. Guardar «revisiones» dentro de la misma fila rompería ambas
cosas (el Sheet solo tiene una fila por ID; ¿de qué versión son las 12 valoraciones?).

Por eso **una versión nueva es un recurso nuevo** (su propio ID, su propia fila en el Sheet,
su propio enlace/imagen/año y su propia capa social), **enlazado** a su predecesor. Encaja
con la realidad (la v2 suele tener enlace y curso distintos) y con el sync (fila nueva = alta
normal, sin conflicto). Una corrección menor (un typo, arreglar un enlace roto) **no** es una
versión: eso se sigue haciendo editando en el sitio (`editado_web_at`, SPEC-008 §2). Crear
versión se reserva para cuando quieres **preservar** la anterior como referencia.

## Modelo de datos (migración 00012 — propuesta)

Una sola columna nueva; todo lo demás se deriva.

```sql
alter table recursos.recurso
  add column version_de text references recursos.recurso (id) on delete set null;

-- una versión no puede ser su propio predecesor (guard anti-ciclo básico)
alter table recursos.recurso
  add constraint recurso_version_no_propia check (version_de is distinct from id);

create index recurso_version_de_idx on recursos.recurso (version_de);
```

- `version_de` = ID del **predecesor inmediato**. `NULL` = recurso original (raíz del linaje).
- **Linaje**: se recorre `version_de` hasta la raíz; la cadena da el orden (v1, v2, v3…).
- **Versión vigente** de un linaje = el recurso `publicado` al que **ningún otro recurso
  publicado apunta** por `version_de` (la cabeza de la cadena). Un borrador de v3 todavía
  no oculta a la v2 publicada.
- **RLS**: `version_de` es una columna más de `recurso`; aplican las políticas ya existentes
  (lectura según visibilidad; escritura editor/admin, o `edicion_local` en su MCM). No hacen
  falta políticas nuevas.
- **Denormalización opcional**: si algún día hiciera falta por rendimiento (no a ~1.500
  filas), añadir `reemplazado_por` mantenido por trigger. Por ahora se deriva en cliente.

### Helpers (migración 00012)

- Extraer el generador de IDs `R####` que hoy vive dentro de `sync_filas` a una función
  reutilizable `recursos.nuevo_id_recurso() returns text` (para que web y Sheet asignen IDs
  de la misma serie, que nunca se recicla — AD-1).
- `recursos.crear_version(origen_id text) returns text` (security definer, editor/admin o
  `edicion_local` de ese MCM): crea una fila nueva con `nuevo_id_recurso()`, **copia** los
  metadatos del origen (nombre, descripción, tipo, etapas, edades, nivel, idioma, soporte,
  tags, autores, itinerario, MCM local…), fija `version_de = origen_id`, `estado='borrador'`,
  `editado_web_at = now()`, **vacía** los campos que casi siempre cambian (`enlace`, `imagen`,
  `enlace_imagenes`) y devuelve el nuevo ID. No copia la capa social (empieza limpia).

## Experiencia de usuario

### Catálogo y buscador (SPEC-002/006)
- Por defecto, grid, facetas, contadores e índice Orama consideran **solo versiones
  vigentes**: se excluyen los recursos a los que otro recurso publicado apunta por
  `version_de`. El cálculo es en cliente (la carga ya trae todos los publicados, AD-3):
  `superseded = new Set(recursos.filter(r => r.estado==='publicado' && r.version_de).map(r => r.version_de))`.
- Las versiones anteriores **siguen siendo accesibles**: por enlace directo (`?r=Rxxxx`),
  desde listas/favoritos que ya las referencian y desde la ficha de la versión vigente. No
  aparecen en el grid para no duplicar.
- (Opcional) chip/toggle «incluir versiones anteriores» para quien quiera verlas en el grid.

### Ficha del recurso (SPEC-006, panel lateral)
- **Discriminador de versión** siempre visible: año de publicación y curso usado.
- En la **versión vigente**: sección «Versiones anteriores» con una fila por versión
  (v2 · 2023 · ⭐4,1) que abre su ficha.
- En una **versión anterior**: banner ámbar «Esta es una versión anterior (curso 2023).
  Ver versión actual (2025) →», enlazando a la vigente.
- Las valoraciones/favoritos mostrados son **los de esa versión**. De forma informativa, la
  vigente puede mostrar «También valorado en versiones anteriores: ⭐4,1 (12)».

### Panel de administración (SPEC-008)
- `/admin/recursos`: badge de versión (p. ej. `v2`) y marca de «vigente»; filtro
  «solo vigentes / todas las versiones».
- Acción de fila **«Crear nueva versión»** → llama a `crear_version`, abre el formulario de
  edición con el borrador ya prerrellenado; el editor pega el enlace nuevo, ajusta año/curso
  y **Publica**. Al publicarse, la anterior deja de ser vigente automáticamente (queda fuera
  del grid; su ficha pasa a mostrar el banner).
- En el formulario de recurso, campo **«Es nueva versión de…»** (combobox que busca por
  id/nombre) para enlazar/desenlazar manualmente (`version_de`), con guard anti-ciclo.
- `edicion_local` solo puede versionar recursos de su MCM (RLS ya lo garantiza).

### Envíos (SPEC-004/008) — opcional pero recomendado
- «Enviar recurso» gana un campo opcional **«¿Es una versión mejorada de un recurso
  existente?»** → guarda `envio.recurso_id` (ya existe, SPEC-008 §6).
- En la revisión, si el envío trae `recurso_id`, el revisor elige: **«Publicar como nueva
  versión de Rxxxx»** (crea la versión y enlaza), **«Actualizar Rxxxx»** (edición normal) o
  **«Publicar como recurso nuevo»**.

### Sincronización con el Sheet (SPEC-005)
- Nueva columna **`version_de`** en la hoja `Recursos` (y en `docs/seed/recursos_seed.csv`).
  Para versionar desde el Sheet: duplicar la fila, **vaciar `id`** (recibe `R####` nuevo al
  sincronizar) y poner en `version_de` el ID del predecesor. El sync enlaza; si el
  `version_de` apunta a un ID inexistente, se ignora y se reporta en `errores` (como ya hace
  con `relacionados`).
- ⚠️ Una versión creada en la web es una fila nueva que **aún no está en el Sheet**;
  `sync_filas` con `retirar_ausentes=true` **no debe retirarla** por no encontrarla. Hay que
  confirmar/ajustar esa salvaguarda (ver «Preguntas abiertas»); la escritura inversa BD→Sheet
  sigue siendo «futuro» (SPEC-005).

## Criterios de aceptación

- [ ] Publicar una versión nueva conserva la anterior con su capa social intacta y la saca
      del grid por defecto; la nueva aparece como vigente.
- [ ] La ficha de la vigente lista las anteriores; la de una anterior enlaza a la vigente.
- [ ] Deep link (`?r=`), listas y favoritos a una versión anterior siguen funcionando.
- [ ] «Crear nueva versión» copia metadatos, vacía el enlace, deja borrador y asigna un ID
      nuevo de la serie `R####` sin reciclar.
- [ ] `edicion_local` solo versiona recursos de su MCM (probado por RLS).
- [ ] Enlazar versiones desde el Sheet (`version_de`) funciona y no retira las creadas en web.
- [ ] Un recurso no puede ser su propia versión ni formar un ciclo directo.

## Preguntas abiertas (a validar antes de implementar)

1. **Grid por defecto:** ¿ocultar las versiones anteriores (propuesto) o mostrarlas todas
   con un badge «versión anterior»?
2. **Valoraciones/favoritos:** ¿por versión (propuesto, cada versión es un recurso propio) o
   arrastrarlas/heredarlas a la nueva al publicar?
3. **Accesos y stats:** el contador de aperturas y los rankings de `/admin/stats`, ¿por
   versión o **sumados por linaje** (para no partir la popularidad histórica)?
4. **Umbral versión vs. edición:** confirmar la regla — arreglos menores = editar en el
   sitio; versión nueva = entrada nueva que preserva la anterior. Es criterio editorial, no
   se fuerza. ¿De acuerdo?
5. **Aviso de novedad:** ¿queremos (más adelante) avisar a quien guardó/usó una versión de
   que hay una nueva? Requeriría una capa de notificaciones que aún no existe.
6. **`retirar_ausentes` + recursos creados en web:** ¿cómo protegerlos definitivamente? Opción
   A: excluir del retiro los que tengan `editado_web_at` y no hayan aparecido nunca en el
   Sheet; Opción B: adelantar la escritura inversa BD→Sheet para las altas web.
