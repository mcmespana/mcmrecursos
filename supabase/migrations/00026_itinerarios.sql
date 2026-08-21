-- 00026 · Itinerarios: lo que le falta al esquema de 00002 (SPEC-015)
--
-- Las tres tablas (`itinerario`, `itinerario_bloque`, `recurso_bloque`) existen vacías desde la
-- migración 00002 y nunca se usaron. Esto NO crea nada nuevo: le pone las cuatro cosas que les
-- faltan para poder sostener un itinerario de verdad, y ni una más.
--
-- Nada de tabla de progreso personal: descartado a propósito (SPEC-015 §Preguntas 2).

-- ---------------------------------------------------------------------------------------------
-- 1 · Orden de los recursos DENTRO de un bloque
--
-- Es LO que faltaba. `recurso_bloque` era una tabla puente de dos columnas, así que se podía
-- decir «estos cinco recursos van en este bloque» pero no «este va antes que aquel» — y un
-- itinerario sin orden no es un itinerario, es una lista.
-- ---------------------------------------------------------------------------------------------
alter table recursos.recurso_bloque add column if not exists orden int not null default 0;

comment on column recursos.recurso_bloque.orden is
	'Posición del recurso dentro de su bloque. Sin esto un itinerario no puede ordenarse.';

-- Recorrer un itinerario es siempre «dame los recursos de este bloque en orden».
create index if not exists recurso_bloque_orden_idx on recursos.recurso_bloque (bloque_id, orden);

-- ---------------------------------------------------------------------------------------------
-- 2 · Borrador / publicado
--
-- Mismo vocabulario que `recurso.estado`. Un itinerario a medio montar no puede aparecer en
-- /itinerarios: se arma en varias sentadas, eligiendo y reordenando recursos.
-- ---------------------------------------------------------------------------------------------
alter table recursos.itinerario add column if not exists estado text not null default 'borrador';

comment on column recursos.itinerario.estado is
	'borrador | publicado. Solo los publicados salen en /itinerarios.';

-- ---------------------------------------------------------------------------------------------
-- 3 · `etapa` (texto libre, obligatorio) → `etapas` (array del mismo vocabulario de siempre)
--
-- Decisión validada (SPEC-015 §Preguntas 3): que la etapa se elija igual que en cualquier otra
-- parte de la app. En `recurso` es `etapas text[]` contra la lista `etapas` de `lista_valor`, y
-- el formulario usa `SelectorMultiple`. Aquí era un `text` suelto y obligatorio, o sea otro
-- vocabulario y otro control para lo mismo — la vía rápida a que un itinerario diga «MIC» y
-- otro «Infancia».
--
-- Pasa a ser opcional de paso: un itinerario transversal no tiene por qué mentir eligiendo una.
-- ---------------------------------------------------------------------------------------------
alter table recursos.itinerario add column if not exists etapas text[] not null default '{}';

-- La tabla está vacía, pero si algún día no lo estuviera no se pierde nada.
update recursos.itinerario
	set etapas = array[etapa]
	where etapa is not null and etapa <> '' and cardinality(etapas) = 0;

alter table recursos.itinerario drop column if exists etapa;

comment on column recursos.itinerario.etapas is
	'Etapas a las que apunta, del mismo vocabulario que recurso.etapas. Vacío = transversal.';

-- ---------------------------------------------------------------------------------------------
-- 4 · El nombre del bloque deja de ser obligatorio
--
-- Los bloques son la estructura OPCIONAL del itinerario. El caso normal —«veinte sesiones en
-- orden»— es un único bloque sin título que no se pinta; obligar a bautizarlo forzaba a
-- inventarse un «Bloque 1» que luego sale en pantalla.
-- ---------------------------------------------------------------------------------------------
alter table recursos.itinerario_bloque alter column nombre drop not null;

comment on column recursos.itinerario_bloque.nombre is
	'Título del tramo. NULL = bloque único sin título, no se pinta.';

-- ---------------------------------------------------------------------------------------------
-- 5 · Que los borradores no se cuelen en público
--
-- La escritura ya era `es_editor()` en las tres tablas desde 00002, que es exactamente lo que
-- se quería (editores y administradores, SPEC-015 §Preguntas 5): no se toca.
-- La lectura era `true` a secas, así que un borrador habría salido en /itinerarios.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "lectura publica" on recursos.itinerario;
create policy "lectura publica" on recursos.itinerario for select
	using (estado = 'publicado' or recursos.es_editor());

-- Un bloque solo se lee si su itinerario se lee: si no, los tramos de un borrador quedarían
-- a la vista de cualquiera aunque el itinerario no.
drop policy if exists "lectura publica" on recursos.itinerario_bloque;
create policy "lectura publica" on recursos.itinerario_bloque for select
	using (
		exists (
			select 1 from recursos.itinerario i
			where i.id = itinerario_id and (i.estado = 'publicado' or recursos.es_editor())
		)
	);

notify pgrst, 'reload schema';
