-- ECE como administrador; Alcora, Onda, Quintanar con su email limpio confirmado
-- APLICADA el 2026-07-19 como "recursos_acceso_previo_ampliado".
-- Pendiente aún: Caravaca (delegación existe, email sin confirmar).

insert into recursos.acceso_previo (email, rol, mcm_local_id) values
	('ece@movimientoconsolacion.com', 'administrador', null),
	('alcora@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'alcora')),
	('onda@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'onda')),
	('quintanar@movimientoconsolacion.com', 'edicion_local', (select id from recursos.mcm_local where slug = 'quintanar'))
on conflict (email) do update
	set rol = excluded.rol, mcm_local_id = excluded.mcm_local_id;

update recursos.perfil p
set rol = ap.rol, mcm_local_id = coalesce(ap.mcm_local_id, p.mcm_local_id)
from recursos.acceso_previo ap
where ap.email = p.email
	and ap.email in ('ece@movimientoconsolacion.com', 'alcora@movimientoconsolacion.com',
		'onda@movimientoconsolacion.com', 'quintanar@movimientoconsolacion.com');
