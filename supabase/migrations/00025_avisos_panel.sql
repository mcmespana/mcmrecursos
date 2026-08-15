-- 00025 · Avisos y tareas como panel de toda la app (SPEC-016)
--
-- SPEC-014 dejó `recursos.tarea` viviendo solo dentro de /admin/salud, en una lista que había
-- que ir a buscar. Esto la convierte en el buzón del equipo: visible desde cualquier pantalla,
-- con lo que hacía falta para que un aviso se entienda sin abrir nada — quién responde, para
-- cuándo, y si ya lo has leído.
--
-- Tres piezas:
--   1. `tipo`: separar el **aviso** (se lee) de la **tarea** (se hace). Convivían mal en una
--      sola lista porque «marcar hecha» no significa nada en un «ojo, el lunes no hay reunión».
--   2. `vence_at`: la fecha límite, que hoy solo se podía escribir dentro del título.
--   3. `tarea_visto`: qué ha leído cada quien. Es por persona y no una columna `leida` en la
--      tarea, porque el buzón es compartido: que Marta lo lea no puede apagarle el aviso a Ana.

-- ---------------------------------------------------------------------------------------------
-- 1 · Aviso vs tarea, y fecha límite
-- ---------------------------------------------------------------------------------------------
alter table recursos.tarea
	add column if not exists tipo text not null default 'tarea',
	add column if not exists vence_at timestamptz;

comment on column recursos.tarea.tipo is
	'tarea = hay algo que hacer (se marca hecha) · aviso = hay algo que saber (se marca leído).';
comment on column recursos.tarea.vence_at is
	'Fecha límite opcional. Lo vencido y sin cerrar se destaca en el panel.';

-- Lo que más se pide al panel: lo abierto, lo más urgente primero, y lo que vence pronto.
create index if not exists tarea_abiertas_idx on recursos.tarea (estado, prioridad, created_at desc);
create index if not exists tarea_vence_idx on recursos.tarea (vence_at) where vence_at is not null;

-- ---------------------------------------------------------------------------------------------
-- 2 · Quién ha leído qué
-- ---------------------------------------------------------------------------------------------
create table if not exists recursos.tarea_visto (
	tarea_id uuid not null references recursos.tarea (id) on delete cascade,
	perfil_id uuid not null references recursos.perfil (id) on delete cascade,
	visto_at timestamptz not null default now(),
	primary key (tarea_id, perfil_id)
);

comment on table recursos.tarea_visto is
	'Marca de leído por persona: el buzón es compartido, así que el «sin leer» es de cada quien.';

alter table recursos.tarea_visto enable row level security;

-- Cada quien gestiona sus propias marcas y no ve las de nadie más: quién ha leído qué no es
-- información que el panel necesite, y sí es información que incomoda tener a la vista.
drop policy if exists "tarea_visto es cosa de cada quien" on recursos.tarea_visto;
create policy "tarea_visto es cosa de cada quien" on recursos.tarea_visto for all
	using (perfil_id = auth.uid())
	with check (perfil_id = auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 3 · Resumen para la campana
--
-- La campana sale en todas las pantallas, así que el conteo tiene que costar una consulta y no
-- traerse la lista entera. `security invoker`: la RLS de `tarea` ya acota lo que cada rol ve
-- (un `edicion_local` no cuenta las tareas de otro MCM).
-- ---------------------------------------------------------------------------------------------
create or replace function recursos.avisos_resumen()
returns jsonb
language sql
security invoker
stable
set search_path = ''
as $$
	select jsonb_build_object(
		-- lo que mueve el badge: abierto y que yo no he leído todavía
		'sin_leer', (select count(*) from recursos.tarea t
			where t.estado = 'abierta'
				and not exists (select 1 from recursos.tarea_visto v
					where v.tarea_id = t.id and v.perfil_id = auth.uid())),
		'abiertas', (select count(*) from recursos.tarea where estado = 'abierta'),
		'mias',     (select count(*) from recursos.tarea
			where estado = 'abierta' and asignada_a = auth.uid()),
		'vencidas', (select count(*) from recursos.tarea
			where estado = 'abierta' and vence_at is not null and vence_at < now())
	);
$$;

comment on function recursos.avisos_resumen() is
	'Conteos del buzón para la campana de la cabecera (SPEC-016): sin leer, abiertas, mías y vencidas.';

grant execute on function recursos.avisos_resumen() to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4 · «Marcar todo leído» sin mandar N inserts desde el cliente
-- ---------------------------------------------------------------------------------------------
create or replace function recursos.marcar_avisos_leidos()
returns integer
language sql
security invoker
volatile
set search_path = ''
as $$
	with nuevas as (
		insert into recursos.tarea_visto (tarea_id, perfil_id)
		select t.id, auth.uid() from recursos.tarea t
		where t.estado = 'abierta'
			and auth.uid() is not null
			and not exists (select 1 from recursos.tarea_visto v
				where v.tarea_id = t.id and v.perfil_id = auth.uid())
		on conflict do nothing
		returning 1
	)
	select coalesce(count(*), 0)::integer from nuevas;
$$;

comment on function recursos.marcar_avisos_leidos() is
	'Marca como leídos todos los avisos abiertos que quien llama aún no había leído. Devuelve cuántos.';

grant execute on function recursos.marcar_avisos_leidos() to authenticated;

notify pgrst, 'reload schema';
