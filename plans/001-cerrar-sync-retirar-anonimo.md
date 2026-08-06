# Plan 001: `recursos._sync_retirar` deja de ser invocable desde internet

> **Instrucciones para quien ejecuta**: sigue el plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes de pasar al
> siguiente. Si ocurre algo de la sección «Condiciones de PARADA», para y
> repórtalo — no improvises. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Comprobación de deriva (ejecútala primero)**:
> `git diff --stat 950bbad..HEAD -- supabase/migrations/ app/src/routes/admin/sync/`
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

`recursos._sync_retirar(ids_lote, corte)` es `security definer` (corre como su
dueño, saltándose la RLS), **no comprueba ningún permiso** y el rol `anon` tiene
`EXECUTE` sobre ella. El esquema `recursos` está expuesto en PostgREST, así que
es alcanzable con un `POST /rest/v1/rpc/_sync_retirar` sin sesión ninguna.

Su cuerpo pone `estado = 'retirado'` en **todo recurso que no esté en la lista que
le pases**. Con `ids_lote = '{}'` retira el catálogo entero (salvo lo que tenga
`editado_web_at` no nulo). Y la política de lectura de `recurso` exige
`estado = 'publicado'` en todas las ramas menos las de editor: el catálogo
quedaría **a oscuras para el público y para los usuarios con cuenta**.

Es recuperable (un `update` devuelve los estados) pero es una caída total del
producto al alcance de una petición anónima. Todas las funciones hermanas del
esquema sí tienen guardia (`es_editor()`, `puede_catalogar()`, la clave de sync,
o el uuid de dispositivo), lo que confirma que esto es un olvido y no una
decisión de diseño.

De paso se arreglan tres funciones de trigger con `search_path` mutable, que son
las únicas tres del esquema que no lo fijan (el resto usa `set search_path = ''`).

## Estado actual

Ficheros implicados:

- `supabase/migrations/00007_envios_conflictos.sql` — define `_sync_retirar` por
  primera vez (líneas 74–88) y la llama desde `sync_filas` (línea 263).
- `supabase/migrations/00009_admin_conflictos_v2.sql` — la **redefine** (líneas
  38–52); esta es la versión viva. Sigue sin guardia.
- `supabase/migrations/00001_esquema_inicial.sql:112` — la causa raíz de los
  permisos: `alter default privileges in schema recursos grant all on routines to
  anon, authenticated, service_role;` hace que **toda** función creada después
  nazca ejecutable por `anon`.

La definición viva, en `00009_admin_conflictos_v2.sql:38-52`:

```sql
create or replace function recursos._sync_retirar(ids_lote text[], corte timestamptz)
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
	update recursos.recurso r
		set estado = 'retirado'
		where not (r.id = any (ids_lote))
			and r.estado <> 'retirado'
			and r.editado_web_at is null;
	get diagnostics n = row_count;
	return n;
end;
$$;
```

Confirmado contra la base de datos remota (`sjhxhsdckvungsrbquve`, esquema
`recursos`) el 2026-08-06:

| función | security definer | anon EXECUTE |
|---|---|---|
| `_sync_retirar(text[], timestamptz)` | sí | **sí** |

El linter de Supabase lo marca como `anon_security_definer_function_executable`
(16 casos en total; los otros 15 tienen guardia interna, este no).

**El único sitio que la llama** es `sync_filas`, en
`00007_envios_conflictos.sql:263`:

```sql
		retiradas := recursos._sync_retirar(ids_lote, corte);
```

`sync_filas` es a su vez `security definer`, y **fija el GUC `recursos.en_sync`
antes de llamarla** (`00007_envios_conflictos.sql`, dentro del cuerpo:
`perform set_config('recursos.en_sync', '1', true);`).

Esos dos hechos son los que hacen que el arreglo sea seguro:

1. Dentro de una función `security definer`, el permiso de ejecución de lo que
   llama se comprueba **como el dueño**, no como quien invocó. Revocar
   `EXECUTE` a `anon`/`authenticated` **no rompe la sincronización**.
2. El GUC `recursos.en_sync` ya es el patrón del repo para «esto viene de la
   sincronización». `marcar_edicion_web` lo usa exactamente igual
   (`00007_envios_conflictos.sql:62`):

```sql
	if coalesce(current_setting('recursos.en_sync', true), '') <> '1' then
		new.editado_web_at = now();
	end if;
```

**No uses `recursos.es_editor()` como guardia.** La sincronización corre sin
sesión de usuario (clave `sync_config` + clave anónima), así que `es_editor()`
daría false y romperías el sync. La guardia correcta es el GUC.

Las tres funciones de trigger con `search_path` mutable, con su cuerpo íntegro
(ninguna referencia a tablas — solo `new.*`, `now()` y `current_setting()`, todo
resoluble desde `pg_catalog`, que está siempre en el path; por eso fijar
`search_path = ''` es seguro en las tres):

- `recursos.set_updated_at()` — `00002_catalogo.sql:19-27`
- `recursos.invalidar_formato()` — `00015_archivos_envio_anonimo.sql:44-52`
- `recursos.marcar_edicion_web()` — `00007_envios_conflictos.sql:57-67`

Convenciones del repo que hay que respetar (de `CLAUDE.md` y de las 18
migraciones existentes):

- **Nunca edites una migración ya aplicada: crea una nueva.** La siguiente libre
  es `00019_`.
- Todo va en el esquema `recursos`, nunca en `public`.
- Cada migración que cambia DDL termina con `notify pgrst, 'reload schema';`
  (mira el final de `00016_fijar_formato.sql` como ejemplar).
- Comentario de cabecera en español explicando el por qué, estilo
  `00016_fijar_formato.sql`.
- Las migraciones se aplican con el MCP de Supabase (`apply_migration`) **y** se
  versionan en `supabase/migrations/`.

## Comandos que vas a necesitar

| Propósito | Comando | Esperado |
|---|---|---|
| Instalar deps | `cd app && npm install` | exit 0 |
| Typecheck | `cd app && npm run check` | exit 0, 0 errores |
| Build | `cd app && npm run build` | exit 0 |

Este plan es solo SQL: `npm run check` es una comprobación de no-regresión, no
la verificación de verdad. La verificación real son las consultas SQL de cada
paso.

## Alcance

**En alcance** (lo único que debes crear o modificar):
- `supabase/migrations/00019_endurecer_sync_retirar.sql` (crear)
- `plans/README.md` (actualizar tu fila)

**Fuera de alcance** (NO lo toques, aunque parezca relacionado):
- `supabase/migrations/00001..00018` — ya aplicadas. Crear la 00019, nunca
  editar una anterior.
- `recursos.sync_filas` — no la toques. Su clave (`clave_in` contra
  `sync_config`) es su guardia y funciona. Que esté concedida a `anon` es
  deliberado: la sincronización desde Apps Script usa la clave anónima.
- `app/src/routes/admin/sync/+page.server.ts` — el flujo de sincronización desde
  el panel no cambia; si tocas esto, algo va mal.
- Las otras 15 funciones `security definer` que el linter marca: todas tienen
  guardia interna verificada. No las endurezcas «de paso».
- `alter default privileges` de `00001:112`: **no lo cambies en este plan** (ver
  «Notas de mantenimiento»).

## Flujo de git

- Rama: `advisor/001-cerrar-sync-retirar-anonimo`
- Un commit. Estilo de mensaje del repo (mira `git log --oneline -8`): frase en
  español, sin prefijo de conventional commits. Ejemplo real del repo:
  `Rendimiento con catálogo de verdad (SPEC-013) (#25)`.
  Para este: `Cerrar _sync_retirar a las llamadas anónimas`
- NO hagas push ni abras PR salvo que te lo pidan explícitamente.

## Pasos

### Paso 1: escribir la migración `00019`

Crea `supabase/migrations/00019_endurecer_sync_retirar.sql` con este contenido
exacto:

```sql
-- Endurecer `_sync_retirar`: era invocable por cualquiera desde internet
--
-- `_sync_retirar` es `security definer` (salta la RLS) y no comprobaba nada. Con el
-- esquema expuesto en PostgREST y el `alter default privileges` de 00001, el rol `anon`
-- tenía EXECUTE: un POST a /rest/v1/rpc/_sync_retirar con `ids_lote = '{}'` ponía
-- `estado = 'retirado'` en todo el catálogo, que la política de lectura de `recurso`
-- deja entonces invisible para el público y para las cuentas no editoras.
--
-- Es una función interna de la sincronización: solo la llama `sync_filas`. Se cierra por
-- dos vías independientes, a propósito:
--   1. Revocar EXECUTE a anon/authenticated. No rompe el sync: dentro de una función
--      `security definer` el permiso se comprueba como el dueño, no como quien invoca.
--   2. Exigir el GUC `recursos.en_sync`, que `sync_filas` fija antes de llamarla. Es el
--      mismo patrón que ya usa el trigger `marcar_edicion_web`. Así sigue cerrada aunque
--      los grants vuelvan a abrirse en el futuro.
--
-- De paso, las tres únicas funciones del esquema sin `search_path` fijo lo fijan. Ninguna
-- referencia tablas (solo `new.*`, `now()` y `current_setting()`), así que es seguro.

-- 1. Guardia interna: solo desde la sincronización
create or replace function recursos._sync_retirar(ids_lote text[], corte timestamptz)
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
	if coalesce(current_setting('recursos.en_sync', true), '') <> '1' then
		raise exception 'recursos._sync_retirar solo puede llamarse desde la sincronización';
	end if;

	update recursos.recurso r
		set estado = 'retirado'
		where not (r.id = any (ids_lote))
			and r.estado <> 'retirado'
			and r.editado_web_at is null;
	get diagnostics n = row_count;
	return n;
end;
$$;

-- 2. Y que no se pueda ni llamar desde fuera
revoke all on function recursos._sync_retirar(text[], timestamptz) from anon, authenticated;
revoke all on function recursos._sync_retirar(text[], timestamptz) from public;

-- 3. `search_path` fijo en las tres funciones de trigger que les faltaba
alter function recursos.set_updated_at() set search_path = '';
alter function recursos.invalidar_formato() set search_path = '';
alter function recursos.marcar_edicion_web() set search_path = '';

notify pgrst, 'reload schema';
```

**Verifica**: `test -f supabase/migrations/00019_endurecer_sync_retirar.sql && echo OK`
→ imprime `OK`.

### Paso 2: aplicar la migración en remoto

Aplícala con el MCP de Supabase: herramienta `apply_migration`, `project_id`
`sjhxhsdckvungsrbquve`, `name` `endurecer_sync_retirar`, `query` = el contenido
íntegro del fichero del paso 1.

**Verifica**: la llamada devuelve éxito sin error de SQL.

### Paso 3: comprobar que `anon` ya no puede ejecutarla

Con `execute_sql` (`project_id` `sjhxhsdckvungsrbquve`):

```sql
select has_function_privilege('anon', p.oid, 'EXECUTE') as anon_puede,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_puede
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'recursos' and p.proname = '_sync_retirar';
```

**Esperado**: `anon_puede = false`, `auth_puede = false`.

### Paso 4: comprobar que la guardia interna salta

```sql
select recursos._sync_retirar('{}'::text[], now());
```

**Esperado**: la consulta **falla** con
`recursos._sync_retirar solo puede llamarse desde la sincronización`.
Que falle es el resultado correcto: no la estás llamando desde el sync.

> Esta llamada es segura precisamente porque la guardia la corta antes del
> `update`. Si por lo que sea **no** falla y devuelve un número, has retirado
> catálogo: ve inmediatamente a «Condiciones de PARADA».

### Paso 5: comprobar que las tres funciones de trigger tienen `search_path`

```sql
select p.proname, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'recursos'
  and p.proname in ('set_updated_at', 'invalidar_formato', 'marcar_edicion_web');
```

**Esperado**: las tres filas con `proconfig = {search_path=""}`.

### Paso 6: comprobar que la sincronización sigue viva

Este es el paso que de verdad importa: la migración no debe haber roto el sync.

```sql
select count(*) as recursos_publicados
from recursos.recurso where estado = 'publicado';
```

Apunta el número **antes** de nada (si no lo tienes, sáltate la comparación) y
comprueba que sigue igual.

Y verifica que `sync_filas` sigue pudiendo llamar a `_sync_retirar` — inspección
estática, sin ejecutar el sync:

```sql
select pg_get_functiondef(p.oid) like '%_sync_retirar%' as sigue_llamandola
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'recursos' and p.proname = 'sync_filas';
```

**Esperado**: `sigue_llamandola = true`.

Después, **pide a una persona** que ejecute una sincronización de prueba desde
`/admin/sync` con «retirar ausentes» activado y confirme que:
- el resultado incluye un recuento de `retiradas` sin error, y
- no aparece el mensaje `solo puede llamarse desde la sincronización`.

No intentes ejecutar el sync tú mismo: necesita la clave de `sync_config` y
escribe sobre el catálogo real de producción.

### Paso 7: no regresión de la app

```
cd app && npm install && npm run check
```

**Esperado**: exit 0, 0 errores. (Este plan no toca TypeScript; si aquí sale
algo, viene de otro sitio.)

## Plan de pruebas

El repo no tiene infraestructura de tests todavía (ver `plans/003`), así que la
verificación de este plan son las consultas SQL de los pasos 3–6. Cuando 003
esté hecho, no hay que volver atrás: esto es DDL, no lógica de aplicación, y no
tiene un test unitario natural.

Lo que sí debe quedar apuntado para el futuro: la guardia del paso 1 es una
regresión fácil de reintroducir con un `create or replace` descuidado. El
chequeo del paso 3 (`has_function_privilege`) es el que hay que repetir tras
cualquier migración que toque funciones.

## Criterios de terminado

Verificables por máquina. TODOS deben cumplirse:

- [ ] `supabase/migrations/00019_endurecer_sync_retirar.sql` existe y está en git
- [ ] La migración está aplicada en remoto (aparece en `list_migrations`)
- [ ] `has_function_privilege('anon', ..., 'EXECUTE')` sobre `_sync_retirar` = `false`
- [ ] `has_function_privilege('authenticated', ..., 'EXECUTE')` sobre `_sync_retirar` = `false`
- [ ] `select recursos._sync_retirar('{}', now())` falla con el mensaje de la guardia
- [ ] Las 3 funciones de trigger tienen `proconfig = {search_path=""}`
- [ ] `pg_get_functiondef(sync_filas)` sigue conteniendo `_sync_retirar`
- [ ] El recuento de `recursos.recurso where estado='publicado'` no ha cambiado
- [ ] `cd app && npm run check` exit 0
- [ ] Ningún fichero fuera de la lista «En alcance» modificado (`git status`)
- [ ] Fila de 001 actualizada en `plans/README.md`

## Condiciones de PARADA

Para y reporta (no improvises) si:

- El cuerpo vivo de `_sync_retirar` en remoto no coincide con el extracto de
  «Estado actual» (alguien la ha cambiado desde `950bbad`).
- **El paso 4 devuelve un número en vez de fallar.** Has retirado recursos.
  Repórtalo de inmediato indicando el número devuelto; se revierte con
  `update recursos.recurso set estado = 'publicado' where estado = 'retirado' and ...`
  pero **no lo ejecutes tú**: hace falta saber qué estaba retirado legítimamente
  antes, y esa información no está en este plan.
- La sincronización de prueba del paso 6 falla con
  `solo puede llamarse desde la sincronización` — significa que `sync_filas` no
  está fijando el GUC como se documenta aquí. No quites la guardia: para y
  reporta.
- `alter function ... set search_path = ''` falla en alguna de las tres.
- Descubres que `_sync_retirar` se llama desde algún sitio más que `sync_filas`
  (código de la app, Apps Script, otra función SQL). La suposición «solo la
  llama `sync_filas`» sería falsa y el plan necesita rehacerse.

## Notas de mantenimiento

- **La causa raíz sigue ahí.** `00001_esquema_inicial.sql:112`
  (`alter default privileges in schema recursos grant all on routines to anon,
  authenticated, service_role`) hace que **toda función futura del esquema nazca
  ejecutable por `anon`**. Este plan tapa la función peligrosa, no el patrón.
  Cambiar el default es lo correcto a medio plazo, pero es un cambio con efecto
  a distancia: cada migración futura tendría que acordarse de su `grant execute`
  o la función daría 404 en PostgREST sin avisar. Merece su propio plan y una
  nota en `CLAUDE.md`. Está anotado en `plans/README.md` como pendiente.
- Regla que conviene adoptar al revisar migraciones nuevas: **toda función
  `security definer` del esquema `recursos` necesita, o una guardia de permisos
  en su cuerpo, o un `revoke` explícito.** Las 15 hermanas cumplen; esta era la
  excepción.
- Ejecutar `get_advisors(type: 'security')` tras cada migración es la forma
  barata de que esto no vuelva a colarse: el linter ya marcaba la clase
  (`anon_security_definer_function_executable`), solo faltaba mirar cuál de las
  16 no tenía guardia.
- Qué debe mirar con lupa quien revise el PR: que la guardia use el GUC y **no**
  `es_editor()` (eso rompería el sync), y que los `revoke` nombren la firma
  exacta `(text[], timestamptz)`.
