-- SPEC-011 · Archivos y formatos de un recurso + envío sin cuenta + borrado seguro
--
-- Tres bloques independientes que comparten migración:
--   1. `recurso_archivo`: un recurso puede ofrecerse en varios formatos (Docs + PDF + Word…).
--      `recurso.enlace` sigue siendo el principal (es lo que sincroniza el Sheet); esta tabla
--      guarda los alternativos. `formato` cachea la detección (por URL o consulta a Drive).
--   2. Envío de recursos sin estar registrado: `envio.perfil_id` pasa a ser opcional y aparece
--      `anon_id` (uuid del dispositivo, mismo patrón que la valoración anónima de 00008).
--   3. Borrado de recursos desde el panel: `envio.recurso_id` deja de bloquearlo.

-- ---------------------------------------------------------------------------
-- 1. Formatos y archivos alternativos
-- ---------------------------------------------------------------------------

alter table recursos.recurso add column if not exists formato text;

comment on column recursos.recurso.formato is
	'Formato detectado del enlace principal (clave de app: google-doc, pdf, drive-carpeta…). '
	'Se recalcula al cambiar el enlace; null = pendiente de detectar.';

create table if not exists recursos.recurso_archivo (
	id uuid primary key default gen_random_uuid(),
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	enlace text not null,
	etiqueta text,
	formato text,
	orden int not null default 0,
	created_at timestamptz not null default now(),
	unique (recurso_id, enlace)
);

create index if not exists recurso_archivo_recurso_idx on recursos.recurso_archivo (recurso_id, orden);

alter table recursos.recurso_archivo enable row level security;

create policy "lectura via recurso" on recursos.recurso_archivo for select
	using (exists (select 1 from recursos.recurso r where r.id = recurso_id));

create policy "escribe catalogador" on recursos.recurso_archivo for all
	using (recursos.puede_catalogar()) with check (recursos.puede_catalogar());

-- Si cambia el enlace, la caché de formato deja de valer… salvo que quien actualiza ya haya
-- detectado el formato nuevo y lo mande en el mismo UPDATE.
create or replace function recursos.invalidar_formato()
returns trigger language plpgsql as $$
begin
	if new.enlace is distinct from old.enlace and new.formato is not distinct from old.formato then
		new.formato = null;
	end if;
	return new;
end;
$$;

drop trigger if exists recurso_invalidar_formato on recursos.recurso;
create trigger recurso_invalidar_formato
	before update on recursos.recurso
	for each row execute function recursos.invalidar_formato();

drop trigger if exists recurso_archivo_invalidar_formato on recursos.recurso_archivo;
create trigger recurso_archivo_invalidar_formato
	before update on recursos.recurso_archivo
	for each row execute function recursos.invalidar_formato();

-- ---------------------------------------------------------------------------
-- 2. Envío sin cuenta
-- ---------------------------------------------------------------------------

alter table recursos.envio alter column perfil_id drop not null;
alter table recursos.envio add column if not exists anon_id uuid;
alter table recursos.envio add column if not exists nombre_contacto text;
alter table recursos.envio add column if not exists email_contacto text;
alter table recursos.envio add column if not exists clasificacion jsonb not null default '{}';

do $$
begin
	if not exists (select 1 from pg_constraint where conname = 'envio_autoria') then
		alter table recursos.envio add constraint envio_autoria
			check (perfil_id is not null or anon_id is not null);
	end if;
end $$;

create index if not exists envio_anon_idx on recursos.envio (anon_id) where anon_id is not null;

comment on column recursos.envio.clasificacion is
	'Clasificación opcional que aporta quien envía (tipo, etapas, edades, tags, idioma). '
	'Solo es una pista para el equipo editor: se revisa antes de publicar.';

-- Los revisores ya ven todos los envíos; sin `perfil_id` la política del dueño simplemente
-- no casa (null = auth.uid() es null → false), así que los anónimos solo se leen por RPC.

/**
 * Alta de un envío desde el formulario público. Sirve con y sin sesión:
 *   - con sesión → queda atado al perfil (como hasta ahora);
 *   - sin sesión → queda atado al uuid del dispositivo (localStorage), y opcionalmente a un
 *     email de contacto para poder avisar de la publicación o la devolución.
 * Fuerza `estado = 'enviado'` y limita el ritmo para que el formulario abierto no sea un grifo
 * de spam.
 */
create or replace function recursos.crear_envio(
	titulo_in text,
	enlace_in text default null,
	notas_in text default null,
	dispositivo uuid default null,
	nombre_contacto_in text default null,
	email_contacto_in text default null,
	clasificacion_in jsonb default '{}'::jsonb,
	mcm_local_in uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
	uid uuid := auth.uid();
	nuevo uuid;
	recientes int;
begin
	titulo_in := nullif(trim(titulo_in), '');
	enlace_in := nullif(trim(enlace_in), '');

	if titulo_in is null and enlace_in is null then
		raise exception 'hace falta al menos un título o un enlace';
	end if;
	if titulo_in is null then
		titulo_in := 'Recurso sin título';
	end if;
	if length(titulo_in) > 300 then
		raise exception 'el título es demasiado largo';
	end if;
	if uid is null and dispositivo is null then
		raise exception 'falta identificar el dispositivo';
	end if;

	-- freno de spam: 30 envíos por hora y remitente
	select count(*) into recientes
		from recursos.envio e
		where e.created_at > now() - interval '1 hour'
			and (
				(uid is not null and e.perfil_id = uid)
				or (uid is null and e.anon_id = dispositivo)
			);
	if recientes >= 30 then
		raise exception 'demasiados envíos seguidos: prueba de nuevo dentro de un rato';
	end if;

	insert into recursos.envio (
		perfil_id, anon_id, mcm_local_id, titulo, enlace, notas,
		nombre_contacto, email_contacto, clasificacion, estado
	) values (
		uid,
		case when uid is null then dispositivo end,
		coalesce(mcm_local_in, case when uid is not null then recursos.mi_mcm_local() end),
		titulo_in,
		enlace_in,
		nullif(trim(notas_in), ''),
		nullif(trim(nombre_contacto_in), ''),
		nullif(trim(email_contacto_in), ''),
		coalesce(clasificacion_in, '{}'::jsonb),
		'enviado'
	)
	returning id into nuevo;

	return nuevo;
end;
$$;

grant execute on function recursos.crear_envio(text, text, text, uuid, text, text, jsonb, uuid)
	to anon, authenticated;

/** Envíos hechos desde este dispositivo sin cuenta (para la página «Mis envíos»). */
create or replace function recursos.mis_envios_anon(dispositivo uuid)
returns table (
	id uuid,
	titulo text,
	enlace text,
	notas text,
	estado text,
	motivo_devolucion text,
	recurso_id text,
	created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
	select e.id, e.titulo, e.enlace, e.notas, e.estado, e.motivo_devolucion, e.recurso_id, e.created_at
	from recursos.envio e
	where e.anon_id = dispositivo and e.perfil_id is null
	order by e.created_at desc;
$$;
grant execute on function recursos.mis_envios_anon(uuid) to anon, authenticated;

/** Corregir y reenviar un envío anónimo devuelto, desde el mismo dispositivo. */
create or replace function recursos.reenviar_envio_anon(
	envio_id uuid,
	dispositivo uuid,
	titulo_in text,
	enlace_in text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
	update recursos.envio e
		set titulo = coalesce(nullif(trim(titulo_in), ''), e.titulo),
			enlace = nullif(trim(enlace_in), ''),
			estado = 'enviado',
			motivo_devolucion = null
		where e.id = envio_id
			and e.anon_id = dispositivo
			and e.perfil_id is null
			and e.estado in ('enviado', 'devuelto');
	if not found then
		raise exception 'ese envío no se puede reenviar desde este dispositivo';
	end if;
end;
$$;
grant execute on function recursos.reenviar_envio_anon(uuid, uuid, text, text) to anon, authenticated;

/** Al iniciar sesión, los envíos hechos sin cuenta en este dispositivo pasan a la cuenta. */
create or replace function recursos.reclamar_envios(dispositivo uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
	if auth.uid() is null then
		raise exception 'requiere sesión';
	end if;
	update recursos.envio
		set perfil_id = auth.uid(),
			anon_id = null,
			mcm_local_id = coalesce(mcm_local_id, recursos.mi_mcm_local())
		where anon_id = dispositivo and perfil_id is null;
	get diagnostics n = row_count;
	return n;
end;
$$;
grant execute on function recursos.reclamar_envios(uuid) to authenticated;

-- El aviso por email al remitente vale también para los anónimos que dejaron correo.
create or replace function recursos.email_remitente(envio_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
	select coalesce(p.email, e.email_contacto)
	from recursos.envio e
	left join recursos.perfil p on p.id = e.perfil_id
	where e.id = envio_id and recursos.es_revisor_de(e.mcm_local_id);
$$;

-- ---------------------------------------------------------------------------
-- 3. Borrado de recursos desde el panel
-- ---------------------------------------------------------------------------

-- Un envío publicado apuntaba al recurso con FK sin acción: bastaba eso para que el borrado
-- fallase siempre. Se conserva el envío, perdiendo solo el enlace al recurso borrado.
alter table recursos.envio drop constraint if exists envio_recurso_id_fkey;
alter table recursos.envio add constraint envio_recurso_id_fkey
	foreign key (recurso_id) references recursos.recurso (id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4. Vocabularios que faltaban
-- ---------------------------------------------------------------------------

insert into recursos.lista_valor (lista, valor, grupo, orden) values
	('tipo', 'Carpeta de Drive', 'Documentos', 22),
	('soporte', 'Carpeta de Drive', null, 11),
	('soporte', 'Imagen', null, 12),
	('soporte', 'Vídeo', null, 13),
	('soporte', 'Audio', null, 14),
	('soporte', 'Web', null, 15)
on conflict (lista, valor) do nothing;

notify pgrst, 'reload schema';
