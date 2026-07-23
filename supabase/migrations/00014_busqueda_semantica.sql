-- SPEC-010 · Búsqueda semántica con embeddings (Voyage AI)
--
-- Añade un vector de embedding por recurso y una función de búsqueda por cercanía
-- coseno. Se rellena desde la app (acción "reindexar" en /admin/recursos) llamando
-- a la API de Voyage; sin VOYAGE_API_KEY el vector queda a NULL y la búsqueda
-- semántica simplemente no aporta resultados (el buscador léxico sigue igual).
--
-- Modelo por defecto: voyage-4-lite (familia Voyage 4, ene 2026), 1024 dimensiones.

create extension if not exists vector with schema extensions;

alter table recursos.recurso
	add column if not exists embedding extensions.vector(1024),
	add column if not exists embedding_at timestamptz;

comment on column recursos.recurso.embedding is
	'Embedding semántico (Voyage voyage-4-lite, 1024d). NULL = pendiente de indexar.';

-- Índice HNSW para distancia coseno (rápido en catálogos de miles de filas).
create index if not exists recurso_embedding_idx
	on recursos.recurso using hnsw (embedding extensions.vector_cosine_ops);

-- Búsqueda semántica: devuelve ids ordenados por cercanía a la consulta.
-- SECURITY INVOKER (por defecto): respeta las RLS de `recurso`, así que un usuario
-- anónimo solo ve recursos públicos publicados y uno con sesión los suyos.
create or replace function recursos.buscar_semantica(
	consulta extensions.vector(1024),
	limite int default 48,
	umbral float default 0.68
)
returns table (id text, distancia float)
language sql
stable
set search_path = recursos, extensions, public
as $$
	select r.id, (r.embedding <=> consulta) as distancia
	from recursos.recurso r
	where r.embedding is not null
		and r.estado = 'publicado'
		and (r.embedding <=> consulta) < umbral
	order by r.embedding <=> consulta
	limit limite;
$$;

grant execute on function recursos.buscar_semantica(extensions.vector, int, float)
	to anon, authenticated;

notify pgrst, 'reload schema';
