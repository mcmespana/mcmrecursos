-- Origen del material y programaciones anuales
-- APLICADA el 2026-07-19 como "recursos_ubicacion_material".
--
-- · fuera_del_banco: true (default) = el archivo vive en una carpeta/propiedad que NO es
--   del banco (p. ej. la carpeta de trabajo de un MCM local). Un script futuro migrará
--   estos materiales a la estructura de carpetas propia del banco y pondrá esto a false.
-- · pendiente_clasificar: true = contenedor localizado pero sin trocear (p. ej. una
--   "Programación anual" enlazada como carpeta entera, a dividir en sesiones con tags).

alter table recursos.recurso
	add column fuera_del_banco boolean not null default true,
	add column pendiente_clasificar boolean not null default false;

insert into recursos.lista_valor (lista, valor, grupo, orden) values
	('tipo', 'Programación anual', 'Sesiones y formación', 22);
