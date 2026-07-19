# Modelo de datos — borrador para validar

> **Estado:** validado y APLICADO en remoto (migración `00002_catalogo.sql`).
> Pendiente: contenido real de itinerarios (estructura de tablas ya creada).

## Principio rector: columnas nuevas sin dolor

El Sheet se sincroniza **por nombre de cabecera, no por posición** → reordenar columnas en
Google Sheets nunca rompe nada. Y la tabla `recurso` tiene un cajón `extra jsonb`: cualquier
columna del Sheet que el sync no reconozca cae ahí automáticamente, y puede promocionarse a
faceta de filtro solo con configuración (tabla `faceta`), sin migración. Añadir un filtro
nuevo = añadir columna al Sheet + una fila en `faceta`. Ya está.

Casi **nada es obligatorio**: solo `id`, `nombre` y `estado` (con default `borrador`, así
una fila a medias nunca se publica sola). Todo lo demás admite vacío y la UI muestra
"sin catalogar" donde toque.

Las listas cerradas (tipo, nivel, idioma, ubicación, soporte, etapas, edades, estado…)
viven en la tabla **`lista_valor`** (lista, valor, grupo, orden): el front pinta selects
desde ahí, el sync valida contra ella, y `docs/seed/listas_seed.csv` la replica para
configurar los desplegables de validación del Google Sheet. Añadir un valor = una fila
(desde admin), sin migración.

## Tabla central: `recurso`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | ID estable del Sheet (p. ej. `R0001`). Nunca se recicla |
| `nombre` | text **not null** | único campo obligatorio junto al id |
| `descripcion` | text | libre, alimenta la búsqueda de texto |
| `tipo` | text | lista sugerida (ver abajo), no enum rígido: valores nuevos no rompen el sync |
| `etapas` | text[] | multiselect: MIC, COM, LC, Monitores |
| `nivel` | text | MIC, Conocimiento, Incorporación, Crecimiento, Opción responsable, Laicos |
| `edades` | text[] | multiselect: 3º-6º EP, 1º-4º ESO, Bachillerato, Universitarios, Jóvenes <30, Adultos jóvenes +30, Adultos, Mayores |
| `mcm_local_id` | uuid FK → mcm_local | quién lo aporta |
| `idioma` | text | lista: Castellano, Catalán, Portugués, Inglés, Otros, N/A |
| `soporte` | text | PDF, Word, Docs, Formulario, Genially, Canva, PPT, Hoja de cálculo, YouTube, Archivo |
| `ubicacion` | text | lista: Drive, Servidor propio, Servidor externo, YouTube |
| `enlace` | text | el link principal (Drive o externo) |
| `imagen` | text | URL de miniatura |
| `enlace_imagenes` | text | link a carpeta/álbum con más imágenes |
| `anyo_publicacion` | int | año de creación del recurso |
| `curso_usado` | text | curso académico, formato `2024-2025` |
| `visibilidad` | text | `publico` / `privado` (privado = solo usuarios con login/permiso) |
| `estado` | text **not null** | `publicado` / `pendiente_revision` / `subido_usuario` / `revisar_ia` / `borrador` / `retirado` — obligatorio, default `borrador` |
| `datos_personales` | boolean | true = pendiente de limpiar datos personales |
| `fuera_del_banco` | boolean | **default true**: el archivo vive en una carpeta que NO es del banco (p. ej. la de trabajo de un MCM local). Un script futuro migrará el material a la estructura propia y lo pondrá a false |
| `pendiente_clasificar` | boolean | true = contenedor localizado sin trocear (p. ej. una **Programación anual** enlazada como carpeta entera, a dividir en sesiones con tags) |
| `creado_con_ia` | boolean | |
| `notas_internas` | text | solo visible a editores/admin |
| `extra` | jsonb | columnas del Sheet no mapeadas (futuros filtros) |
| `created_at` / `updated_at` | timestamptz | |

**No son columnas del Sheet** (viven solo en BD, calculadas por la capa social):
valoración media, nº votos, veces usado, veces en favoritos, accesos. El sync jamás las toca.

### `tipo` — lista sugerida, agrupada

- **Sesiones y formación**: Sesión de grupo *(el más habitual)*, Itinerario de sesiones, Formación de monitores, Taller, Guía, Programación anual *(carpeta de curso completa, suele ir con `pendiente_clasificar`)*
- **Actividades**: Campamento, Acampada, Actividad de voluntariado, Conclusiones de actividad
- **Celebración y oración**: Oración, Canción
- **Audiovisual y gráfico**: Vídeo, Película, Imagen, Dibujo, Diseño, Presentación
- **Documentos**: Libro, Documento MCM, Web, Recurso general

## Vocabularios reutilizables (evitan el caos "Adviento/Advent/adviento")

### `tag` + `recurso_tag`
`tag(id, nombre, slug unique, usos)` — el slug normaliza (minúsculas, sin acentos). En la
web se asignan con combobox "busca antes de crear"; el sync del Sheet fusiona por slug.
**Es el campo más importante para la búsqueda**: temas (María, Adviento, Cuaresma…) cortos
y combinables.

### `autor` + `recurso_autor`
`autor(id, nombre, apellidos, slug unique, mcm_local_id?, perfil_id?)` — autoría con nombre
propio, además del MCM local. El sync da de alta autores nuevos por nombre normalizado;
`perfil_id` permite algún día enlazar el autor con su usuario. Un recurso puede tener varios.

### Itinerarios formativos: `itinerario` + `itinerario_bloque` + `recurso_bloque`
Cada etapa (MIC, COM, LC) tiene itinerarios; cada itinerario, **bloques ordenados**:

```
itinerario        (id, etapa, nombre, descripcion, orden)
itinerario_bloque (id, itinerario_id, nombre, descripcion, orden)
recurso_bloque    (recurso_id, bloque_id)
```

Esto da la vista "Itinerario de MIC" completa: bloques en orden y, colgando de cada bloque,
sus recursos. El sí/no de "vinculado a itinerario" no se guarda: se deduce de si tiene
bloques. En el Sheet se escribe `MIC>Itinerario X>Bloque 3; COM>…` (o el código corto del
bloque cuando exista).

### `recurso_relacion`
`(recurso_id, relacionado_id)` — "recursos relacionados" manuales (simétricos). En el Sheet:
columna `relacionados` con ids separados por coma. (La relación automática "se parece a"
llegará con embeddings en fase 5.)

## Configuración de facetas: `faceta`

`faceta(campo, etiqueta, tipo: select|multiselect|boolean|rango, origen: columna|extra|tag|autor…, orden, visible, protegida)`
— define qué campos son filtros, con qué etiqueta y en qué orden aparecen. Promocionar una
columna de `extra` a filtro es insertar una fila aquí desde el panel admin. Cero código.

## Capa social (solo BD, SPEC-003)

`valoracion` (1-5 única por usuario+recurso), `favorito`, `uso` ("lo he usado"),
`lista` + `lista_recurso`, `comentario`, `acceso` (clics, admite anónimos).
Agregados en vista materializada `recurso_stats` (media, nº votos, usos, favoritos, accesos)
refrescada con trigger — para que el índice de búsqueda ordene por popularidad sin costes.

## Reglas de visibilidad

- `visibilidad = 'privado'` o `datos_personales = true` → solo usuarios autenticados
  (consulta y superiores, incluida consulta_externa).
- `estado != 'publicado'` → visible solo a editores/admin (y al autor del envío).
- Anónimos: solo `publicado` + `publico` + sin datos personales, vía vista `recurso_publico`.

## CSV seed

`docs/seed/recursos_seed.csv` replica el orden ideal de columnas del Sheet con filas de
ejemplo. Cabeceras = nombres canónicos que entiende el sync (el orden da igual, se mapea
por nombre).
