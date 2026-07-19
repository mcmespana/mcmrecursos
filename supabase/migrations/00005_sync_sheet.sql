-- SPEC-005 · Sincronización Sheet → BD (push desde la hoja, sin cron)
-- APLICADA el 2026-07-19 como "recursos_sync_sheet".
--
-- El Apps Script del Sheet (o el endpoint /api/sync) llama a recursos.sync_filas()
-- con las filas y la clave. La clave vive en recursos.sync_config (RLS sin políticas:
-- solo legible por las funciones security definer). Para consultarla/rotarla:
--   select clave from recursos.sync_config;  (SQL editor del dashboard)

create extension if not exists unaccent with schema extensions;

create table recursos.sync_config (
	id int primary key default 1 check (id = 1),
	clave text not null,
	ultima_sync timestamptz
);
alter table recursos.sync_config enable row level security;
-- sin políticas a propósito

create table recursos.sync_log (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),
	procesadas int not null,
	creadas int not null,
	actualizadas int not null,
	retiradas int not null,
	errores jsonb not null default '[]'
);
alter table recursos.sync_log enable row level security;
create policy "log visible editor" on recursos.sync_log for select using (recursos.es_editor());

create or replace function recursos.slugify(t text)
returns text immutable language sql set search_path = ''
as $$
	select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(t, ''))), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function recursos._csv_a_array(t text)
returns text[] immutable language sql set search_path = ''
as $$
	select coalesce(array_remove(array(select nullif(trim(x), '') from unnest(string_to_array(coalesce(t, ''), ',')) x), null), '{}');
$$;

create or replace function recursos._a_bool(t text)
returns boolean immutable language sql set search_path = ''
as $$
	select lower(trim(coalesce(t, ''))) in ('si', 'sí', 'true', '1', 'x', 'yes');
$$;

-- Sincroniza un lote de filas del Sheet (cabeceras canónicas de docs/seed/recursos_seed.csv).
-- Filas sin id reciben uno nuevo (R####) que se devuelve en ids_asignados para escribirlo
-- de vuelta en la hoja. Con retirar_ausentes=true, los recursos que no vengan en el lote
-- pasan a estado 'retirado' (nunca DELETE: se conserva la capa social).
create or replace function recursos.sync_filas(
	filas jsonb,
	clave_in text,
	retirar_ausentes boolean default false
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
	fila jsonb;
	indice int := 0;
	rid text;
	num_sig int;
	mcm uuid;
	existia boolean;
	nombre_autor text;
	partes text[];
	aid uuid;
	tid uuid;
	rel text;
	ids_lote text[] := '{}';
	ids_asignados jsonb := '[]';
	errores jsonb := '[]';
	creadas int := 0;
	actualizadas int := 0;
	retiradas int := 0;
begin
	if not exists (select 1 from recursos.sync_config c where c.clave = clave_in) then
		raise exception 'clave de sincronización incorrecta';
	end if;

	select coalesce(max(substring(id from 2)::int), 0) + 1
		into num_sig
		from recursos.recurso
		where id ~ '^R[0-9]+$';

	for fila in select * from jsonb_array_elements(filas) loop
		indice := indice + 1;
		begin
			rid := nullif(trim(fila ->> 'id'), '');
			if rid is null then
				rid := 'R' || lpad(num_sig::text, 4, '0');
				num_sig := num_sig + 1;
				ids_asignados := ids_asignados || jsonb_build_object('fila', indice, 'id', rid);
			end if;
			if nullif(trim(fila ->> 'nombre'), '') is null then
				raise exception 'falta el nombre';
			end if;

			select ml.id into mcm
				from recursos.mcm_local ml
				where ml.nombre = trim(fila ->> 'mcm_local') or ml.slug = recursos.slugify(fila ->> 'mcm_local');

			existia := exists (select 1 from recursos.recurso r where r.id = rid);

			insert into recursos.recurso as r (
				id, nombre, descripcion, tipo, etapas, nivel, edades, mcm_local_id, idioma,
				soporte, ubicacion, enlace, imagen, enlace_imagenes, anyo_publicacion, curso_usado,
				visibilidad, estado, datos_personales, creado_con_ia, fuera_del_banco,
				pendiente_clasificar, notas_internas
			) values (
				rid,
				trim(fila ->> 'nombre'),
				nullif(trim(fila ->> 'descripcion'), ''),
				nullif(trim(fila ->> 'tipo'), ''),
				recursos._csv_a_array(fila ->> 'etapas'),
				nullif(trim(fila ->> 'nivel'), ''),
				recursos._csv_a_array(fila ->> 'edades'),
				mcm,
				nullif(trim(fila ->> 'idioma'), ''),
				nullif(trim(fila ->> 'soporte'), ''),
				nullif(trim(fila ->> 'ubicacion'), ''),
				nullif(trim(fila ->> 'enlace'), ''),
				nullif(trim(fila ->> 'imagen'), ''),
				nullif(trim(fila ->> 'enlace_imagenes'), ''),
				nullif(trim(fila ->> 'anyo_publicacion'), '')::int,
				nullif(trim(fila ->> 'curso_usado'), ''),
				coalesce(nullif(trim(fila ->> 'visibilidad'), ''), 'publico'),
				coalesce(nullif(trim(fila ->> 'estado'), ''), 'borrador'),
				recursos._a_bool(fila ->> 'datos_personales'),
				recursos._a_bool(fila ->> 'creado_con_ia'),
				case when fila ? 'fuera_del_banco' and nullif(trim(fila ->> 'fuera_del_banco'), '') is not null
					then recursos._a_bool(fila ->> 'fuera_del_banco') else true end,
				recursos._a_bool(fila ->> 'pendiente_clasificar'),
				nullif(trim(fila ->> 'notas_internas'), '')
			)
			on conflict (id) do update set
				nombre = excluded.nombre,
				descripcion = excluded.descripcion,
				tipo = excluded.tipo,
				etapas = excluded.etapas,
				nivel = excluded.nivel,
				edades = excluded.edades,
				mcm_local_id = excluded.mcm_local_id,
				idioma = excluded.idioma,
				soporte = excluded.soporte,
				ubicacion = excluded.ubicacion,
				enlace = excluded.enlace,
				imagen = excluded.imagen,
				enlace_imagenes = excluded.enlace_imagenes,
				anyo_publicacion = excluded.anyo_publicacion,
				curso_usado = excluded.curso_usado,
				visibilidad = excluded.visibilidad,
				estado = excluded.estado,
				datos_personales = excluded.datos_personales,
				creado_con_ia = excluded.creado_con_ia,
				fuera_del_banco = excluded.fuera_del_banco,
				pendiente_clasificar = excluded.pendiente_clasificar,
				notas_internas = excluded.notas_internas;

			-- tags: fusión por slug (Adviento = adviento = Advent no, pero sí variantes de acento/caja)
			delete from recursos.recurso_tag rt where rt.recurso_id = rid;
			for nombre_autor in select unnest(recursos._csv_a_array(fila ->> 'tags')) loop
				insert into recursos.tag (nombre, slug)
					values (nombre_autor, recursos.slugify(nombre_autor))
					on conflict (slug) do nothing;
				select t.id into tid from recursos.tag t where t.slug = recursos.slugify(nombre_autor);
				insert into recursos.recurso_tag (recurso_id, tag_id) values (rid, tid)
					on conflict do nothing;
			end loop;

			-- autores: alta por nombre normalizado
			delete from recursos.recurso_autor ra where ra.recurso_id = rid;
			for nombre_autor in select unnest(recursos._csv_a_array(fila ->> 'autores')) loop
				partes := string_to_array(trim(nombre_autor), ' ');
				insert into recursos.autor (nombre, apellidos, slug)
					values (partes[1], coalesce(array_to_string(partes[2:], ' '), ''), recursos.slugify(nombre_autor))
					on conflict (slug) do nothing;
				select a.id into aid from recursos.autor a where a.slug = recursos.slugify(nombre_autor);
				insert into recursos.recurso_autor (recurso_id, autor_id) values (rid, aid)
					on conflict do nothing;
			end loop;

			ids_lote := ids_lote || rid;
			if existia then actualizadas := actualizadas + 1; else creadas := creadas + 1; end if;
		exception when others then
			errores := errores || jsonb_build_object('fila', indice, 'id', fila ->> 'id', 'error', sqlerrm);
		end;
	end loop;

	-- segunda pasada: relacionados (los destinos ya existen)
	indice := 0;
	for fila in select * from jsonb_array_elements(filas) loop
		indice := indice + 1;
		rid := coalesce(nullif(trim(fila ->> 'id'), ''),
			(select x ->> 'id' from jsonb_array_elements(ids_asignados) x where (x ->> 'fila')::int = indice));
		continue when rid is null or not (rid = any (ids_lote));
		delete from recursos.recurso_relacion rr where rr.recurso_id = rid;
		for rel in select unnest(recursos._csv_a_array(fila ->> 'relacionados')) loop
			if exists (select 1 from recursos.recurso r where r.id = rel) and rel <> rid then
				insert into recursos.recurso_relacion (recurso_id, relacionado_id)
					values (rid, rel) on conflict do nothing;
			end if;
		end loop;
	end loop;

	if retirar_ausentes and array_length(ids_lote, 1) > 0 then
		update recursos.recurso r
			set estado = 'retirado'
			where not (r.id = any (ids_lote)) and r.estado <> 'retirado';
		get diagnostics retiradas = row_count;
	end if;

	update recursos.sync_config set ultima_sync = now() where id = 1;
	insert into recursos.sync_log (procesadas, creadas, actualizadas, retiradas, errores)
		values (indice, creadas, actualizadas, retiradas, errores);

	return jsonb_build_object(
		'procesadas', indice,
		'creadas', creadas,
		'actualizadas', actualizadas,
		'retiradas', retiradas,
		'ids_asignados', ids_asignados,
		'errores', errores
	);
end;
$$;

grant execute on function recursos.sync_filas(jsonb, text, boolean) to anon, authenticated;
