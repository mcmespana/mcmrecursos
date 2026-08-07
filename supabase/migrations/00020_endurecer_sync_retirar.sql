-- Endurecer `_sync_retirar`: era invocable por cualquiera desde internet
--
-- `_sync_retirar` es `security definer` (salta la RLS) y no comprobaba nada. Con el
-- esquema expuesto en PostgREST y el `alter default privileges` de 00001, el rol `anon`
-- tenía EXECUTE: un POST a /rest/v1/rpc/_sync_retirar con `ids_lote = '{}'` ponía
-- `estado = 'retirado'` en todo el catálogo, que la política de lectura de `recurso`
-- deja entonces invisible para el público y para las cuentas no editoras.
--
-- Es una función interna de la sincronización: solo la llama `sync_filas`. Se cierra por
-- dos vías independientes, a propósito:
--   1. Revocar EXECUTE a anon/authenticated. No rompe el sync: dentro de una función
--      `security definer` el permiso se comprueba como el dueño, no como quien invoca.
--   2. Exigir el GUC `recursos.en_sync`, que `sync_filas` fija antes de llamarla. Es el
--      mismo patrón que ya usa el trigger `marcar_edicion_web`. Así sigue cerrada aunque
--      los grants vuelvan a abrirse en el futuro.
--
-- De paso, las tres únicas funciones del esquema sin `search_path` fijo lo fijan. Ninguna
-- referencia tablas (solo `new.*`, `now()` y `current_setting()`), así que es seguro.

-- 1. Guardia interna: solo desde la sincronización
create or replace function recursos._sync_retirar(ids_lote text[], corte timestamptz)
returns int
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
	if coalesce(current_setting('recursos.en_sync', true), '') <> '1' then
		raise exception 'recursos._sync_retirar solo puede llamarse desde la sincronización';
	end if;

	update recursos.recurso r
		set estado = 'retirado'
		where not (r.id = any (ids_lote))
			and r.estado <> 'retirado'
			and r.editado_web_at is null;
	get diagnostics n = row_count;
	return n;
end;
$$;

-- 2. Y que no se pueda ni llamar desde fuera
revoke all on function recursos._sync_retirar(text[], timestamptz) from anon, authenticated;
revoke all on function recursos._sync_retirar(text[], timestamptz) from public;

-- 3. `search_path` fijo en las tres funciones de trigger que les faltaba
alter function recursos.set_updated_at() set search_path = '';
alter function recursos.invalidar_formato() set search_path = '';
alter function recursos.marcar_edicion_web() set search_path = '';

notify pgrst, 'reload schema';
