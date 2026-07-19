-- SPEC-001 · Autenticación, perfiles y roles
-- APLICADA el 2026-07-18 en el proyecto compartido mcmvotaciones (sjhxhsdckvungsrbquve)
-- como migración "recursos_esquema_inicial".
--
-- El Banco de Recursos vive en el esquema Postgres `recursos`, aislado del `public`
-- de mcmvotaciones (ver AD-6 en docs/01-arquitectura.md). No tocar el esquema public.

create schema if not exists recursos;

create type recursos.rol_usuario as enum (
	'consulta',
	'edicion_local',
	'editor',
	'administrador',
	'consulta_externa'
);

create table recursos.mcm_local (
	id uuid primary key default gen_random_uuid(),
	nombre text not null unique,
	slug text not null unique,
	activo boolean not null default true,
	created_at timestamptz not null default now()
);

insert into recursos.mcm_local (nombre, slug) values
	('MCM Castellón', 'castellon'),
	('MCM Nules', 'nules');

create table recursos.perfil (
	id uuid primary key references auth.users (id) on delete cascade,
	email text not null unique,
	nombre text not null default '',
	apellidos text not null default '',
	avatar_url text,
	mcm_local_id uuid references recursos.mcm_local (id),
	rol recursos.rol_usuario not null default 'consulta',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Alta automática de perfil al primer login (solo usuarios del banco de recursos;
-- mcmvotaciones no usa Supabase Auth, así que no interfiere).
create or replace function recursos.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
	insert into recursos.perfil (id, email, nombre, apellidos, avatar_url)
	values (
		new.id,
		new.email,
		coalesce(new.raw_user_meta_data ->> 'given_name', split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1)),
		coalesce(new.raw_user_meta_data ->> 'family_name', ''),
		new.raw_user_meta_data ->> 'avatar_url'
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

create trigger on_auth_user_created_recursos
	after insert on auth.users
	for each row execute function recursos.handle_new_user();

-- Helpers de autorización para políticas RLS.
create or replace function recursos.rol_actual()
returns recursos.rol_usuario
language sql stable security definer set search_path = ''
as $$
	select rol from recursos.perfil where id = auth.uid();
$$;

create or replace function recursos.es_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
	select coalesce(recursos.rol_actual() = 'administrador', false);
$$;

-- RLS
alter table recursos.mcm_local enable row level security;
alter table recursos.perfil enable row level security;

create policy "mcm_local legible por todos"
	on recursos.mcm_local for select using (true);

create policy "mcm_local solo admin escribe"
	on recursos.mcm_local for all
	using (recursos.es_admin()) with check (recursos.es_admin());

create policy "perfil legible por su dueño y admin"
	on recursos.perfil for select
	using (id = auth.uid() or recursos.es_admin());

create policy "perfil editable por su dueño sin cambiar rol"
	on recursos.perfil for update
	using (id = auth.uid())
	with check (id = auth.uid() and rol = (select p.rol from recursos.perfil p where p.id = auth.uid()));

create policy "perfil gestionable por admin"
	on recursos.perfil for all
	using (recursos.es_admin()) with check (recursos.es_admin());

-- Exposición del esquema a la API (PostgREST) y grants.
grant usage on schema recursos to anon, authenticated, service_role;
grant all on all tables in schema recursos to anon, authenticated, service_role;
grant all on all routines in schema recursos to anon, authenticated, service_role;
grant all on all sequences in schema recursos to anon, authenticated, service_role;
alter default privileges in schema recursos grant all on tables to anon, authenticated, service_role;
alter default privileges in schema recursos grant all on routines to anon, authenticated, service_role;
alter default privileges in schema recursos grant all on sequences to anon, authenticated, service_role;

-- Ejecutado aparte (config de PostgREST, no versionable como DDL puro):
--   alter role authenticator set pgrst.db_schemas = 'public, graphql_public, recursos';
--   notify pgrst, 'reload config';
