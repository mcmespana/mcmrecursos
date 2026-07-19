-- SPEC-003 (cierre) · Listas personales y comentarios
-- APLICADA el 2026-07-19 como "recursos_listas_comentarios".

create table recursos.lista (
	id uuid primary key default gen_random_uuid(),
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	nombre text not null,
	descripcion text,
	publica boolean not null default false, -- compartible por enlace
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger lista_updated_at
	before update on recursos.lista
	for each row execute function recursos.set_updated_at();

create table recursos.lista_recurso (
	lista_id uuid not null references recursos.lista (id) on delete cascade,
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (lista_id, recurso_id)
);

create table recursos.comentario (
	id uuid primary key default gen_random_uuid(),
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	texto text not null check (char_length(texto) between 1 and 2000),
	tipo text not null default 'comentario', -- comentario | sugerencia
	created_at timestamptz not null default now()
);

create index comentario_recurso_idx on recursos.comentario (recurso_id, created_at desc);

-- Identidad mínima pública para firmar comentarios (perfil tiene RLS restrictivo)
create view recursos.perfil_publico as
	select id, nombre, avatar_url from recursos.perfil;

-- RLS
alter table recursos.lista enable row level security;
alter table recursos.lista_recurso enable row level security;
alter table recursos.comentario enable row level security;

create policy "lista propia o publica" on recursos.lista for select
	using (perfil_id = auth.uid() or publica);
create policy "lista gestiona el dueño" on recursos.lista for all
	using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "lista_recurso visible via lista" on recursos.lista_recurso for select
	using (exists (select 1 from recursos.lista l where l.id = lista_id));
create policy "lista_recurso gestiona el dueño" on recursos.lista_recurso for all
	using (exists (select 1 from recursos.lista l where l.id = lista_id and l.perfil_id = auth.uid()))
	with check (exists (select 1 from recursos.lista l where l.id = lista_id and l.perfil_id = auth.uid()));

-- Comentarios: lectura pública (moderación a posteriori por editores)
create policy "comentario lectura publica" on recursos.comentario for select using (true);
create policy "comentario escribe el autor" on recursos.comentario for insert
	with check (perfil_id = auth.uid());
create policy "comentario borra autor o editor" on recursos.comentario for delete
	using (perfil_id = auth.uid() or recursos.es_editor());
