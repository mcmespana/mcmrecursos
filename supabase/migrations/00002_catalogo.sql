-- SPEC-002 · Catálogo: recurso, vocabularios, itinerarios, facetas y listas
-- APLICADA el 2026-07-19 como "recursos_catalogo" (esquema `recursos`, ver AD-6).

-- Helpers de rol adicionales
create or replace function recursos.es_editor()
returns boolean
language sql stable security definer set search_path = ''
as $$
	select coalesce(recursos.rol_actual() in ('editor', 'administrador'), false);
$$;

create or replace function recursos.mi_mcm_local()
returns uuid
language sql stable security definer set search_path = ''
as $$
	select mcm_local_id from recursos.perfil where id = auth.uid();
$$;

create or replace function recursos.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

-- Listas cerradas editables (selects del front, validación del sync, dropdowns del Sheet)
create table recursos.lista_valor (
	id uuid primary key default gen_random_uuid(),
	lista text not null,
	valor text not null,
	grupo text,
	orden int not null default 0,
	activo boolean not null default true,
	unique (lista, valor)
);

insert into recursos.lista_valor (lista, valor, grupo, orden) values
	('tipo', 'Sesión de grupo', 'Sesiones y formación', 1),
	('tipo', 'Itinerario de sesiones', 'Sesiones y formación', 2),
	('tipo', 'Formación de monitores', 'Sesiones y formación', 3),
	('tipo', 'Taller', 'Sesiones y formación', 4),
	('tipo', 'Guía', 'Sesiones y formación', 5),
	('tipo', 'Campamento', 'Actividades', 6),
	('tipo', 'Acampada', 'Actividades', 7),
	('tipo', 'Actividad de voluntariado', 'Actividades', 8),
	('tipo', 'Conclusiones de actividad', 'Actividades', 9),
	('tipo', 'Oración', 'Celebración y oración', 10),
	('tipo', 'Canción', 'Celebración y oración', 11),
	('tipo', 'Vídeo', 'Audiovisual y gráfico', 12),
	('tipo', 'Película', 'Audiovisual y gráfico', 13),
	('tipo', 'Imagen', 'Audiovisual y gráfico', 14),
	('tipo', 'Dibujo', 'Audiovisual y gráfico', 15),
	('tipo', 'Diseño', 'Audiovisual y gráfico', 16),
	('tipo', 'Presentación', 'Audiovisual y gráfico', 17),
	('tipo', 'Libro', 'Documentos', 18),
	('tipo', 'Documento MCM', 'Documentos', 19),
	('tipo', 'Web', 'Documentos', 20),
	('tipo', 'Recurso general', 'Documentos', 21),
	('etapas', 'MIC', null, 1),
	('etapas', 'COM', null, 2),
	('etapas', 'LC', null, 3),
	('etapas', 'Monitores', null, 4),
	('nivel', 'MIC', null, 1),
	('nivel', 'Conocimiento', null, 2),
	('nivel', 'Incorporación', null, 3),
	('nivel', 'Crecimiento', null, 4),
	('nivel', 'Opción responsable', null, 5),
	('nivel', 'Laicos', null, 6),
	('edades', '3º EP', 'Primaria', 1),
	('edades', '4º EP', 'Primaria', 2),
	('edades', '5º EP', 'Primaria', 3),
	('edades', '6º EP', 'Primaria', 4),
	('edades', '1º ESO', 'Secundaria', 5),
	('edades', '2º ESO', 'Secundaria', 6),
	('edades', '3º ESO', 'Secundaria', 7),
	('edades', '4º ESO', 'Secundaria', 8),
	('edades', 'Bachillerato', 'Jóvenes', 9),
	('edades', 'Universitarios', 'Jóvenes', 10),
	('edades', 'Jóvenes adultos (<30)', 'Jóvenes', 11),
	('edades', 'Adultos jóvenes (+30)', 'Adultos', 12),
	('edades', 'Adultos', 'Adultos', 13),
	('edades', 'Personas mayores', 'Adultos', 14),
	('idioma', 'Castellano', null, 1),
	('idioma', 'Catalán', null, 2),
	('idioma', 'Portugués', null, 3),
	('idioma', 'Inglés', null, 4),
	('idioma', 'Otros', null, 5),
	('idioma', 'N/A', null, 6),
	('soporte', 'PDF', null, 1),
	('soporte', 'Word', null, 2),
	('soporte', 'Docs', null, 3),
	('soporte', 'Formulario', null, 4),
	('soporte', 'Genially', null, 5),
	('soporte', 'Canva', null, 6),
	('soporte', 'PPT', null, 7),
	('soporte', 'Hoja de cálculo', null, 8),
	('soporte', 'YouTube', null, 9),
	('soporte', 'Archivo', null, 10),
	('ubicacion', 'Drive', null, 1),
	('ubicacion', 'Servidor propio', null, 2),
	('ubicacion', 'Servidor externo', null, 3),
	('ubicacion', 'YouTube', null, 4),
	('estado', 'borrador', null, 1),
	('estado', 'subido_usuario', null, 2),
	('estado', 'pendiente_revision', null, 3),
	('estado', 'revisar_ia', null, 4),
	('estado', 'publicado', null, 5),
	('estado', 'retirado', null, 6),
	('visibilidad', 'publico', null, 1),
	('visibilidad', 'privado', null, 2);

-- Tabla central del catálogo
create table recursos.recurso (
	id text primary key,
	nombre text not null,
	descripcion text,
	tipo text,
	etapas text[] not null default '{}',
	nivel text,
	edades text[] not null default '{}',
	mcm_local_id uuid references recursos.mcm_local (id),
	idioma text,
	soporte text,
	ubicacion text,
	enlace text,
	imagen text,
	enlace_imagenes text,
	anyo_publicacion int,
	curso_usado text,
	visibilidad text not null default 'publico',
	estado text not null default 'borrador',
	datos_personales boolean not null default false,
	creado_con_ia boolean not null default false,
	notas_internas text,
	extra jsonb not null default '{}',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create trigger recurso_updated_at
	before update on recursos.recurso
	for each row execute function recursos.set_updated_at();

-- Tags con slug normalizado (fusiona Adviento/adviento/Advent)
create table recursos.tag (
	id uuid primary key default gen_random_uuid(),
	nombre text not null,
	slug text not null unique,
	created_at timestamptz not null default now()
);

create table recursos.recurso_tag (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	tag_id uuid not null references recursos.tag (id) on delete cascade,
	primary key (recurso_id, tag_id)
);

-- Autores con nombre propio
create table recursos.autor (
	id uuid primary key default gen_random_uuid(),
	nombre text not null,
	apellidos text not null default '',
	slug text not null unique,
	mcm_local_id uuid references recursos.mcm_local (id),
	perfil_id uuid references recursos.perfil (id),
	created_at timestamptz not null default now()
);

create table recursos.recurso_autor (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	autor_id uuid not null references recursos.autor (id) on delete cascade,
	primary key (recurso_id, autor_id)
);

-- Itinerarios formativos (estructura lista; contenido se definirá más adelante)
create table recursos.itinerario (
	id uuid primary key default gen_random_uuid(),
	etapa text not null,
	nombre text not null,
	descripcion text,
	orden int not null default 0
);

create table recursos.itinerario_bloque (
	id uuid primary key default gen_random_uuid(),
	itinerario_id uuid not null references recursos.itinerario (id) on delete cascade,
	nombre text not null,
	descripcion text,
	orden int not null default 0
);

create table recursos.recurso_bloque (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	bloque_id uuid not null references recursos.itinerario_bloque (id) on delete cascade,
	primary key (recurso_id, bloque_id)
);

-- Recursos relacionados (manual, simétrico a nivel de app)
create table recursos.recurso_relacion (
	recurso_id text not null references recursos.recurso (id) on delete cascade,
	relacionado_id text not null references recursos.recurso (id) on delete cascade,
	primary key (recurso_id, relacionado_id),
	check (recurso_id <> relacionado_id)
);

-- Configuración de facetas de filtro (promocionar columna/extra a filtro sin código)
create table recursos.faceta (
	id uuid primary key default gen_random_uuid(),
	campo text not null unique,
	etiqueta text not null,
	tipo text not null default 'multiselect', -- select | multiselect | boolean | rango
	origen text not null default 'columna',   -- columna | extra | tag | autor | mcm_local
	orden int not null default 0,
	visible boolean not null default true,
	protegida boolean not null default false  -- true = solo visible con login
);

insert into recursos.faceta (campo, etiqueta, tipo, origen, orden) values
	('tipo', 'Tipo', 'multiselect', 'columna', 1),
	('etapas', 'Etapa', 'multiselect', 'columna', 2),
	('edades', 'Edades', 'multiselect', 'columna', 3),
	('tags', 'Temática', 'multiselect', 'tag', 4),
	('nivel', 'Nivel', 'multiselect', 'columna', 5),
	('mcm_local', 'MCM Local', 'multiselect', 'mcm_local', 6),
	('idioma', 'Idioma', 'multiselect', 'columna', 7),
	('soporte', 'Soporte', 'multiselect', 'columna', 8),
	('anyo_publicacion', 'Año', 'rango', 'columna', 9);

-- RLS
alter table recursos.lista_valor enable row level security;
alter table recursos.recurso enable row level security;
alter table recursos.tag enable row level security;
alter table recursos.recurso_tag enable row level security;
alter table recursos.autor enable row level security;
alter table recursos.recurso_autor enable row level security;
alter table recursos.itinerario enable row level security;
alter table recursos.itinerario_bloque enable row level security;
alter table recursos.recurso_bloque enable row level security;
alter table recursos.recurso_relacion enable row level security;
alter table recursos.faceta enable row level security;

-- Vocabularios y configuración: lectura pública, escritura editor/admin
create policy "lectura publica" on recursos.lista_valor for select using (true);
create policy "escribe admin" on recursos.lista_valor for all
	using (recursos.es_admin()) with check (recursos.es_admin());

create policy "lectura publica" on recursos.tag for select using (true);
create policy "escribe editor" on recursos.tag for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura publica" on recursos.autor for select using (true);
create policy "escribe editor" on recursos.autor for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura publica" on recursos.itinerario for select using (true);
create policy "escribe editor" on recursos.itinerario for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura publica" on recursos.itinerario_bloque for select using (true);
create policy "escribe editor" on recursos.itinerario_bloque for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura publica" on recursos.faceta for select using (true);
create policy "escribe admin" on recursos.faceta for all
	using (recursos.es_admin()) with check (recursos.es_admin());

-- Recurso: visibilidad escalonada
--  anon → publicado + publico + sin datos personales
--  con login → todo lo publicado
--  edicion_local → además, cualquier estado de su MCM local
--  editor/admin → todo
create policy "recurso visible segun rol" on recursos.recurso for select using (
	(estado = 'publicado' and visibilidad = 'publico' and not datos_personales)
	or (auth.uid() is not null and estado = 'publicado')
	or recursos.es_editor()
	or (recursos.rol_actual() = 'edicion_local' and mcm_local_id is not distinct from recursos.mi_mcm_local())
);

create policy "recurso insert editor" on recursos.recurso for insert
	with check (recursos.es_editor());

create policy "recurso update editor o local" on recursos.recurso for update
	using (
		recursos.es_editor()
		or (recursos.rol_actual() = 'edicion_local' and mcm_local_id is not distinct from recursos.mi_mcm_local())
	)
	with check (
		recursos.es_editor()
		or (recursos.rol_actual() = 'edicion_local' and mcm_local_id is not distinct from recursos.mi_mcm_local())
	);

create policy "recurso delete editor" on recursos.recurso for delete
	using (recursos.es_editor());

-- Uniones: legibles si puedes leer el recurso; escribe quien puede editar el recurso
create policy "lectura via recurso" on recursos.recurso_tag for select
	using (exists (select 1 from recursos.recurso r where r.id = recurso_id));
create policy "escribe editor" on recursos.recurso_tag for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura via recurso" on recursos.recurso_autor for select
	using (exists (select 1 from recursos.recurso r where r.id = recurso_id));
create policy "escribe editor" on recursos.recurso_autor for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura via recurso" on recursos.recurso_bloque for select
	using (exists (select 1 from recursos.recurso r where r.id = recurso_id));
create policy "escribe editor" on recursos.recurso_bloque for all
	using (recursos.es_editor()) with check (recursos.es_editor());

create policy "lectura via recurso" on recursos.recurso_relacion for select
	using (exists (select 1 from recursos.recurso r where r.id = recurso_id));
create policy "escribe editor" on recursos.recurso_relacion for all
	using (recursos.es_editor()) with check (recursos.es_editor());

-- Índices para filtros habituales
create index recurso_estado_idx on recursos.recurso (estado);
create index recurso_tipo_idx on recursos.recurso (tipo);
create index recurso_mcm_local_idx on recursos.recurso (mcm_local_id);
create index recurso_etapas_idx on recursos.recurso using gin (etapas);
create index recurso_edades_idx on recursos.recurso using gin (edades);
create index recurso_extra_idx on recursos.recurso using gin (extra);
