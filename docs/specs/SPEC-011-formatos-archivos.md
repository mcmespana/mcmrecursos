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

Entra también (2026-07-29): descargar en PDF/Office y hacerse una copia editable de los
documentos de Google, y el favicon del sitio como miniatura de los recursos que son una web.
Ver §«URLs de Google» más abajo.

Queda fuera **por ahora, y está en el roadmap** (Fase 3.6):

- Convertir a PDF un **.docx/.xlsx/.pptx que viva en Drive como fichero suelto**. Esto sí
  necesita cuenta de servicio con permiso de escritura, y no es un capricho: ver §«El caso del
  Word en Drive».
- Subida de archivos a Supabase Storage desde `/enviar`: se siguen guardando enlaces. Quien
  aporta suele tener el material ya en su Drive, y el enlace evita duplicar el fichero y tener
  que decidir su destino final.

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
- [x] Un documento de Google ofrece «PDF», «Word/Excel/PowerPoint» y «Hacer una copia» sin que
      el banco tenga configurada ninguna credencial.
- [x] Un recurso que es una web enseña el favicon del sitio, y si Google no lo tiene, el icono
      de su tipo.

## URLs de Google: descargar y copiar sin API ni credenciales

Los editores de Google exportan **por URL**. No hace falta la API de Drive, ni cuenta de
servicio, ni permiso de escritura: basta sustituir el `/edit` final del enlace. Y como el enlace
lo abre quien lo pulsa, se resuelve con SUS permisos.

| Familia            | Cómo va el formato | URL                                          |
| ------------------ | ------------------ | -------------------------------------------- |
| Documento (Docs)   | en la **query**    | `…/document/d/ID/export?format=pdf`          |
| Hoja (Sheets)      | en la **query**    | `…/spreadsheets/d/ID/export?format=xlsx`     |
| Presentación       | en la **ruta**     | `…/presentation/d/ID/export/pdf`             |
| Dibujo             | en la **ruta**     | `…/drawings/d/ID/export/png`                 |
| Copia editable     | —                  | `…/document/d/ID/copy`                       |

**Verificado el 2026-07-29** contra documentos públicos de Google, sin ninguna credencial:
`export?format=pdf` de una hoja devuelve `application/pdf` (53 KB), `?format=xlsx` devuelve el
mime de Office y `?format=csv` un `text/csv`; en presentaciones funcionan **las dos** formas
(`/export/pdf` y `?format=pdf`) y devuelven el PDF real. Se usa la de la ruta, que es la
documentada para presentaciones.

Se ofrecen dos formatos por familia (PDF + el equivalente de Office) porque son los que se
piden de verdad: el PDF para imprimir y repartir, el Office para adaptarlo sin cuenta de
Google. Google admite bastantes más y añadir uno es meterlo en `FAMILIA_GOOGLE`
(`catalogo/formatos.ts`).

`/copy` abre el «¿Quieres hacer una copia?» de Google y solo necesita permiso de **lectura**
sobre el original, así que nadie puede modificar el documento del banco por esta vía. (Existe
también `/template/preview`, que enseña el documento con un botón «Usar plantilla»; se descarta
porque en Google Sites exige compartir con permiso de **edición**, y no compensa manejar dos
mecanismos con reglas distintas.)

**Requisito y modo de fallo.** El documento tiene que estar compartido por enlace, que es como
ya está todo lo del banco: si no lo estuviera, Google pide cuenta — exactamente lo que pasa hoy
al pulsar «Abrir recurso». El peor caso no empeora, así que no hay nada que validar antes de
mostrar el botón.

### El caso del Word en Drive

Un `.docx` subido a Drive **no** tiene atajo por URL, y la API tampoco ayuda de forma directa:
`files.export` solo admite ficheros de los editores de Google y responde `403 Export only
supports Docs Editors files` con cualquier binario. El camino real es de tres pasos —
`files.copy` con `mimeType: application/vnd.google-apps.document` para convertirlo, exportar la
copia y borrarla — y eso sí necesita un scope de **escritura** en Drive. De ahí que siga
aparcado: no es la misma cosa que lo anterior aunque el usuario lo viva igual.

### Favicon como miniatura de las webs

`https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&size=64&url=ORIGEN`
devuelve el favicon del sitio. Se usa como respaldo de miniatura en los recursos de formato
`web`: la marca del sitio se reconoce mucho mejor que un globo genérico. Para dominios que
Google no tiene indexados responde **404 con un PNG de respaldo**, y como el navegador dispara
`error` en un `<img>` con estado no-2xx, cae solo en el icono del tipo. Degradación gratis.

(La miniatura de Drive —`drive.google.com/thumbnail?id=ID&sz=w640`— ya se usaba desde SPEC-002
en `miniatura()`; admite además `&sz=wANCHO-hALTO` si algún día interesa fijar el alto.)

## Faceta «Formato» en el buscador (migración 00017)

El dato ya existía, así que promocionarlo a filtro fue insertar una fila en `recursos.faceta`:
el buscador la lee de BD y no hizo falta tocar código de rutas. Va después de «Soporte». El
extractor cuenta el enlace principal **y** los alternativos, así que filtrar por «PDF»
encuentra también los recursos que solo tienen el PDF como formato secundario. Se puede
ocultar o reordenar desde `/admin/config`.

## Estados de acción en la interfaz

Todo lo que habla con el servidor lo dice ahora en pantalla: `<Button cargando>` con spinner y
`aria-busy`, `<Button hecho>` con un check que se apaga solo, filas atenuadas mientras su
acción está en vuelo y una barra de progreso al navegar. El vocabulario completo está en
`docs/04-diseno.md` §5. Que el botón deje de aceptar clics es, además, la segunda barrera
contra el doble envío (la primera es la idempotencia del servidor).

## Preguntas abiertas

- ¿Interesa ofrecer más formatos de descarga (ODT/ODS/ODP, EPUB, CSV) o con PDF + Office se
  cubre lo que la gente pide? Ampliarlo es una línea en `FAMILIA_GOOGLE`.
