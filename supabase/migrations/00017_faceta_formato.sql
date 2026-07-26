-- SPEC-011 · «Formato» como filtro del buscador público
--
-- El dato ya existe (`recurso.formato` y `recurso_archivo.formato`), así que promocionarlo a
-- faceta es insertar una fila: el buscador lee `recursos.faceta` y no hay que tocar código
-- (SPEC-002 / SPEC-008 §config). Las opciones no salen de `lista_valor` sino de los propios
-- recursos, porque el formato se deduce, no se elige.
--
-- Va después de Soporte y antes de Año. Se puede ocultar o reordenar desde /admin/config.

update recursos.faceta set orden = 10 where campo = 'anyo_publicacion';

insert into recursos.faceta (campo, etiqueta, tipo, origen, orden, visible, protegida) values
	('formato', 'Formato', 'multiselect', 'columna', 9, true, false)
on conflict (campo) do nothing;

notify pgrst, 'reload schema';
