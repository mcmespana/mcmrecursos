-- 00031 · El catálogo de demostración (SPEC-017 §3)
--
-- Qué se arregla aquí, y por qué es más que «poner bonitos unos datos de prueba»:
--
--   · **El prefijo «[EJEMPLO] » sale del título.** Era un dato metido dentro de otro: la
--     interfaz lo recortaba al vuelo y el buscador lo indexaba, así que escribir «ejemplo»
--     encontraba los once recursos. Ahora lo dice `es_demo` (migración 00030), que es un
--     campo y por tanto se puede filtrar, contar y apagar.
--   · **Los enlaces dejan de ser basura.** Eran `…/folders/EJEMPLO-R0001`: 404 al pulsar y
--     miniatura rota en la tarjeta. Ahora tienen la forma que tendrá el enlace de verdad
--     (Documento, Presentación, carpeta, YouTube…) — así el icono de formato, el vocabulario
--     de soporte y la faceta enseñan lo que enseñarán en producción — y la interfaz, viendo
--     `es_demo`, no intenta abrirlos ni empotrar su vista previa: explica que son muestra.
--   · **El catálogo se llena hasta 19 recursos.** Con siete, media interfaz no se podía
--     enseñar: las facetas tenían una opción, los relacionados estaban vacíos y el mazo de
--     Descubre se acababa en tres golpes. Diecinueve reparten las cinco familias de tipo, las
--     cuatro etapas y catorce edades, que es lo que hace falta para que quien entre entienda
--     de qué va esto.
--   · **La capa social deja de estar a cero.** Estrellas y accesos repartidos, para que la
--     fila social de la tarjeta y el orden por valoración se vean funcionando. Solo
--     valoraciones anónimas (`valoracion.anon_id`, migración 00008) y accesos sin perfil:
--     favoritos y usos exigen una persona de verdad y no se inventan cuentas.
--
-- Todo lo de aquí es **idempotente y reversible**: el día que entre material real basta con
-- `delete from recursos.recurso where es_demo` y el banco queda limpio de un tirón.

-- ---------------------------------------------------------------------------------------------
-- 1 · Vocabulario: los tags que necesita el catálogo nuevo
-- ---------------------------------------------------------------------------------------------

insert into recursos.tag (slug, nombre) values
	('oracion', 'Oración'),
	('cuaresma', 'Cuaresma'),
	('pascua', 'Pascua'),
	('biblia', 'Biblia'),
	('dinamicas', 'Dinámicas'),
	('voluntariado', 'Voluntariado'),
	('carisma', 'Carisma'),
	('diseno', 'Diseño'),
	('acompanamiento', 'Acompañamiento'),
	('evaluacion', 'Evaluación'),
	('programacion', 'Programación'),
	('monitores', 'Monitores'),
	('navidad', 'Navidad'),
	('naturaleza', 'Naturaleza'),
	('convivencia', 'Convivencia')
on conflict (slug) do nothing;

-- El tag «Ejemplo» decía lo mismo que ahora dice `es_demo`, y encima como si fuera materia:
-- salía en la faceta de tags junto a «Adviento» y «Campamento».
delete from recursos.recurso_tag
	where tag_id in (select id from recursos.tag where slug = 'ejemplo');
delete from recursos.tag where slug = 'ejemplo';

-- ---------------------------------------------------------------------------------------------
-- 2 · Autoría de las muestras
-- ---------------------------------------------------------------------------------------------
-- Equipos, no personas inventadas: una ficha de demostración firmada con nombre y apellidos de
-- alguien que no existe se lee como una atribución real.

update recursos.autor set nombre = 'Equipo de tiempo libre', apellidos = 'MCM Castellón',
	slug = 'equipo-tiempo-libre-castellon'
	where slug = 'equipo-de-ejemplo';
update recursos.autor set nombre = 'Comisión de formación', apellidos = 'MCM Nules',
	slug = 'comision-formacion-nules'
	where slug = 'monitora-ejemplar';

insert into recursos.autor (slug, nombre, apellidos, mcm_local_id) values
	('equipo-pastoral-vila-real', 'Equipo de pastoral', 'MCM Vila-real',
	 (select id from recursos.mcm_local where slug = 'vila-real'))
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------------------------
-- 3 · Los recursos
-- ---------------------------------------------------------------------------------------------
-- Se escriben con un `insert … on conflict do update` sobre la lista entera: los diez que ya
-- existían se reescriben en su sitio (conservan su capa social y su puesto en el itinerario) y
-- los nuevos se crean. Volver a lanzar la migración deja exactamente el mismo resultado.

insert into recursos.recurso (
	id, nombre, descripcion, tipo, etapas, nivel, edades, mcm_local_id, idioma, soporte,
	ubicacion, enlace, formato, anyo_publicacion, curso_usado, visibilidad, estado,
	datos_personales, creado_con_ia, fuera_del_banco, pendiente_clasificar, notas_internas,
	es_demo
)
select
	d.id, d.nombre, d.descripcion, d.tipo, d.etapas, d.nivel, d.edades,
	(select ml.id from recursos.mcm_local ml where ml.slug = d.local),
	'Castellano', d.soporte, d.ubicacion, d.enlace, d.formato, d.anyo, d.curso,
	d.visibilidad, d.estado, d.datos_personales, false, false, d.pendiente, d.notas, true
from (values
	-- id, nombre, descripción, tipo, etapas, nivel, edades, local, soporte, ubicación, enlace,
	-- formato, año, curso, visibilidad, estado, datos personales, pendiente clasificar, notas
	(
		'R0001',
		'Adviento con María: cuatro sesiones de espera',
		'Itinerario corto de cuatro sesiones para preparar la Navidad con el grupo, con María como hilo conductor. Cada sesión trae dinámica de entrada, texto breve, trabajo en pequeños grupos y oración final con la corona de Adviento. La cuarta se puede convertir en celebración con familias.',
		'Sesión de grupo', array['MIC','COM'], 'Conocimiento',
		array['5º EP','6º EP','1º ESO'], 'castellon', 'PDF', 'Drive',
		'https://drive.google.com/file/d/1demoAdvientoMaria4Sesiones/view', 'pdf',
		2023, '2023-2024', 'publico', 'publicado', false, false, null
	),
	(
		'R0002',
		'Oración de la mañana con símbolos',
		'Oración breve para abrir la sesión o el día de convivencia: tres símbolos (la luz, el camino y el agua), un salmo adaptado y un gesto sencillo. Incluye variante exprés de cinco minutos para los días en que el grupo llega tarde, que son casi todos.',
		'Oración', array['MIC'], 'MIC',
		array['3º EP','4º EP'], 'nules', 'Docs', 'Drive',
		'https://docs.google.com/document/d/1demoOracionSimbolos/edit', 'google-doc',
		2022, '2022-2023', 'publico', 'publicado', false, false, null
	),
	(
		'R0003',
		'Vídeo resumen del campamento de verano',
		'Montaje de seis minutos con los mejores momentos del campamento: la marcha, la velada, el río y la despedida. Sirve para la reunión de familias de septiembre y para enganchar a quien duda si apuntarse.',
		'Vídeo', array['COM','LC'], null,
		array['3º ESO','4º ESO'], 'castellon', 'YouTube', 'YouTube',
		'https://www.youtube.com/watch?v=demoCampamentoResumen', 'youtube',
		2025, '2024-2025', 'privado', 'revisar_ia', true, false,
		'Aparecen menores: revisar autorizaciones de imagen antes de hacerlo público.'
	),
	(
		'R0004',
		'Programación anual de MIC 2024-2025',
		'Carpeta con la programación completa del curso de MIC: calendario, objetivos por trimestre, las sesiones en orden y los materiales de cada una. Está entera, pero sin trocear en fichas sueltas.',
		'Programación anual', array['MIC'], null,
		array['3º EP','4º EP','5º EP','6º EP'], 'castellon', 'Carpeta de Drive', 'Drive',
		'https://drive.google.com/drive/folders/1demoProgramacionMIC2425', 'drive-carpeta',
		2024, '2024-2025', 'publico', 'publicado', false, true,
		'Trocear en sesiones sueltas cuando haya un rato.'
	),
	(
		'R0005',
		'Taller de pan a la fogata',
		'Taller de dos horas para hacer pan de pita sobre las brasas: masa con cuatro ingredientes, reposo mientras se juega, y palos seguros para hornear. Trae la lista de la compra para 30 personas y las normas de fuego.',
		'Taller', array['COM'], null,
		array['1º ESO','2º ESO'], 'castellon', 'PDF', 'Drive',
		'https://drive.google.com/file/d/1demoTallerPanFogata/view', 'pdf',
		2024, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0006',
		'Consolación: letra y acordes',
		'Letra y acordes en La mayor, con cifrado sencillo y una versión con cejilla para quien todavía no llega al fa. Apta para guitarras con cinco cuerdas supervivientes de campamento.',
		'Canción', array['MIC','COM','LC'], null,
		array[]::text[], 'nules', 'PDF', 'Drive',
		'https://drive.google.com/file/d/1demoCancionConsolacion/view', 'pdf',
		2021, null, 'publico', 'publicado', false, false, null
	),
	(
		'R0007',
		'Guía del monitor novato',
		'Todo lo que nadie te cuenta el primer día: qué llevar en la mochila, cómo se prepara una sesión, qué hacer cuando el grupo se desmadra y a quién preguntar. Pensada para leerla de una sentada antes del primer sábado.',
		'Guía', array['Monitores'], 'Laicos',
		array['Universitarios','Jóvenes adultos (<30)'], 'castellon', 'Docs', 'Drive',
		'https://docs.google.com/document/d/1demoGuiaMonitorNovato/edit', 'google-doc',
		2025, '2024-2025', 'publico', 'pendiente_revision', false, false,
		'Falta revisar el capítulo 3 (protección del menor) con la comisión.'
	),
	(
		'R0008',
		'Presentación para la reunión de familias',
		'Plantilla de presentación para la reunión de inicio de curso: quiénes somos, calendario, cuotas, autorizaciones y turno de preguntas. Con las diapositivas de relleno ya puestas para que solo haya que cambiar las fechas.',
		'Presentación', array['MIC','COM'], null,
		array[]::text[], 'castellon', 'PPT', 'Drive',
		'https://docs.google.com/presentation/d/1demoReunionFamilias/edit', 'google-slides',
		2024, '2024-2025', 'publico', 'borrador', false, false, null
	),
	(
		'R0009',
		'Dinámica del ovillo: tejer un grupo',
		'Dinámica de cohesión de veinte minutos para las primeras sesiones del curso: el ovillo viaja de mano en mano con una pregunta, la telaraña deja ver que el grupo se sostiene entre todos, y nadie recuerda nunca cómo desenredarla.',
		'Sesión de grupo', array['MIC'], null,
		array['5º EP','6º EP'], 'nules', 'Docs', 'Drive',
		'https://docs.google.com/document/d/1demoDinamicaOvillo/edit', 'google-doc',
		2024, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0014',
		'Vía Crucis joven en siete estaciones',
		'Vía Crucis adaptado para grupos de jóvenes: siete estaciones en vez de catorce, cada una con una imagen actual, un texto corto y una pregunta. Pensado para rezarlo caminando por el barrio o por el monte.',
		'Oración', array['COM','LC'], 'Crecimiento',
		array['2º ESO','3º ESO','4º ESO','Bachillerato'], 'vila-real', 'PDF', 'Drive',
		'https://drive.google.com/file/d/1demoViaCrucisJoven/view', 'pdf',
		2024, '2023-2024', 'publico', 'publicado', false, false, null
	),
	(
		'R0015',
		'Escape room del Evangelio de Marcos',
		'Sesión de hora y media en formato escape room: cinco pruebas que solo se resuelven leyendo pasajes de Marcos, con candados de verdad y un cofre. Incluye el Genially, las tarjetas para imprimir y la lista de material.',
		'Sesión de grupo', array['LC'], 'Crecimiento',
		array['3º ESO','4º ESO','Bachillerato'], 'castellon', 'Genially', 'Servidor externo',
		'https://view.genially.com/demo-escape-marcos', 'genially',
		2025, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0016',
		'Acampada de otoño: cronograma y material',
		'Hoja de cálculo con todo lo de una acampada de fin de semana: horario minuto a minuto, reparto de equipos, menús con alergias, material por bloque y presupuesto. Se copia, se cambian las fechas y ya está.',
		'Acampada', array['COM'], null,
		array['1º ESO','2º ESO'], 'nules', 'Hoja de cálculo', 'Drive',
		'https://docs.google.com/spreadsheets/d/1demoAcampadaOtono/edit', 'google-sheets',
		2024, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0017',
		'Voluntariado en la residencia: guía de la visita',
		'Cómo preparar, vivir y evaluar una tarde de voluntariado en una residencia de mayores: qué se hace y qué no, ideas de actividad intergeneracional, y una revisión final para que la experiencia no se quede en la anécdota.',
		'Actividad de voluntariado', array['LC','Monitores'], 'Opción responsable',
		array['Bachillerato','Universitarios','Jóvenes adultos (<30)'], 'vila-real', 'Docs', 'Drive',
		'https://docs.google.com/document/d/1demoVoluntariadoResidencia/edit', 'google-doc',
		2025, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0018',
		'Santa María Rosa Molas: cuaderno para conocerla',
		'Cuaderno de veinte páginas sobre la fundadora, en lenguaje llano: su época, las decisiones que tomó, qué significa hoy «consolación» y una línea del tiempo. Con actividades al final de cada capítulo para trabajarlo por tramos.',
		'Documento MCM', array['MIC','COM','LC','Monitores'], null,
		array[]::text[], 'castellon', 'PDF', 'Drive',
		'https://drive.google.com/file/d/1demoCuadernoMariaRosaMolas/view', 'pdf',
		2023, null, 'publico', 'publicado', false, false, null
	),
	(
		'R0019',
		'Plantillas de Canva para carteles del MCM',
		'Carpeta de plantillas editables con la identidad del movimiento: cartel de actividad, historia de Instagram, invitación a familias y diploma de fin de curso. Con los colores y las tipografías ya puestos.',
		'Diseño', array['Monitores'], null,
		array['Universitarios','Jóvenes adultos (<30)','Adultos jóvenes (+30)'], 'castellon', 'Canva',
		'Servidor externo', 'https://www.canva.com/design/demo-plantillas-mcm/view', 'canva',
		2025, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0020',
		'Acompañar sin dirigir: formación para monitores',
		'Formación de tres horas sobre acompañamiento de grupos: la diferencia entre acompañar y resolver, escucha activa con casos reales, y qué hacer cuando alguien cuenta algo que se te queda grande. Con guion del formador y diapositivas.',
		'Formación de monitores', array['Monitores'], 'Laicos',
		array['Universitarios','Jóvenes adultos (<30)','Adultos jóvenes (+30)'], 'nules', 'PPT', 'Drive',
		'https://docs.google.com/presentation/d/1demoAcompanarSinDirigir/edit', 'google-slides',
		2025, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0021',
		'Conclusiones de la Pascua Joven 2025',
		'Lo que salió de la evaluación de la Pascua Joven: qué funcionó, qué no, cuántos vinieron y de dónde, y las seis decisiones que se tomaron para el año que viene. Se lee en diez minutos y ahorra repetir errores.',
		'Conclusiones de actividad', array['LC','Monitores'], null,
		array['Bachillerato','Universitarios','Jóvenes adultos (<30)'], 'castellon', 'Docs', 'Drive',
		'https://docs.google.com/document/d/1demoConclusionesPascua25/edit', 'google-doc',
		2025, '2024-2025', 'publico', 'publicado', false, false, null
	),
	(
		'R0022',
		'Dibujos de la Semana de la Consolación',
		'Doce ilustraciones en blanco y negro para colorear, imprimir o proyectar durante la semana de la Consolación. Sirven para decorar el local, para la oración y para tener a los pequeños ocupados diez minutos.',
		'Dibujo', array['MIC','COM'], null,
		array['3º EP','4º EP','5º EP','6º EP'], 'nules', 'Imagen', 'Drive',
		'https://drive.google.com/drive/folders/1demoDibujosConsolacion', 'drive-carpeta',
		2022, null, 'publico', 'publicado', false, false, null
	)
) as d(
	id, nombre, descripcion, tipo, etapas, nivel, edades, local, soporte, ubicacion, enlace,
	formato, anyo, curso, visibilidad, estado, datos_personales, pendiente, notas
)
on conflict (id) do update set
	nombre = excluded.nombre,
	descripcion = excluded.descripcion,
	tipo = excluded.tipo,
	etapas = excluded.etapas,
	nivel = excluded.nivel,
	edades = excluded.edades,
	mcm_local_id = excluded.mcm_local_id,
	idioma = excluded.idioma,
	soporte = excluded.soporte,
	ubicacion = excluded.ubicacion,
	enlace = excluded.enlace,
	formato = excluded.formato,
	anyo_publicacion = excluded.anyo_publicacion,
	curso_usado = excluded.curso_usado,
	visibilidad = excluded.visibilidad,
	estado = excluded.estado,
	datos_personales = excluded.datos_personales,
	fuera_del_banco = excluded.fuera_del_banco,
	pendiente_clasificar = excluded.pendiente_clasificar,
	notas_internas = excluded.notas_internas,
	es_demo = true;

-- R0010 es la versión en borrador de R0007 (SPEC-009): hereda su ficha, así que se copia en vez
-- de escribirse a mano. Sin enlace propio, como hace `crear_version`.
update recursos.recurso v set
	nombre = o.nombre,
	descripcion = o.descripcion,
	tipo = o.tipo,
	etapas = o.etapas,
	nivel = o.nivel,
	edades = o.edades,
	mcm_local_id = o.mcm_local_id,
	soporte = o.soporte,
	ubicacion = o.ubicacion,
	anyo_publicacion = 2026,
	curso_usado = '2025-2026',
	visibilidad = o.visibilidad,
	fuera_del_banco = false,
	notas_internas = 'Versión en preparación para el curso que viene: añadir el capítulo de protección del menor.',
	es_demo = true
from recursos.recurso o
where v.id = 'R0010' and o.id = 'R0007';

-- R0013 (la carpeta de dibujos de María Rosa Molas) es material de verdad, enviado y aprobado:
-- no lleva la marca de muestra. Sí se le quita `fuera_del_banco`, que estaba puesto por el
-- valor por defecto de la migración 00003 y no por una decisión.
update recursos.recurso set es_demo = false, fuera_del_banco = false where id = 'R0013';

-- ---------------------------------------------------------------------------------------------
-- 4 · Etiquetas y autoría de cada recurso
-- ---------------------------------------------------------------------------------------------

delete from recursos.recurso_tag rt
	using recursos.recurso r where rt.recurso_id = r.id and r.es_demo;

insert into recursos.recurso_tag (recurso_id, tag_id)
select d.recurso_id, t.id
from (values
	('R0001','adviento'), ('R0001','maria'), ('R0001','navidad'),
	('R0002','oracion'), ('R0002','interioridad'),
	('R0003','campamento'), ('R0003','naturaleza'),
	('R0004','programacion'),
	('R0005','campamento'), ('R0005','cocina'), ('R0005','naturaleza'),
	('R0006','musica'), ('R0006','carisma'),
	('R0007','formacion'), ('R0007','monitores'),
	('R0008','familias'),
	('R0009','cohesion'), ('R0009','dinamicas'), ('R0009','convivencia'),
	('R0010','formacion'), ('R0010','monitores'),
	('R0014','oracion'), ('R0014','cuaresma'),
	('R0015','dinamicas'), ('R0015','biblia'),
	('R0016','campamento'), ('R0016','naturaleza'), ('R0016','convivencia'),
	('R0017','voluntariado'),
	('R0018','maria-rosa-molas'), ('R0018','carisma'),
	('R0019','diseno'),
	('R0020','formacion'), ('R0020','acompanamiento'), ('R0020','monitores'),
	('R0021','pascua'), ('R0021','evaluacion'),
	('R0022','dibujo'), ('R0022','carisma'), ('R0022','imagen')
) as d(recurso_id, slug)
join recursos.tag t on t.slug = d.slug
on conflict do nothing;

delete from recursos.recurso_autor ra
	using recursos.recurso r where ra.recurso_id = r.id and r.es_demo;

insert into recursos.recurso_autor (recurso_id, autor_id)
select d.recurso_id, a.id
from (values
	('R0001','equipo-tiempo-libre-castellon'),
	('R0002','comision-formacion-nules'),
	('R0005','equipo-tiempo-libre-castellon'),
	('R0006','comision-formacion-nules'),
	('R0007','comision-formacion-nules'),
	('R0009','comision-formacion-nules'),
	('R0010','comision-formacion-nules'),
	('R0014','equipo-pastoral-vila-real'),
	('R0015','equipo-tiempo-libre-castellon'),
	('R0016','comision-formacion-nules'),
	('R0017','equipo-pastoral-vila-real'),
	('R0018','equipo-tiempo-libre-castellon'),
	('R0020','comision-formacion-nules'),
	('R0021','equipo-tiempo-libre-castellon')
) as d(recurso_id, slug)
join recursos.autor a on a.slug = d.slug
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 5 · Relaciones entre recursos
-- ---------------------------------------------------------------------------------------------
-- «Relacionados» al pie de la ficha: sin esto, la sección no se puede enseñar. Las relaciones
-- son bidireccionales, así que cada par se inserta en los dos sentidos.

delete from recursos.recurso_relacion rr
	using recursos.recurso r where rr.recurso_id = r.id and r.es_demo;

insert into recursos.recurso_relacion (recurso_id, relacionado_id)
select a, b from (
	select unnest(array['R0001','R0001','R0003','R0005','R0009','R0014','R0017','R0018','R0020']) as a,
	       unnest(array['R0002','R0006','R0016','R0016','R0015','R0018','R0021','R0022','R0007']) as b
) p
union
select b, a from (
	select unnest(array['R0001','R0001','R0003','R0005','R0009','R0014','R0017','R0018','R0020']) as a,
	       unnest(array['R0002','R0006','R0016','R0016','R0015','R0018','R0021','R0022','R0007']) as b
) p
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 6 · Capa social de muestra
-- ---------------------------------------------------------------------------------------------
-- Un banco donde nada tiene estrellas no enseña que se pueda valorar. Estas valoraciones son
-- anónimas (`anon_id`, migración 00008) y los accesos van sin perfil: no se inventa ninguna
-- cuenta ni se atribuye una opinión a nadie.

delete from recursos.valoracion v
	using recursos.recurso r
	where v.recurso_id = r.id and r.es_demo and v.anon_id is not null;

insert into recursos.valoracion (recurso_id, anon_id, estrellas, created_at)
select d.recurso_id, gen_random_uuid(), d.estrellas,
       now() - (d.dias || ' days')::interval
from (values
	('R0001', 5, 41), ('R0001', 5, 26), ('R0001', 4, 12),
	('R0002', 4, 33), ('R0002', 5, 9),
	('R0005', 5, 55), ('R0005', 4, 21), ('R0005', 5, 7),
	('R0006', 4, 60), ('R0006', 4, 18),
	('R0009', 5, 29), ('R0009', 5, 14), ('R0009', 4, 5), ('R0009', 5, 2),
	('R0014', 4, 47), ('R0014', 5, 16),
	('R0015', 5, 23), ('R0015', 5, 11), ('R0015', 5, 3),
	('R0016', 4, 38), ('R0016', 3, 19),
	('R0017', 5, 44), ('R0017', 4, 8),
	('R0018', 4, 51), ('R0018', 5, 27), ('R0018', 4, 6),
	('R0020', 5, 35), ('R0020', 4, 13),
	('R0021', 4, 10),
	('R0022', 5, 31), ('R0022', 4, 15)
) as d(recurso_id, estrellas, dias)
where exists (select 1 from recursos.recurso r where r.id = d.recurso_id);

delete from recursos.acceso a
	using recursos.recurso r
	where a.recurso_id = r.id and r.es_demo and a.perfil_id is null;

insert into recursos.acceso (recurso_id, perfil_id, created_at)
select d.recurso_id, null, now() - (random() * 90 || ' days')::interval
from (values
	('R0001', 34), ('R0002', 19), ('R0004', 8), ('R0005', 41), ('R0006', 27),
	('R0007', 12), ('R0009', 45), ('R0014', 22), ('R0015', 38), ('R0016', 16),
	('R0017', 14), ('R0018', 29), ('R0019', 11), ('R0020', 18), ('R0021', 6),
	('R0022', 23)
) as d(recurso_id, cuantos), generate_series(1, d.cuantos)
where exists (select 1 from recursos.recurso r where r.id = d.recurso_id);

-- ---------------------------------------------------------------------------------------------
-- 7 · Itinerario y atajos
-- ---------------------------------------------------------------------------------------------

-- El itinerario de prueba («test», sin descripción y con un bloque vacío) sobra en cuanto hay
-- uno de verdad al lado: en /itinerarios se veía una tarjeta con el nombre «test».
delete from recursos.itinerario where nombre = 'test';

-- «Buscad y encontraréis» pasa de cuatro recursos a seis y gana un segundo tramo, que es lo
-- que hace visible que un itinerario tiene estructura y no es una lista.
update recursos.itinerario
	set etapas = array['MIC','COM'],
	    edades = array['5º EP','6º EP','1º ESO','2º ESO'],
	    descripcion = 'Seis sesiones para acompañar a un grupo que empieza a preguntarse cosas. Van en este orden a propósito: primero se crea confianza, después se abre la pregunta, y solo al final se reza con ella.'
	where nombre = 'Buscad y encontraréis';

update recursos.itinerario_bloque b
	set nombre = 'Primero, el grupo',
	    descripcion = 'Nadie se abre en un grupo donde no se fía. Estas tres son de cohesión, y valen aunque no se siga el itinerario entero.'
	from recursos.itinerario i
	where b.itinerario_id = i.id and i.nombre = 'Buscad y encontraréis' and b.orden = 0;

insert into recursos.itinerario_bloque (itinerario_id, orden, nombre, descripcion)
select i.id, 1, 'Después, la pregunta',
	'Con el grupo hecho, se puede abrir lo que cada uno lleva dentro. Aquí ya se reza, y se reza con lo que ha salido antes.'
from recursos.itinerario i
where i.nombre = 'Buscad y encontraréis'
	and not exists (
		select 1 from recursos.itinerario_bloque b
		where b.itinerario_id = i.id and b.orden = 1
	);

delete from recursos.recurso_bloque rb
	using recursos.itinerario_bloque b, recursos.itinerario i
	where rb.bloque_id = b.id and b.itinerario_id = i.id and i.nombre = 'Buscad y encontraréis';

insert into recursos.recurso_bloque (bloque_id, recurso_id, orden)
select b.id, d.recurso_id, d.orden
from (values
	(0, 'R0009', 0), (0, 'R0006', 1), (0, 'R0016', 2),
	(1, 'R0015', 0), (1, 'R0002', 1), (1, 'R0001', 2)
) as d(bloque, recurso_id, orden)
join recursos.itinerario i on i.nombre = 'Buscad y encontraréis'
join recursos.itinerario_bloque b on b.itinerario_id = i.id and b.orden = d.bloque
on conflict do nothing;

-- Atajos de la portada: los tres de antes salían de una prueba («1º ESO» filtraba a un solo
-- recurso). Estos cinco recortan a algo que se puede mirar, que es lo único que un atajo tiene
-- que hacer para merecer su sitio.
delete from recursos.preset;
insert into recursos.preset (nombre, filtros, orden, activo) values
	('Para MIC', 'etapas=MIC', 0, true),
	('Sesiones de grupo', 'tipo=Sesi%C3%B3n+de+grupo', 1, true),
	('Oración', 'tags=Oraci%C3%B3n', 2, true),
	('Campamentos y aire libre', 'tags=Campamento', 3, true),
	('Para monitores', 'etapas=Monitores', 4, true);

notify pgrst, 'reload schema';
