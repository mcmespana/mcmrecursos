# SPEC-011 · Formatos de archivo, varios archivos por recurso y envío sin cuenta

> **Estado:** IMPLEMENTADA (migraciones 00015 y 00016).
> **Depende de:** SPEC-002 (catálogo), SPEC-004 y SPEC-008 (envíos y panel), SPEC-010 (Drive).

## Objetivo

Que al mirar un recurso se sepa de un vistazo **qué vas a abrir** —un Doc, un PDF, un Word, una
carpeta de Drive, un vídeo— sin tener que pinchar; que un mismo recurso pueda ofrecerse en
varios formatos a la vez (el Word y el PDF del mismo documento); y que cualquiera pueda aportar
recursos aunque no tenga cuenta.

## Alcance

Entra:

- Detección automática del formato de cada enlace, con icono y color de marca.
- Varios archivos por recurso (`recurso_archivo`), con el enlace principal como primero.
- Envío de recursos sin sesión iniciada, con clasificación opcional.
- Borrado de recursos desde el panel.

Queda fuera (por ahora):

- Convertir documentos de Drive a PDF automáticamente. Se hará cuando exista la cuenta de
  servicio con permiso de escritura; el modelo ya lo admite (basta añadir otro
  `recurso_archivo` con `formato = 'pdf'`).
- Subida de archivos a Storage: se siguen guardando enlaces.

## Tres conceptos que no son lo mismo

Conviene no mezclarlos, porque las tres cosas conviven en la ficha:

| Campo     | Qué es                                 | Quién lo pone           | Ejemplos                        |
| --------- | -------------------------------------- | ----------------------- | ------------------------------- |
| `tipo`    | Qué es el recurso                      | El equipo editor        | Sesión de grupo, Oración, Imagen |
| `soporte` | Etiqueta editorial del catálogo/Sheet  | Editor (o el formato)   | PDF, Docs, YouTube              |
| `formato` | Qué hay realmente detrás del enlace    | **La app, sola**        | `google-doc`, `pdf`, `drive-carpeta` |

`formato` nunca se escribe a mano en el uso normal: se deduce. Y como `soporte` suele decir lo
mismo, al guardar se rellena solo a partir del formato si el editor lo dejó vacío.

## Detección del formato

Dos pasos, del más barato al más caro (`app/src/lib/catalogo/formatos.ts` y
`app/src/lib/server/formatos.ts`):

1. **Por la URL**, en cliente y servidor, sin coste. Distingue Google Docs, Slides, Sheets,
   Forms y Drawings; carpetas de Drive (`/folders/`); YouTube, Vimeo, Canva, Genially; y todo lo
   que lleve extensión en el path (`.pdf`, `.docx`, `.pptx`, imágenes, audio, vídeo, zip…).
2. **Consultando a Drive** solo cuando la URL se queda en «es un archivo de Drive»
   (`drive.google.com/file/d/…`), que es la única forma de saber si es un PDF, un Word o una
   imagen. Usa la cuenta de servicio de SPEC-010 (`mimeDeDrive`). Si no está configurada, se
   conserva el genérico y se ve el icono de Drive: nunca es un error, solo menos detalle.

El resultado se cachea en `recurso.formato` / `recurso_archivo.formato`. Un trigger
(`invalidar_formato`) lo pone a null cuando cambia el enlace, salvo que el mismo UPDATE ya
traiga el formato nuevo.

La detección en lote (botón «Detectar formatos» del panel) escribe vía
`recursos.fijar_formato()`, que se salta el trigger `recurso_edicion_web`: rellenar un campo
técnico no es una edición editorial y no debe generar conflictos falsos con el Sheet.

### Iconos

`IconoFormato.svelte` pinta la marca de Google Drive (el triángulo de tres colores) para los
archivos de Drive sin identificar, y un icono de Lucide con el color de marca para el resto
(PDF rojo, Word azul, Sheets verde…). En fondos de color se usa `neutro` para que herede el
color del contenedor.

Aparte, cada `tipo` tiene ahora su propio icono (`TIPO_ICON` en `catalogo/tipos.ts`), con la
familia como respaldo: un recurso de tipo «Imagen» ya no sale con una claqueta de cine solo por
compartir familia con «Película».

## Modelo de datos

```sql
alter table recursos.recurso add column formato text;

create table recursos.recurso_archivo (
  id uuid primary key default gen_random_uuid(),
  recurso_id text not null references recursos.recurso (id) on delete cascade,
  enlace text not null,
  etiqueta text,          -- nombre visible; si falta, se usa el del formato
  formato text,
  orden int not null default 0,
  created_at timestamptz not null default now(),
  unique (recurso_id, enlace)
);
```

`recurso.enlace` sigue siendo el **principal** y es lo que sincroniza el Sheet (SPEC-005);
`recurso_archivo` guarda solo los alternativos. Así no hay dos fuentes de verdad para el enlace
que ya existía.

RLS: se lee si se puede leer el recurso; escribe quien puede catalogar.

### Envío sin cuenta

- `envio.perfil_id` pasa a ser opcional; aparece `anon_id` (uuid del dispositivo en
  localStorage, mismo patrón que la valoración anónima de la migración 00008), más
  `nombre_contacto`, `email_contacto` y `clasificacion jsonb`.
- El alta va siempre por `recursos.crear_envio()` (security definer, con y sin sesión): fuerza
  `estado = 'enviado'` y limita a 30 envíos por hora y remitente.
- `mis_envios_anon()` y `reenviar_envio_anon()` dan acceso a lo enviado desde el dispositivo.
- `reclamar_envios()` los pasa a la cuenta al iniciar sesión, igual que ya se hacía con
  favoritos, listas y valoraciones.
- `email_remitente()` devuelve también el `email_contacto` de los anónimos, para poder avisar.

### Borrado de recursos

`envio.recurso_id` pasa a `on delete set null`: esa FK sin acción era lo que impedía borrar
nada. El resto de tablas ya iban en cascada. El envío sobrevive al borrado, solo pierde el
enlace al recurso.

## Experiencia de usuario

- **Ficha pública**: el botón principal lleva el icono del formato y dice qué abre («Abrir
  documento», «Abrir PDF»…). Debajo, «También disponible en» con un botón por formato
  alternativo. Cada apertura registra acceso, sea del que sea.
- **Tarjeta y tabla**: chip con el icono del formato y `+N` si hay alternativos. La tabla añade
  una columna «Formato» opcional.
- **`/enviar`**: funciona sin cuenta. Solo hace falta el enlace (o el título). Al pegar el
  enlace se dice qué se ha detectado. Un bloque plegable «¿Nos ayudas a clasificar tu recurso?»
  ofrece temáticas, tipo, idioma, etapas y edades, todo opcional, y viaja en
  `envio.clasificacion`.
- **`/envios`**: quien envió sin cuenta ve sus envíos del dispositivo y puede corregir y
  reenviar los devueltos.
- **Panel**: un único formulario para crear, editar y catalogar-y-publicar
  (`RecursoFormulario.svelte`), con las temáticas y la clasificación arriba del todo y la lista
  de archivos alternativos junto al enlace principal.

## Criterios de aceptación

- [x] Un enlace de Google Docs, Slides, Sheets, Forms, carpeta de Drive, YouTube, Canva o con
      extensión conocida se detecta sin llamar a ninguna API.
- [x] Un `drive.google.com/file/d/…` se afina con la API de Drive si hay cuenta de servicio, y
      si no, se queda en «Archivo en Drive» con el icono de Drive.
- [x] Un recurso puede tener el Doc, el PDF y el Word, y la ficha los ofrece los tres con su
      icono.
- [x] Se puede enviar un recurso sin haber iniciado sesión, y al entrar después esos envíos
      aparecen en la cuenta.
- [x] Un recurso se puede eliminar desde el panel, con confirmación.
- [x] Detectar formatos en lote no marca los recursos como editados en web.

## Preguntas abiertas

- ¿Merece la pena una faceta «Formato» en el buscador público, ahora que el dato existe? De
  momento solo es columna opcional de la tabla; se puede promover desde `/admin/config` sin
  tocar código en cuanto se decida.
