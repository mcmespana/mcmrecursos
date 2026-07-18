# Modelo de datos — borrador para validar

> **Estado:** propuesta, NO aplicada en BD. Se aplicará como migración 00002 al validarse.

## Principio rector: columnas nuevas sin dolor

El Sheet se sincroniza **por nombre de cabecera, no por posición** → reordenar columnas en
Google Sheets nunca rompe nada. Y la tabla `recurso` tiene un cajón `extra jsonb`: cualquier
columna del Sheet que el sync no reconozca cae ahí automáticamente, y puede promocionarse a
faceta de filtro solo con configuración (tabla `faceta`), sin migración. Añadir un filtro
nuevo = añadir columna al Sheet + una fila en `faceta`. Ya está.

Casi **nada es obligatorio**: solo `id` y `nombre`. Todo lo demás admite vacío y la UI
muestra "sin catalogar" donde toque.

## Tabla central: `recurso`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | text PK | ID estable del Sheet (p. ej. `R0001`). Nunca se recicla |
| `nombre` | text **not null** | único campo obligatorio junto al id |
| `descripcion` | text | libre, alimenta la búsqueda de texto |
| `tipo` | text | lista sugerida (ver abajo), no enum rígido: valores nuevos no rompen el sync |
| `etapas` | text[] | multiselect: MIC, COM, LC, Monitores |
| `nivel` | text | Conocimiento, Incorporación… (lista abierta, por cerrar) |
| `edades` | text[] | multiselect: 3º-6º EP, 1º-4º ESO, Bachillerato, Universitarios, Jóvenes <30, Adultos jóvenes +30, Adultos, Mayores |
| `mcm_local_id` | uuid FK → mcm_local | quién lo aporta |
| `idioma` | text | Castellano, Valencià, English… |
| `soporte` | text | PDF, Word, Docs, Formulario, Genially, Canva, PPT, Hoja de cálculo, YouTube, Archivo |
| `ubicacion` | text | drive, servidor propio, servidor externo, youtube |
| `enlace` | text | el link principal (Drive o externo) |
| `imagen` | text | URL de miniatura |
| `enlace_imagenes` | text | link a carpeta/álbum con más imágenes |
| `anyo_publicacion` | int | año de creación del recurso |
| `curso_usado` | text | curso académico, formato `2024-2025` |
| `visibilidad` | text | `publico` / `privado` (privado = solo usuarios con login/permiso) |
| `estado` | text | `publicado` / `pendiente_revision` / `subido_usuario` / `revisar_ia` / `borrador` / `retirado` |
| `datos_personales` | boolean | true = pendiente de limpiar datos personales |
| `creado_con_ia` | boolean | |
| `notas_internas` | text | solo visible a editores/admin |
| `extra` | jsonb | columnas del Sheet no mapeadas (futuros filtros) |
| `created_at` / `updated_at` | timestamptz | |

**No son columnas del Sheet** (viven solo en BD, calculadas por la capa social):
valoración media, nº votos, veces usado, veces en favoritos, accesos. El sync jamás las toca.

### `tipo` — lista sugerida, agrupada

- **Sesiones y formación**: Sesión de grupo *(el más habitual)*, Itinerario de sesiones, Formación de monitores, Taller, Guía
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
