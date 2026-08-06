-- 00019 · Detección de duplicados
--
-- El error más fácil de cometer en un banco de enlaces: el mismo material entra dos veces, una por
-- el Sheet y otra por un envío, con el nombre escrito de otra forma. Aquí van las piezas para
-- avisarlo ANTES de crear el recurso: dos normalizadores y una función de búsqueda.

create extension if not exists pg_trgm schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Enlace normalizado: lo que hace que dos enlaces sean «el mismo».
--
-- Los enlaces de Google llegan de mil formas para el mismo archivo — /edit, /view, /preview,
-- ?usp=sharing, ?usp=drive_link, con y sin barra final. Lo único que identifica el archivo es su
-- id, así que para comparar se reduce todo a `drive:<id>`. Con YouTube, igual: `youtube:<id>`.
-- Para el resto de webs, host + ruta en minúsculas y sin la cola de parámetros de campaña.
--
-- IMMUTABLE a propósito: hace falta para poder indexar la expresión.
-- ---------------------------------------------------------------------------------------------
create or replace function recursos.normalizar_enlace(enlace text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
	limpio text;
	id_archivo text;
begin
	if enlace is null or btrim(enlace) = '' then
		return null;
	end if;

	limpio := btrim(enlace);

	-- id de Drive / Docs / Sheets / Slides / Forms, en sus dos formas habituales
	id_archivo := (regexp_match(limpio, '/(?:d|folders|e)/([a-zA-Z0-9_-]{10,})'))[1];
	if id_archivo is null then
		id_archivo := (regexp_match(limpio, '[?&]id=([a-zA-Z0-9_-]{10,})'))[1];
	end if;
	if id_archivo is not null and limpio ~* '(google\.com|googleusercontent\.com)' then
		return 'drive:' || id_archivo;
	end if;

	-- vídeos de YouTube: watch?v=, youtu.be/ y /embed/
	id_archivo := (regexp_match(limpio, '(?:youtube\.com/(?:watch\?(?:.*&)?v=|embed/|shorts/)|youtu\.be/)([a-zA-Z0-9_-]{6,})'))[1];
	if id_archivo is not null then
		return 'youtube:' || id_archivo;
	end if;

	-- resto: protocolo y www fuera, minúsculas, sin parámetros ni barra final
	limpio := lower(limpio);
	limpio := regexp_replace(limpio, '^https?://', '');
	limpio := regexp_replace(limpio, '^www\.', '');
	limpio := split_part(limpio, '#', 1);
	limpio := split_part(limpio, '?', 1);
	limpio := regexp_replace(limpio, '/+$', '');
	return limpio;
end;
$$;

comment on function recursos.normalizar_enlace(text) is
	'Forma canónica de un enlace para comparar duplicados: drive:<id>, youtube:<id> o host+ruta.';

create index if not exists recurso_enlace_normalizado_idx
	on recursos.recurso (recursos.normalizar_enlace(enlace))
	where enlace is not null;

-- ---------------------------------------------------------------------------------------------
-- Firma del nombre: para que «Oración de la mañana», «ORACION DE LA MAÑANA» y
-- «[EJEMPLO] Oración de la mañana!!» se reconozcan como el mismo título.
--
-- Se usa `translate` en vez de `unaccent()` porque unaccent depende de un diccionario y no es
-- IMMUTABLE, y esto tiene que poder indexarse y compararse sin sorpresas.
-- ---------------------------------------------------------------------------------------------
create or replace function recursos.firma_nombre(nombre text)
returns text
language sql
immutable
set search_path = ''
as $$
	select btrim(regexp_replace(
		regexp_replace(
			translate(
				lower(regexp_replace(coalesce(nombre, ''), '^\s*\[ejemplo\]\s*', '', 'i')),
				'áàäâãéèëêíìïîóòöôõúùüûñç',
				'aaaaaeeeeiiiiooooouuuunc'
			),
			'[^a-z0-9áéíóúñ ]+', ' ', 'g'
		),
		'\s+', ' ', 'g'
	));
$$;

comment on function recursos.firma_nombre(text) is
	'Nombre reducido a lo comparable: sin acentos, sin puntuación, sin el prefijo [EJEMPLO].';

-- ---------------------------------------------------------------------------------------------
-- Búsqueda de posibles duplicados.
--
-- `security invoker` a propósito: cada quien encuentra lo que su RLS le deja ver. Quien envía un
-- recurso sin cuenta solo choca con recursos publicados —no se enteran de los borradores de nadie—
-- y un catalogador ve también lo que está sin publicar, que es justo cuando importa.
--
-- Motivos, de más fuerte a más débil:
--   'enlace'  → apunta exactamente al mismo archivo. Es un duplicado casi seguro.
--   'nombre'  → mismo título una vez normalizado.
--   'parecido'→ títulos parecidos (trigramas). Es un aviso, no una acusación.
-- ---------------------------------------------------------------------------------------------
create or replace function recursos.buscar_duplicados(
	enlace_in text default null,
	titulo_in text default null,
	excluir_id text default null,
	umbral real default 0.55
)
returns table (id text, nombre text, estado text, motivo text, parecido real)
language sql
stable
security invoker
set search_path = ''
as $$
	with candidato as (
		select
			recursos.normalizar_enlace(enlace_in) as enlace_norm,
			recursos.firma_nombre(titulo_in) as nombre_norm
	)
	select r.id, r.nombre, r.estado,
		case
			when c.enlace_norm is not null
				and recursos.normalizar_enlace(r.enlace) = c.enlace_norm then 'enlace'
			when c.nombre_norm <> '' and recursos.firma_nombre(r.nombre) = c.nombre_norm then 'nombre'
			else 'parecido'
		end as motivo,
		case
			when c.nombre_norm = '' then 0::real
			else extensions.similarity(recursos.firma_nombre(r.nombre), c.nombre_norm)
		end as parecido
	from recursos.recurso r, candidato c
	where (excluir_id is null or r.id <> excluir_id)
		and (
			(c.enlace_norm is not null and recursos.normalizar_enlace(r.enlace) = c.enlace_norm)
			or (c.nombre_norm <> '' and recursos.firma_nombre(r.nombre) = c.nombre_norm)
			or (
				c.nombre_norm <> ''
				and length(c.nombre_norm) >= 6
				and extensions.similarity(recursos.firma_nombre(r.nombre), c.nombre_norm) >= umbral
			)
		)
	order by (case
			when c.enlace_norm is not null
				and recursos.normalizar_enlace(r.enlace) = c.enlace_norm then 0
			when c.nombre_norm <> '' and recursos.firma_nombre(r.nombre) = c.nombre_norm then 1
			else 2
		end),
		parecido desc
	limit 6;
$$;

comment on function recursos.buscar_duplicados(text, text, text, real) is
	'Posibles duplicados de un enlace o un título: mismo archivo, mismo nombre o nombre parecido.';

grant execute on function recursos.buscar_duplicados(text, text, text, real) to anon, authenticated;
grant execute on function recursos.normalizar_enlace(text) to anon, authenticated;
grant execute on function recursos.firma_nombre(text) to anon, authenticated;

notify pgrst, 'reload schema';
