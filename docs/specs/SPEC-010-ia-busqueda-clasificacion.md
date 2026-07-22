# SPEC-010 · IA: búsqueda semántica y autoclasificación de recursos

> **Estado:** validada (decisiones cerradas 2026-07-20). Motor: **Google Gemini**.
> Empezamos por **autoclasificación** (fase 2). En implementación.
> **Depende de:** SPEC-002 (catálogo), SPEC-004/008 (envíos y revisión), SPEC-005 (sync)
> **Habilita:** Fase 5 del roadmap (búsqueda con IA) y el gran salto de calidad del banco vivo

## Decisiones cerradas (2026-07-20)

1. **Privacidad:** el banco **no maneja datos personales** relevantes — como mucho algún
   nombre suelto en un libro de campamento, que no es problema. Sin puerta bloqueante; se
   deja un opt-out simple `no_ia` por si algún recurso concreto no debe procesarse.
2. **Qué lee la IA:** solo **texto evidente** (título, descripción, notas, texto extraído del
   documento). Nada de imágenes ni análisis de fotos de personas.
3. **Motor:** **Google Gemini**, empezando por los modelos **Flash** (free tier, consumo
   bajo). Modelo configurable por env (`GEMINI_MODELO`, por defecto `gemini-2.5-flash`) para
   poder cambiarlo sin tocar código; migrar a Google Cloud «algo sencillito» más adelante si
   hace falta. Embeddings también de Gemini (mismo proveedor, una sola clave).
4. **Empezamos por autoclasificación** (fase 2), no por la búsqueda semántica.
5. **Acceso a Drive:** con una **cuenta de servicio** de Google (exporta el documento a
   texto). Encaja porque ya todo es Google. En la v1 la IA clasifica con el **texto que ya
   hay** (título, notas, campos existentes); leer el documento de Drive es la rebanada
   siguiente, pequeña.

## Objetivo

Meter IA donde de verdad aporta, en dos frentes:

- **(A) Búsqueda ampliada por IA** — encontrar recursos por *significado*, no solo por
  palabras que coincidan: entrar en el contenido de los documentos y proponer cosas
  relevantes aunque no compartan término exacto («dinámicas de confianza para 1º ESO» →
  encuentra la sesión aunque no diga «confianza»).
- **(B) Autoclasificación con humano al mando** — una **bandeja de entrada** donde, cuando
  llega un recurso (envío o carpeta de Drive), la IA hace el trabajo pesado: propone tipo,
  etapas, edades, nivel, tags y descripción; **detecta datos personales**; avisa de qué hay
  que arreglar antes de publicar; y un editor revisa y le da a **publicar**. La IA propone,
  el humano dispone.

## Alcance

**Entra (por fases, ver más abajo):**
- Índice semántico (embeddings + pgvector) del catálogo y búsqueda híbrida (léxica Orama +
  semántica) en el buscador público.
- «Recomiéndame…» conversacional (texto libre → mazo explicado), reaprovechando Descubre.
- Bandeja de entrada de clasificación en `/admin`: la IA analiza cada envío/recurso pendiente
  y rellena una **propuesta** editable; el editor la ajusta y publica.
- Detección de datos personales y de «arreglos previos» (calidad, enlace roto, falta ficha…).

**Fuera (por ahora):**
- Generación de recursos por IA (esto es un banco curado por personas).
- Traducción automática, moderación automática de comentarios.
- Cualquier acción que publique sin validación humana (la IA **nunca** publica sola).

## Privacidad (resuelto)

El banco no maneja datos personales relevantes (decisión 1): material de tiempo libre, con
como mucho algún nombre suelto en un libro de campamento. No hay puerta bloqueante ni
detector obligatorio. Se respeta un opt-out simple **`no_ia`** a nivel de recurso/envío por
si algún caso concreto no debe procesarse, y la IA lee **solo texto** (decisión 2), nunca
imágenes de personas.

## Decisiones técnicas

- **Motor: Google Gemini.**
  - Clasificación/extracción → **Gemini Flash** (`gemini-2.5-flash` por defecto, free tier).
    Modelo **configurable por env** (`GEMINI_MODELO`) para subir a uno mayor o migrar a
    Google Cloud sin tocar código.
  - Embeddings (búsqueda semántica, fase posterior) → **Voyage AI** como opción preferida:
    200M tokens gratis (indexar los ~1.500 recursos son ~1-2M tokens *una vez*; no se agota),
    calidad top y `voyage-4-lite` a $0.02/millón si algún día se supera. Alternativa: los
    embeddings del propio Gemini (una sola clave). Se decide al llegar a esa fase. En ambos
    casos, guardados en **pgvector** (Supabase, AD-4). **Nota:** Voyage solo hace embeddings;
    la clasificación seguirá siendo Gemini (generativo).
  - **REST directo** (`generateContent` con `responseSchema` para salida JSON estable): sin
    SDK, solo `fetch`, endpoint canónico y duradero. La clave va en la cabecera
    `x-goog-api-key`.
- **Dónde corre:** en **servidor** (acciones de SvelteKit), nunca en el cliente. La clave
  `GEMINI_API_KEY` vive en env; **sin clave, la funcionalidad se degrada a “no disponible”**
  y el resto de la app sigue igual (mismo patrón que `RESEND_API_KEY`). Se lee de
  `$env/dynamic/private` para poder añadirla en Vercel sin recompilar.
- **Coste bajo control:**
  - Free tier de Flash para el grueso; llamada **síncrona** cuando el editor pulsa «Analizar
    con IA», y lote bajo demanda para «analizar todo lo pendiente».
  - **Salida estructurada** (`responseMimeType: application/json` + `responseSchema`) para que
    la propuesta venga siempre válida y parseable, sin post-proceso frágil.
  - Se le pasan los **vocabularios cerrados** (`lista_valor`, tags existentes) en el prompt
    para que elija de valores válidos y no invente etiquetas.
  - **Texto de entrada** = título + descripción + notas + campos existentes (v1); + texto
    exportado de Drive vía cuenta de servicio (rebanada siguiente).
- **A ~1.500 recursos** el índice semántico es minúsculo y baratísimo de mantener.

## Modelo de datos

**Migración 00013 (autoclasificación — aplicada):** `recurso.no_ia` + tabla
`clasificacion_ia`. **Embeddings (pgvector) → migración posterior** con la fase de búsqueda
semántica (columna `recurso.embedding vector(768)`, `embedding_at`, índice HNSW), para no
añadir esquema que aún no se usa.

```sql
alter table recursos.recurso
  add column if not exists no_ia boolean not null default false; -- excluir de todo lo IA

-- Propuesta de clasificación de la IA sobre un envío o recurso (editable, no publica sola).
create table recursos.clasificacion_ia (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid references recursos.envio (id) on delete cascade,
  recurso_id text references recursos.recurso (id) on delete cascade,
  estado text not null default 'pendiente',   -- pendiente | analizando | propuesta | error
  modelo text,                                 -- p. ej. claude-haiku-4-5
  propuesta jsonb not null default '{}',       -- {tipo, etapas, edades, nivel, tags, descripcion...}
  datos_personales_detectados boolean,         -- señal de la IA (no decide, avisa)
  avisos jsonb not null default '[]',          -- ["enlace roto", "falta portada", ...]
  confianza numeric,                           -- 0..1 autoevaluada
  coste_tokens int,                            -- trazabilidad de gasto
  created_at timestamptz not null default now(),
  check (envio_id is not null or recurso_id is not null)
);
alter table recursos.clasificacion_ia enable row level security;
create policy "clasificacion ve/gestiona revisor" on recursos.clasificacion_ia for all
  using (recursos.es_editor()) with check (recursos.es_editor());
```

- **RLS:** solo editor/admin ven las propuestas. Los embeddings viajan al cliente solo como
  resultados de búsqueda (ids + score), nunca el vector en crudo.
- **Búsqueda semántica** vía RPC `recursos.buscar_semantica(embedding_consulta, limite)` que
  devuelve ids ordenados por distancia coseno, respetando la RLS de `recurso`.

## Experiencia de usuario

### (A) Búsqueda ampliada
- El buscador (SPEC-002/006) suma un modo **híbrido**: Orama sigue dando la respuesta léxica
  instantánea; en paralelo, una llamada corta convierte la consulta en embedding y trae los
  vecinos semánticos, que se **fusionan** (unión ponderada) con un badge sutil «relacionado
  por IA». Sin `q`, nada de IA (coste 0).
- **Descubre** gana un mazo «Recomiéndame…»: texto libre → Sonnet arma el mazo por similitud
  + popularidad y **cada tarjeta explica en una línea por qué** te la propone. Enlaza con
  SPEC-007 (variante con IA).
- Los **relacionados** de la ficha (SPEC-009 anexo A) pasan de heurística a semánticos.

### (B) Bandeja de entrada de clasificación (`/admin/bandeja`, editor/admin)
- Lista de envíos/recursos **pendientes de clasificar** con estado. La IA corre **al llegar**
  (si hay clave y el envío no tiene sospecha de datos personales) o **bajo demanda** con un
  botón «dale un vuelto a esto» / «analizar todo lo pendiente» (Batch).
- Cada fila abre el **formulario de recurso** (el de SPEC-008 §2) **prerrellenado con la
  propuesta**: tipo, etapas, edades, nivel, tags y descripción sugeridos, con un chip «IA» y
  la confianza. El editor ajusta lo que quiera.
- **Banner de avisos**: «⚠️ posible dato personal — revisar antes de publicar», «enlace roto»,
  «sin portada», «falta año». El de datos personales **bloquea** la publicación hasta que un
  humano lo confirma y marca el flag `datos_personales`.
- Acción final **Publicar** (reutiliza el flujo de SPEC-008: crea/actualiza `recurso`,
  registra quién revisó, email al remitente). La IA nunca publica sola.
- Integra con **versiones** (SPEC-009): si el envío se marca «versión mejorada de Rxxxx», la
  IA puede comparar y proponer los cambios respecto a la anterior.

## Fases de entrega (incremental, cada una aporta valor sola)

1. **Fundaciones IA** (hecho): env `GEMINI_API_KEY`/`GEMINI_MODELO`, módulo servidor
   `lib/server/ia.ts` (cliente Gemini vía fetch, salida estructurada, degradación sin clave),
   migración 00013 (`no_ia` + `clasificacion_ia`).
2. **Autoclasificación bajo demanda** (en curso): botón «Analizar con IA» en `/admin/recursos`
   que clasifica desde el texto existente y propone tipo/etapas/edades/nivel/tags/descripción
   editable; el editor aplica y publica. Después: leer el documento de Drive (cuenta de
   servicio) y «analizar todo lo pendiente» en lote.
3. **Embeddings + búsqueda semántica** en el buscador y relacionados de verdad (migración con
   pgvector; backfill de embeddings).
4. **«Recomiéndame…» conversacional** en Descubre.

## Criterios de aceptación (borrador)

- [ ] Sin `ANTHROPIC_API_KEY`/`VOYAGE_API_KEY`, la app funciona igual; lo IA aparece como
      «no disponible» y no rompe ningún flujo.
- [ ] Ningún documento con sospecha de datos personales se envía entero a la IA sin que un
      humano lo haya autorizado; el aviso bloquea la publicación.
- [ ] La IA **nunca** cambia el estado a `publicado`; solo deja una propuesta editable.
- [ ] La búsqueda híbrida mejora el recall en consultas por significado sin degradar la
      latencia léxica (Orama sigue respondiendo primero).
- [ ] Coste por clasificación registrado (`coste_tokens`) y acotado con caching + Batch.
- [ ] Toda propuesta llega como JSON válido contra el esquema (salidas estructuradas).

## Preguntas abiertas — RESUELTAS (2026-07-20)

1. **Privacidad:** sin datos personales relevantes; sin puerta bloqueante, solo opt-out
   `no_ia`. ✅
2. **Qué lee la IA:** solo texto evidente, nada de imágenes. ✅
3. **Motor y embeddings:** Google Gemini (Flash, free tier), embeddings del mismo Gemini. ✅
4. **Llaves/coste:** free tier de Flash para empezar; `GEMINI_API_KEY` en env (Vercel). ✅
5. **Orden:** primero autoclasificación (fase 2). ✅
6. **Drive:** cuenta de servicio de Google (exporta a texto). Rebanada posterior; la v1
   clasifica con el texto que ya hay. ✅

## Pendiente de configuración (para encender la IA)

- Crear una **API key de Gemini** (Google AI Studio, free tier) y ponerla como
  `GEMINI_API_KEY` en las variables de entorno de Vercel (y en `app/.env` para local).
- (Opcional) `GEMINI_MODELO` si se quiere otro modelo que el `gemini-2.5-flash` por defecto.
- Para leer documentos de Drive (rebanada siguiente): cuenta de servicio con acceso de
  lectura a las carpetas del banco.
