# Roadmap — histórico (todo lo ya hecho)

Todo lo de este documento está **cerrado y en `main`**. Vive aquí, fuera de
`docs/03-roadmap.md`, para que ese archivo enseñe solo lo que queda por hacer — antes
mezclaba dos años de trabajo terminado con las cuatro cosas pendientes de verdad, y daba
agobio nada más abrirlo.

Nada de esto se ha reescrito: es un traslado literal, con sus fechas y sus PRs, para no
perder ningún porqué.

## Fase 0 — Fundaciones ✅
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

### ⚠️ Estado (2026-07-27)

El dashboard de estadísticas **ya está en `main`** (PR #15), igual que formatos, aportación
sin cuenta y estados de carga (PR #16). La nota anterior sobre un PR pendiente del dashboard
quedó obsoleta.

Migraciones **ya aplicadas** en remoto (proyecto `sjhxhsdckvungsrbquve`, esquema `recursos`)
en ese momento — hasta la `00018_ajustes_descubre_ia.sql` inclusive. (Ver `docs/02-modelo-datos.md`
o `supabase/migrations/` para el estado actual: hay más aplicadas desde entonces.)

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
      notas/pendiente-clasificar, qué otra pantalla chirría) para si se retoma más pulido —
      **la única línea de esta fase que sigue abierta**; el resto de la fase está cerrado

### Dos bugs de antes que salieron al hacer esto (2026-07-30)

Ninguno los había causado la Fase 3.7; se comprobó volviendo a `main` limpio antes de tocar
nada. Los dos afectaban a algo que sí es nuevo, así que se arreglaron aquí:

- **La ficha no se cerraba con Escape.** La primitiva del panel no lo hacía, así que solo se
  salía con el ratón. Ahora `RecursoFicha` lo maneja donde ya escuchaba las flechas.
- **La URL se quedaba con el `?r=` pegado al cerrar la ficha.** `page.url` NO se actualiza con
  `replaceState`, y el efecto que sincroniza la URL se comparaba justo contra `page.url.search`:
  veía el valor de la carga inicial y decidía que no había nada que escribir. Ahora se compara
  con lo último que escribimos nosotros. El mismo motivo explicaba por qué la paleta cambiaba la
  URL sin abrir nada: `?r=` solo se leía al inicializar, y ahora hay un puente que escucha las
  navegaciones de verdad (paleta, enlace pegado, botón atrás) sin pelearse con nuestras propias
  escrituras.

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
- [x] Eliminar recursos desde el panel (con confirmación — más tarde sustituida por
      deshacer con cuenta atrás, ver Fase 3.7 UI/UX)
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

## Fase 3.7 — UI/UX: la siguiente vuelta 🎨 (lo ya cerrado de esta fase)

Ordenado por lo que más se notaba. Las cuatro primeras no eran ideas nuevas: eran **promesas
que ya estaban escritas** en las specs o en el sistema de diseño y seguían sin cumplirse.
(Lo que queda pendiente de esta fase está en `docs/03-roadmap.md`, no aquí.)

- [x] **Vista previa dentro de la ficha** (2026-07-29). Documentos, hojas, presentaciones,
      formularios, carpetas de Drive, cualquier archivo de Drive (PDF, imagen, vídeo, Office),
      YouTube, Vimeo y Canva se ven empotrados; una web cualquiera no, a propósito (casi todas
      prohíben el empotrado y un marco en blanco es peor que ninguno). Viene abierta, se puede
      ocultar y se recuerda; con ella abierta el héroe se reduce a las etiquetas para no enseñar
      dos veces la misma primera página. También en la cola de revisión, que es donde más falta
      hacía. Detalle y decisiones en SPEC-011 §«Vista previa»
- [x] **View Transition de tarjeta a ficha** (2026-07-30), con la miniatura viajando, como
      prometía `docs/04-diseno.md` §5. El nombre de transición se pasa de mano en mano (tarjeta →
      ficha) porque tiene que ser único en cada instante; aterriza en el héroe, o en el marco de
      la vista previa si el héroe está colapsado, para que nunca quede desparejado. Sin la API o
      con `prefers-reduced-motion`, la ficha se abre sin más
- [x] **Selección múltiple y acciones en lote** en /admin/recursos (2026-07-30, SPEC-008 §2).
      Casilla por fila, rango con shift, y la de la cabecera marca **todo lo filtrado**, no solo la
      tanda pintada. Barra pegada abajo con cambiar estado, asignar o quitar MCM local, añadir o
      quitar temática (creándola si no existe, por slug, para no duplicar «Adviento») y eliminar con
      cuenta atrás. Cada operación es una sola sentencia `in('id', ids)`: se aplica a todos o a
      ninguno. Lo marcado que deja de pasar el filtro no recibe la acción
- [x] **Estado vacío que sugiere qué quitar** (2026-07-30). Con cero resultados se prueba a quitar
      cada filtro **y la consulta** por separado, y se ofrecen los que devuelven algo, empezando por
      el que más desbloquea: «Prueba quitando esto: × «zzzqqq» 36 recursos». El título nombra al
      culpable («Sin resultados con «adviento» y este filtro»), y si quitar uno solo no basta, lo
      dice en vez de sugerir en falso
- [x] **Paleta de comandos (⌘K)** (2026-07-30): ⌘K, Ctrl+K o `/` desde cualquier pantalla, con
      disparador visible en la cabecera para que el atajo no sea un secreto. Busca sin acentos
      («oracion» encuentra «Oración»), agrupa en Recursos / Ir a / Acciones y pide el catálogo la
      primera vez que se abre, no al cargar la app
- [x] **Copiar el enlace del recurso** desde la ficha (2026-07-30), con el check de
      confirmación del botón
- [x] **Deshacer en lo destructivo** (2026-07-30). `$lib/deshacer.ts` con dos patrones y la
      regla de cuándo usar cada uno:
      - `accionRetardada` — la pantalla reacciona al instante y la acción espera 7 s con un
        «Deshacer» a mano. Durante la cuenta atrás **no ha pasado nada en la base de datos**:
        no hay que revertir un borrado, es que aún no se ha borrado. Eso es más seguro que un
        diálogo, que ejecuta en cuanto lo confirmas. Usado en descartar un envío (nuevo botón
        directo en la fila, sin pasar por el diálogo de devolver), eliminar un recurso —donde
        sustituye al diálogo de confirmación— y borrar una lista, que usaba un `confirm()` del
        navegador
      - `avisoDeshacible` — para lo que ya era reversible de por sí (quitar un favorito): la
        acción se ejecuta al momento y «Deshacer» hace la contraria. Retardar ahí no aporta nada
      - Si te vas de la página con una cuenta atrás en marcha, se lanza (`pagehide` +
        `keepalive` en `lanzarAccion`): abandonarla dejaría la pantalla diciendo una cosa y la
        base de datos otra
      - `lanzarAccion` (en `$lib/acciones.svelte.ts`) llama a una acción de formulario de
        SvelteKit sin `<form>`, que es lo que hace falta cuando el envío ocurre 7 s después del
        clic y ya no hay evento del que colgarse
- [x] **Rendimiento con catálogo de verdad** (2026-07-30, SPEC-013). Medido con un PostgREST de
      mentira que sirve catálogos de 800 y 2.000 recursos, sobre el build de producción y con SSR.
      Cuatro cosas estaban mal, la peor de todas invisible:
      - **El catálogo viajaba dos veces en cada visita en frío**: serializado en el HTML del SSR y
        otra vez en JSON al hidratar. El culpable no era el `load` de la página sino el del layout,
        que crea el cliente de Supabase y por eso corre en los dos lados — y cuando un `load` padre
        se reejecuta, los hijos también. Ahora se carga en `+page.server.ts`: **de 5,1 MB de HTML +
        4 peticiones REST a 1,0 MB y ninguna**
      - **Se pintaba el catálogo entero**: 2.000 recursos eran 60.000 nodos y 136 MB, y sobre todo
        **abrir una ficha tardaba 14 segundos**, porque la View Transition fotografía el documento
        completo dos veces. Ahora se pintan 48 tarjetas y crece al llegar al final: **126 ms**, y el
        DOM ya no depende del tamaño del catálogo (1.681 nodos con 800 y con 2.000)
      - **El índice de búsqueda se construía al cargar** —sin que nadie hubiera buscado nada— y se
        rehacía entero cada vez que se guardaba un favorito. Ahora se construye al escribir la
        primera letra y se reutiliza
      - **Los valores de faceta se recalculaban decenas de miles de veces por tecla** (contar una
        faceta implica filtrar por todas las demás). Memoizados con un `WeakMap`
      - De paso: la paleta de comandos pedía el catálogo entero al servidor en la primera ⌘K aunque
        lo tuvieras delante, y pintaba una entrada por recurso. Ahora reutiliza lo que ya está en
        memoria y enseña como mucho 40 coincidencias
      - Limpiar la búsqueda con 2.000 recursos: de **2.927 ms a 77 ms**. Bloqueo del hilo principal
        al cargar: de **2.345 ms a 104 ms**
      - Lo que sigue creciendo en línea recta es el payload (el catálogo entero viaja en el HTML).
        SPEC-013 fija el umbral —~3.000 recursos— y qué hacer entonces, por orden
      - **Segunda vuelta, el JavaScript** (2026-07-30): la paleta de comandos viajaba en el paquete
        del layout, o sea que su primitiva se descargaba en TODAS las páginas para todo el mundo; y
        el motor de búsqueda venía con la portada aunque nadie buscase. Los dos se cargan ahora con
        `import()` cuando hacen falta: el layout baja de 82 a 70 KB comprimidos y la portada de 32 a
        12, o sea **114 → 82 KB de JavaScript en una primera visita**. La paleta, además, pintaba una
        entrada por recurso (16.000 nodos con 2.000); ahora enseña como mucho 40 coincidencias
- [x] **Accesibilidad y targets táctiles** (2026-07-30):
      - **Bug real de móvil**: el corazón de la tarjeta era `opacity-0` hasta el `hover`, y en
        una pantalla táctil no hay `hover` — o sea que en móvil no había forma de guardar un
        favorito desde la rejilla. Ahora se ve siempre por debajo de `sm`
      - `aria-live` en el recuento de resultados del catálogo y en el de la cola de revisión,
        que cambiaban en silencio. Con un texto entero para quien escucha: «1 recurso encontrado
        con la búsqueda actual»
      - El botón que cubre la tarjeta anuncia también el tipo («Ver ficha de X, Sesión de
        grupo»): en la rejilla hay decenas de «Ver ficha de…» seguidos. El corazón dice de qué
        recurso es, en la tarjeta y en la tabla
      - Enlace «Saltar al contenido» en el layout: antes había que tabular por paleta, Descubre,
        enviar, tema y cuenta en cada página
      - Las estrellas de valoración son un `radiogroup` de verdad: una sola parada de tabulación
        y las flechas cambian la nota (antes eran 5 paradas con `role="radio"` y sin flechas)
      - Clases `.toque` / `.toque-encima` en `app.css`: un pseudo-elemento invisible lleva la
        zona sensible a los 44 px que pide `docs/04-diseno.md` §7 **sin engordar el dibujo**, y
        solo con `(pointer: coarse)` — con ratón, ampliar la zona solo robaría clics a lo de al
        lado. Aplicado a corazones, chips de filtro, conmutador galería/tabla, botón de buscar
        de móvil, tema, formatos y descargas de la ficha
- [x] **Detección de duplicados** (2026-08-04, migración 00019, SPEC-008 §2) — ver el detalle
      en `docs/03-roadmap.md` §hecho recientemente y en el propio SPEC-008
- [x] **Acciones en lote, estado vacío que sugiere qué quitar y menos JavaScript** (PR #26,
      2026-08-04/06) — mismo detalle que arriba, repartido entre esta línea y las de rendimiento

## Fase 3.5 — Descubre (el tinder de recursos) 🎴
- [x] Modo swipe sin IA (SPEC-007 v1): `/descubre` con mazo desde los filtros del buscador,
      sesgo a mejor valorados, gestos táctiles + botones + atajos de teclado, descartes por
      sesión, deshacer, volver a barajar y enlace en cabecera
- [x] Con IA (SPEC-007 fase 2, migración 00018): cuentas qué necesitas en texto libre y la IA
      **reordena** el mazo (no lo recorta) con una línea por tarjeta explicando por qué;
      chips de retoque («más cortas», «para más mayores»), filtros interpretados que se
      ofrecen con un clic y consulta compartible en `?ia=`. Dos llamadas por consulta
      (embedding + una a Gemini para todas las tarjetas), tope por IP y **cuatro formas de
      apagarlo**: /admin/config → Funciones, `DESCUBRE_IA=off`, fusible automático tras 3
      fallos seguidos y ausencia de clave

(«Presets de mazo configurables» sigue pendiente — está en `docs/03-roadmap.md`, ahora
fundido con la spec de itinerarios que se está redactando.)

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

## Auditoría de seguridad y verificación (2026-08-06/08, planes `plans/001`–`004`)

Generados por la skill `improve` contra el commit `950bbad`, en modo asesor de solo lectura.
Los cuatro están **hechos** — detalle completo en `plans/README.md` y en cada plan individual:

- [x] **`_sync_retirar` deja de ser invocable desde internet** (P1) — migración
      `00020_endurecer_sync_retirar.sql`, aplicada en remoto el 2026-08-08.
- [x] **Las 13 acciones de `/admin` comprueban el rol**, no solo que haya sesión — `exigirRol`
      en vez de `if (!user) return fail(401)` suelto.
- [x] **Baseline de verificación**: Vitest + CI (GitHub Actions) + tests de la lógica pura.
      Primer paso hacia lo que pide SPEC-013 de «tests automatizados» — sigue pendiente
      extenderlo a Playwright en CI, ver `docs/03-roadmap.md`.
- [x] **Que las escrituras dejen de fallar en silencio** — comprobación de error añadida a
      llamadas que antes ignoraban el resultado.

De paso, al rebasar el PR de estos planes sobre `main`, se encontró y corrigió el mismo agujero
de rol que `plans/002` acababa de cerrar en la acción `lote` del PR #26 (mergeado entre medias),
y el mismo patrón de `plans/004` en un `update` sin comprobar error del borrado en lote.
