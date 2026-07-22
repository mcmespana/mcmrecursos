# SPEC-010 · IA: búsqueda semántica y autoclasificación de recursos

> **Estado:** borrador (pendiente de validar con el usuario antes de codificar)
> **Depende de:** SPEC-002 (catálogo), SPEC-004/008 (envíos y revisión), SPEC-005 (sync)
> **Habilita:** Fase 5 del roadmap (búsqueda con IA) y el gran salto de calidad del banco vivo

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

## Decisión previa ⚠️ — privacidad antes que nada

El banco contiene material de tiempo libre con **menores**; hay un flag `datos_personales`
justamente porque algunos recursos incluyen fotos, nombres o listados. Que la IA «entre en
los documentos» significa **enviar ese contenido a un proveedor externo**. Esto **no puede
decidirse a la ligera** y condiciona todo el diseño:

- **Principio:** solo se procesan con IA los recursos **sin datos personales**. El pipeline
  primero clasifica «¿esto tiene datos personales?» con señales baratas (nombre de archivo,
  metadatos, primeras páginas) y, si hay sospecha, **se detiene y lo marca para revisión
  humana sin haber mandado el documento entero**.
- **Proveedor y retención:** usar la API de Anthropic (Claude) con **retención de datos
  configurada y sin entrenamiento** sobre nuestros datos; documentar el DPA. Para embeddings,
  Voyage AI (recomendado por Anthropic) con las mismas garantías. Nada de proveedores que
  entrenen con lo enviado.
- **Minimización:** enviar el **texto extraído** necesario, no el binario con metadatos EXIF;
  recortar/anonimizar cuando se pueda; no enviar imágenes de personas.
- **Consentimiento y transparencia:** dejar claro en la ficha y en el envío que el material
  puede analizarse con IA para clasificarlo, y permitir marcar «no procesar con IA»
  (`no_ia` a nivel de recurso/envío).

> Esta sección es la **primera pregunta abierta**: hay que validar el enfoque legal antes de
> escribir una línea del pipeline (ver «Preguntas abiertas»).

## Decisiones técnicas (propuesta)

- **Modelos (enero 2026):**
  - Clasificación/extracción y detección de datos personales → **Claude Haiku 4.5**
    (`claude-haiku-4-5`, 1$/5$ por millón tok) para el grueso barato; **Claude Sonnet 5**
    (`claude-sonnet-5`, 3$/15$) para casos dudosos o documentos complejos. Opus 4.8 solo si
    hiciera falta razonamiento profundo (no debería).
  - «Recomiéndame…» conversacional → **Sonnet 5**.
  - **Embeddings** → **Voyage AI** (Anthropic no ofrece embeddings propios); se guardan en
    **pgvector** (extensión ya disponible en Supabase, AD-4).
- **Dónde corre:** en **servidor** (acciones de SvelteKit o una Edge Function de Supabase),
  nunca en el cliente. La clave `ANTHROPIC_API_KEY` (y `VOYAGE_API_KEY`) viven en env del
  servidor; **sin clave, la funcionalidad se degrada a “no disponible”** y el resto de la app
  sigue igual (mismo patrón que `RESEND_API_KEY`).
- **Coste bajo control:**
  - **Batch API** (–50%) para reindexar embeddings y para clasificar lotes de envíos que no
    corren prisa; llamada síncrona solo cuando el editor pulsa «analizar ahora».
  - **Prompt caching** del bloque de instrucciones + vocabularios (`lista_valor`, tags) que se
    repite en cada clasificación → ~90% menos en la parte cacheada.
  - **Salidas estructuradas** (`output_config.format` con JSON Schema) para que la propuesta
    venga siempre válida y parseable, sin post-proceso frágil.
  - **Entrada de documentos** vía base64/Files API (PDF, texto); para Google Docs/Drive,
    exportar a PDF/txt antes de enviar.
- **A ~1.500 recursos** el índice semántico es minúsculo y baratísimo de mantener.

## Modelo de datos (migración futura 00013 — propuesta)

```sql
-- Embeddings para búsqueda semántica (pgvector). Un embedding por recurso vigente.
create extension if not exists vector with schema extensions;

alter table recursos.recurso
  add column if not exists embedding extensions.vector(1024),  -- dim de Voyage (voyage-3)
  add column if not exists embedding_at timestamptz,           -- cuándo se calculó
  add column if not exists no_ia boolean not null default false; -- excluir de todo lo IA

create index if not exists recurso_embedding_idx
  on recursos.recurso using hnsw (embedding extensions.vector_cosine_ops);

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

1. **Fundaciones IA sin tocar UX**: env + módulo servidor `lib/server/ia.ts` (cliente Claude,
   caching, salidas estructuradas), migración 00013, y el detector de datos personales como
   función pura probada. Sin esto, nada.
2. **Autoclasificación bajo demanda** en la bandeja (el mayor ahorro de trabajo humano). Batch
   para lotes; síncrono para «analizar ahora».
3. **Embeddings + búsqueda semántica** en el buscador y relacionados de verdad.
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

## Preguntas abiertas (a validar antes de implementar)

1. **Privacidad/legal (bloqueante):** ¿damos por bueno el enfoque «no procesar con IA los
   recursos con datos personales, detectar y frenar antes de enviar el documento entero,
   proveedor con DPA y sin entrenamiento»? ¿Hay que consultar con protección de datos de MCM
   (material con menores)?
2. **Alcance de lo que lee la IA:** ¿solo texto extraído (recomendado) o también imágenes?
   Las imágenes de personas quedarían excluidas por defecto — ¿de acuerdo?
3. **Proveedor de embeddings:** ¿Voyage AI (recomendado por Anthropic) o prefieres otro?
   Implica una segunda API key y su propio DPA.
4. **Coste y llaves:** ¿quién pone y paga las API keys? ¿Presupuesto mensual objetivo para
   acotar Batch vs. síncrono?
5. **¿Empezamos por (B) autoclasificación** —el mayor ahorro de trabajo— **o por (A)
   búsqueda semántica** —lo más vistoso—? Mi recomendación: (B), fase 2.
6. **Acceso a Drive:** para leer el contenido hay que exportar de Drive (PDF/txt). ¿Con qué
   credencial (cuenta de servicio, OAuth del editor)? Esto es un pequeño proyecto en sí.
