# Plan 002: las 13 acciones de `/admin` comprueban el rol, no solo que haya sesión

> **Instrucciones para quien ejecuta**: sigue el plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes de pasar al
> siguiente. Si ocurre algo de la sección «Condiciones de PARADA», para y
> repórtalo — no improvises. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Comprobación de deriva (ejecútala primero)**:
> `git diff --stat 950bbad..HEAD -- app/src/routes/admin/ app/src/lib/server/`
> Si algún fichero en alcance ha cambiado desde que se escribió el plan, compara
> los extractos de «Estado actual» con el código vivo antes de seguir; si no
> coinciden, trátalo como condición de PARADA.

## Estado

- **Prioridad**: P1
- **Esfuerzo**: S
- **Riesgo**: LOW
- **Depende de**: nada
- **Categoría**: security
- **Planeado en**: commit `950bbad`, 2026-08-06

## Por qué importa

El control de rol del panel vive en el `load` de
`app/src/routes/admin/+layout.server.ts`. **En SvelteKit, las acciones de
formulario se ejecutan antes que los `load`**: un `POST` a
`/admin/recursos?/clasificarPendientes` ejecuta la acción y solo después corren
los `load` para repintar. O sea que el guardián del layout no protege ninguna
acción.

Lo que queda protegiendo las escrituras es la RLS, y lo hace bien: un usuario con
rol `consulta` no consigue escribir en `recurso`. Pero **la RLS no protege lo que
pasa antes de la escritura**, y varias acciones gastan dinero antes de tocar la
base de datos:

- `clasificarPendientes` → hasta **12 llamadas a Gemini** más lecturas de Drive
  por cada POST.
- `reindexarSemantica` → hasta **128 embeddings de Voyage** por POST.
- `detectarFormatos` → hasta **60 consultas a Drive** por POST.
- `clasificar` → una llamada a Gemini + una lectura de Drive por POST.

Nada de eso tiene tope por IP ni por usuario. Cualquiera con una cuenta puede
fundir la cuota gratuita de Gemini, Voyage y Drive recargando un POST. Y
conseguir una cuenta es barato: `handle_new_user`
(`supabase/migrations/00010_locales_acceso_previo.sql:49-70`) da rol `'consulta'`
por defecto a quien entre y no esté en `acceso_previo`.

Contrasta con `/api/recomendar`, que sí tiene tope por IP
(`app/src/lib/server/recomendar.ts`, `superaElTope`): el coste de la IA ya está
pensado en el endpoint público, pero no en las acciones del panel.

Hay un segundo efecto, más silencioso: como la RLS rechaza la escritura *después*
de la llamada a la IA, `clasificarUno` inserta la propuesta sin mirar el error y
devuelve `{ ok: true }`. La interfaz dice que la clasificación ha ido bien y no se
ha guardado nada (eso se arregla en `plans/004`).

Lo bueno: **el patrón correcto ya existe en el repo**. `admin/usuarios` y
`admin/config` tienen un `exigirAdmin()` que llaman *también desde la acción*.
Este plan lo generaliza y lo aplica a las 13 que no lo tienen.

## Estado actual

### El guardián que no cubre las acciones

`app/src/routes/admin/+layout.server.ts` (fichero completo):

```ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const ROLES_PANEL = ['edicion_local', 'editor', 'administrador'];

export const load: LayoutServerLoad = async ({ locals: { supabase, user } }) => {
	if (!user) redirect(303, '/');
	const { data: perfil } = await supabase
		.from('perfil')
		.select('id, nombre, rol, mcm_local_id')
		.eq('id', user.id)
		.maybeSingle();
	if (!perfil || !ROLES_PANEL.includes(perfil.rol)) redirect(303, '/');
	return { rolPanel: perfil.rol as string };
};
```

`app/src/hooks.server.ts` solo cubre el caso «sin sesión ninguna»:

```ts
	if (!session && event.url.pathname.startsWith('/admin')) {
		redirect(303, '/');
	}
```

### El patrón bueno, duplicado en dos sitios

`app/src/routes/admin/usuarios/+page.server.ts:6-13` y
`app/src/routes/admin/config/+page.server.ts:14-21` tienen **la misma función,
copiada literal**:

```ts
async function exigirAdmin(locals: App.Locals) {
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user!.id)
		.maybeSingle();
	if (data?.rol !== 'administrador') redirect(303, '/admin');
}
```

Y la llaman desde la acción, que es lo correcto —
`admin/usuarios/+page.server.ts:35-36`:

```ts
	actualizar: async ({ request, locals }) => {
		await exigirAdmin(locals);
```

### Las 13 acciones que solo comprueban sesión

Todas tienen exactamente esta primera línea: `if (!user) return fail(401);`

`app/src/routes/admin/recursos/+page.server.ts` — 9 acciones:

| línea | acción | efecto externo si se llama sin rol |
|---|---|---|
| 142 | `guardar` | — (la RLS lo corta) |
| 170 | `crear` | — (la RLS lo corta) |
| 190 | `eliminar` | — (la RLS lo corta) |
| 206 | `detectarFormatos` | **60 consultas a Drive** |
| 234 | `estado` | — (la RLS lo corta) |
| 246 | `crearVersion` | — (`crear_version` tiene guardia propia) |
| 257 | `clasificar` | **1 Gemini + 1 Drive** |
| 271 | `clasificarPendientes` | **12 Gemini + 12 Drive** |
| 304 | `reindexarSemantica` | **128 embeddings Voyage** |

`app/src/routes/admin/revision/+page.server.ts` — 4 acciones:

| línea | acción |
|---|---|
| 56 | `publicar` |
| 102 | `devolver` |
| 124 | `descartar` |
| 139 | `clasificar` (**Gemini + Drive**) |

### Roles del sistema

De `app/src/routes/admin/config/+page.server.ts:7` y
`admin/usuarios/+page.server.ts:4`:

```ts
const ROLES = ['consulta', 'edicion_local', 'editor', 'administrador', 'consulta_externa'];
```

Y los que pueden entrar al panel, de `admin/+layout.server.ts:4`:

```ts
const ROLES_PANEL = ['edicion_local', 'editor', 'administrador'];
```

La jerarquía real, según `docs/specs/SPEC-001-auth-usuarios.md` y las funciones
SQL: `es_editor()` = `editor` o `administrador`; `puede_catalogar()` incluye
además `edicion_local`. **Para este plan, el nivel que hay que exigir en las 13
acciones es el mismo que el del panel: `ROLES_PANEL`.** No inventes una
jerarquía más fina — la RLS ya afina por delegación (`edicion_local` solo toca lo
de su `mcm_local_id`), y replicarla en TypeScript la duplicaría mal.

### Convenciones del repo que aplican

- Código (variables, funciones) en inglés; textos de interfaz y comentarios en
  español. Estos ficheros usan nombres de acción en español (`guardar`, `crear`)
  porque son parte del contrato del formulario: **no los renombres**.
- Módulos de servidor compartidos van en `app/src/lib/server/`. Ejemplares a
  imitar: `app/src/lib/server/ajustes.ts` y `app/src/lib/server/recursos.ts`
  (funciones exportadas, JSDoc en español explicando el por qué).
- Tabulaciones para indentar (mira cualquier `.ts` del repo).
- `fail` y `redirect` vienen de `@sveltejs/kit`.
- Svelte 5 con runes; nada de sintaxis legacy. (Este plan no toca `.svelte`.)

## Comandos que vas a necesitar

| Propósito | Comando | Esperado |
|---|---|---|
| Instalar deps | `cd app && npm install` | exit 0 |
| Typecheck | `cd app && npm run check` | exit 0, **0 errores** |
| Build | `cd app && npm run build` | exit 0 |

`npm run check` es la única puerta automática que tiene hoy el repo. Tiene que
quedar en 0 errores.

## Alcance

**En alcance** (lo único que debes modificar o crear):
- `app/src/lib/server/permisos.ts` (crear)
- `app/src/routes/admin/recursos/+page.server.ts` (9 acciones)
- `app/src/routes/admin/revision/+page.server.ts` (4 acciones)
- `app/src/routes/admin/usuarios/+page.server.ts` (sustituir el `exigirAdmin` local)
- `app/src/routes/admin/config/+page.server.ts` (sustituir el `exigirAdmin` local)
- `plans/README.md` (actualizar tu fila)

**Fuera de alcance** (NO lo toques, aunque parezca relacionado):
- `app/src/hooks.server.ts` — el `authGuard` de ahí está bien para lo que hace
  (cortar el paso sin sesión). Añadir la consulta de rol al hook la pondría en
  **todas** las peticiones, incluidas las del catálogo público. No lo hagas.
- `app/src/routes/admin/+layout.server.ts` — se queda como está. Sigue siendo el
  guardián de la navegación; este plan añade el de las acciones, no lo sustituye.
- Las políticas RLS y las migraciones — la RLS ya hace su parte bien.
- `app/src/routes/api/recomendar/+server.ts` y `api/buscar/+server.ts` — son
  endpoints públicos a propósito, con su propio tope. No les pongas rol.
- **No añadas rate limiting en este plan.** Es tentador y es otro asunto: el tope
  en memoria de `recomendar.ts` está documentado como aproximado por instancia
  (ver el comentario del propio fichero) y hacerlo bien pide almacenamiento
  compartido. Anotado en `plans/README.md` como pendiente.
- Los `.svelte` del panel — no hay que cambiar ninguna interfaz.

## Flujo de git

- Rama: `advisor/002-rol-en-acciones-admin`
- Commits por unidad lógica (helper, luego cada fichero). Estilo del repo (mira
  `git log --oneline -8`): frase en español, sin prefijo de conventional commits.
  Para el conjunto: `Comprobar el rol en las acciones del panel, no solo la sesión`
- NO hagas push ni abras PR salvo que te lo pidan explícitamente.

## Pasos

### Paso 1: crear el helper compartido

Crea `app/src/lib/server/permisos.ts`:

```ts
import { error } from '@sveltejs/kit';

/** Roles que pueden entrar al panel. Mismo listado que `admin/+layout.server.ts`. */
export const ROLES_PANEL = ['edicion_local', 'editor', 'administrador'];

/**
 * Comprueba el rol de quien pide. Hace falta llamarla **desde cada acción**, no solo
 * desde el `load`: en SvelteKit las acciones de formulario corren antes que los `load`,
 * así que el guardián de `admin/+layout.server.ts` no las cubre. Sin esto, cualquier
 * cuenta (el rol por defecto es `consulta`) podía disparar las acciones que llaman a
 * Gemini, Voyage o Drive y gastar cuota, aunque la RLS le cortara luego la escritura.
 *
 * Lanza 403 en vez de redirigir: quien llama es un POST de acción, y un 303 desde una
 * acción se interpretaría como navegación con éxito.
 */
export async function exigirRol(locals: App.Locals, permitidos: string[] = ROLES_PANEL) {
	if (!locals.user) error(401, 'Hace falta iniciar sesión');
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user.id)
		.maybeSingle();
	const rol = (data as { rol?: string } | null)?.rol;
	if (!rol || !permitidos.includes(rol)) error(403, 'Sin permiso para esta operación');
	return rol;
}

/** Atajo para lo que solo puede hacer un administrador. */
export async function exigirAdmin(locals: App.Locals) {
	return exigirRol(locals, ['administrador']);
}
```

Detalles que importan:
- `error(403, ...)` lanza, así que no hace falta `return` en quien llama.
- No uses `locals.user!` con `!`: comprueba `if (!locals.user)` de verdad. Los
  dos `exigirAdmin` actuales usan la aserción y funcionan solo porque el hook ya
  cortó; el helper no debe depender de eso.

**Verifica**: `cd app && npm run check` → exit 0, 0 errores.

### Paso 2: aplicarlo a las 9 acciones de `admin/recursos`

En `app/src/routes/admin/recursos/+page.server.ts`:

1. Añade el import junto a los que ya hay (arriba del fichero):
   ```ts
   import { exigirRol } from '$lib/server/permisos';
   ```
2. En **cada una de las 9 acciones**, sustituye la línea
   `if (!user) return fail(401);` por:
   ```ts
   await exigirRol(locals);
   ```
3. Eso obliga a cambiar la desestructuración de cada acción: donde hoy dice
   `async ({ request, locals: { supabase, user } })` tiene que decir
   `async ({ request, locals })` y usar `locals.supabase` dentro; o, si prefieres
   tocar menos, `async ({ request, locals })` y al principio del cuerpo
   `const { supabase } = locals;`. **Usa esta segunda forma**, que deja el resto
   del cuerpo intacto y el diff mínimo:

   Antes (`línea 142`):
   ```ts
   	guardar: async ({ request, locals: { supabase, user } }) => {
   		if (!user) return fail(401);
   		const f = await request.formData();
   ```
   Después:
   ```ts
   	guardar: async ({ request, locals }) => {
   		await exigirRol(locals);
   		const { supabase } = locals;
   		const f = await request.formData();
   ```

   Las dos acciones sin `request` (`detectarFormatos` línea 206 y
   `clasificarPendientes` línea 271, `reindexarSemantica` línea 304) pasan de
   `async ({ locals: { supabase, user } })` a `async ({ locals })` con el mismo
   patrón.

4. Cuando termines, en este fichero **no debe quedar ninguna** referencia a
   `user` dentro de `actions`. Si `fail` deja de usarse en algún sitio, déjalo
   importado: se sigue usando para los `fail(400)` de validación.

**Verifica**:
```
cd app && npm run check
grep -c "await exigirRol(locals)" src/routes/admin/recursos/+page.server.ts
grep -c "if (!user) return fail(401)" src/routes/admin/recursos/+page.server.ts
```
→ `check` exit 0 con 0 errores; el primer `grep` imprime `9`; el segundo imprime
`0`.

### Paso 3: aplicarlo a las 4 acciones de `admin/revision`

Lo mismo en `app/src/routes/admin/revision/+page.server.ts`, en las acciones de
las líneas 56 (`publicar`), 102 (`devolver`), 124 (`descartar`) y 139
(`clasificar`).

Ojo: `publicar` y `devolver` reciben también `url`
(`async ({ request, url, locals: { supabase, user } })`). Conserva `url`:
`async ({ request, url, locals })`.

**Verifica**:
```
cd app && npm run check
grep -c "await exigirRol(locals)" src/routes/admin/revision/+page.server.ts
grep -c "if (!user) return fail(401)" src/routes/admin/revision/+page.server.ts
```
→ `check` exit 0; primer `grep` = `4`; segundo = `0`.

### Paso 4: quitar los dos `exigirAdmin` duplicados

En `app/src/routes/admin/usuarios/+page.server.ts` y
`app/src/routes/admin/config/+page.server.ts`:

1. Borra la función local `exigirAdmin` (líneas 6–13 y 14–21 respectivamente).
2. Importa la compartida: `import { exigirAdmin } from '$lib/server/permisos';`
3. No cambies las llamadas: siguen siendo `await exigirAdmin(locals)`.

**Cuidado con un cambio de comportamiento**: la versión local hacía
`redirect(303, '/admin')` y la compartida lanza `error(403)`. Para el `load` de
la página, el redirect era mejor experiencia. Deja el `load` como estaba usando
una variante explícita: añade al helper de `permisos.ts`

```ts
import { error, redirect } from '@sveltejs/kit';

/** Como `exigirAdmin`, pero redirige en vez de dar 403. Para los `load` de página. */
export async function exigirAdminEnPagina(locals: App.Locals) {
	if (!locals.user) redirect(303, '/');
	const { data } = await locals.supabase
		.from('perfil')
		.select('rol')
		.eq('id', locals.user.id)
		.maybeSingle();
	if ((data as { rol?: string } | null)?.rol !== 'administrador') redirect(303, '/admin');
}
```

y usa `exigirAdminEnPagina` en los dos `load`, `exigirAdmin` en las acciones.

**Verifica**:
```
cd app && npm run check
grep -rn "async function exigirAdmin" src/routes/admin/
```
→ `check` exit 0; el `grep` no devuelve **nada** (la función ya no está
duplicada en las rutas).

### Paso 5: comprobación global y build

```
cd app && npm run check && npm run build
grep -rn "if (!user) return fail(401)" src/routes/admin/
```

**Esperado**: `check` exit 0 con 0 errores, `build` exit 0, y el `grep` sin
resultados.

### Paso 6: verificación manual del comportamiento

No puedes automatizar esto sin tests (ver `plans/003`), así que déjalo escrito en
el PR para que lo confirme una persona con acceso:

1. Con una cuenta de rol `administrador`: entrar en `/admin/recursos`, guardar un
   recurso, y pulsar «Analizar con IA». **Debe seguir funcionando igual.**
2. Con una cuenta de rol `consulta`: `POST` a
   `/admin/recursos?/clasificarPendientes` (por ejemplo con las herramientas de
   desarrollo del navegador estando logueado). **Debe responder 403** y **no**
   debe aparecer ninguna llamada nueva a Gemini en los logs.

Si no hay cuenta de rol `consulta` a mano, la comprobación 1 más el `grep` del
paso 5 son suficientes para dar el plan por hecho; anota en el PR que la 2 queda
pendiente de confirmar.

## Plan de pruebas

El repo no tiene todavía infraestructura de tests (`plans/003` la monta). Este
plan **no** espera a 003: el cambio es mecánico y verificable con `grep` +
`npm run check`.

Cuando 003 esté hecho, el test que hay que escribir para esto —anótalo en
`plans/README.md` como seguimiento— es un test de integración por acción que
compruebe que un `locals` con perfil de rol `consulta` produce 403 y que uno con
`editor` pasa. El sitio natural sería
`app/src/lib/server/permisos.test.ts` para el helper (unitario, con un `locals`
falso) más un test por ruta si se monta capa de integración.

## Criterios de terminado

Verificables por máquina. TODOS deben cumplirse:

- [ ] `app/src/lib/server/permisos.ts` existe y exporta `exigirRol`, `exigirAdmin`, `exigirAdminEnPagina`, `ROLES_PANEL`
- [ ] `cd app && npm run check` exit 0, **0 errores**
- [ ] `cd app && npm run build` exit 0
- [ ] `grep -rn "if (!user) return fail(401)" app/src/routes/admin/` sin resultados
- [ ] `grep -c "await exigirRol(locals)" app/src/routes/admin/recursos/+page.server.ts` = `9`
- [ ] `grep -c "await exigirRol(locals)" app/src/routes/admin/revision/+page.server.ts` = `4`
- [ ] `grep -rn "async function exigirAdmin" app/src/routes/admin/` sin resultados
- [ ] Ningún fichero fuera de la lista «En alcance» modificado (`git status`)
- [ ] Fila de 002 actualizada en `plans/README.md`

## Condiciones de PARADA

Para y reporta (no improvises) si:

- El número de acciones no cuadra: esperas 9 en `admin/recursos` y 4 en
  `admin/revision`. Si `grep -cE "^\s+[a-zA-Z]+: async \(" ` da otro número,
  alguien ha añadido o quitado acciones desde `950bbad`.
- `npm run check` da errores que **no** vienen de tus cambios (por ejemplo en
  ficheros `.svelte` que no has tocado): significa que el repo no partía de 0
  errores. Anota el estado de partida y repórtalo antes de seguir.
- Alguna acción resulta necesitar un rol distinto de `ROLES_PANEL` para no
  romper un flujo real (por ejemplo, si `revision` la usa alguien con rol
  `consulta_externa` por diseño). No inventes la jerarquía: para y pregunta.
- `npm install` falla (el `package-lock.json` está en el repo; si falla, es
  entorno, no el plan).
- Descubres que alguna de estas acciones se llama desde código público (no del
  panel). Ninguna debería.

## Notas de mantenimiento

- **La regla, para que no se vuelva a olvidar**: en SvelteKit el `load` de un
  layout **no** protege las acciones. Toda acción nueva bajo `/admin` empieza con
  `await exigirRol(locals)`. Vale la pena anotarlo en `CLAUDE.md` en la sección
  de convenciones (el plan no lo hace para no salirse de alcance; queda apuntado
  en `plans/README.md`).
- Qué debe mirar con lupa quien revise el PR: que **ninguna** acción se haya
  quedado sin el `await` (un `exigirRol(locals)` sin `await` no protege nada y
  TypeScript no se queja porque devuelve una promesa que nadie mira). Un
  `grep -n "exigirRol" | grep -v await` debe salir vacío.
- Este plan cierra el agujero de *quién* puede disparar las acciones caras, no el
  de *cuántas veces*. Un editor legítimo sigue pudiendo darle 50 veces al botón
  de «Analizar todo lo pendiente». El tope compartido es otro asunto, anotado en
  `plans/README.md`.
- Interacción con `plans/004`: ese plan toca `clasificarUno` en el mismo fichero
  `admin/recursos/+page.server.ts`. Si se ejecutan a la vez habrá conflicto de
  merge; hazlos en orden (002 antes de 004).
