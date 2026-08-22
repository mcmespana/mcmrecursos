-- 00029 · Presets de búsqueda y de mazo (SPEC-006 §Filtros, SPEC-007 §Fases 1)
--
-- Un preset es **una combinación de filtros con nombre**: «Adviento», «Para monitores».
-- Nada más. No es una lista de recursos elegidos a mano (eso ya existe: `lista`, SPEC-008) ni
-- un itinerario (SPEC-015): es el atajo a una búsqueda que se repite, y por eso lo que se
-- guarda es la selección de facetas, no un puñado de ids que envejece solo.
--
-- Guardar la selección como **query string** (`etapas=MIC|COM&tags=Adviento`) no es pereza:
-- es exactamente el formato que `/` y `/descubre` ya leen y escriben en la URL desde SPEC-006,
-- así que un preset es un enlace que las dos pantallas entienden sin código nuevo, y sigue
-- funcionando cuando mañana se añada una faceta desde /admin/config. Con una tabla
-- normalizada (preset_filtro: campo, valor) habría que mantener un mapeo campo→faceta que la
-- URL ya resuelve.
--
-- El texto libre NO viaja en el preset a propósito: Descubre no busca por texto, y un preset
-- que en el buscador diera 3 resultados y en el mazo otros tantos distintos sería un chip que
-- miente. Un preset son facetas, y por eso vale igual en las dos pantallas.

create table if not exists recursos.preset (
	id uuid primary key default gen_random_uuid(),
	nombre text not null,
	filtros text not null,
	orden int not null default 0,
	activo boolean not null default true,
	creado_por uuid references recursos.perfil (id) on delete set null,
	created_at timestamptz not null default now(),
	constraint preset_nombre_no_vacio check (btrim(nombre) <> ''),
	constraint preset_filtros_no_vacio check (btrim(filtros) <> '')
);

comment on table recursos.preset is
	'Combinaciones de filtros con nombre: los chips de atajo del buscador y los mazos de Descubre.';
comment on column recursos.preset.filtros is
	'Selección de facetas en el mismo formato de URL que usan / y /descubre: campo=valor|valor&campo=valor. Sin texto libre.';
comment on column recursos.preset.orden is
	'Posición del chip. A igual orden, manda el nombre.';
comment on column recursos.preset.activo is
	'Desactivado = sigue guardado pero no se enseña. Para retirar un preset de temporada sin perderlo.';

-- Siempre se piden igual: los activos, en su orden.
create index if not exists preset_orden_idx on recursos.preset (activo, orden, nombre);

alter table recursos.preset enable row level security;

-- Lectura: los activos los ve cualquiera (salen en la portada, también sin sesión). Los
-- desactivados solo el administrador, que es quien los gestiona.
drop policy if exists "preset lectura publica" on recursos.preset;
create policy "preset lectura publica" on recursos.preset for select
	using (activo or recursos.es_admin());

-- Escritura: solo administradores. SPEC-006 pide los presets «configurables por admin», y
-- mantener una sola regla evita el caso raro de un editor que crea un preset y luego no puede
-- borrarlo porque la pantalla de gestión vive en /admin/config, que es solo para admins.
drop policy if exists "preset escribe admin" on recursos.preset;
create policy "preset escribe admin" on recursos.preset for all
	using (recursos.es_admin()) with check (recursos.es_admin());

notify pgrst, 'reload schema';
