-- Valoración sin login (por dispositivo) + reclamación al iniciar sesión
-- APLICADA el 2026-07-19 como "recursos_valoracion_anonima".
--
-- Las estrellas se pueden dar sin cuenta: se guardan con un anon_id (uuid generado en el
-- dispositivo, en localStorage). Al hacer login, reclamar_valoraciones() las funde con la
-- cuenta. Corazones/usos/listas anónimos viven SOLO en localStorage (no en BD).

alter table recursos.valoracion drop constraint valoracion_pkey;
alter table recursos.valoracion alter column perfil_id drop not null;
alter table recursos.valoracion add column id uuid primary key default gen_random_uuid();
alter table recursos.valoracion add column anon_id uuid;
alter table recursos.valoracion add constraint valoracion_autoria
	check (perfil_id is not null or anon_id is not null);

create unique index valoracion_perfil_unica on recursos.valoracion (recurso_id, perfil_id);
create unique index valoracion_anon_unica on recursos.valoracion (recurso_id, anon_id);

-- Valorar sin sesión (una por recurso y dispositivo, actualizable)
create or replace function recursos.valorar_anon(rid text, estrellas_in int, dispositivo uuid)
returns void
language sql security definer set search_path = ''
as $$
	insert into recursos.valoracion (recurso_id, anon_id, estrellas)
	values (rid, dispositivo, estrellas_in)
	on conflict (recurso_id, anon_id) do update set estrellas = excluded.estrellas;
$$;
grant execute on function recursos.valorar_anon(text, int, uuid) to anon, authenticated;

-- Al hacer login: las valoraciones del dispositivo pasan a la cuenta (la de la cuenta gana
-- si ya existía) y se eliminan las anónimas de ese dispositivo.
create or replace function recursos.reclamar_valoraciones(dispositivo uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
	if auth.uid() is null then
		raise exception 'requiere sesión';
	end if;
	insert into recursos.valoracion (recurso_id, perfil_id, estrellas)
		select v.recurso_id, auth.uid(), v.estrellas
		from recursos.valoracion v
		where v.anon_id = dispositivo
	on conflict (recurso_id, perfil_id) do nothing;
	get diagnostics n = row_count;
	delete from recursos.valoracion where anon_id = dispositivo;
	return n;
end;
$$;
grant execute on function recursos.reclamar_valoraciones(uuid) to authenticated;

-- La media debe contar también las anónimas
create or replace view recursos.recurso_stats as
select
	r.id as recurso_id,
	round(avg(v.estrellas)::numeric, 1) as valoracion_media,
	count(v.estrellas)::int as num_valoraciones,
	(select count(*) from recursos.favorito f where f.recurso_id = r.id)::int as num_favoritos,
	(select count(*) from recursos.uso u where u.recurso_id = r.id)::int as num_usos,
	(select count(*) from recursos.acceso a where a.recurso_id = r.id)::int as num_accesos
from recursos.recurso r
left join recursos.valoracion v on v.recurso_id = r.id
group by r.id;
