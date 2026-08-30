-- 00030 · Lista de espera, sugerencias y recursos de demostración (SPEC-017)
--
-- El banco tiene la maquinaria montada y siete recursos públicos. Quien entra hoy ve una
-- herramienta que funciona sobre un catálogo que aún no existe, y se va sin dejar rastro.
-- Esta migración añade las dos vías para que no se vaya:
--
--   1. `espera`      — deja su correo y le avisamos cuando haya material (waitlist).
--   2. `sugerencia`  — cuenta una idea, un problema o un recurso que echa en falta.
--
-- Las dos comparten forma: **cualquiera puede escribir, nadie puede leer**. Se escriben con
-- funciones `security definer` (como `crear_envio`, migración 00015) porque quien las usa casi
-- nunca tiene sesión, y se leen solo desde el panel. Sin políticas de `insert` directas: si la
-- única puerta es la función, el freno de spam y la validación del correo no se pueden saltar
-- desde el cliente.
--
-- Y una tercera pieza pequeña: `recurso.es_demo`, para que los recursos de muestra se puedan
-- marcar como tales **en un campo**, no en el título. Hasta ahora lo decía el prefijo
-- «[EJEMPLO] » del nombre, que la interfaz recortaba al vuelo (`limpiarNombre`): el dato de
-- «esto es una muestra» viajaba escondido dentro de otro dato, así que no se podía filtrar,
-- ni contar, ni quitar el día que entre material de verdad sin editar once títulos a mano.

-- ---------------------------------------------------------------------------------------------
-- 1 · Marca de recurso de demostración
-- ---------------------------------------------------------------------------------------------

alter table recursos.recurso
	add column if not exists es_demo boolean not null default false;

comment on column recursos.recurso.es_demo is
	'Recurso de muestra para enseñar cómo funciona el banco: se ve, se filtra y se valora como los demás, pero lleva insignia «Demo» y su enlace no apunta a material real.';

create index if not exists recurso_es_demo_idx on recursos.recurso (es_demo) where es_demo;

-- Una versión nueva de un recurso de demostración sigue siendo de demostración: si no se
-- copiara aquí, `crear_version` (00012) la crearía con el `default false` y saldría al catálogo
-- disfrazada de material real.
-- Copia literal de la de 00012 con una línea más: `es_demo`. Todo lo demás (el permiso por MCM
-- local, `extra`, `editado_web_at`, los bloques de itinerario y el enlace en blanco a propósito)
-- se conserva tal cual.
create or replace function recursos.crear_version(origen_id text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  nid text;
  o recursos.recurso;
begin
  select * into o from recursos.recurso where id = origen_id;
  if not found then
    raise exception 'recurso origen % no existe', origen_id;
  end if;

  if not (recursos.es_editor()
          or (recursos.rol_actual() = 'edicion_local'
              and o.mcm_local_id is not distinct from recursos.mi_mcm_local())) then
    raise exception 'sin permiso para versionar este recurso';
  end if;

  nid := recursos.nuevo_id_recurso();

  insert into recursos.recurso (
    id, nombre, descripcion, tipo, etapas, nivel, edades, mcm_local_id, idioma,
    soporte, ubicacion, enlace, imagen, enlace_imagenes, anyo_publicacion, curso_usado,
    visibilidad, estado, datos_personales, creado_con_ia, fuera_del_banco,
    pendiente_clasificar, notas_internas, extra, version_de, editado_web_at, es_demo
  ) values (
    nid, o.nombre, o.descripcion, o.tipo, o.etapas, o.nivel, o.edades, o.mcm_local_id, o.idioma,
    o.soporte, o.ubicacion, null, null, null, o.anyo_publicacion, o.curso_usado,
    o.visibilidad, 'borrador', o.datos_personales, o.creado_con_ia, o.fuera_del_banco,
    o.pendiente_clasificar, o.notas_internas, o.extra, origen_id, now(), o.es_demo
  );

  insert into recursos.recurso_tag (recurso_id, tag_id)
    select nid, tag_id from recursos.recurso_tag where recurso_id = origen_id;
  insert into recursos.recurso_autor (recurso_id, autor_id)
    select nid, autor_id from recursos.recurso_autor where recurso_id = origen_id;
  insert into recursos.recurso_bloque (recurso_id, bloque_id)
    select nid, bloque_id from recursos.recurso_bloque where recurso_id = origen_id;

  return nid;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2 · `espera` — la lista de espera
-- ---------------------------------------------------------------------------------------------

create table if not exists recursos.espera (
	id uuid primary key default gen_random_uuid(),
	email text not null,
	nombre text,
	-- «¿Quieres ayudarnos a construir el banco?» — la pregunta del modal. Del mismo correo sale
	-- la conversación, así que no hace falta un segundo formulario.
	quiere_ayudar boolean not null default false,
	-- Cómo quiere ayudar, si lo dijo: aportar | catalogar | probar | difundir. Sin tabla de
	-- vocabulario a propósito: son cuatro etiquetas de una pregunta opcional, no una taxonomía.
	ayudas text[] not null default '{}',
	mensaje text,
	origen text not null default 'modal', -- modal | pagina | otro
	anon_id uuid,
	perfil_id uuid references recursos.perfil (id) on delete set null,
	-- Cuándo se le escribió de verdad. El envío del aviso de lanzamiento se hará por fuera
	-- (exportando los correos), así que esto lo marca una persona desde el panel.
	contactado_at timestamptz,
	notas text,
	created_at timestamptz not null default now(),
	-- Validación de correo deliberadamente laxa: la estricta rechaza direcciones legítimas y
	-- aquí el coste de un correo malo es un aviso que rebota, no un agujero.
	constraint espera_email_valido check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
	constraint espera_origen_valido check (origen in ('modal', 'pagina', 'otro'))
);

comment on table recursos.espera is
	'Lista de espera: quien llegó antes que el contenido y quiere que le avisemos. Se escribe con recursos.apuntarse_espera(); se lee desde /admin/comunidad.';
comment on column recursos.espera.ayudas is
	'Cómo quiere echar una mano: aportar | catalogar | probar | difundir. Vacío si no marcó nada.';
comment on column recursos.espera.contactado_at is
	'Marcado a mano desde el panel cuando ya se le ha escrito. El envío masivo se hace por fuera.';

-- El mismo correo no se apunta dos veces: la segunda vez actualiza lo que trae de nuevo.
create unique index if not exists espera_email_uniq on recursos.espera (lower(email));
create index if not exists espera_created_idx on recursos.espera (created_at desc);
create index if not exists espera_ayudar_idx on recursos.espera (quiere_ayudar) where quiere_ayudar;

alter table recursos.espera enable row level security;

-- Nadie lee la lista salvo el equipo. Un correo ajeno es un dato personal: ni siquiera su
-- dueño lo consulta aquí (no hay pantalla donde hacerlo, y darla abriría un oráculo de
-- «¿está fulano apuntado?»).
drop policy if exists "espera lee equipo" on recursos.espera;
create policy "espera lee equipo" on recursos.espera for select
	using (recursos.rol_actual() in ('editor', 'administrador'));

drop policy if exists "espera actualiza equipo" on recursos.espera;
create policy "espera actualiza equipo" on recursos.espera for update
	using (recursos.rol_actual() in ('editor', 'administrador'))
	with check (recursos.rol_actual() in ('editor', 'administrador'));

drop policy if exists "espera borra admin" on recursos.espera;
create policy "espera borra admin" on recursos.espera for delete
	using (recursos.es_admin());

-- Sin política de insert: se entra por `apuntarse_espera()` y por ningún otro sitio.

-- ---------------------------------------------------------------------------------------------
-- 3 · `sugerencia` — el buzón de propuestas y problemas
-- ---------------------------------------------------------------------------------------------

create table if not exists recursos.sugerencia (
	id uuid primary key default gen_random_uuid(),
	tipo text not null default 'idea', -- idea | problema | falta | otro
	mensaje text not null,
	email text,
	-- Desde qué pantalla se envió. Para un «esto no funciona» es la mitad del parte de avería.
	ruta text,
	estado text not null default 'nueva', -- nueva | vista | resuelta | descartada
	anon_id uuid,
	perfil_id uuid references recursos.perfil (id) on delete set null,
	-- Si se convirtió en tarea del equipo, cuál. Evita apuntarla dos veces.
	tarea_id uuid references recursos.tarea (id) on delete set null,
	notas text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint sugerencia_tipo_valido check (tipo in ('idea', 'problema', 'falta', 'otro')),
	constraint sugerencia_estado_valido check (estado in ('nueva', 'vista', 'resuelta', 'descartada')),
	constraint sugerencia_mensaje_no_vacio check (btrim(mensaje) <> ''),
	constraint sugerencia_email_valido check (
		email is null or email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
	)
);

comment on table recursos.sugerencia is
	'Buzón abierto: ideas, problemas y recursos que se echan en falta. Se escribe con recursos.crear_sugerencia(); se lee desde /admin/comunidad.';
comment on column recursos.sugerencia.tipo is
	'idea = propuesta de mejora · problema = algo roto · falta = recurso que echa en falta · otro.';
comment on column recursos.sugerencia.ruta is
	'Pantalla desde la que se envió, para poder reproducir un «esto no funciona».';

create index if not exists sugerencia_estado_idx on recursos.sugerencia (estado, created_at desc);
create index if not exists sugerencia_created_idx on recursos.sugerencia (created_at desc);

create trigger sugerencia_updated_at
	before update on recursos.sugerencia
	for each row execute function recursos.set_updated_at();

alter table recursos.sugerencia enable row level security;

drop policy if exists "sugerencia lee equipo" on recursos.sugerencia;
create policy "sugerencia lee equipo" on recursos.sugerencia for select
	using (recursos.rol_actual() in ('edicion_local', 'editor', 'administrador'));

drop policy if exists "sugerencia actualiza equipo" on recursos.sugerencia;
create policy "sugerencia actualiza equipo" on recursos.sugerencia for update
	using (recursos.rol_actual() in ('edicion_local', 'editor', 'administrador'))
	with check (recursos.rol_actual() in ('edicion_local', 'editor', 'administrador'));

drop policy if exists "sugerencia borra admin" on recursos.sugerencia;
create policy "sugerencia borra admin" on recursos.sugerencia for delete
	using (recursos.es_admin());

-- ---------------------------------------------------------------------------------------------
-- 4 · Las dos puertas de entrada
-- ---------------------------------------------------------------------------------------------

/**
 * Apuntarse a la lista de espera.
 *
 * Devuelve `{ id, ya_estaba, total }`. `ya_estaba` distingue el alta nueva de la repetida —
 * es la diferencia entre «¡Apuntado!» y «Ya te tenemos», y decir lo segundo cuando toca evita
 * que alguien se pregunte si se ha apuntado dos veces.
 *
 * La repetición NO es un error: actualiza lo que trae de nuevo (nombre, ganas de ayudar) sin
 * borrar lo que ya había. Quien vuelve a apuntarse marcando «quiero ayudar» está diciendo algo
 * nuevo, y contestarle «ya estabas» perdiendo el dato sería lo peor de las dos opciones.
 */
create or replace function recursos.apuntarse_espera(
	email_in text,
	nombre_in text default null,
	quiere_ayudar_in boolean default false,
	ayudas_in text[] default '{}',
	mensaje_in text default null,
	origen_in text default 'modal',
	dispositivo uuid default null
)
returns jsonb
language plpgsql
security definer set search_path = ''
as $$
declare
	uid uuid := auth.uid();
	limpio text;
	fila recursos.espera%rowtype;
	previo uuid;
	recientes int;
	cuantos int;
begin
	limpio := lower(btrim(coalesce(email_in, '')));
	if limpio = '' then
		raise exception 'hace falta un correo';
	end if;
	if length(limpio) > 320 then
		raise exception 'ese correo es demasiado largo';
	end if;
	if limpio !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
		raise exception 'ese correo no parece válido';
	end if;

	-- Freno de spam por dispositivo: 10 altas por hora. Alto a propósito — quien se equivoca de
	-- letra y lo reintenta no puede toparse con un muro, y cada alta cuesta un correo enviado.
	if dispositivo is not null then
		select count(*) into recientes
			from recursos.espera e
			where e.created_at > now() - interval '1 hour' and e.anon_id = dispositivo;
		if recientes >= 10 then
			raise exception 'demasiadas altas seguidas: prueba de nuevo dentro de un rato';
		end if;
	end if;

	select e.id into previo from recursos.espera e where lower(e.email) = limpio;

	insert into recursos.espera as e (
		email, nombre, quiere_ayudar, ayudas, mensaje, origen, anon_id, perfil_id
	) values (
		limpio,
		nullif(btrim(nombre_in), ''),
		coalesce(quiere_ayudar_in, false),
		coalesce(ayudas_in, '{}'),
		nullif(btrim(mensaje_in), ''),
		case when origen_in in ('modal', 'pagina', 'otro') then origen_in else 'otro' end,
		dispositivo,
		uid
	)
	on conflict (lower(email)) do update set
		-- `coalesce` en este orden: lo nuevo si viene, lo de antes si no. Volver a apuntarse
		-- sin escribir el nombre no borra el nombre que dejaste la primera vez.
		nombre = coalesce(nullif(btrim(excluded.nombre), ''), e.nombre),
		quiere_ayudar = e.quiere_ayudar or excluded.quiere_ayudar,
		ayudas = case
			when cardinality(excluded.ayudas) > 0 then excluded.ayudas
			else e.ayudas
		end,
		mensaje = coalesce(nullif(btrim(excluded.mensaje), ''), e.mensaje),
		perfil_id = coalesce(excluded.perfil_id, e.perfil_id)
	returning * into fila;

	select count(*) into cuantos from recursos.espera;

	return jsonb_build_object(
		'id', fila.id,
		'ya_estaba', previo is not null,
		'total', cuantos
	);
end;
$$;

comment on function recursos.apuntarse_espera is
	'Alta en la lista de espera desde el modal de bienvenida o /sugerencias. Repetir el mismo correo actualiza, no duplica.';

/**
 * Dejar una sugerencia. Sin correo obligatorio: pedirlo para reportar que un botón no funciona
 * es el peaje que hace que nadie lo reporte. Quien quiera respuesta, lo deja.
 */
create or replace function recursos.crear_sugerencia(
	mensaje_in text,
	tipo_in text default 'idea',
	email_in text default null,
	ruta_in text default null,
	dispositivo uuid default null
)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
	uid uuid := auth.uid();
	nuevo uuid;
	recientes int;
	correo text;
begin
	mensaje_in := btrim(coalesce(mensaje_in, ''));
	if mensaje_in = '' then
		raise exception 'la sugerencia está vacía';
	end if;
	if length(mensaje_in) > 4000 then
		raise exception 'la sugerencia es demasiado larga';
	end if;

	correo := nullif(lower(btrim(coalesce(email_in, ''))), '');
	if correo is not null and correo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
		raise exception 'ese correo no parece válido';
	end if;

	if uid is null and dispositivo is null then
		raise exception 'falta identificar el dispositivo';
	end if;

	-- 15 por hora y remitente: suficiente para quien encuentra cinco cosas rotas seguidas.
	select count(*) into recientes
		from recursos.sugerencia s
		where s.created_at > now() - interval '1 hour'
			and (
				(uid is not null and s.perfil_id = uid)
				or (uid is null and s.anon_id = dispositivo)
			);
	if recientes >= 15 then
		raise exception 'demasiadas sugerencias seguidas: prueba de nuevo dentro de un rato';
	end if;

	insert into recursos.sugerencia (mensaje, tipo, email, ruta, anon_id, perfil_id)
	values (
		mensaje_in,
		case when tipo_in in ('idea', 'problema', 'falta', 'otro') then tipo_in else 'otro' end,
		correo,
		left(nullif(btrim(coalesce(ruta_in, '')), ''), 300),
		dispositivo,
		uid
	)
	returning id into nuevo;

	return nuevo;
end;
$$;

comment on function recursos.crear_sugerencia is
	'Entrada del buzón de sugerencias, con o sin sesión. El correo es opcional: pedirlo espantaría los avisos de averías.';

/**
 * Cuánta gente espera ya. Público a propósito y sin nada más: devuelve un número, nunca una
 * dirección. Es la prueba social del modal («ya somos 34»), y la interfaz decide si enseñarla
 * — con cuatro personas apuntadas, el número resta en vez de sumar.
 */
create or replace function recursos.cuenta_espera()
returns int
language sql
stable
security definer set search_path = ''
as $$
	select count(*)::int from recursos.espera;
$$;

/**
 * Convertir una sugerencia en tarea del equipo. Lo que hoy se hace copiando el texto a mano al
 * buzón de avisos (SPEC-016), en un clic y dejando el vínculo puesto en los dos sentidos.
 */
create or replace function recursos.sugerencia_a_tarea(sugerencia_id uuid)
returns uuid
language plpgsql
security definer set search_path = ''
as $$
declare
	s recursos.sugerencia%rowtype;
	nueva uuid;
	etiqueta text;
begin
	if recursos.rol_actual() not in ('edicion_local', 'editor', 'administrador') then
		raise exception 'no tienes permiso';
	end if;

	select * into s from recursos.sugerencia where id = sugerencia_id;
	if not found then
		raise exception 'esa sugerencia no existe';
	end if;
	if s.tarea_id is not null then
		return s.tarea_id;
	end if;

	etiqueta := case s.tipo
		when 'problema' then 'Problema'
		when 'falta' then 'Falta un recurso'
		when 'idea' then 'Idea'
		else 'Sugerencia'
	end;

	insert into recursos.tarea (titulo, detalle, origen, prioridad, creada_por)
	values (
		etiqueta || ': ' || left(regexp_replace(s.mensaje, '\s+', ' ', 'g'), 90),
		s.mensaje
			|| case when s.ruta is not null then E'\n\nDesde: ' || s.ruta else '' end
			|| case when s.email is not null then E'\nContacto: ' || s.email else '' end,
		'manual',
		case when s.tipo = 'problema' then 'alta' else 'normal' end,
		auth.uid()
	)
	returning id into nueva;

	update recursos.sugerencia
		set tarea_id = nueva, estado = case when estado = 'nueva' then 'vista' else estado end
		where id = sugerencia_id;

	return nueva;
end;
$$;

-- `cuenta_espera` la llama cualquiera; las otras tres, cualquiera que llegue a la pantalla
-- (el permiso real lo pone el propio cuerpo de la función).
grant execute on function recursos.apuntarse_espera(text, text, boolean, text[], text, text, uuid)
	to anon, authenticated;
grant execute on function recursos.crear_sugerencia(text, text, text, text, uuid) to anon, authenticated;
grant execute on function recursos.cuenta_espera() to anon, authenticated;
grant execute on function recursos.sugerencia_a_tarea(uuid) to authenticated;

notify pgrst, 'reload schema';
