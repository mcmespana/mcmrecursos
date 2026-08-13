-- 00021 · Salud del banco y tareas del equipo (SPEC-014)
--
-- Dos piezas independientes que viven en la misma pantalla (/admin/salud):
--   1. `recursos.tarea` — la lista compartida de «hay que…» que hoy vive en un WhatsApp.
--   2. `recursos.salud_banco()` — un solo JSON con los conteos de todo lo que le falta al
--      banco, para no encadenar quince peticiones al cargar la pantalla.

-- ---------------------------------------------------------------------------------------------
-- Tabla `tarea`
-- ---------------------------------------------------------------------------------------------
create table recursos.tarea (
	id uuid primary key default gen_random_uuid(),
	titulo text not null,
	detalle text,
	estado text not null default 'abierta', -- abierta | hecha | descartada
	prioridad text not null default 'normal', -- alta | normal | baja
	asignada_a uuid references recursos.perfil (id) on delete set null,
	recurso_id text references recursos.recurso (id) on delete set null,
	mcm_local_id uuid references recursos.mcm_local (id),
	origen text not null default 'manual', -- manual | salud (nacida de una señal)
	senal text, -- qué señal la creó, para no duplicarla dos veces
	creada_por uuid references recursos.perfil (id),
	created_at timestamptz not null default now(),
	resuelta_por uuid references recursos.perfil (id),
	resuelta_at timestamptz
);

create index tarea_estado_prioridad_idx on recursos.tarea (estado, prioridad);
create index tarea_asignada_a_idx on recursos.tarea (asignada_a);
create index tarea_recurso_id_idx on recursos.tarea (recurso_id);

-- «Apuntarlo» dos veces sobre la misma señal no duplica la tarea mientras siga abierta.
create unique index tarea_senal_abierta_idx on recursos.tarea (senal) where estado = 'abierta' and senal is not null;

alter table recursos.tarea enable row level security;

-- select: rol de panel; edicion_local ve las suyas y las generales (sin MCM), no las de otro MCM.
create policy "tarea ve su alcance" on recursos.tarea for select
	using (
		recursos.rol_actual() in ('editor', 'administrador')
		or (
			recursos.rol_actual() = 'edicion_local'
			and (mcm_local_id is null or mcm_local_id = recursos.mi_mcm_local())
		)
	);

-- insert: mismo alcance que el select — un edicion_local no puede apuntar una tarea a otro MCM.
create policy "tarea crea en su alcance" on recursos.tarea for insert
	with check (
		recursos.rol_actual() in ('editor', 'administrador')
		or (
			recursos.rol_actual() = 'edicion_local'
			and (mcm_local_id is null or mcm_local_id = recursos.mi_mcm_local())
		)
	);

-- update: cualquiera del equipo puede marcar hecha la tarea de otro — equipo pequeño, y la
-- alternativa (solo quien la creó) deja tareas colgadas cuando esa persona no está.
create policy "tarea actualiza en su alcance" on recursos.tarea for update
	using (
		recursos.rol_actual() in ('editor', 'administrador')
		or (
			recursos.rol_actual() = 'edicion_local'
			and (mcm_local_id is null or mcm_local_id = recursos.mi_mcm_local())
		)
	);

-- delete: solo administrador. Para el resto, «descartada» es el camino (deja rastro).
create policy "tarea solo admin borra" on recursos.tarea for delete
	using (recursos.rol_actual() = 'administrador');

comment on table recursos.tarea is
	'Lista compartida del equipo editor: lo que no es un recurso concreto, o una señal de salud convertida en pendiente.';

-- ---------------------------------------------------------------------------------------------
-- RPC `salud_banco()` — un JSON con todas las señales.
--
-- `security invoker` a propósito: cada quien ve lo que su RLS le deja contar. Ojo con esto desde
-- la app: `olvidados` cuenta sobre `recursos.acceso`, cuya política solo deja leer a
-- editor/administrador (`es_editor()`), así que esta función solo se llama desde ahí — un
-- `edicion_local` no ve la sección de señales en /admin/salud, solo las tareas del equipo.
-- ---------------------------------------------------------------------------------------------
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
		'envios_viejos',    (select count(*) from recursos.envio where estado in ('enviado', 'en_revision')
		                        and created_at < now() - interval '14 days'),
		'enlaces_repetidos',(select count(*) from (
		                        select 1 from recursos.recurso where coalesce(enlace, '') <> ''
		                        group by recursos.normalizar_enlace(enlace) having count(*) > 1) d)
	);
$$;

comment on function recursos.salud_banco() is
	'Conteos de todas las señales de salud del banco en un solo JSON (SPEC-014). Solo para editor/administrador.';

grant execute on function recursos.salud_banco() to authenticated;

notify pgrst, 'reload schema';
