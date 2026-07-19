-- SPEC-003 · Capa social: valoraciones, favoritos, usos y accesos
-- APLICADA el 2026-07-19 como "recursos_capa_social".

create table recursos.valoracion (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	estrellas int not null check (estrellas between 1 and 5),
	comentario text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	primary key (recurso_id, perfil_id)
);

create trigger valoracion_updated_at
	before update on recursos.valoracion
	for each row execute function recursos.set_updated_at();

create table recursos.favorito (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (recurso_id, perfil_id)
);

-- "Lo he usado": personal y única por recurso (se puede quitar)
create table recursos.uso (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	created_at timestamptz not null default now(),
	primary key (recurso_id, perfil_id)
);

-- Clics en "Abrir recurso"; admite anónimos (perfil_id null)
create table recursos.acceso (
	id uuid primary key default gen_random_uuid(),
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	perfil_id uuid references recursos.perfil (id) on delete set null,
	created_at timestamptz not null default now()
);

create index acceso_recurso_idx on recursos.acceso (recurso_id);

-- RLS: cada uno ve/gestiona lo suyo; agregados via vista recurso_stats
alter table recursos.valoracion enable row level security;
alter table recursos.favorito enable row level security;
alter table recursos.uso enable row level security;
alter table recursos.acceso enable row level security;

create policy "propia o editor" on recursos.valoracion for select
	using (perfil_id = auth.uid() or recursos.es_editor());
create policy "gestiona la propia" on recursos.valoracion for all
	using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "propio" on recursos.favorito for select using (perfil_id = auth.uid());
create policy "gestiona el propio" on recursos.favorito for all
	using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "propio" on recursos.uso for select using (perfil_id = auth.uid());
create policy "gestiona el propio" on recursos.uso for all
	using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

create policy "acceso solo editor lee" on recursos.acceso for select
	using (recursos.es_editor());

-- Registro de acceso para cualquiera (también anónimos) sin abrir INSERT por RLS
create or replace function recursos.registrar_acceso(rid text)
returns void
language sql security definer set search_path = ''
as $$
	insert into recursos.acceso (recurso_id, perfil_id) values (rid, auth.uid());
$$;

-- Agregados públicos (la vista corre con el dueño: solo expone recuentos y media)
create view recursos.recurso_stats as
select
	r.id as recurso_id,
	round(avg(v.estrellas)::numeric, 1) as valoracion_media,
	count(v.perfil_id)::int as num_valoraciones,
	(select count(*) from recursos.favorito f where f.recurso_id = r.id)::int as num_favoritos,
	(select count(*) from recursos.uso u where u.recurso_id = r.id)::int as num_usos,
	(select count(*) from recursos.acceso a where a.recurso_id = r.id)::int as num_accesos
from recursos.recurso r
left join recursos.valoracion v on v.recurso_id = r.id
group by r.id;
