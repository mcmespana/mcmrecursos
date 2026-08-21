-- 00027 · «Ahora no» que se respeta de verdad
--
-- El aviso de «¿de qué MCM local eres?» recordaba el «ahora no» en `localStorage`, o sea POR
-- DISPOSITIVO: decías que no en el portátil y te lo volvía a preguntar en el móvil, y otra vez
-- al vaciar el navegador. Una preferencia sobre si molestar a alguien vive con la persona.
alter table recursos.perfil
	add column if not exists onboarding_mcm_omitido boolean not null default false;

comment on column recursos.perfil.onboarding_mcm_omitido is
	'true si dijo «ahora no» al aviso de MCM local. No se le vuelve a preguntar en ningún dispositivo.';

notify pgrst, 'reload schema';
