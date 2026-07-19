-- SPEC-008 §6 · Envíos, conflictos web/Sheet y perfil.activo
-- APLICADA el 2026-07-19 como "recursos_envios_conflictos".

alter table recursos.recurso add column editado_web_at timestamptz;
alter table recursos.perfil add column activo boolean not null default true;

create table recursos.envio (
	id uuid primary key default gen_random_uuid(),
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	mcm_local_id uuid references recursos.mcm_local (id),
	titulo text not null,
	enlace text,
	archivo_storage text,
	notas text,
	estado text not null default 'enviado', -- enviado | en_revision | publicado | devuelto | descartado
	motivo_ia text,
	motivo_devolucion text,
	recurso_id text references recursos.recurso (id),
	revisado_por uuid references recursos.perfil (id),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger envio_updated_at
	before update on recursos.envio
	for each row execute function recursos.set_updated_at();

create index envio_estado_idx on recursos.envio (estado, created_at);

alter table recursos.envio enable row level security;

create or replace function recursos.es_revisor_de(mcm uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
	select recursos.es_editor()
		or (recursos.rol_actual() = 'edicion_local'
			and mcm is not distinct from recursos.mi_mcm_local());
$$;

create policy "envio ve dueño o revisor" on recursos.envio for select
	using (perfil_id = auth.uid() or recursos.es_revisor_de(mcm_local_id));

create policy "envio crea el dueño" on recursos.envio for insert
	with check (perfil_id = auth.uid());

-- El dueño puede corregir/reenviar lo devuelto; los revisores gestionan el resto
create policy "envio actualiza dueño en devuelto" on recursos.envio for update
	using (perfil_id = auth.uid() and estado in ('enviado', 'devuelto'))
	with check (perfil_id = auth.uid());

create policy "envio actualiza revisor" on recursos.envio for update
	using (recursos.es_revisor_de(mcm_local_id))
	with check (recursos.es_revisor_de(mcm_local_id));

-- Marca de edición web (la ponen los formularios del panel al guardar)
create or replace function recursos.marcar_edicion_web()
returns trigger language plpgsql as $$
begin
	-- solo cuando el cambio viene de la web (updates vía RLS de usuario);
	-- sync_filas (security definer) la salta poniendo la variable local
	if coalesce(current_setting('recursos.en_sync', true), '') <> '1' then
		new.editado_web_at = now();
	end if;
	return new;
end;
$$;

create trigger recurso_edicion_web
	before insert or update on recursos.recurso
	for each row execute function recursos.marcar_edicion_web();

-- Retirada segura: nunca retira recursos tocados desde la web tras la última sync
create or replace function recursos._sync_retirar(ids_lote text[], corte timestamptz)
returns int
language plpgsql security definer set search_path = ''
as $fn$
declare n int;
begin
	update recursos.recurso r
		set estado = 'retirado'
		where not (r.id = any (ids_lote))
			and r.estado <> 'retirado'
			and (r.editado_web_at is null or r.editado_web_at <= coalesce(corte, '-infinity'::timestamptz));
	get diagnostics n = row_count;
	return n;
end;
$fn$;

-- sync_filas v2: detecta conflictos (recurso editado en web tras la última sync)
-- y no lo pisa; lo devuelve en `conflictos`. Resolver a favor del Sheet =
-- limpiar editado_web_at y volver a sincronizar.
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
	editado timestamptz;
	corte timestamptz;
	nombre_autor text;
	partes text[];
	aid uuid;
	tid uuid;
	rel text;
	ids_lote text[] := '{}';
	ids_asignados jsonb := '[]';
	conflictos jsonb := '[]';
	errores jsonb := '[]';
	creadas int := 0;
	actualizadas int := 0;
	retiradas int := 0;
begin
	if not exists (select 1 from recursos.sync_config c where c.clave = clave_in) then
		raise exception 'clave de sincronización incorrecta';
	end if;

	perform set_config('recursos.en_sync', '1', true);
	select ultima_sync into corte from recursos.sync_config where id = 1;

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

			-- conflicto: editado en web después de la última sync → la fila no se aplica
			select r.editado_web_at into editado from recursos.recurso r where r.id = rid;
			if editado is not null and editado > coalesce(corte, '-infinity'::timestamptz) then
				conflictos := conflictos || jsonb_build_object('fila', indice, 'id', rid,
					'editado_web', editado);
				ids_lote := ids_lote || rid; -- sigue presente: no se retira
				continue;
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

			delete from recursos.recurso_tag rt where rt.recurso_id = rid;
			for nombre_autor in select unnest(recursos._csv_a_array(fila ->> 'tags')) loop
				insert into recursos.tag (nombre, slug)
					values (nombre_autor, recursos.slugify(nombre_autor))
					on conflict (slug) do nothing;
				select t.id into tid from recursos.tag t where t.slug = recursos.slugify(nombre_autor);
				insert into recursos.recurso_tag (recurso_id, tag_id) values (rid, tid)
					on conflict do nothing;
			end loop;

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

	indice := 0;
	for fila in select * from jsonb_array_elements(filas) loop
		indice := indice + 1;
		rid := coalesce(nullif(trim(fila ->> 'id'), ''),
			(select x ->> 'id' from jsonb_array_elements(ids_asignados) x where (x ->> 'fila')::int = indice));
		continue when rid is null or not (rid = any (ids_lote));
		continue when exists (select 1 from jsonb_array_elements(conflictos) c where c ->> 'id' = rid);
		delete from recursos.recurso_relacion rr where rr.recurso_id = rid;
		for rel in select unnest(recursos._csv_a_array(fila ->> 'relacionados')) loop
			if exists (select 1 from recursos.recurso r where r.id = rel) and rel <> rid then
				insert into recursos.recurso_relacion (recurso_id, relacionado_id)
					values (rid, rel) on conflict do nothing;
			end if;
		end loop;
	end loop;

	if retirar_ausentes and array_length(ids_lote, 1) > 0 then
		retiradas := recursos._sync_retirar(ids_lote, corte);
	end if;

	update recursos.sync_config set ultima_sync = now() where id = 1;
	insert into recursos.sync_log (procesadas, creadas, actualizadas, retiradas, errores)
		values (indice, creadas, actualizadas, retiradas,
			errores || jsonb_build_object('conflictos', conflictos));

	return jsonb_build_object(
		'procesadas', indice,
		'creadas', creadas,
		'actualizadas', actualizadas,
		'retiradas', retiradas,
		'ids_asignados', ids_asignados,
		'conflictos', conflictos,
		'errores', errores
	);
end;
$$;

-- (aplicado como migración aparte "recursos_email_remitente")
-- Email del remitente de un envío, solo para quien puede revisarlo (para notificar)
create or replace function recursos.email_remitente(envio_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
	select p.email
	from recursos.envio e
	join recursos.perfil p on p.id = e.perfil_id
	where e.id = envio_id and recursos.es_revisor_de(e.mcm_local_id);
$$;
grant execute on function recursos.email_remitente(uuid) to authenticated;

-- (aplicado como migración aparte "recursos_permisos_edicion_local")
create policy "recurso insert edicion_local su mcm" on recursos.recurso for insert
	with check (
		recursos.rol_actual() = 'edicion_local'
		and mcm_local_id is not distinct from recursos.mi_mcm_local()
	);

create or replace function recursos.puede_catalogar()
returns boolean language sql stable security definer set search_path = ''
as $$
	select coalesce(recursos.rol_actual() in ('edicion_local', 'editor', 'administrador'), false);
$$;

drop policy "escribe editor" on recursos.tag;
create policy "escribe catalogador" on recursos.tag for all
	using (recursos.puede_catalogar()) with check (recursos.puede_catalogar());
drop policy "escribe editor" on recursos.recurso_tag;
create policy "escribe catalogador" on recursos.recurso_tag for all
	using (recursos.puede_catalogar()) with check (recursos.puede_catalogar());
drop policy "escribe editor" on recursos.autor;
create policy "escribe catalogador" on recursos.autor for all
	using (recursos.puede_catalogar()) with check (recursos.puede_catalogar());
drop policy "escribe editor" on recursos.recurso_autor;
create policy "escribe catalogador" on recursos.recurso_autor for all
	using (recursos.puede_catalogar()) with check (recursos.puede_catalogar());
