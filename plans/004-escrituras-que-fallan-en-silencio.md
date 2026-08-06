# Plan 004: que las escrituras dejen de fallar en silencio (temáticas y archivos incluidos)

> **Instrucciones para quien ejecuta**: sigue el plan paso a paso. Ejecuta cada
> comando de verificación y confirma el resultado esperado antes de pasar al
> siguiente. Si ocurre algo de la sección «Condiciones de PARADA», para y
> repórtalo — no improvises. Al terminar, actualiza la fila de este plan en
> `plans/README.md`.
>
> **Comprobación de deriva (ejecútala primero)**:
> `git diff --stat 950bbad..HEAD -- app/src/lib/server/recursos.ts app/src/routes/admin/`
> Si algún fichero en alcance ha cambiado desde que se escribió el plan, compara
> los extractos de «Estado actual» con el código vivo antes de seguir; si no
> coinciden, trátalo como condición de PARADA.

## Estado

- **Prioridad**: P2
- **Esfuerzo**: S
- **Riesgo**: MED
- **Depende de**: `plans/003-baseline-verificacion.md` (para tener red de tests),
  `plans/002-rol-en-acciones-admin.md` (toca los mismos ficheros; hazlo después
  para no pelearte con el merge)
- **Categoría**: bug
- **Planeado en**: commit `950bbad`, 2026-08-06

## Por qué importa

Hay unas doce escrituras a Supabase que descartan el error. Dos de ellas pueden
**perder datos que el usuario acababa de escribir**, y ninguna de las dos avisa.

`guardarTags` y `guardarArchivos` en `app/src/lib/server/recursos.ts` siguen el
patrón «borra todo y reinserta». El `delete` y los `insert` van sueltos, sin
transacción y sin mirar el error: si el `delete` funciona y algún `insert` falla
(la RLS lo rechaza, salta una restricción, se corta la red), **las temáticas o los
archivos del recurso se quedan borrados** y la acción devuelve `{ ok: true }`. El
editor ve «guardado», recarga, y sus etiquetas ya no están.

`clasificarUno` en `app/src/routes/admin/recursos/+page.server.ts` tiene el mismo
vicio con menos daño pero más desconcierto: inserta la propuesta de la IA sin
comprobar el error y devuelve `{ ok: true }`. Si el `insert` falla, la interfaz
dice que la clasificación ha ido bien y no se ha guardado nada. Ese es
exactamente el síntoma que produce hoy una cuenta sin rol de editor (ver
`plans/002`): Gemini responde, la RLS rechaza el `insert`, y la pantalla dice que
todo bien.

Este plan **no** convierte el par borrar/insertar en atómico —eso pide un RPC en
SQL y es otro plan—. Hace lo primero y más barato: que un fallo se propague y se
vea, en vez de quedarse callado.

## Estado actual

### Los dos sitios que pueden perder datos

`app/src/lib/server/recursos.ts:55-70` (íntegro):

```ts
export async function guardarTags(supabase: Cliente, recursoId: string, crudo: string) {
	const { data: existentesRes } = await supabase.from('tag').select('nombre');
	const existentes = (existentesRes ?? []).map((t: any) => t.nombre as string);
	const tags = normalizarTags(partirTags(crudo), existentes);

	await supabase.from('recurso_tag').delete().eq('recurso_id', recursoId);
	for (const nombreTag of tags) {
		const slug = slugTag(nombreTag);
		if (!slug) continue;
		await supabase
			.from('tag')
			.upsert({ nombre: nombreTag, slug }, { onConflict: 'slug', ignoreDuplicates: true });
		const { data: tag } = await supabase.from('tag').select('id').eq('slug', slug).maybeSingle();
		if (tag) await supabase.from('recurso_tag').insert({ recurso_id: recursoId, tag_id: tag.id });
	}
}
```

Cuatro escrituras sin comprobar: el `delete` (línea 60), el `upsert` (64–66), y el
`insert` (68). Y fíjate en el `if (tag)` de la 68: si el `upsert` falló, `tag` sale
`null`, no se inserta nada, **y no pasa nada visible**. Esa etiqueta simplemente
desaparece.

`app/src/lib/server/recursos.ts:76-106` (el bloque relevante):

```ts
	await supabase.from('recurso_archivo').delete().eq('recurso_id', recursoId);
	...
	if (filas.length) await supabase.from('recurso_archivo').insert(filas);
```

Mismo patrón: borra (línea 82), inserta (línea 105), ninguna comprobación.

Y quien las llama, `app/src/lib/server/recursos.ts:108-112`:

```ts
/** Temáticas y archivos en una sola llamada, que es como se usan siempre. */
export async function guardarRelacionados(supabase: Cliente, recursoId: string, f: FormData) {
	await guardarTags(supabase, recursoId, String(f.get('tags') ?? ''));
	await guardarArchivos(
```

Las tres funciones devuelven `Promise<void>`: **hoy no hay forma de que quien
llama sepa que algo falló.** Eso es lo que cambia este plan.

Los sitios que llaman a `guardarRelacionados` y se creen el éxito, en
`app/src/routes/admin/recursos/+page.server.ts`:

```ts
	// acción `guardar`, línea 164
		await guardarRelacionados(supabase, id, f);

		return { ok: true, id };
```

```ts
	// acción `crear`, línea 183
		await guardarRelacionados(supabase, id, f);

		return { ok: true, id };
```

### El sitio de la clasificación

`app/src/routes/admin/recursos/+page.server.ts:73-85`:

```ts
	if (!res.ok) {
		await supabase.from('clasificacion_ia').insert({ recurso_id: id, estado: 'error', error: res.error });
		return { disponible: true, ok: false, error: res.error };
	}
	await supabase.from('clasificacion_ia').insert({
		recurso_id: id,
		estado: 'propuesta',
		modelo: res.modelo,
		propuesta: res.propuesta,
		avisos: res.propuesta.avisos,
		confianza: res.propuesta.confianza
	});
	return { disponible: true, ok: true, propuesta: res.propuesta };
```

El `insert` de la línea 77 es el que miente: falla y aun así se devuelve
`ok: true`.

### El resto de sitios, para inventario

Los que quedan, todos con el patrón `await supabase...` sin destructurar `error`:

- `app/src/routes/admin/recursos/+page.server.ts:74` — `insert` del registro de
  error de IA. Aquí sí es razonable ignorarlo (ya estás en la rama de error y no
  quieres tapar el error original con otro), pero **déjalo explícito** con un
  comentario, no por omisión.
- `app/src/routes/admin/recursos/+page.server.ts:197` — `update` que desenlaza
  versiones antes de borrar. Si falla, el `delete` siguiente puede dejar
  huérfanos: hay que comprobarlo.
- `app/src/routes/admin/revision/+page.server.ts:77` — `update` que devuelve un
  envío al estado `enviado`.
- `app/src/routes/admin/revision/+page.server.ts:94` — `update` que enlaza el
  envío con el recurso creado.
- `app/src/routes/admin/revision/+page.server.ts:179` — `insert` en
  `clasificacion_ia`, igual que el de `recursos`.

Y `app/src/routes/admin/revision/+page.server.ts:29`, que es un `select` (no
escritura): déjalo, está fuera de alcance.

### Convenciones del repo que aplican

- El repo ya tiene una forma establecida de devolver un fallo desde una acción:
  `return fail(500, { error: error.message })`. Está en todas partes; el ejemplar
  más claro es `app/src/routes/admin/recursos/+page.server.ts:162`:
  ```ts
  		if (error) return fail(500, { error: error.message });
  ```
  **Sigue ese patrón, no inventes otro.** No introduzcas un tipo `Result`, ni
  excepciones propias, ni una librería.
- `fail` viene de `@sveltejs/kit`.
- Tabulaciones. Comentarios en español.
- `Cliente` es el alias de tipo que ya usa `recursos.ts` para el cliente de
  Supabase; úsalo.

## Comandos que vas a necesitar

| Propósito | Comando | Esperado |
|---|---|---|
| Instalar deps | `cd app && npm install` | exit 0 |
| Typecheck | `cd app && npm run check` | exit 0, 0 errores |
| Tests | `cd app && npm test` | todos pasan |
| Build | `cd app && npm run build` | exit 0 |

`npm test` existe solo si `plans/003` ya está hecho. Si no lo está, **para**: este
plan depende de él.

## Alcance

**En alcance**:
- `app/src/lib/server/recursos.ts`
- `app/src/routes/admin/recursos/+page.server.ts`
- `app/src/routes/admin/revision/+page.server.ts`
- `plans/README.md` (actualizar tu fila)

**Fuera de alcance** (NO lo toques, aunque parezca relacionado):
- **No hagas atómico el borrar/insertar.** Hacerlo bien pide un RPC
  `security definer` en una migración nueva que reemplace tags y archivos en una
  transacción. Es más valioso y más arriesgado, y va en su propio plan (anotado en
  `plans/README.md`). Este plan solo hace que el fallo se vea.
- **No cambies ninguna interfaz `.svelte`.** Los formularios del panel ya pintan
  `form?.error` cuando la acción devuelve `fail` (mira cómo lo hacen los `fail`
  que ya existen). Si al probar descubres que algún formulario **no** muestra el
  error, anótalo y déjalo: es otro plan.
- Los `select` sin comprobar error (por ejemplo
  `admin/revision/+page.server.ts:29`, o los `Promise.all` de los `load`). Un
  `select` que falla devuelve `data: null` y el código ya usa `?? []`. Cambiar eso
  es un plan de otra forma y otro tamaño.
- `app/src/lib/server/drive.ts`, `ia.ts`, `embeddings.ts` — su manejo de errores
  es deliberado y está documentado en sus comentarios. No lo toques.
- Cualquier cosa de `supabase/migrations/`.

## Flujo de git

- Rama: `advisor/004-escrituras-que-fallan-en-silencio`
- Commits por unidad lógica: (1) `recursos.ts` y su contrato, (2) las llamadas en
  `admin/recursos`, (3) `admin/revision`, (4) tests. Estilo del repo
  (`git log --oneline -8`): frase en español sin prefijo de conventional commits.
  Para el conjunto: `Que las escrituras que fallan dejen de decir que han ido bien`
- NO hagas push ni abras PR salvo que te lo pidan explícitamente.

## Pasos

### Paso 1: que `recursos.ts` pueda informar de un fallo

En `app/src/lib/server/recursos.ts`, cambia las tres funciones para que devuelvan
el primer error en vez de `void`. Tipo de retorno:

```ts
/** `null` si todo fue bien; el mensaje del primer fallo si no. */
type FalloEscritura = string | null;
```

1. `guardarTags(...)`: `Promise<FalloEscritura>`. Comprueba **las cuatro**
   escrituras. En cuanto una falle, devuelve su `error.message` y **no sigas
   insertando** (si el `delete` ya se cargó las etiquetas, seguir solo empeora la
   inconsistencia). El caso `if (tag)` de la línea 68 pasa a ser explícito: si
   `tag` viene `null`, devuelve un mensaje del estilo
   `` `no se pudo crear la temática «${nombreTag}»` ``.

   Forma esperada:
   ```ts
   	const { error: errBorrar } = await supabase.from('recurso_tag').delete().eq('recurso_id', recursoId);
   	if (errBorrar) return errBorrar.message;
   ```
   …y así con el `upsert`, el `select` del id y el `insert`.

2. `guardarArchivos(...)`: `Promise<FalloEscritura>`. Comprueba el `delete`
   (línea 82) y el `insert` (línea 105).

3. `guardarRelacionados(...)`: `Promise<FalloEscritura>`. Llama a las dos y
   devuelve el primer fallo:
   ```ts
   	const falloTags = await guardarTags(supabase, recursoId, String(f.get('tags') ?? ''));
   	if (falloTags) return falloTags;
   	return guardarArchivos(...);
   ```
   Conserva los argumentos que ya le pasa a `guardarArchivos` tal cual — ábrelo y
   cópialos, no los reconstruyas de memoria.

Mantén los JSDoc en español que ya tienen las tres funciones y añade una línea
diciendo qué devuelven ahora.

**Verifica**: `cd app && npm run check` → exit 0, 0 errores. (Va a fallar si has
dejado alguna llamada sin actualizar: eso es el paso 2.)

### Paso 2: que quien llama haga caso

En `app/src/routes/admin/recursos/+page.server.ts`, acciones `guardar` (línea
~164) y `crear` (línea ~183):

```ts
		const fallo = await guardarRelacionados(supabase, id, f);
		if (fallo) return fail(500, { error: fallo });

		return { ok: true, id };
```

Busca cualquier otra llamada a `guardarRelacionados` o a `guardarTags` /
`guardarArchivos` en el repo y actualízala igual:

```
grep -rn "guardarRelacionados\|guardarTags\|guardarArchivos" app/src/
```

**Verifica**:
```
cd app && npm run check
grep -rn "await guardarRelacionados" src/ | grep -v "const fallo"
```
→ `check` exit 0 con 0 errores; el `grep` **sin resultados** (ninguna llamada
ignora el retorno).

### Paso 3: la clasificación deja de mentir

En `app/src/routes/admin/recursos/+page.server.ts`, dentro de `clasificarUno`:

1. Línea ~74 (el `insert` del registro de error): déjalo sin comprobar, pero
   **explícito**. Añade el comentario:
   ```ts
   	// si este registro de error no se puede guardar, da igual: no queremos tapar el error de verdad
   ```
2. Línea ~77 (el `insert` de la propuesta): comprueba el error y refleja el fallo
   en el retorno, en vez de devolver `ok: true`:
   ```ts
   	const { error: errGuardar } = await supabase.from('clasificacion_ia').insert({ ... });
   	if (errGuardar) return { disponible: true, ok: false, error: `no se pudo guardar la propuesta: ${errGuardar.message}` };
   	return { disponible: true, ok: true, propuesta: res.propuesta };
   ```
   El tipo de retorno de `clasificarUno` ya es
   `{ disponible: boolean; ok: boolean; propuesta?: any; error?: string }`, así que
   encaja sin cambiarlo.

Repite lo mismo en el `insert` de `app/src/routes/admin/revision/+page.server.ts:179`.

**Verifica**: `cd app && npm run check` → exit 0, 0 errores.

### Paso 4: los tres `update` restantes

Añade `if (error) return fail(500, { error: error.message });` a:
- `app/src/routes/admin/recursos/+page.server.ts:197` — el `update` que pone
  `version_de: null`. Si falla, **no sigas al `delete`**: devuelve el fallo.
- `app/src/routes/admin/revision/+page.server.ts:77`
- `app/src/routes/admin/revision/+page.server.ts:94`

En los dos de `revision`, mira el contexto: si el `update` está dentro de una
rama que ya devuelve algo, adapta el retorno a la forma que use esa acción (unas
devuelven `fail`, otras un objeto). **No cambies la forma del retorno de la
acción**, solo añade la rama de error.

**Verifica**:
```
cd app && npm run check && npm run build
```
→ los dos exit 0.

### Paso 5: tests

Escribe `app/src/lib/server/recursos.test.ts`. `guardarTags` y `guardarArchivos`
reciben el cliente por parámetro, así que se testean con un doble de mentira sin
tocar red ni base de datos.

Monta un `Cliente` falso que devuelva lo que tú decidas. La forma mínima que
necesitas es una cadena `from(...).delete().eq(...)` / `.upsert(...)` /
`.select().eq().maybeSingle()` / `.insert(...)` que resuelva a
`{ data, error }`. Constrúyelo con objetos que devuelvan `this` en los métodos
intermedios y el resultado en el terminal; mira el orden real de llamadas en
`recursos.ts` para saber cuáles necesitas.

Casos:
1. Todo bien → `guardarTags` devuelve `null`.
2. El `delete` de `recurso_tag` falla → devuelve el mensaje de ese error, **y no
   se ha llamado a ningún `insert`** (compruébalo con un contador en el doble).
3. El `insert` de `recurso_tag` falla → devuelve ese mensaje.
4. El `select` del id de tag devuelve `data: null` → devuelve un mensaje que
   mencione la temática.
5. `guardarArchivos` con `delete` que falla → mensaje, sin `insert`.
6. `guardarArchivos` con `enlaces: []` → devuelve `null` y **no** llama a
   `insert` (hay un `if (filas.length)`).
7. `guardarRelacionados`: si `guardarTags` falla, **no** llama a
   `guardarArchivos`.

Ojo con el caso 6 y con `guardarArchivos`: llama a `resolverFormato`, que está en
`$lib/server/formatos` y **consulta a Drive**. Para los tests, o usas
`enlaces: []` (que no llega a llamarla), o mockeas el módulo con
`vi.mock('$lib/server/formatos', ...)`. Prefiere lo primero donde puedas; usa el
mock solo para los casos que necesiten enlaces de verdad.

Sigue el estilo de los tests que dejó `plans/003` (`describe` con el nombre del
módulo, `it('...')` en español).

**Verifica**: `cd app && npm test` → todos pasan, incluidos los nuevos.

## Plan de pruebas

- Fichero nuevo: `app/src/lib/server/recursos.test.ts`, con los 7 casos del paso 5.
- Patrón estructural a imitar: los tests creados en `plans/003`, en concreto
  `app/src/lib/catalogo/cargar.test.ts` (que también construye datos de mentira
  con un helper local).
- Verificación: `cd app && npm test` → todos pasan, con al menos 7 tests nuevos.

## Criterios de terminado

Verificables por máquina. TODOS deben cumplirse:

- [ ] `cd app && npm run check` exit 0, **0 errores**
- [ ] `cd app && npm test` exit 0, **0 fallos**, ≥ 7 tests nuevos en `recursos.test.ts`
- [ ] `cd app && npm run build` exit 0
- [ ] `guardarTags`, `guardarArchivos` y `guardarRelacionados` devuelven
      `Promise<string | null>` (ya no `Promise<void>`)
- [ ] `grep -rn "await guardarRelacionados" app/src/ | grep -v "const fallo"` sin resultados
- [ ] `grep -c "await supabase" app/src/lib/server/recursos.ts` — cada una de esas
      líneas tiene su comprobación de `error` (revísalo a ojo una vez y déjalo
      dicho en el PR)
- [ ] En `clasificarUno`, el `insert` de la propuesta comprueba el error y puede
      devolver `ok: false`
- [ ] El `insert` de la rama de error tiene el comentario que explica por qué se
      ignora a propósito
- [ ] Ningún fichero fuera de la lista «En alcance» modificado (`git status`)
- [ ] Fila de 004 actualizada en `plans/README.md`

## Condiciones de PARADA

Para y reporta (no improvises) si:

- **`npm test` no existe**: `plans/003` no está hecho. Este plan depende de él.
- `plans/002` no está hecho y estás tocando
  `app/src/routes/admin/recursos/+page.server.ts`: vas a chocar en el merge.
  Haz 002 primero.
- Al añadir la comprobación de error, algún flujo del panel que antes «funcionaba»
  empieza a devolver `fail(500)`. **Eso es el bug saliendo a la luz, no una
  regresión que tapar.** Anota qué acción, qué error de Supabase y con qué rol, y
  repórtalo. No quites la comprobación.
- Descubres que `guardarTags` se llama desde algún sitio público (fuera de
  `/admin`). No debería.
- Montar el doble del cliente Supabase se te va de las manos (más de ~40 líneas).
  Para y reporta: quizá convenga extraer las escrituras a funciones más pequeñas
  primero, y eso sería otro plan.
- El tipo `Cliente` de `recursos.ts` no encaja con tu doble y te ves tentado de
  usar `as any` en más de un sitio del test. Un `as unknown as Cliente` en el
  helper del doble es aceptable; salpicar `any` por el test, no.

## Notas de mantenimiento

- **Lo que este plan deja sin resolver, a propósito**: `guardarTags` y
  `guardarArchivos` siguen sin ser atómicos. Ahora un fallo se ve, pero el
  recurso puede quedar con las temáticas a medias. El arreglo de verdad es un RPC
  `security definer` que haga borrar+insertar en una transacción (y que además
  quitaría el bucle de N+1 inserciones por etiqueta). Está anotado en
  `plans/README.md` como pendiente y es la continuación natural de este plan.
- Ese futuro RPC hereda la lección de `plans/001`: si se escribe, necesita guardia
  de permisos en el cuerpo, no solo confiar en los grants.
- Qué debe mirar con lupa quien revise el PR: que ninguna comprobación nueva se
  haya «arreglado» cambiando el comportamiento esperado, y que el `insert` de la
  rama de error siga ignorándose **a propósito y con comentario** (es el único
  caso legítimo de los doce).
- Este plan sube el riesgo a MED por un motivo concreto: si alguna de estas
  escrituras venía fallando en producción sin que nadie lo supiera, al desplegarlo
  aparecerán errores 500 donde antes había silencio. Eso es lo correcto, pero
  conviene desplegarlo con alguien mirando y no un viernes.
