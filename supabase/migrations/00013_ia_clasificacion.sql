-- SPEC-010 · IA: autoclasificación (Gemini). Propuesta editable; la IA nunca publica sola.
-- APLICADA el 2026-07-20 como "recursos_ia_clasificacion".
--
-- Solo texto (sin imágenes ni datos personales relevantes, ver SPEC-010 §decisiones).
-- `no_ia` deja excluir un recurso concreto de cualquier procesamiento con IA.

alter table recursos.recurso
  add column if not exists no_ia boolean not null default false;

create table if not exists recursos.clasificacion_ia (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid references recursos.envio (id) on delete cascade,
  recurso_id text references recursos.recurso (id) on delete cascade,
  estado text not null default 'propuesta',   -- propuesta | error
  modelo text,
  propuesta jsonb not null default '{}',       -- {tipo, etapas, edades, nivel, idioma, soporte, tags, descripcion}
  avisos jsonb not null default '[]',          -- ["enlace roto", "falta año", ...]
  confianza numeric,                           -- 0..1 autoevaluada
  error text,
  created_at timestamptz not null default now(),
  check (envio_id is not null or recurso_id is not null)
);

create index if not exists clasificacion_ia_recurso_idx on recursos.clasificacion_ia (recurso_id, created_at desc);
create index if not exists clasificacion_ia_envio_idx on recursos.clasificacion_ia (envio_id, created_at desc);

alter table recursos.clasificacion_ia enable row level security;

drop policy if exists "clasificacion gestiona revisor" on recursos.clasificacion_ia;
create policy "clasificacion gestiona revisor" on recursos.clasificacion_ia for all
  using (recursos.es_editor()) with check (recursos.es_editor());

notify pgrst, 'reload schema';
