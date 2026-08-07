# Plan 003: montar la baseline de verificación (Vitest + CI) y cubrir la lógica pura

> **Instrucciones para quien ejecuta**: sigue el plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes de pasar al
> siguiente. Si ocurre algo de la sección «Condiciones de PARADA», para y
> repórtalo — no improvises. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Comprobación de deriva (ejecútala primero)**:
> `git diff --stat 950bbad..HEAD -- app/package.json app/vite.config.ts app/src/lib/catalogo/`
> Si algún fichero en alcance ha cambiado desde que se escribió el plan, compara
> los extractos de «Estado actual» con el código vivo antes de seguir; si no
> coinciden, trátalo como condición de PARADA.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: M
- **Riesgo**: LOW
- **Depende de**: nada
- **Categoría**: tests
- **Planeado en**: commit `950bbad`, 2026-08-06

## Por qué importa

El repo tiene **14.367 líneas** de TypeScript y Svelte, 18 migraciones SQL, y
**cero tests**. No hay Vitest, ni Playwright, ni ESLint, ni Prettier, ni
`.github/` (o sea, ninguna CI). La única puerta es `npm run check`
(`svelte-check`), y nada la ejecuta automáticamente: depende de que alguien se
acuerde.

Eso convierte cualquier cambio en una apuesta, y muy en concreto bloquea el
trabajo que viene: `plans/004` toca manejo de errores en 12 sitios, y la
migración a tipos generados de Supabase (anotada como pendiente) toca 26
ficheros. Refactorizar sin red en un repo de este tamaño es cómo se rompen cosas
que ya funcionaban.

Lo bueno es que hay **mucha lógica pura, sin base de datos y sin DOM**, que es
exactamente lo más fácil de cubrir y lo que más duele si se rompe en silencio:

- El linaje de versiones (SPEC-009): `resolverVersiones`, `linajeDe`,
  `agregarStats`, `mapaAVigente` en `app/src/lib/catalogo/cargar.ts`. Recorren
  grafos con ciclos posibles y hacen medias ponderadas. Un error aquí muestra
  valoraciones equivocadas sin que salte nada.
- Las facetas y el filtrado: `filtrar`, `contar`, `construirFacetas`,
  `normalizarConsulta`, `relacionar` en `app/src/lib/catalogo/filtros.ts`.
- Los formatos (491 líneas, todo puro): `detectarFormato`, `formatoDeMime`,
  `descargasDe`, `urlCopia`, `urlVistaPrevia`, `urlFavicon` en
  `app/src/lib/catalogo/formatos.ts`. Son un montón de expresiones regulares
  sobre URLs de Drive: el sitio clásico donde una regex se come un caso.
- El saneado de la salida del modelo: `sanear` (interna) en
  `app/src/lib/server/recomendar.ts`, que es la defensa contra ids inventados por
  Gemini.
- Los tags: `slugTag`, `plano`, `normalizarTags`, `partirTags` en
  `app/src/lib/catalogo/tags.ts`.

Este plan no persigue un porcentaje. Persigue que **exista un comando que diga si
el repo funciona** y que la lógica pura de arriba quede cubierta, para que los
planes siguientes tengan red.

## Estado actual

### Lo que hay hoy

`app/package.json`, sección `scripts` (íntegra):

```json
	"scripts": {
		"dev": "vite dev",
		"build": "vite build",
		"preview": "vite preview",
		"prepare": "svelte-kit sync || echo ''",
		"check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
		"check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
	},
```

No hay `test`, ni `lint`, ni `format`. `ls app` no muestra ningún
`eslint.config.*`, `.prettierrc*`, `vitest.config.*` ni `playwright.config.*`.
`ls -a /` del repo no muestra `.github`.

Versiones relevantes (de `app/package.json`): `vite ^8.0.16`,
`svelte ^5.56.1`, `@sveltejs/kit ^2.63.0`, `typescript ^6.0.3`,
`@sveltejs/vite-plugin-svelte ^7.1.2`, `tailwindcss ^4.3.0`.
**Vite 8** — importa para elegir la versión de Vitest (ver paso 1).

`app/vite.config.ts` es donde está forzado el modo runes. Ábrelo antes de tocarlo
y **conserva todo lo que haya**; solo añades la clave `test`.

### Las funciones a cubrir, tal como están hoy

`app/src/lib/catalogo/cargar.ts` — **las funciones del linaje no están
exportadas**. Líneas 126, 156, 161, 188 y 211:

```ts
function resolverVersiones(recursos: RecursoCatalogo[]) {
function esSucesora(r: RecursoCatalogo, porId: Map<string, RecursoCatalogo>): boolean {
function linajeDe(
function agregarStats(cabeza: RecursoCatalogo, linaje: RecursoCatalogo[]) {
function mapaAVigente(recursos: RecursoCatalogo[]): (id: string) => string {
```

Solo `cargarDatosCatalogo` (línea 14) es `export`, y esa necesita un cliente de
Supabase. **Para poder testear el linaje hay que exportar `resolverVersiones` y
`mapaAVigente`** (paso 3). Es un cambio de una palabra por función y no altera
comportamiento.

Cómo funciona el linaje, para que puedas escribir los tests sin leerte el módulo
entero (de `cargar.ts:121-153` y `docs/specs/SPEC-009-versiones-recurso.md`):
- Cada recurso puede tener `version_de` apuntando a su predecesor.
- Un recurso queda **sucedido** (`es_vigente = false`, `reemplazado_por = <id>`)
  si existe otro recurso que le apunta con `version_de` **y está `publicado`**.
  Un borrador que apunte a él no lo sucede.
- La cabeza del linaje (el vigente) acumula los agregados sociales de toda la
  cadena: `num_favoritos`, `num_usos`, `num_accesos` se **suman**, y
  `valoracion_media` es la **media ponderada por `num_valoraciones`**, redondeada
  a un decimal (`Math.round(x * 10) / 10`).
- `mapaAVigente` devuelve una función `id → id vigente`, subiendo por
  `reemplazado_por`. Tiene guarda contra ciclos con un `Set` de vistos.

`app/src/lib/catalogo/tipos.ts` (198 líneas) define `RecursoCatalogo` y exporta
`socialVacio()`. Para los tests del linaje vas a necesitar construir
`RecursoCatalogo` de mentira: **escribe un helper `unRecurso(parcial)` en el
propio fichero de test** que rellene todos los campos obligatorios con valores
neutros y aplique encima el parcial. Lee `tipos.ts` para la lista exacta de
campos; no adivines.

`app/src/lib/server/recomendar.ts` — `sanear` (alrededor de la línea 200) **no
está exportada**; sí lo está `recomendar`, que llama a Gemini. Expórtala también
(paso 3): es la defensa contra ids inventados y merece test propio. Su contrato,
del propio código:
- descarta recomendaciones cuyo `id` no esté entre los candidatos,
- descarta ids repetidos (gana el primero),
- recorta `motivo` a 140 caracteres añadiendo `…`,
- corta la lista a 15,
- de `etapas`/`edades`/`tipos` solo deja valores presentes en el vocabulario,
- `resumen` se recorta a 160 y `''` pasa a `null`.

### Convenciones del repo que aplican

- Tabulaciones, no espacios.
- Comentarios y textos en español; nombres de función y variable en inglés salvo
  donde el repo ya usa español (todo el dominio: `recurso`, `filtrar`, `contar`).
  **Sigue lo que haya en cada fichero**, no lo unifiques.
- Svelte 5 con runes; nada de `export let` ni `$:`.
- Todo lo del cliente en `$lib/`; lo de servidor en `$lib/server/`.
- Nada de librerías de estado globales ni frameworks CSS extra (`CLAUDE.md`).

## Comandos que vas a necesitar

| Propósito | Comando | Esperado |
|---|---|---|
| Instalar deps | `cd app && npm install` | exit 0 |
| Typecheck | `cd app && npm run check` | exit 0, 0 errores |
| Tests (nuevo) | `cd app && npm test` | todos pasan |
| Build | `cd app && npm run build` | exit 0 |

## Alcance

**En alcance**:
- `app/package.json` (añadir devDeps y scripts)
- `app/vite.config.ts` (añadir la clave `test`)
- `app/src/lib/catalogo/cargar.ts` (**solo** añadir `export` a 2 funciones)
- `app/src/lib/server/recomendar.ts` (**solo** añadir `export` a `sanear`)
- `app/src/lib/catalogo/cargar.test.ts` (crear)
- `app/src/lib/catalogo/filtros.test.ts` (crear)
- `app/src/lib/catalogo/formatos.test.ts` (crear)
- `app/src/lib/catalogo/tags.test.ts` (crear)
- `app/src/lib/server/recomendar.test.ts` (crear)
- `.github/workflows/ci.yml` (crear)
- `plans/README.md` (actualizar tu fila)

**Fuera de alcance** (NO lo toques, aunque parezca relacionado):
- **No añadas ESLint ni Prettier en este plan.** Meter un formateador ahora
  reformatearía miles de líneas y ahogaría el diff de los tests. Es su propio
  plan; queda anotado en `plans/README.md`.
- **No añadas Playwright ni tests de componente Svelte.** Solo lógica pura, sin
  DOM. Testear `.svelte` pide `@testing-library/svelte` + entorno jsdom y es otro
  plan.
- **No refactorices nada para hacerlo testeable** más allá de los tres `export`
  del paso 3. Si una función no se puede testear sin reescribirla, **no la
  testees**: anótala en `plans/README.md` como pendiente y sigue.
- **No cambies el comportamiento de ninguna función**, ni «de paso» ni para que
  pase un test. Si un test que has escrito bien falla, has encontrado un bug:
  ve a «Condiciones de PARADA».
- `app/src/lib/catalogo/refresco.ts` — depende de `invalidateAll` de SvelteKit; no
  merece el mock.
- Las migraciones SQL y cualquier cosa de `supabase/`.

## Flujo de git

- Rama: `advisor/003-baseline-verificacion`
- Commits por unidad lógica: (1) Vitest + script + CI, (2) los `export`,
  (3) un commit por fichero de test. Estilo del repo (`git log --oneline -8`):
  frase en español sin prefijo de conventional commits.
  Para el conjunto: `Baseline de verificación: Vitest, CI y tests de la lógica pura`
- NO hagas push ni abras PR salvo que te lo pidan explícitamente.

## Pasos

### Paso 1: instalar y configurar Vitest

```
cd app && npm install -D vitest
```

**Importante**: el repo usa **Vite 8**. Instala la versión de Vitest que declare
compatibilidad con Vite 8 (deja que `npm install -D vitest` resuelva la última;
si npm avisa de conflicto de peer dependencies con `vite@8`, **para** y ve a
«Condiciones de PARADA» — no lo fuerces con `--legacy-peer-deps`).

Añade a `app/package.json`, en `scripts`, **sin tocar los que ya hay**:

```json
		"test": "vitest run",
		"test:watch": "vitest"
```

En `app/vite.config.ts`, añade la clave `test` al objeto de configuración
conservando **todo** lo que ya haya (plugins, la config de runes, lo de
Tailwind):

```ts
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
```

`environment: 'node'` es deliberado: todo lo que testeas aquí es lógica pura sin
DOM, y así no hace falta jsdom.

**Verifica**: `cd app && npm test` → sale sin error diciendo que no ha encontrado
ficheros de test (`No test files found`). Eso es lo correcto de momento.

> Si tu versión de Vitest devuelve exit code distinto de 0 cuando no hay tests,
> no pasa nada: el paso 2 crea el primero.

### Paso 2: primer test, el más barato, para validar el montaje

Crea `app/src/lib/catalogo/tags.test.ts`. Lee primero
`app/src/lib/catalogo/tags.ts` (46 líneas) para ver los contratos exactos de
`slugTag`, `plano`, `normalizarTags` y `partirTags`.

Cubre, como mínimo:
- `slugTag`: que fusione mayúsculas y acentos (el comentario del módulo dice que
  «Adviento/adviento/Advent» deben caer juntos donde toque) — comprueba el
  comportamiento **real** que leas en el código, no lo que supongas.
- `plano`: que quite acentos y baje a minúsculas.
- `partirTags`: que parta por el separador que use, que recorte espacios y que
  descarte vacíos (`'a,,b'`, `' a , b '`).
- `normalizarTags`: que deduplique, y que **reutilice el existente** cuando el
  slug coincide (es su razón de ser: `normalizarTags(['adviento'], ['Adviento'])`
  debe quedarse con la forma ya existente).

Estilo: `describe` / `it` de Vitest, un `expect` claro por caso, nombres de test
en español (es la lengua de la documentación del repo).

**Verifica**: `cd app && npm test` → todos los tests pasan, y el recuento es > 0.

### Paso 3: exportar las tres funciones que hacen falta

Tres cambios de una palabra. **Nada más.**

En `app/src/lib/catalogo/cargar.ts`:
- línea 126: `function resolverVersiones(` → `export function resolverVersiones(`
- línea 211: `function mapaAVigente(` → `export function mapaAVigente(`

En `app/src/lib/server/recomendar.ts`:
- `function sanear(` → `export function sanear(`

Añade sobre cada una un comentario de una línea en español diciendo que se
exporta para poder testearla, por ejemplo:
`// exportada para los tests; no la uses desde fuera del módulo`

**Verifica**:
```
cd app && npm run check
grep -c "^export function resolverVersiones\|^export function mapaAVigente" src/lib/catalogo/cargar.ts
grep -c "^export function sanear" src/lib/server/recomendar.ts
```
→ `check` exit 0 con 0 errores; primer `grep` = `2`; segundo = `1`.

### Paso 4: tests del linaje de versiones

Crea `app/src/lib/catalogo/cargar.test.ts`. Lee `app/src/lib/catalogo/tipos.ts`
para los campos de `RecursoCatalogo` y escribe el helper `unRecurso(parcial)`
descrito en «Estado actual».

Casos que hay que cubrir (los tres primeros son los que de verdad importan):

1. **Cadena simple**: `R1 ← R2` (R2 con `version_de: 'R1'`, ambos `publicado`).
   Tras `resolverVersiones`: `R1.es_vigente === false`,
   `R1.reemplazado_por === 'R2'`, `R2.es_vigente === true`,
   `R2.versiones_anteriores` contiene `'R1'`.
2. **Media ponderada**: `R1` con `valoracion_media: 5, num_valoraciones: 1` y
   `R2` con `valoracion_media: 3, num_valoraciones: 3`. La cabeza `R2` debe
   quedar con `num_valoraciones: 4` y `valoracion_media: 3.5`
   (`(5·1 + 3·3) / 4 = 3.5`). Y `num_favoritos` / `num_usos` / `num_accesos`
   sumados.
3. **Un borrador no sucede**: `R2` con `version_de: 'R1'` pero
   `estado: 'borrador'`. `R1` debe seguir `es_vigente === true` y sin
   `reemplazado_por`.
4. **Cadena de tres**: `R1 ← R2 ← R3` todos publicados. Solo `R3` vigente;
   `R3.versiones_anteriores` con `R1` y `R2`; los agregados suman los tres.
5. **`version_de` colgando**: un recurso con `version_de: 'RX'` donde `RX` no
   existe en la lista. No debe petar y el recurso debe quedar vigente.
6. **`mapaAVigente`**: con `R1 ← R2` resuelto, `mapaAVigente(recursos)('R1')`
   devuelve `'R2'`; con un id desconocido devuelve el id tal cual.
7. **Ciclo**: `R1.version_de = 'R2'` y `R2.version_de = 'R1'`, ambos publicados.
   El test debe comprobar que `resolverVersiones` **termina** (no cuelga) — hay
   guardas de `Set` para esto. Si se cuelga, es un bug: PARADA.

Ojo: `resolverVersiones` **muta** el array que recibe y no devuelve nada.
Constrúyelo, llámalo, y comprueba sobre los mismos objetos.

**Verifica**: `cd app && npm test` → todos pasan.

### Paso 5: tests de formatos

Crea `app/src/lib/catalogo/formatos.test.ts`. `formatos.ts` son 491 líneas de
tablas y regexes: **lee `FORMATOS` (línea 63) y las funciones antes de escribir
un solo `expect`**, y deriva los casos del código real. No inventes URLs de Drive
«plausibles»: coge las formas que las propias regexes esperan.

Cubre:
- `detectarFormato` (línea 247): un caso por familia que el código distinga
  (documento, hoja, presentación, carpeta, PDF, vídeo de YouTube, enlace externo
  genérico…), más `null` y `''` y `undefined` → `null`.
- `formatoDeMime` (línea 272): un mime que mapee y uno desconocido.
- `formatoEfectivo` (línea 294): comprueba la precedencia que implemente
  (formato fijado vs. detectado).
- `necesitaConsultaDrive` (línea 303): true para el enlace genérico de Drive,
  false para los que se resuelven por URL.
- `descargasDe` (línea 376) y `urlCopia` (línea 396): que para un documento de
  Drive salgan las URLs de export/copia que el código construye; que para
  entrada nula salga `[]` / `null`.
- `urlVistaPrevia` (línea 421), `proporcionVistaPrevia` (466) y `urlFavicon`
  (478): caso bueno y caso nulo.

**Verifica**: `cd app && npm test` → todos pasan.

### Paso 6: tests de filtros y del saneado del modelo

Crea `app/src/lib/catalogo/filtros.test.ts`:
- `normalizarConsulta` (línea 152): acentos, mayúsculas, espacios de sobra.
- `filtrar` (línea 109): sin selección devuelve todo; con una faceta filtra; con
  dos facetas es Y entre facetas y O dentro de una (**confírmalo leyendo el
  código**, no lo supongas); una selección que no case devuelve `[]`.
- `contar` (línea 129): los recuentos por valor de una faceta sobre un conjunto
  pequeño hecho a mano.
- `construirFacetas` (línea 86): que `conSesion: false` deje fuera las facetas que
  requieran sesión (mira `FACETAS`, línea 68, y el campo que las marque).
- `relacionar` (línea 161): caso con relacionados y caso sin.

Crea `app/src/lib/server/recomendar.test.ts` para `sanear`, con el contrato de
«Estado actual»:
- id que no está entre los candidatos → fuera.
- id repetido → solo la primera.
- `motivo` de 200 caracteres → 140 exactos terminando en `…`.
- 20 recomendaciones válidas → se queda con 15.
- `etapas` con un valor fuera de vocabulario → fuera; con uno válido → dentro.
- `resumen: '   '` → `null`; `resumen` de 300 caracteres → 160.
- entrada basura (`null`, `{}`, `{ recomendaciones: 'no soy un array' }`) → no
  peta y devuelve listas vacías.

`sanear` es pura: no hace falta mockear Gemini ni importar nada de red.

**Verifica**: `cd app && npm test` → todos pasan.

### Paso 7: la CI

Crea `.github/workflows/ci.yml` (en la **raíz** del repo, no dentro de `app/`):

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verificar:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run check
      - run: npm test
```

Notas:
- `working-directory: app` porque el proyecto Node vive en `app/`, no en la raíz.
- **No añadas el `build` a la CI en este plan.** El build usa
  `@sveltejs/adapter-vercel` y variables de entorno (`PUBLIC_SUPABASE_URL`,
  `PUBLIC_SUPABASE_ANON_KEY`, ver `app/.env.example`); montar eso en CI sin
  filtrar secretos es otro asunto. `check` + `test` ya dan la señal que falta.
- No pongas ninguna clave ni secreto en este fichero.

**Verifica**: `cd app && npm ci && npm run check && npm test` en local → los tres
exit 0. (Es exactamente lo que hará la CI.)

### Paso 8: verificación final

```
cd app && npm ci && npm run check && npm test && npm run build
```

**Esperado**: los cuatro exit 0. `npm test` debe reportar **5 ficheros** de test y
un número de tests > 30.

## Plan de pruebas

Este plan *es* el plan de pruebas. Los ficheros a crear y los casos están en los
pasos 2 y 4–6. Patrón estructural a seguir: no hay test previo en el repo que
imitar, así que usa el estilo estándar de Vitest (`describe` con el nombre del
módulo, `it('hace X', ...)` en español) y mantenlo idéntico en los cinco
ficheros.

Verificación: `cd app && npm test` → todos pasan, ≥ 30 tests en 5 ficheros.

## Criterios de terminado

Verificables por máquina. TODOS deben cumplirse:

- [ ] `cd app && npm ci` exit 0
- [ ] `cd app && npm run check` exit 0, **0 errores**
- [ ] `cd app && npm test` exit 0, ≥ 30 tests, 5 ficheros, **0 fallos**
- [ ] `cd app && npm run build` exit 0
- [ ] `app/package.json` tiene los scripts `test` y `test:watch`
- [ ] `vitest` está en `devDependencies` de `app/package.json`
- [ ] Existen los 5 ficheros `*.test.ts` de la lista «En alcance»
- [ ] `.github/workflows/ci.yml` existe y ejecuta `npm run check` y `npm test`
- [ ] `git diff 950bbad..HEAD -- app/src/lib/catalogo/cargar.ts` muestra **solo**
      dos `export` añadidos y dos comentarios (ningún cambio de lógica)
- [ ] `git diff 950bbad..HEAD -- app/src/lib/server/recomendar.ts` muestra **solo**
      un `export` añadido y un comentario
- [ ] Ningún fichero fuera de la lista «En alcance» modificado (`git status`)
- [ ] Fila de 003 actualizada en `plans/README.md`

## Condiciones de PARADA

Para y reporta (no improvises) si:

- **Un test que has escrito correctamente falla.** Eso no es un test que arreglar:
  es un bug encontrado. Anótalo con el caso exacto (entrada, esperado, obtenido),
  **deja el test escrito y marcado con `it.fails(...)` o `it.skip(...)` con un
  comentario**, y repórtalo. No cambies el código de producción para que pase.
- `npm install -D vitest` avisa de conflicto de peer dependencies con `vite@8`.
  No uses `--legacy-peer-deps` ni `--force`: reporta la versión que pide.
- `npm run check` ya daba errores **antes** de tus cambios. Apunta cuántos y
  cuáles y repórtalo: el criterio «0 errores» habría que renegociarlo.
- El test del ciclo (paso 4, caso 7) **cuelga** en vez de terminar. Mátalo,
  déjalo en `it.skip` con un comentario, y repórtalo como bug.
- Un módulo resulta no ser puro (importa `$app/*`, `$env/*` o toca red) y
  testearlo exigiría mocks. Sáltalo y anótalo; no montes mocks en este plan.
- `npm ci` falla por `package-lock.json` desincronizado tras añadir Vitest. Usa
  `npm install` una vez para regenerar el lock, **commitea el lock**, y vuelve a
  probar `npm ci`.

## Notas de mantenimiento

- Lo que este plan deja fuera a propósito, para que se retome con orden: ESLint +
  Prettier (su propio plan, diff enorme), tests de componente Svelte y E2E con
  Playwright, y el `build` en CI (necesita decidir cómo se le dan las variables
  públicas). Los tres están anotados en `plans/README.md`.
- **`plans/004` y la migración a tipos generados de Supabase deberían ir después
  de este plan**, y usar `npm test` como red. Ese es el motivo de que este esté
  en P1 aunque no arregle ningún bug.
- Los cinco `*.test.ts` viven al lado del módulo que prueban
  (`cargar.ts` / `cargar.test.ts`). Si más adelante se añade una carpeta `tests/`
  aparte, hay que mover el `include` de `vite.config.ts` con ellos.
- Qué debe mirar con lupa quien revise el PR: que el diff de `cargar.ts` y
  `recomendar.ts` sea **solo** `export` + comentario. Cualquier otra línea
  cambiada en esos dos ficheros está fuera de alcance.
- Los tres `export` de testabilidad son deuda menor consciente: exponen funciones
  internas. La alternativa (testear a través de `cargarDatosCatalogo` con un
  cliente Supabase falso) costaría mucho más y probaría menos.
