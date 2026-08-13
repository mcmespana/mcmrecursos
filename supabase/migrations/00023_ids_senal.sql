-- 00023 · IDs de una señal de salud (SPEC-014 §«Ver los N»)
--
-- `salud_banco()` (00021) da el conteo; esto da los IDs de esa misma señal, para que
-- /admin/recursos?pendiente=<señal> filtre el listado sin repetir cada predicado en JS y
-- arriesgarse a que se desincronicen del conteo. Un solo `case` con las mismas condiciones que
-- `salud_banco()`; lo que no encaja con ninguna señal (o no aplica a `recurso`, como
-- `envios_viejos`) devuelve vacío.

create or replace function recursos.ids_senal(p_senal text)
returns setof text
language sql
security invoker
stable
set search_path = ''
as $$
	select r.id from recursos.recurso r where
		case p_senal
			when 'sin_formato' then r.enlace is not null and r.formato is null
			when 'sin_tematicas' then not exists (
				select 1 from recursos.recurso_tag rt where rt.recurso_id = r.id)
			when 'sin_descripcion' then coalesce(r.descripcion, '') = ''
			when 'sin_etapa' then r.etapas is null or cardinality(r.etapas) = 0
			when 'sin_edades' then r.edades is null or cardinality(r.edades) = 0
			when 'sin_tipo' then r.tipo is null
			when 'sin_enlace' then coalesce(r.enlace, '') = ''
			when 'por_clasificar' then r.pendiente_clasificar
			when 'fuera_del_banco' then r.fuera_del_banco
			when 'editados_en_web' then r.editado_web_at is not null
			when 'sin_embedding' then r.estado = 'publicado' and r.embedding is null
			when 'olvidados' then r.estado = 'publicado'
				and r.updated_at < now() - interval '90 days'
				and not exists (select 1 from recursos.acceso a where a.recurso_id = r.id)
			when 'enlaces_repetidos' then coalesce(r.enlace, '') <> '' and recursos.normalizar_enlace(r.enlace) in (
				select recursos.normalizar_enlace(enlace) from recursos.recurso
				where coalesce(enlace, '') <> '' group by recursos.normalizar_enlace(enlace) having count(*) > 1)
			else false
		end;
$$;

comment on function recursos.ids_senal(text) is
	'IDs de recurso que disparan una señal de /admin/salud, para el filtro de /admin/recursos?pendiente=. Mismos predicados que salud_banco().';

grant execute on function recursos.ids_senal(text) to authenticated;

notify pgrst, 'reload schema';
