-- SPEC-011 · Detección de formato en lote sin ensuciar la sincronización con el Sheet
--
-- `recurso.formato` es un dato técnico que rellena la app sola (por URL o consultando a Drive),
-- no una edición editorial. Si se escribiera con un UPDATE normal, el trigger
-- `recurso_edicion_web` marcaría `editado_web_at` y esos recursos aparecerían como conflicto en
-- Sincronización sin que nadie los haya tocado. Esta función usa la misma puerta que `sync_filas`
-- para saltarse ese trigger.

create or replace function recursos.fijar_formato(
	rid text default null,
	formato_in text default null,
	archivo_id uuid default null
)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
	if not recursos.puede_catalogar() then
		raise exception 'sin permiso para clasificar recursos';
	end if;

	perform set_config('recursos.en_sync', '1', true);

	if archivo_id is not null then
		update recursos.recurso_archivo set formato = formato_in where id = archivo_id;
	elsif rid is not null then
		update recursos.recurso set formato = formato_in where id = rid;
	end if;
end;
$$;

grant execute on function recursos.fijar_formato(text, text, uuid) to authenticated;

notify pgrst, 'reload schema';
