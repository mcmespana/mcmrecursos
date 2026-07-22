-- SPEC-009 · Nuevas versiones de un recurso (linaje enlazado)
-- APLICADA el 2026-07-20 como "recursos_versiones".
--
-- Una versión nueva es un recurso nuevo (id estable propio, su Sheet, su capa social)
-- enlazado a su predecesor por `version_de` (AD-1). La "vigente" de un linaje es la cabeza
-- publicada a la que ningún otro recurso publicado apunta. La herencia de valoraciones/
-- favoritos/accesos (SPEC-009 §2/§3) se hace por AGREGACIÓN de linaje en la app, no moviendo
-- filas: cada valoración sigue atada a la versión que se valoró.

alter table recursos.recurso
  add column if not exists version_de text references recursos.recurso (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recurso_version_no_propia') then
    alter table recursos.recurso
      add constraint recurso_version_no_propia check (version_de is distinct from id);
  end if;
end $$;

create index if not exists recurso_version_de_idx on recursos.recurso (version_de);

-- Generador de IDs R#### reutilizable (misma serie que sync_filas; nunca recicla)
create or replace function recursos.nuevo_id_recurso()
returns text
language sql
security definer set search_path = ''
as $$
  select 'R' || lpad((coalesce(max(substring(id from 2)::int), 0) + 1)::text, 4, '0')
  from recursos.recurso
  where id ~ '^R[0-9]+$';
$$;

-- Crea una nueva versión (borrador) a partir de un recurso existente: copia metadatos y
-- M2M (tags, autores, bloques), enlaza version_de y devuelve el nuevo id. La capa social NO
-- se copia: la herencia se hace por agregación de linaje en la app.
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
    pendiente_clasificar, notas_internas, extra, version_de, editado_web_at
  ) values (
    nid, o.nombre, o.descripcion, o.tipo, o.etapas, o.nivel, o.edades, o.mcm_local_id, o.idioma,
    o.soporte, o.ubicacion, null, null, null, o.anyo_publicacion, o.curso_usado,
    o.visibilidad, 'borrador', o.datos_personales, o.creado_con_ia, o.fuera_del_banco,
    o.pendiente_clasificar, o.notas_internas, o.extra, origen_id, now()
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

grant execute on function recursos.nuevo_id_recurso() to authenticated;
grant execute on function recursos.crear_version(text) to authenticated;

notify pgrst, 'reload schema';
