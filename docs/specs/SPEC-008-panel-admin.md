# SPEC-008 · Panel de administración

> **Estado:** IMPLEMENTADA. §1 revisión, §2 tabla densa + formulario completo
> de recursos (con cambio de estado inline), §3 sync (última sync, historial con errores,
> conflictos con «Aplicar versión del Sheet» — la protección web ahora es PERSISTENTE
> hasta resolverse, migración 00009), §4 usuarios (rol/MCM/activo con anti-auto-degradación;
> `perfil.activo=false` anula privilegios vía `rol_actual()`), §5 emails, §7 mis envíos,
> §stats (tiles + tops), §config con pestañas: listas cerradas (`lista_valor`), facetas
> (`faceta` — el buscador público las lee de BD), MCM locales y accesos preautorizados
> (`acceso_previo`, aplica el cambio al perfil si ya existe, con guard anti-auto-degradación).
> PENDIENTE dentro de §config: editor visual de itinerarios.
> **Depende de:** SPEC-001 (roles), SPEC-002 (catálogo), SPEC-004 (envíos), SPEC-005 (sync)
> **Decide y cierra:** las preguntas abiertas de SPEC-004 y SPEC-005

## Decisiones fundacionales (validadas)

1. **La BD manda; el Sheet importa.** Al editar desde la web, la web es la fuente de
   verdad. El sync del Sheet detecta conflictos y pregunta, nunca pisa en silencio.
2. **Revisión repartida:** editor/admin revisan todo; `edicion_local` ve y revisa los
   envíos de su MCM local, y edita solo los recursos de su localidad.
3. **Email desde el principio** (Resend, plantillas cuidadas) al aprobar/rechazar +
   sección "Mis envíos" sencilla pero funcional. Todo implementado a falta de pegar la
   API key de Resend (`RESEND_API_KEY` en env; sin key, los emails se registran en log
   y no se envían — la app no se rompe).
4. **Consulta externa por ascenso:** login libre con Google, nace como `consulta`;
   un admin le sube el rol desde el panel.

## Estructura y navegación

`/admin` dentro de la misma app (mismo tema, misma tipografía), con **navegación lateral**
(sidebar shadcn en escritorio, drawer en móvil). Guard en servidor por sección según rol.

| Sección | Ruta | consulta | edicion_local | editor | admin |
|---|---|---|---|---|---|
| Mis envíos | `/envios` (fuera de /admin) | ✅ | ✅ | ✅ | ✅ |
| Revisión | `/admin/revision` | — | solo su MCM | ✅ | ✅ |
| Recursos (tabla) | `/admin/recursos` | — | solo su MCM (edición) | ✅ | ✅ |
| Sincronización | `/admin/sync` | — | — | ✅ (ver) | ✅ |
| Usuarios | `/admin/usuarios` | — | — | — | ✅ |
| Configuración | `/admin/config` (facetas, listas, MCM locales, itinerarios) | — | — | — | ✅ |
| Estadísticas | `/admin/stats` | — | — | ✅ | ✅ |

La cabecera del panel muestra siempre: contador de pendientes de revisión (badge),
estado de la última sync y quién eres/rol.

## 1. Revisión de envíos (`/admin/revision`)

**Cola** de envíos en estados `subido_usuario`, `pendiente_revision` y `revisar_ia`,
ordenada por antigüedad. Cada tarjeta: título, remitente (avatar + MCM local), enlace(s),
notas del remitente, antigüedad, y origen del estado (persona/IA).

**Flujo de aprobación** (pantalla de detalle, dos columnas):
- Izquierda: lo enviado (enlace navegable, vista previa si es Drive/YouTube, notas).
- Derecha: **el formulario de recurso completo** (mismo componente que edición, ver §2)
  pre-rellenado con lo que dio el remitente. El revisor completa metadatos ahí mismo.
- Acciones: **Publicar** (crea/actualiza `recurso` con `estado=publicado`),
  **Guardar como borrador**, **Devolver** (vuelve al remitente con motivo, estado
  `rechazado` + texto), **Descartar**.
- Al publicar: el envío guarda `recurso_id` y quién lo revisó; email al remitente (§5).
- `edicion_local`: la cola se filtra a envíos cuyo remitente es de su MCM local (RLS).

**Estado `revisar_ia`**: mismo flujo, con banner destacando qué señaló la IA
(campo `motivo_ia` en el envío; el análisis automático llegará en fase 5 — el estado y el
campo quedan preparados).

## 2. Edición de recursos (`/admin/recursos`)

**La vista tabla densa de SPEC-006, aquí:** filas de 44 px, columnas configurables y
ordenables (nombre, tipo, estado, MCM, año, valoración, accesos, última edición),
los mismos filtros/facetas del buscador + filtro por estado, búsqueda de texto.
Selección múltiple → acciones en lote (cambiar estado, añadir tag, asignar MCM local).

**Formulario de recurso** (sheet lateral ancho o página según viewport):
- Campos agrupados: Identidad (nombre, descripción, tipo) · Clasificación (etapas, nivel,
  edades, tags con combobox crea-si-no-existe, itinerario) · Origen (MCM local, autores,
  año, curso) · Enlaces (enlace, imagen, más imágenes, ubicación, soporte) · Control
  (estado, visibilidad, datos personales, IA, fuera del banco, pendiente de clasificar,
  notas internas).
- Selects alimentados por `lista_valor`; solo `nombre` y `estado` obligatorios.
- `edicion_local` solo puede abrir en edición recursos de su MCM (RLS ya lo garantiza;
  la UI además lo muestra en solo-lectura con aviso).
- Al guardar: `recurso.editado_web_at = now()` (columna nueva, ver §6).

## 3. Sincronización (`/admin/sync`) — «BD manda, Sheet importa»

- Estado: última sync (de `sync_config`), historial de `sync_log` con detalle expandible
  de errores por fila.
- **Modelo de conflictos** (cierra la pregunta de SPEC-005): `sync_filas` comparará
  `recurso.editado_web_at` con la última sync. Si un recurso fue editado en la web
  después de la última sincronización y su fila del Sheet también cambia, la fila
  **no se aplica**: cae en la lista de conflictos del informe
  (`conflictos: [{id, campos_sheet, campos_web}]`).
- Pantalla de conflictos: comparación lado a lado por campo, con botones
  "Mantener versión web" / "Aplicar versión del Sheet" por recurso (o en lote).
  Resolver a favor del Sheet limpia `editado_web_at`.
- El Apps Script muestra los conflictos en su aviso final («3 filas en conflicto,
  resuélvelas en el panel»).

## 4. Usuarios (`/admin/usuarios`) — solo admin

- Tabla: avatar, nombre, email, MCM local, rol, alta, última actividad.
- Acciones por fila: cambiar rol (select con confirmación), asignar MCM local,
  desactivar (nuevo booleano `perfil.activo`; desactivado = tratado como anónimo).
- Un admin no puede quitarse a sí mismo el rol de admin (guard en servidor).
- Búsqueda por nombre/email y filtros por rol y MCM.
- Aquí se asciende a `consulta_externa` (decisión 4): buscar al usuario y cambiarle el rol.

## 5. Emails (Resend)

- Módulo `app/src/lib/server/email.ts`: plantillas HTML con la identidad del banco
  (teal, Bricolage en cabecera, botón CTA) para: **envío aprobado** (con enlace a la
  ficha publicada), **envío devuelto** (con el motivo y enlace para reenviar).
- Sin `RESEND_API_KEY` configurada: se registra en consola/log y no rompe el flujo.
- Remitente: `Banco de Recursos MCM <recursos@...>` (dominio por decidir al crear la
  cuenta de Resend). Idioma: castellano. Sin marketing, solo transaccional.

## 6. Cambios de modelo de datos (migración futura 00006)

- `recurso.editado_web_at timestamptz` — base del modelo de conflictos.
- `perfil.activo boolean not null default true`.
- Tabla `envio` (de SPEC-004, aquí concretada): `id`, `perfil_id`, `titulo`,
  `enlace` / `archivo_storage`, `notas`, `mcm_local_id` (del perfil al crear),
  `estado: enviado | en_revision | publicado | devuelto | descartado`, `motivo_ia`,
  `motivo_devolucion`, `recurso_id`, `revisado_por`, timestamps.
  RLS: dueño ve los suyos; editor/admin todo; `edicion_local` los de su MCM.
- `sync_filas`: parámetro de retorno `conflictos` + lógica `editado_web_at`.

## 7. «Mis envíos» (`/envios`, todos los roles con login)

Lista simple de mis envíos con estado en pill semántica (Enviado 🔵 / Publicado 🟢 con
enlace a la ficha / Devuelto 🟠 con el motivo visible y botón "Corregir y reenviar" /
Descartado ⚪). Badge de novedades en el menú del avatar desde la última visita.

## Diseño

Mismo sistema (docs/04-diseno.md) con densidad "herramienta": tablas compactas,
`tabular-nums`, pills semánticas de estado (verde publicado / ámbar pendiente / azul
enviado / rojo descartado — semánticos, nunca los colores de familia), sidebar sobria,
sin héroes. Las stats de `/admin/stats` siguen las pautas dataviz del doc de diseño
(barras horizontales para tops, línea para accesos en el tiempo, paleta secuencial teal,
un eje, tooltips, vista tabla accesible).

## Criterios de aceptación

- [ ] Cada sección rechaza en **servidor** a quien no tiene el rol (probar con curl).
- [ ] `edicion_local` no puede ver ni editar recursos/envíos de otro MCM (RLS probado).
- [ ] Aprobar un envío publica el recurso, guarda trazabilidad y envía email (o lo
      loguea sin key).
- [ ] Un recurso editado en web y cambiado en el Sheet aparece como conflicto y ninguna
      versión se pierde hasta resolverlo.
- [ ] Cambios de rol quedan reflejados al instante (el usuario afectado ve su nuevo
      alcance sin relogin).
- [ ] "Mis envíos" refleja cada transición de estado.

## Fuera de alcance (fases posteriores)

Comentarios/moderación (SPEC-003 pendiente), análisis automático con IA que alimenta
`revisar_ia`, escritura inversa BD→Sheet automática, editor de itinerarios visual
(en `/admin/config` empezará como CRUD simple).
