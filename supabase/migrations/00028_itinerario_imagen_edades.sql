-- 00028 · Portada y edades para el itinerario (SPEC-015, segunda vuelta)
--
-- `imagen` se había dejado fuera a propósito en la primera vuelta para no añadir campos que
-- rellenar; con el primer itinerario montado se pidió, y tiene sentido: la rejilla de
-- /itinerarios es lo único que ve alguien que llega, y ahí una portada hace el trabajo que no
-- hace un párrafo. Sigue siendo opcional y con el mismo fallback generado que los recursos.
--
-- `edades` va con `etapas`: mismo vocabulario y mismo selector que en un recurso, para poder
-- decir «esto es de 3º a 6º de primaria» sin escribirlo en la descripción.
alter table recursos.itinerario add column if not exists imagen text;
alter table recursos.itinerario add column if not exists edades text[] not null default '{}';

comment on column recursos.itinerario.imagen is
	'Portada del itinerario. Mismo trato que recurso.imagen; si falta, se pinta el fallback generado.';
comment on column recursos.itinerario.edades is
	'Edades a las que apunta, mismo vocabulario que recurso.edades. Vacío = cualquiera.';

notify pgrst, 'reload schema';
