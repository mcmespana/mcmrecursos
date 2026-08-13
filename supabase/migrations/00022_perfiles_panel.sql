-- 00022 · Lista de personas del equipo, para asignar tareas (SPEC-014)
--
-- La RLS de `perfil` (00001) solo deja ver el propio perfil o, si eres admin, todos — a propósito,
-- para no filtrar el email de nadie a cualquiera. El selector de «asignar a» de /admin/salud
-- necesita que cualquiera con rol de panel vea nombre + avatar de sus compañeros, no su ficha
-- entera. Una función `security definer` que solo expone eso, y solo a quien ya tiene rol de panel.
create or replace function recursos.perfiles_panel()
returns table (id uuid, nombre text, apellidos text, avatar_url text, rol recursos.rol_usuario)
language sql
stable
security definer
set search_path = ''
as $$
	select p.id, p.nombre, p.apellidos, p.avatar_url, p.rol
	from recursos.perfil p
	where recursos.rol_actual() in ('edicion_local', 'editor', 'administrador')
		and p.rol in ('edicion_local', 'editor', 'administrador')
	order by p.nombre;
$$;

comment on function recursos.perfiles_panel() is
	'Nombre + avatar de quienes tienen rol de panel, para el selector de «asignar a» de tareas (SPEC-014). Sin email.';

grant execute on function recursos.perfiles_panel() to authenticated;

notify pgrst, 'reload schema';
