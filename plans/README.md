# Planes de mejora — Banco de Recursos MCM

Generados por la skill `improve` (shadcn) el **2026-08-06**, contra el commit
`950bbad`, por Claude Opus 5 en modo asesor (auditoría de solo lectura: ningún
fichero de `app/` ni de `supabase/` ha sido modificado al escribir estos planes).

Cada plan es **autónomo**: quien lo ejecute no necesita haber visto la auditoría
ni los otros planes. Lee el plan entero antes de empezar, respeta sus condiciones
de PARADA, y actualiza tu fila al terminar.

## Orden de ejecución y estado

| Plan | Título | Prioridad | Esfuerzo | Riesgo | Depende de | Estado |
|------|--------|-----------|----------|--------|------------|--------|
| [001](001-cerrar-sync-retirar-anonimo.md) | `_sync_retirar` deja de ser invocable desde internet | P1 | S | LOW | — | TODO |
| [002](002-rol-en-acciones-admin.md) | Las 13 acciones de `/admin` comprueban el rol | P1 | S | LOW | — | HECHO |
| [003](003-baseline-verificacion.md) | Baseline de verificación: Vitest + CI + lógica pura | P1 | M | LOW | — | TODO |
| [004](004-escrituras-que-fallan-en-silencio.md) | Que las escrituras dejen de fallar en silencio | P2 | S | MED | 003, 002 | TODO |

Valores de estado: TODO · EN CURSO · HECHO · BLOQUEADO (con el motivo en una
línea) · RECHAZADO (con el razonamiento).

## Notas de dependencia

- **001 va primero por urgencia, no por dependencia.** Es el único hallazgo
  explotable hoy desde internet sin credenciales, y es un cambio de una migración.
- **002 y 003 son independientes entre sí y de 001.** Se pueden hacer en paralelo
  por personas o agentes distintos, en ramas distintas.
- **004 depende de 003** porque necesita `npm test` para tener red, y **de 002**
  porque toca los mismos dos ficheros (`admin/recursos/+page.server.ts` y
  `admin/revision/+page.server.ts`) y harían conflicto de merge.

## Cómo continuar (relevo a Fable)

Esta pasada la ha hecho Opus 5 y se ha centrado en lo que un modelo caro aporta:
**entender el sistema entero y encontrar lo que un linter no ve**. En concreto, lo
que hizo falta para el hallazgo de 001 fue cruzar cuatro cosas que están en cuatro
sitios distintos del repo (un `alter default privileges` de la migración 00001, una
función redefinida en la 00009, la política de lectura de `recurso` de la 00002, y
el hecho de que solo `sync_filas` la llama). El linter de Supabase marcaba 16
funciones de la misma clase; el trabajo era saber **cuál de las 16** no tenía
guardia y por qué eso tumba el catálogo.

Los cuatro planes están escritos para ejecutarse, no para volverse a diseñar. El
reparto que sugiero:

- **004 es el mejor candidato para un modelo ejecutor**: mecánico, muy acotado,
  con tests como criterio de terminado.
- **003 es el de más valor a largo plazo** y también es buen trabajo de ejecutor,
  pero tiene un punto de juicio: los casos de test de `formatos.ts` hay que
  derivarlos leyendo las regexes, no inventarlos. El plan lo dice explícitamente.
- **002 es puramente mecánico** (13 sustituciones + un helper).
- **001 es corto pero es el más delicado**: toca producción y hay un paso que, si
  la guardia no funciona, retira catálogo. El plan lo marca como condición de
  PARADA. Si se ejecuta con un modelo más barato, conviene que una persona mire el
  paso 4 y el paso 6.

**Lo que le dejo pendiente a la siguiente pasada de auditoría** (no a la
ejecución) está en «Hallazgos sin plan todavía». Los dos primeros son los que
merecen plan antes que nada: la causa raíz de los permisos y la atomicidad de
tags/archivos. Y hay una zona que **no he auditado a fondo** y que sería el
siguiente sitio donde mirar: ver «Qué no se ha auditado».

## Hallazgos sin plan todavía

Ordenados por lo que yo haría primero. Los dos primeros son continuación directa
de planes ya escritos.

1. **La causa raíz de los permisos sigue abierta** (security, S, MED).
   `supabase/migrations/00001_esquema_inicial.sql:112` hace
   `alter default privileges in schema recursos grant all on routines to anon,
   authenticated, service_role`. Toda función futura del esquema nace ejecutable
   por `anon`. `plans/001` tapa la función peligrosa; esto tapa el patrón. Es un
   cambio con efecto a distancia (cada migración futura tendría que acordarse de
   su `grant execute` o dar 404 en PostgREST sin avisar), así que pide plan propio
   y una nota en `CLAUDE.md`.

2. **`guardarTags` / `guardarArchivos` no son atómicos** (bug, M, MED).
   Borran y reinsertan en llamadas separadas: un fallo a medias deja el recurso con
   las temáticas incompletas. `plans/004` hace que se vea; el arreglo de verdad es
   un RPC `security definer` que lo haga en una transacción (y de paso quita el
   bucle de una inserción por etiqueta). Continuación natural de 004.

3. **`SupabaseClient<any, 'recursos'>` en todo el repo** (tech-debt, L, MED).
   106 usos de `: any` / `as any` en 26 ficheros, casi todos por no tener los tipos
   de la base de datos. Supabase los genera (`generate_typescript_types` por MCP) y
   eso convertiría una errata en el nombre de una columna —hoy un fallo silencioso
   en tiempo de ejecución— en un error de compilación. Alto valor, pero radio de
   impacto grande: **hazlo después de `plans/003`**, y por paquetes
   (`lib/catalogo/` primero, luego `lib/server/`, luego rutas), no de una vez.

4. **ESLint + Prettier** (dx, M, LOW). No hay ni linter ni formateador. Meterlos
   reformatearía miles de líneas, así que va en su propio plan y en su propio
   commit, idealmente justo después de 003 y antes de las refactorizaciones
   grandes. Conviene un commit de «solo formato» separado del de configuración.

5. **Sin tope compartido en las acciones caras del panel** (security/coste, M, MED).
   `plans/002` cierra *quién* puede disparar las acciones que llaman a Gemini,
   Voyage y Drive, pero no *cuántas veces*: un editor legítimo puede darle 50 veces
   a «Analizar todo lo pendiente». El tope de `/api/recomendar` está en memoria del
   proceso y su propio comentario reconoce que en serverless protege por instancia.
   Un tope de verdad pide almacenamiento compartido (una tabla en Postgres es lo
   más barato aquí). No urgente: hay fusible y cuatro interruptores manuales.

6. **Tests de componente y E2E** (tests, L, LOW). `plans/003` cubre solo lógica
   pura, sin DOM. Los `.svelte` grandes (`descubre/+page.svelte` 782 líneas,
   `RecursoFicha.svelte` 672, `+page.svelte` 668) no tienen ninguna cobertura, y el
   roadmap tiene pendiente un «repaso de móvil» que es justo lo que un E2E
   detectaría. Pide `@testing-library/svelte` + jsdom o Playwright: decisión de
   herramienta antes de plan.

7. **El `build` no está en CI** (dx, S, LOW). `plans/003` deja la CI con `check` +
   `test` a propósito: el build usa `adapter-vercel` y necesita
   `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`. Hay que decidir cómo se le
   dan esas variables públicas en CI antes de añadirlo.

## Dirección — opciones de producto

No son problemas: son opciones para que decidas tú. Cada una apoyada en algo que
ya está en el repo.

**1. Google OAuth sigue sin configurar, y es el tapón de todo lo demás.**
`CLAUDE.md` lo marca con ⚠️ y es, con diferencia, la mayor distancia entre lo
construido y lo usable. Está hecho: los cinco roles, la RLS que los respeta, el
panel entero, y una tabla `acceso_previo` con **más de diez delegaciones MCM
preautorizadas por email** (migraciones 00010 y 00011) esperando a que alguien
pueda entrar. Hasta que no haya client ID/secret de Google Cloud en el dashboard,
todo el trabajo de autenticación, roles y revisión está construido y apagado. No es
un plan de código (es configuración de dashboard), pero si tuviera que señalar una
sola cosa que desbloquea más valor por menos esfuerzo en este repo, es esta.

**2. Exportar una lista guardada a PDF o CSV.** Está en el roadmap
(«Fase 3.4») y es la asimetría de superficie más clara del banco: las listas se
crean, se comparten y se guardan, pero **no salen**. `/listas/[id]` ya existe y la
ficha ya tiene una sección «Llevártelo» donde encaja sin inventar interfaz nueva.
Un CSV es de un rato; el PDF ya pide decidir plantilla. Coste bajo, y cierra el
círculo de una función que hoy se queda dentro de la web.

**3. «Vistos hace poco» e insignia de «nuevo».** También del roadmap. La
infraestructura está: hay `localStorage` en uso (`lib/social/local.svelte.ts`),
hay `registrar_acceso` guardando accesos, y el catálogo entero ya está en memoria
en el cliente. Es de las pocas cosas del roadmap que no necesita nada de servidor.
El contra honesto: es mejora de descubrimiento, y `/descubre` con IA ya ataca ese
problema por otro lado — igual no hace falta.

**4. Miniatura para las carpetas de Drive.** Del roadmap, y el propio roadmap
identifica el coste: hace falta la API de Drive para sacar el primer archivo de
dentro. Ya hay cuenta de servicio y `lib/server/drive.ts` funcionando, así que la
pieza difícil está. Lo menciono por completar el inventario del roadmap; es la de
menos valor por esfuerzo de las cuatro.

Estimaciones de esfuerzo aquí son gruesas, más que en los planes.

## Qué no se ha auditado

Con honestidad, para que la siguiente pasada sepa por dónde entrar:

- **Los `.svelte` grandes, por dentro.** He leído su estructura y su tamaño, pero
  no he auditado a fondo `descubre/+page.svelte` (782 líneas),
  `RecursoFicha.svelte` (672), `+page.svelte` (668),
  `admin/recursos/+page.svelte` (586) ni `admin/config/+page.svelte` (524). Ahí es
  donde más probablemente queden bugs de estado y de accesibilidad. **Es el primer
  sitio donde miraría la próxima pasada.**
- **Rendimiento.** No lo he auditado porque SPEC-013 lo hizo hace una semana con
  mediciones de verdad (catálogos de 800 y 2.000 recursos, build de producción,
  SSR) y documenta tanto lo arreglado como el umbral de lo que queda (~3.000
  recursos, cuando el payload del catálogo en el HTML empiece a doler). Volver a
  auditarlo ahora sería repetir trabajo hecho mejor.
- **Las rutas de cliente `/enviar`, `/envios`, `/listas`**, que usan `+page.ts`
  (carga universal) en vez de `+page.server.ts`. Las he leído por encima; su
  seguridad descansa en la RLS y en uuids de dispositivo como capacidad, que es un
  diseño deliberado y correcto, pero no he seguido cada flujo.
- **`lib/server/ia.ts`, `drive.ts`, `email.ts`, `embeddings.ts`** más allá de sus
  interfaces y su manejo de errores.
- **Las 18 migraciones como esquema acumulado.** He auditado permisos, RLS y las
  funciones `security definer` una por una (que es donde estaba el problema), pero
  no índices, tipos de columna ni planes de consulta.
- **Dependencias.** No he podido ejecutar `npm audit`: no hay `node_modules` en
  este entorno y la skill prohíbe instalar. Queda pendiente y es barato.

## Hallazgos considerados y rechazados

Para que nadie los vuelva a auditar:

- **El tope por IP y el fusible de `recomendar.ts` son memoria del proceso.** No es
  un hallazgo: el propio fichero lo documenta explícitamente («en serverless
  protege por instancia — suficiente para lo que es») y señala cuál es el
  interruptor de verdad (`/admin/config`). Es un compromiso decidido, no un
  descuido. Lo que sí queda pendiente es extenderlo a las acciones del panel, que
  no tienen ningún tope (punto 5 de «Hallazgos sin plan»).
- **`sync_filas` está concedida a `anon`.** Deliberado: la sincronización desde
  Apps Script usa la clave anónima, y su guardia es la clave de `sync_config`, que
  sí comprueba. Revocarla rompería el sync.
- **Las otras 15 funciones `security definer` que marca el linter de Supabase.**
  Las he leído una por una: todas tienen guardia verificada — `es_editor()`,
  `puede_catalogar()`, `auth.uid() is not null`, la clave de sync, o el uuid de
  dispositivo como capacidad. `_sync_retirar` era la única excepción, y de ahí sale
  `plans/001`.
- **Los uuid de dispositivo como credencial** en `mis_envios_anon`,
  `reenviar_envio_anon`, `valorar_anon`. Es un diseño de capacidad deliberado
  (SPEC-015 / migración 00015) para que se pueda enviar y valorar sin cuenta.
  Adivinar un uuid v4 no es viable. No es un hallazgo.
- **La política RLS de `perfil` permite auto-edición.** La comprobé por si permitía
  escalada de privilegios y **no**: el `with check` compara el rol nuevo con el
  actual (`00001_esquema_inicial.sql:97-100`), así que nadie se cambia el rol a sí
  mismo. Bien hecho.
- **`esSucesora()` en `cargar.ts:156` es lógicamente redundante** — la condición de
  la línea 144 equivale a `if (cabeza.version_de == null) continue`. Es código
  muerto inocuo, no un bug. No merece un plan; si alguien pasa por ahí, que lo
  limpie.
- **Los `select` que no comprueban error** (los `Promise.all` de los `load`, etc.).
  Un `select` fallido devuelve `data: null` y el código usa `?? []` de forma
  consistente, así que degrada a vacío en vez de romper. Cambiarlo es un plan de
  otra forma y otro tamaño, y no está claro que mejore nada.

## Nota sobre la skill

La skill `improve` se instaló en este repo para esta pasada:
`.agents/skills/improve/` (con un enlace simbólico en `.claude/skills/improve`),
vía `npx skills add shadcn/improve`. Se ha dejado en el árbol para que la
siguiente sesión no tenga que reinstalarla. Si no la quieres versionada,
bórrala — los planes no dependen de ella.

Invocaciones útiles para la próxima vez, desde la propia skill:
`improve deep` (auditoría exhaustiva), `improve branch` (solo lo que cambia esta
rama), `improve next` (solo dirección de producto),
`improve review-plan plans/004-...md` (criticar un plan existente),
`improve reconcile` (verificar lo marcado como HECHO y refrescar lo que haya
derivado).
