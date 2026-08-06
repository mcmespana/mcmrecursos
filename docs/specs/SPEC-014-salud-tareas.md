# SPEC-014 · Salud del banco y tareas del equipo

> **Estado:** borrador (pendiente de validar contigo)
> **Depende de:** SPEC-008 (panel admin), SPEC-011 (formatos), SPEC-010 (IA y embeddings)

## Objetivo

Convertir «hay que ordenar el banco» en una lista de cosas concretas que alguien puede hacer esta
tarde, y darle al equipo un sitio compartido donde apuntar lo que no cabe en ninguna pantalla.

Hoy el panel te deja arreglar un recurso si sabes cuál. Lo que no te dice es **qué está a medias**:
cuántos recursos no tienen temáticas (y por tanto no aparecen en media búsqueda), cuántos no tiene
etapa (invisibles al filtro que más se usa), cuántos apuntan a una carpeta local fuera del banco, o
qué envíos llevan tres semanas en la cola. Esa información ya está en la base de datos; lo que falta
es una pantalla que la mire.

Y falta lo otro: cuando dos personas catalogan, todo lo que no es un recurso concreto —«hay que
pedirle a Marta las fotos del campamento», «revisar si las oraciones de Adviento están duplicadas»—
vive hoy en un WhatsApp que se pierde.

## Alcance

**Entra:**

- Pantalla `/admin/salud` con dos mitades: **señales automáticas** (lo que le falta al banco) y
  **tareas del equipo** (lista compartida, escrita a mano).
- Tabla nueva `recursos.tarea` con sus políticas RLS.
- Cada señal enlaza al panel de recursos **ya filtrado** por ese problema, y se puede convertir en
  tarea de un clic.
- Indicador en la navegación del panel con las tareas abiertas.

**Fuera (por ahora):**

- Comprobador de enlaces muertos: es una spec propia (necesita un cron y una columna de estado). Aquí
  se deja **el hueco** de la señal, apagada hasta que exista.
- Tiempo real entre administradores (Supabase Realtime). La v1 refresca al navegar y después de cada
  acción; dos personas a la vez se pisan poco y el coste de arreglarlo no se paga todavía.
- Notificaciones por correo de tareas asignadas.

## Modelo de datos

### Tabla `recursos.tarea` (migración `00019_tareas.sql`)

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` pk | `gen_random_uuid()` |
| `titulo` | `text not null` | lo único obligatorio: apuntar tiene que costar una frase |
| `detalle` | `text` | opcional |
| `estado` | `text not null default 'abierta'` | `abierta` \| `hecha` \| `descartada` |
| `prioridad` | `text not null default 'normal'` | `alta` \| `normal` \| `baja` |
| `asignada_a` | `uuid → perfil(id)` | null = de nadie en particular |
| `recurso_id` | `text → recurso(id) on delete set null` | si la tarea es sobre un recurso concreto |
| `mcm_local_id` | `uuid → mcm_local(id)` | para que `edicion_local` vea las suyas |
| `origen` | `text not null default 'manual'` | `manual` \| `salud` (nacida de una señal) |
| `senal` | `text` | qué señal la creó, para no duplicarla dos veces |
| `creada_por` | `uuid → perfil(id)` | |
| `created_at` | `timestamptz default now()` | |
| `resuelta_por` | `uuid → perfil(id)` | |
| `resuelta_at` | `timestamptz` | |

Índices: `(estado, prioridad)`, `(asignada_a)`, `(recurso_id)`.

**RLS.** Nada de esto es público:

- `select`: cualquiera con rol de panel (`edicion_local`, `editor`, `administrador`). `edicion_local`
  ve las suyas y las que no tienen MCM local (las generales del banco).
- `insert` / `update`: los mismos. Cualquiera puede marcar hecha la tarea de otro — es un equipo
  pequeño y la alternativa (solo quien la creó) hace que las tareas se queden colgadas cuando esa
  persona no está.
- `delete`: solo `administrador`. Para el resto, «descartada» es el camino (deja rastro).

### RPC `recursos.salud_banco()`

Devuelve **un** JSON con los conteos de todas las señales, para no encadenar quince peticiones:

```sql
create or replace function recursos.salud_banco()
returns jsonb language sql security invoker stable as $$
  select jsonb_build_object(
    'sin_formato',      (select count(*) from recursos.recurso where enlace is not null and formato is null),
    'sin_tematicas',    (select count(*) from recursos.recurso r where not exists (
                            select 1 from recursos.recurso_tag rt where rt.recurso_id = r.id)),
    'sin_descripcion',  (select count(*) from recursos.recurso where coalesce(descripcion,'') = ''),
    'sin_etapa',        (select count(*) from recursos.recurso where etapas is null or cardinality(etapas) = 0),
    'sin_edades',       (select count(*) from recursos.recurso where edades is null or cardinality(edades) = 0),
    'sin_tipo',         (select count(*) from recursos.recurso where tipo is null),
    'sin_enlace',       (select count(*) from recursos.recurso where coalesce(enlace,'') = ''),
    'por_clasificar',   (select count(*) from recursos.recurso where pendiente_clasificar),
    'fuera_del_banco',  (select count(*) from recursos.recurso where fuera_del_banco),
    'editados_en_web',  (select count(*) from recursos.recurso where editado_web_at is not null),
    'sin_embedding',    (select count(*) from recursos.recurso where estado = 'publicado' and embedding is null),
    'nunca_abiertos',   (select count(*) from recursos.recurso r where r.estado = 'publicado'
                            and not exists (select 1 from recursos.acceso a where a.recurso_id = r.id)),
    'envios_viejos',    (select count(*) from recursos.envio where estado in ('enviado','en_revision','revisar_ia')
                            and created_at < now() - interval '14 days'),
    'enlaces_repetidos',(select count(*) from (
                            select 1 from recursos.recurso where coalesce(enlace,'') <> ''
                            group by recursos.normalizar_enlace(enlace) having count(*) > 1) d)
  );
$$;
```

`security invoker` a propósito: cada quien ve lo que su RLS le deja contar, así que un
`edicion_local` no descubre por aquí cuántos borradores hay de otros MCM.

`normalizar_enlace` es la función que también usa la detección de duplicados (quita `?usp=sharing`,
`/edit` y demás cola de los enlaces de Drive para comparar de verdad).

### Filtros por URL en `/admin/recursos`

Para que «Ver los 12» funcione, el panel de recursos tiene que aceptar el problema en la URL:
`/admin/recursos?pendiente=sin_tematicas`. Hoy sus filtros son estado local del componente; hay que
leerlos de `page.url` como ya hace la portada, con el mismo cuidado de no pelearse con `replaceState`
(el aviso está en `docs/03-roadmap.md`, sección «Dos bugs de antes»).

## Experiencia de usuario

`/admin/salud` es la **primera** entrada de la navegación del panel: es la pantalla por la que se
empieza el día.

### Arriba: «Qué le falta al banco»

Una rejilla de tarjetas, ordenadas por lo que más duele, **escondiendo las que están a cero** (una
pantalla llena de ceros no es una pantalla de trabajo, es un adorno). Cada tarjeta:

- el número, grande y en `tabular-nums`
- una frase que dice **por qué importa**, no solo qué falta: «12 sin temáticas — no salen al filtrar
  por tema, que es como más se busca»
- botón **«Ver los 12»** → panel de recursos filtrado
- botón **«Apuntarlo»** → crea la tarea con `origen='salud'` y `senal='sin_tematicas'`; si ya existe
  una tarea abierta de esa señal, el botón lo dice en vez de duplicarla

Tres señales tienen su propio botón porque ya hay quien las arregla en lote: `sin_formato` («Detectar
formatos»), `sin_embedding` («Reindexar búsqueda») y `por_clasificar` («Analizar pendientes»).

Colores: nada de rojo por defecto. Rojo (`destructive`) solo para lo que rompe algo —`sin_enlace`, un
recurso publicado que no lleva a ninguna parte— y ámbar (`warm`) para lo que está a medias. El resto,
neutro: el banco a medio catalogar es lo normal, no una emergencia.

### Abajo: «Tareas del equipo»

- **Un campo y Enter.** Apuntar tiene que costar menos que abrir WhatsApp. Lo demás (prioridad,
  asignar, detalle) se rellena después sobre la tarea ya creada.
- Cada tarea: casilla para marcarla hecha (con «Deshacer», `$lib/deshacer.ts`), título editable en
  sitio, avatar de quien la tiene asignada (menú para cambiarlo), pastilla de prioridad, y —si lleva
  `recurso_id`— un enlace a esa ficha.
- Filtros simples: **Abiertas** (por defecto) · **Mías** · **Hechas**. Las hechas se ven, en gris y
  al final: parte del valor de una lista compartida es ver que se avanza.
- Quién y cuándo, en pequeño: «Marta, hace 2 días».
- Orden: prioridad alta primero, luego por antigüedad. Sin arrastrar y soltar en la v1.
- Estado vacío con sentido: «Ninguna tarea apuntada. Lo de arriba son 34 recursos sin temática, por
  si buscabas algo que hacer.»

### En la navegación

`Salud` con una pastilla del número de tareas abiertas. Si hay señales en rojo, un punto ámbar.
Nada de números grandes de señales: la cifra que uno se compromete a bajar son las tareas.

## Criterios de aceptación

- [ ] `/admin/salud` carga con **una** llamada para todas las señales, y las que están a cero no se
      pintan.
- [ ] Cada señal enlaza a `/admin/recursos?pendiente=…` y el panel llega con ese filtro puesto.
- [ ] «Apuntarlo» crea la tarea, y pulsarlo dos veces no crea dos tareas de la misma señal.
- [ ] Escribir una tarea y pulsar Enter la deja en la lista, visible para el resto del equipo.
- [ ] Marcar hecha se puede deshacer; al recargar, sigue hecha.
- [ ] `edicion_local` ve las tareas generales y las de su MCM, y no las de otro MCM.
- [ ] Los conteos cuadran con la realidad: se comprueba con el catálogo sintético del banco de
      pruebas (SPEC-013), tocando un recurso y viendo moverse el número.

## Preguntas abiertas

1. **¿Las tareas son solo del equipo o también «me lo apunto para mí»?** La spec asume compartidas
   con asignación opcional. Si quieres privadas, hace falta una columna más y decidir si el resto las
   ve en gris o no las ve.
2. **¿Qué es «nunca abierto»?** Ahora mismo se propone contar recursos publicados sin ningún acceso
   registrado. Con el catálogo joven eso son casi todos, así que quizá la señal deba ser «publicado
   hace más de 3 meses y nunca abierto».
3. **¿Interesa que una señal se pueda silenciar?** Ejemplo: los recursos «fuera del banco» son una
   decisión consciente, no un defecto; quizá esa tarjeta debería poder marcarse como «ya lo sé».
4. **Umbral de los envíos viejos**: 14 días es una propuesta.
5. **¿Prioridad o solo orden?** Tres pastillas (alta/normal/baja) es lo más simple que funciona; si
   sobra, se cambia por arrastrar y soltar.
