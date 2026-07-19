-- SPEC-008 §2-§4 · Soporte del panel: conflictos persistentes, sync_info, usuarios activos
-- APLICADA el 2026-07-19 como "recursos_admin_conflictos_v2".
--
-- Cambio de semántica de conflictos («BD manda» de verdad): un recurso con
-- editado_web_at NO NULO queda protegido del Sheet SIEMPRE, no solo hasta la
-- siguiente sync (antes, tras una sync la marca quedaba "vieja" y la siguiente
-- lo pisaba en silencio). La protección solo la quita resolver_conflicto_web().

-- 1) Usuarios desactivados pierden privilegios en todas las políticas
create or replace function recursos.rol_actual()
returns recursos.rol_usuario
language sql stable security definer set search_path = ''
as $$
	select rol from recursos.perfil where id = auth.uid() and activo;
$$;

-- 2) Última sync visible para el panel sin exponer la clave
create view recursos.sync_info as
	select ultima_sync from recursos.sync_config where id = 1;

-- 3) Resolución de conflicto a favor del Sheet (limpia la marca sin re-estamparla)
create or replace function recursos.resolver_conflicto_web(rid text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
	if not recursos.es_editor() then
		raise exception 'requiere rol editor';
	end if;
	perform set_config('recursos.en_sync', '1', true);
	update recursos.recurso set editado_web_at = null where id = rid;
end;
$$;
grant execute on function recursos.resolver_conflicto_web(text) to authenticated;

-- 4) Conflicto persistente: marca no nula = el Sheet nunca pisa (antes comparaba
--    con ultima_sync). Parche quirúrgico sobre sync_filas y _sync_retirar.
create or replace function recursos._sync_retirar(ids_lote text[], corte timestamptz)
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
	update recursos.recurso r
		set estado = 'retirado'
		where not (r.id = any (ids_lote))
			and r.estado <> 'retirado'
			and r.editado_web_at is null;
	get diagnostics n = row_count;
	return n;
end;
$$;

do $patch$
declare src text;
begin
	select pg_get_functiondef(p.oid) into src
	from pg_proc p join pg_namespace n on n.oid = p.pronamespace
	where n.nspname = 'recursos' and p.proname = 'sync_filas';
	src := replace(src,
		$old$if editado is not null and editado > coalesce(corte, '-infinity'::timestamptz) then$old$,
		$new$if editado is not null then$new$);
	execute src;
end;
$patch$;
