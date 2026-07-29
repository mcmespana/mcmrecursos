# Roadmap

## Fase 0 — Fundaciones ✅ (en curso)
- [x] Scaffold SvelteKit + Svelte 5 + Tailwind 4 + shadcn-svelte
- [x] Documentación spec-driven
- [x] BD operativa: esquema `recursos` en el proyecto compartido mcmvotaciones, migración 00001 aplicada (AD-6)
- [x] App conectada a Supabase (@supabase/ssr, hooks + locals, callback OAuth)
- [x] Google OAuth configurado en el dashboard de Supabase (2026-07-27). Sigue existiendo el
      login alternativo por email+contraseña en `/entrar` para administración.
- [x] Login con Google + perfiles, onboarding de MCM local (SPEC-001)

## Fase 1 — Catálogo y búsqueda
- [x] Modelo de datos validado y aplicado (migración 00002: recurso, tags, autores, itinerarios, facetas, lista_valor)
- [x] Seeds para el Sheet: `docs/seed/recursos_seed.csv` + `docs/seed/listas_seed.csv`
- [x] Sistema de diseño definido (`docs/04-diseno.md`) y tokens aplicados (fuentes, paleta, modo oscuro)
- [x] Sync Google Sheet → BD con ID estable (SPEC-005): función `sync_filas` probada; falta crear el Sheet y pegar el Apps Script documentado
- [x] Buscador facetado con Orama + vista tarjetas + ficha de recurso
- [x] Contador de accesos por recurso

## Fase 2 — Capa social
- [x] Valoraciones (estrellas), corazones/favoritos, "lo he usado" y accesos (SPEC-003, BD + UI optimista)
- [x] Modo sin cuenta: valorar anónimo (BD, por dispositivo), corazones/usos/listas en localStorage con aviso, y migración automática a la cuenta al hacer login
- [x] Candado en recursos privados (los anónimos ni los ven, vía RLS)
- [x] Listas personales (crear desde la ficha, compartir por enlace público, /listas)
- [x] Comentarios y sugerencias de mejora (borrado por autor/editor)
- [x] Miniaturas automáticas desde Drive/YouTube con respaldo por familia

## Fase 3 — El banco vivo
- [x] SPEC-008 del panel de administración validada (revisión, edición con conflictos Sheet/web, usuarios, emails Resend)
- [x] Migración 00007: envio, editado_web_at, perfil.activo, conflictos en sync_filas (probados)
- [x] Envío rápido multi-recurso + "Mis envíos" con corregir-y-reenviar
- [x] /admin: shell con guard por rol + cola de revisión (publicar/devolver/descartar)
- [x] Emails Resend (plantillas listas; pegar RESEND_API_KEY cuando exista)
- [x] /admin/recursos: tabla densa ordenable con filtro y edición completa (estado inline)
- [x] /admin/sync: última sync, historial con errores y resolución de conflictos (protección web persistente)
- [x] /admin/usuarios: roles, MCM local y activar/desactivar (con salvaguardas)
- [x] /admin/stats: tiles + más abiertos + mejor valorados + por estado
- [x] 13 MCM locales reales + acceso preautorizado (3 admins, 10 delegaciones como edición local)
- [x] Vista tabla para usuarios (SPEC-006 §2b): toggle galería/tabla (`?vista=tabla`),
      filas ~40 px sin imagen (miniatura de 32 px opcional), columnas configurables y
      reordenables recordadas en `localStorage`, ordenable por columna, misma ficha,
      facetas y URL que la galería
- [x] Facetas del buscador dirigidas por BD: el buscador público lee `recursos.faceta`
      (etiqueta, orden, visible, protegida) — añadir/renombrar filtros ya no toca código
- [x] /admin/config (SPEC-008 §config, solo admin) con pestañas: listas cerradas
      (`lista_valor`), facetas (`faceta`, incluye promocionar campos nuevos), MCM locales
      (`mcm_local`) y accesos preautorizados (`acceso_previo`, aplica al perfil si ya existe)
- [x] Caravaca preautorizada (2026-07-27): ya no queda ninguna delegación sin editor
- [x] Nuevas versiones de un recurso (SPEC-009, migración 00012): linaje `version_de`,
      la vigente oculta a las anteriores y hereda su valoración/uso/accesos; ficha con
      «versiones anteriores» y banner en las viejas; «Crear nueva versión» en /admin/recursos
- [x] Relacionados de verdad (afinidad por tags/tipo/etapas) y navegación ←/→ de la ficha
      dentro del filtro/mazo con posición y estado disabled

## 👉 SIGUIENTE

Toda la SPEC-010 está implementada (autoclasificación, búsqueda semántica y el
«Recomiéndame…» de Descubre) y el dashboard de estadísticas también. Lo que queda es
sobre todo **configuración** — ver `docs/05-configuracion-servicios.md` para las claves
pendientes (Gemini, Voyage, cuenta de servicio de Drive).

### ⚠️ Estado (2026-07-27)

El dashboard de estadísticas **ya está en `main`** (PR #15), igual que formatos, aportación
sin cuenta y estados de carga (PR #16). La nota anterior sobre un PR pendiente del dashboard
quedó obsoleta.

Migraciones **ya aplicadas** en remoto (proyecto `sjhxhsdckvungsrbquve`, esquema `recursos`)
— no reaplicar: hasta la `00018_ajustes_descubre_ia.sql` inclusive.

Existe un usuario de servicio en Supabase Auth para entrar sin OAuth por `/entrar`
(enlace discreto en el `·` del footer): `asistente@movimientoconsolacion.com`, rol
`administrador`. La contraseña se entregó una sola vez por chat (no está en ningún
fichero del repo, y así debe seguir) — si se ha perdido, resetéala desde el dashboard de
Supabase (Authentication → Users).

**Librería de gráficas: LayerChart** (`layerchart@2.0.2`), instalada y en uso en
`/admin/stats`. Se evaluó **evilcharts.com** como alternativa a petición del usuario y se
descartó (2026-07-26): es una colección de componentes exclusiva de React/Next.js
(envuelve Recharts/ECharts), incompatible con Svelte sin reescribirla entera — detalle
completo y motivo en `docs/04-diseno.md` §6. Seguir con LayerChart para cualquier
gráfica nueva.

## Fase 3.7 — Pulido de interfaz (SPEC-012) — ✅ completa, en `main`
- [x] Auditoría de las pantallas con mucha información y de los formularios: medida en
      navegador y anotada en `docs/specs/SPEC-012-pulido-interfaz.md`
- [x] Formulario de recurso (el mismo en crear/editar/catalogar) en cinco secciones —Qué es,
      Para quién, Dónde está, De dónde viene, Publicación—; Estado y Visibilidad dejan de
      parecer un campo más; Edades pasa de 175 px a 144 px sin perder los grupos (PR #18)
- [x] Ficha de recurso: metadatos separados en «Para quién» y «Ficha técnica» (PR #19). De
      paso, bug real de cascada de Tailwind en `Sheet.Content`: el panel se quedaba a 3/4 de
      ancho en móvil (contenido cortado) y a 384px en escritorio en vez del `max-w-*` de cada
      pantalla — afectaba también al panel de edición de /admin/recursos
- [x] **Bug de correctitud, no solo estético** (PR #20): en /admin/recursos y /admin/revision,
      `use:enhance={fn(id)}` ponía el estado «ocupado» al montar en vez de en cada envío — 9
      funciones afectadas, todas las filas nacían «cargando» sin tocar nada, y el segundo
      envío de cada botón dejaba de mostrar su estado para siempre. Detalle completo en
      SPEC-012 §«Bug de carga permanente»
- [x] /admin/config auditado: mismo esqueleto en las 5 pestañas, sin cambios necesarios
- [ ] Quedan 3 preguntas abiertas en SPEC-012 (orden de secciones del formulario, dónde van
      notas/pendiente-clasificar, qué otra pantalla chirría) para si se retoma más pulido

### Próximos pasos

1. Poner `GEMINI_API_KEY` y `VOYAGE_API_KEY` en Vercel y pulsar «Reindexar búsqueda» en
   /admin/recursos: es lo único que le falta al «Recomiéndame…» para encenderse del todo
   (sin Voyage funciona, pero recomienda peor porque los candidatos salen por palabras).
2. Pulsar «Detectar formatos» en /admin/recursos — de momento no aporta gran cosa: el
   catálogo son 8 recursos `[EJEMPLO]`, cobra sentido cuando entre contenido real por el Sheet.
3. Presets de mazo para Descubre («Adviento», «Para monitores»…).
4. Elegir por dónde seguir de la Fase 3.7 (UI/UX). Mi orden: vista previa en la ficha,
   acciones en lote en el panel y estado vacío que sugiera qué filtro quitar.
5. Más adelante: conversión a PDF de los Office sueltos de Drive, subida a Storage y editor
   visual de itinerarios en /admin/config.

## Fase 3.6 — Formatos, aportación abierta y pulido del panel (SPEC-011)
- [x] Migración 00015: `recurso.formato`, tabla `recurso_archivo`, envío sin cuenta
      (`envio.anon_id`/`clasificacion` + RPCs `crear_envio`, `mis_envios_anon`,
      `reenviar_envio_anon`, `reclamar_envios`) y `envio.recurso_id` con `on delete set null`
      para poder borrar recursos. Migración 00016: `fijar_formato` (detección en lote sin
      ensuciar la sincronización con el Sheet)
- [x] Detección automática del formato del enlace (Docs, Slides, Sheets, Forms, carpeta de
      Drive, YouTube, Canva, Genially, PDF/Word/PPT/Excel/imagen/vídeo/audio…) con icono de
      marca, afinada con la API de Drive cuando la URL no basta
- [x] Un recurso puede ofrecerse en varios formatos a la vez (Doc + PDF + Word); la ficha los
      lista con su icono bajo «También disponible en»
- [x] Icono propio por `tipo` (Imagen ya no sale con la claqueta de Película)
- [x] Enviar recursos sin cuenta, con clasificación opcional, y reclamarlos al iniciar sesión
- [x] Un único formulario de recurso para crear, editar y catalogar-y-publicar, con las
      temáticas arriba, chips con sugerencias y deduplicación, y atajos Todas/N-A en etapas
      y edades
- [x] Eliminar recursos desde el panel (con confirmación)
- [x] Se acabó el doble envío: publicar un envío es idempotente y todos los botones de acción
      muestran su estado mientras el servidor responde; el catálogo deja de recargarse entero
      en cada corazón
- [x] «Formato» como faceta del buscador público (migración 00017): filtra por Documento de
      Google, PDF, Word, carpeta de Drive… contando también los formatos alternativos
- [x] Estados de carga en toda la interfaz: `<Button cargando>` con spinner y check de
      confirmación, barra de progreso de navegación y respeto de `prefers-reduced-motion`
- [x] **Bug corregido (2026-07-28, ver SPEC-012 rebanada 3a)**: en `/admin/recursos` y
      `/admin/revision`, `use:enhance={fn(id)}` llamaba a `fn` una vez al montar (no en cada
      envío), y esas funciones ponían el estado «ocupado» *antes* de devolver el manejador en
      vez de dentro — así que TODAS las filas de la tabla y varios botones nacían ya
      «cargando» (selects deshabilitados, spinners) desde que se abría la página, y además el
      segundo envío de cada botón dejaba de mostrar su estado para siempre. Rompía justo lo
      que dice esta línea del roadmap. `/admin/sync` y las páginas que usan `crearOcupado()`
      (config, usuarios) no estaban afectadas: ese helper ya lo hacía bien.
- [x] **Descargar y copiar documentos de Google** (2026-07-29). Resulta que NO hacía falta
      cuenta de servicio ni permiso de escritura, como decía aquí antes: los editores de Google
      exportan por URL cambiando el `/edit` final. La ficha ofrece «PDF», «Word/Excel/
      PowerPoint» y «Hacer una copia» (que crea una copia editable en el Drive de quien la
      pulsa, con permiso de solo lectura sobre el original). Verificado contra documentos
      públicos de Google sin ninguna credencial — tabla de URLs y modos de fallo en SPEC-011
      §«URLs de Google»
- [x] Favicon del sitio como miniatura de respaldo de los recursos que son una web, en vez del
      globo genérico (otra URL mágica de Google; cae al icono del tipo si no lo tiene indexado)
- [ ] **Aparcado, esto sí de verdad**: convertir a PDF un `.docx`/`.xlsx`/`.pptx` que viva en
      Drive como fichero suelto. No hay atajo por URL y `files.export` responde `403 Export
      only supports Docs Editors files` con binarios: hay que copiar-convirtiendo con
      `files.copy`, exportar y borrar la copia, y eso necesita scope de escritura en Drive
- [ ] **Aparcado, no olvidado**: subir archivos a Supabase Storage desde /enviar. Hoy solo se
      guardan enlaces y de momento se queda así — quien aporta suele tener el material ya en
      su Drive, y el enlace evita duplicar el fichero y decidir su destino final

## Fase 3.7 — UI/UX: la siguiente vuelta 🎨

Ordenado por lo que más se va a notar. Las cuatro primeras no son ideas nuevas: son **promesas
que ya están escritas** en las specs o en el sistema de diseño y siguen sin cumplirse.

- [ ] **Vista previa dentro de la ficha.** Hoy, para saber si un recurso es el que buscas hay
      que abrirlo en otra pestaña. Drive y los editores de Google sirven `/preview` embebible y
      YouTube tiene su iframe: se puede ver el documento sin salir del banco. SPEC-008 §1 ya lo
      daba por hecho en la cola de revisión («vista previa si es Drive/YouTube») y no está
- [ ] **View Transition de tarjeta a ficha**, con la miniatura viajando. Lo promete
      `docs/04-diseno.md` §5 («250 ms máx.») y hoy la ficha aparece de golpe
- [ ] **Selección múltiple y acciones en lote** en /admin/recursos (cambiar estado, añadir una
      temática, asignar MCM local a varios de una vez). SPEC-008 §2 lo especifica; no existe.
      Es lo que convierte una tarde de catalogación en diez minutos
- [ ] **Estado vacío que sugiera qué quitar.** `docs/04-diseno.md` §7 pide literalmente «Sin
      resultados con estos 4 filtros — prueba quitando *Vídeo*»; hoy el mensaje es genérico. El
      dato para calcularlo ya está: `countsPorFaceta` sabe qué filtro cuesta más resultados
- [ ] **Paleta de comandos (⌘K)**: ir a un recurso, aplicar un filtro o saltar de sección desde
      el teclado. El componente `command` de shadcn está instalado y sin usar desde el día uno
- [ ] **Copiar el enlace del recurso** desde la ficha, con el check de confirmación del botón.
      Hoy toca ir a la barra del navegador
- [ ] **Deshacer** en lo destructivo: quitar un favorito, descartar un envío, eliminar un
      recurso. Un toast con «Deshacer» y retardo real antes de ejecutar vale más que un diálogo
      de confirmación, que se acaba pulsando en automático
- [ ] **Rendimiento con catálogo de verdad.** Hoy se cargan TODOS los recursos y se indexan en
      Orama en el cliente: con 8 sobra, con 800 que entren por el Sheet hay que paginar o
      virtualizar el grid y medirlo. Es lo primero que va a doler cuando haya contenido real
- [ ] **Accesibilidad de la tarjeta**: hay un botón absoluto que cubre la tarjeta entera con el
      corazón por encima — revisar orden de tabulación y qué anuncia el lector de pantalla. Y
      `aria-live` en el recuento de resultados, que ahora cambia en silencio
- [ ] **Repaso de móvil**: la ficha es un panel lateral; comprobar el gesto de cierre y que
      todos los targets lleguen a los 44 px que exige `docs/04-diseno.md` §7
- [ ] «Vistos hace poco» en la portada (localStorage) e insignia «nuevo» para lo publicado en
      los últimos días, con orden «recién añadidos»
- [ ] Exportar una lista guardada a PDF o CSV — encaja con el «Llevártelo» de la ficha
- [ ] Miniatura para las carpetas de Drive, que hoy no tienen ninguna (necesita API para sacar
      el primer archivo de dentro)

## Fase 3.5 — Descubre (el tinder de recursos) 🎴
- [x] Modo swipe sin IA (SPEC-007 v1): `/descubre` con mazo desde los filtros del buscador,
      sesgo a mejor valorados, gestos táctiles + botones + atajos de teclado, descartes por
      sesión, deshacer, volver a barajar y enlace en cabecera
- [ ] Presets de mazo configurables ("Adviento", "Para monitores"…)
- [x] Con IA (SPEC-007 fase 2, migración 00018): cuentas qué necesitas en texto libre y la IA
      **reordena** el mazo (no lo recorta) con una línea por tarjeta explicando por qué;
      chips de retoque («más cortas», «para más mayores»), filtros interpretados que se
      ofrecen con un clic y consulta compartible en `?ia=`. Dos llamadas por consulta
      (embedding + una a Gemini para todas las tarjetas), tope por IP y **cuatro formas de
      apagarlo**: /admin/config → Funciones, `DESCUBRE_IA=off`, fusible automático tras 3
      fallos seguidos y ausencia de clave

## Fase 4 — Estadísticas
- [x] Dashboard con LayerChart: serie de accesos (30 días), top recursos, mejor valorados
      y autores con más aperturas, sobre los tiles ya existentes en /admin/stats

## Fase 5 — IA (SPEC-010; motor Google Gemini)
- [x] Autoclasificación v1: botón «Analizar con IA» en /admin/recursos (Gemini Flash) que
      propone tipo/etapas/edades/nivel/idioma/soporte/tags/descripción + avisos; el editor
      aplica y publica (la IA nunca publica sola). Migración 00013 (`no_ia`, `clasificacion_ia`)
- [x] Leer el documento de Drive (cuenta de servicio) para clasificar con más contexto
- [x] «Analizar todo lo pendiente» en lote y en la cola de revisión
- [x] Embeddings (pgvector, Voyage 200M gratis) + búsqueda híbrida con Orama (etiqueta «por
      significado» en el buscador; migración 00014, «Reindexar búsqueda» en /admin/recursos)
- [x] "Recomiéndame una actividad para…" conversacional en Descubre (ver Fase 3.5)
