-- MCM locales reales (desde las delegaciones de MCM Bank) + acceso preautorizado
-- APLICADA el 2026-07-19 como "recursos_locales_acceso_previo".
--
-- acceso_previo: emails que, al hacer su primer login con Google, nacen ya con su rol
-- y MCM local. Si el perfil ya existía, la migración lo actualiza al momento.
-- Fuente: delegaciones de MCM Bank (solo lectura). Excluidos: cuentas con el typo
-- movimientoconslacion.com, cuentas super* alternativas y cuentas personales.

insert into recursos.mcm_local (nombre, slug) values
	('MCM L''Alcora', 'alcora'),
	('MCM Benicarló-Vinaròs', 'benicarlo-vinaros'),
	('MCM Burriana', 'burriana'),
	('MCM Caravaca', 'caravaca'),
	('MCM Espinardo', 'espinardo'),
	('MCM Madrid', 'madrid'),
	('MCM Onda', 'onda'),
	('MCM Quintanar', 'quintanar'),
	('MCM Vila-real', 'vila-real'),
	('MCM Villacañas', 'villacanas'),
	('MCM Zaragoza', 'zaragoza')
on conflict (slug) do nothing;

create table recursos.acceso_previo (
	email text primary key,
	rol recursos.rol_usuario not null,
	mcm_local_id uuid references recursos.mcm_local (id),
	created_at timestamptz not null default now()
);
alter table recursos.acceso_previo enable row level security;
create policy "acceso_previo solo admin" on recursos.acceso_previo for all
	using (recursos.es_admin()) with check (recursos.es_admin());

insert into recursos.acceso_previo (email, rol, mcm_local_id) values
	('ajmcm@movimientoconsolacion.com', 'administrador', null),
	('admin@movimientoconsolacion.com', 'administrador', null),
	('vinarosbenicarlo@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'benicarlo-vinaros')),
	('burriana@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'burriana')),
	('castellon@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'castellon')),
	('espinardo@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'espinardo')),
	('madrid@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'madrid')),
	('nules@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'nules')),
	('vila-real@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'vila-real')),
	('villacanas@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'villacanas')),
	('zaragoza@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'zaragoza'));
-- Pendientes de confirmar email limpio (en MCM Bank solo existen con typo o no existen):
-- Caravaca, Onda, L'Alcora y Quintanar — añadirlos desde /admin cuando se confirmen.

-- El alta automática ahora respeta lo preautorizado
create or replace function recursos.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare pre record;
begin
	select rol, mcm_local_id into pre from recursos.acceso_previo where email = new.email;
	insert into recursos.perfil (id, email, nombre, apellidos, avatar_url, rol, mcm_local_id)
	values (
		new.id,
		new.email,
		coalesce(new.raw_user_meta_data ->> 'given_name', split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 1)),
		coalesce(new.raw_user_meta_data ->> 'family_name', ''),
		new.raw_user_meta_data ->> 'avatar_url',
		coalesce(pre.rol, 'consulta'),
		pre.mcm_local_id
	)
	on conflict (id) do nothing;
	return new;
end;
$$;

-- Aplica lo preautorizado a perfiles que ya existan
update recursos.perfil p
set rol = ap.rol, mcm_local_id = coalesce(ap.mcm_local_id, p.mcm_local_id)
from recursos.acceso_previo ap
where ap.email = p.email;
