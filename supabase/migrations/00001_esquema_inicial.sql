-- SPEC-001 · Autenticación, perfiles y roles
-- Aplicar con el MCP de Supabase (apply_migration) cuando exista el proyecto.

create type rol_usuario as enum (
	'consulta',
	'edicion_local',
	'editor',
	'administrador',
	'consulta_externa'
);

create table mcm_local (
	id uuid primary key default gen_random_uuid(),
	nombre text not null unique,
	slug text not null unique,
	activo boolean not null default true,
	created_at timestamptz not null default now()
);

insert into mcm_local (nombre, slug) values
	('MCM Castellón', 'castellon'),
	('MCM Nules', 'nules');

create table perfil (
	id uuid primary key references auth.users (id) on delete cascade,
	email text not null unique,
	nombre text not null default '',
	apellidos text not null default '',
	avatar_url text,
	mcm_local_id uuid references mcm_local (id),
	rol rol_usuario not null default 'consulta',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Alta automática de perfil al primer login con Google.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
	insert into public.perfil (id, email, nombre, apellidos, avatar_url)
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

create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- Helpers de autorización (estables para usarse dentro de políticas RLS).
create or replace function public.rol_actual()
returns rol_usuario
language sql stable security definer set search_path = public
as $$
	select rol from perfil where id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
	select coalesce(public.rol_actual() = 'administrador', false);
$$;

-- RLS
alter table mcm_local enable row level security;
alter table perfil enable row level security;

create policy "mcm_local legible por todos"
	on mcm_local for select using (true);

create policy "mcm_local solo admin escribe"
	on mcm_local for all
	using (public.es_admin()) with check (public.es_admin());

create policy "perfil legible por su dueño y admin"
	on perfil for select
	using (id = auth.uid() or public.es_admin());

-- El dueño edita su perfil pero no puede tocar su rol (comparado contra el valor actual).
create policy "perfil editable por su dueño sin cambiar rol"
	on perfil for update
	using (id = auth.uid())
	with check (id = auth.uid() and rol = (select p.rol from perfil p where p.id = auth.uid()));

create policy "perfil gestionable por admin"
	on perfil for all
	using (public.es_admin()) with check (public.es_admin());
