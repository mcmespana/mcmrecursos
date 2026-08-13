-- 00024 · `envios_viejos` se olvidaba del estado `revisar_ia`
--
-- `/admin/revision` considera abierto un envío en `enviado`, `en_revision` o `revisar_ia`
-- (ver ABIERTOS en admin/revision/+page.server.ts); `salud_banco()` (00021) solo miraba los
-- dos primeros, así que un envío estancado en `revisar_ia` nunca aparecía como «parado».

create or replace function recursos.salud_banco()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
	select jsonb_build_object(
		'sin_formato',      (select count(*) from recursos.recurso where enlace is not null and formato is null),
		'sin_tematicas',    (select count(*) from recursos.recurso r where not exists (
		                        select 1 from recursos.recurso_tag rt where rt.recurso_id = r.id)),
		'sin_descripcion',  (select count(*) from recursos.recurso where coalesce(descripcion, '') = ''),
		'sin_etapa',        (select count(*) from recursos.recurso where etapas is null or cardinality(etapas) = 0),
		'sin_edades',       (select count(*) from recursos.recurso where edades is null or cardinality(edades) = 0),
		'sin_tipo',         (select count(*) from recursos.recurso where tipo is null),
		'sin_enlace',       (select count(*) from recursos.recurso where coalesce(enlace, '') = ''),
		'por_clasificar',   (select count(*) from recursos.recurso where pendiente_clasificar),
		'fuera_del_banco',  (select count(*) from recursos.recurso where fuera_del_banco),
		'editados_en_web',  (select count(*) from recursos.recurso where editado_web_at is not null),
		'sin_embedding',    (select count(*) from recursos.recurso where estado = 'publicado' and embedding is null),
		'olvidados',        (select count(*) from recursos.recurso r where r.estado = 'publicado'
		                        and r.updated_at < now() - interval '90 days'
		                        and not exists (select 1 from recursos.acceso a where a.recurso_id = r.id)),
		'envios_viejos',    (select count(*) from recursos.envio where estado in ('enviado', 'en_revision', 'revisar_ia')
		                        and created_at < now() - interval '14 days'),
		'enlaces_repetidos',(select count(*) from (
		                        select 1 from recursos.recurso where coalesce(enlace, '') <> ''
		                        group by recursos.normalizar_enlace(enlace) having count(*) > 1) d)
	);
$$;

notify pgrst, 'reload schema';
