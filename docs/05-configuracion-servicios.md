# 05 · Configuración de servicios y claves

> Guía única para el día que te sientes a configurar todo. Cada bloque dice **qué clave
> pedir, dónde sacarla y dónde ponerla**. Todo lo que no esté configurado **degrada con
> gracia**: la app funciona igual y la función concreta aparece como «no disponible».

## Dónde van las variables de entorno

- **Local:** `app/.env` (copia de `app/.env.example`). No se sube a git.
- **Producción (Vercel):** proyecto → **Settings → Environment Variables**. Tras añadir/cambiar
  una variable, **redeploy** para que tome efecto.

Resumen de todas las variables:

| Variable | Para qué | ¿Obligatoria? |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | Conexión a Supabase (cliente) | ✅ (ya puesta) |
| `PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase | ✅ (ya puesta) |
| `SUPABASE_SECRET_KEY` | Tareas admin server-only (crear usuarios, etc.) | Recomendada |
| `SYNC_CLAVE` | Clave del sync del Google Sheet | Solo si usas el Sheet |
| `RESEND_API_KEY` | Emails transaccionales (aprobado/devuelto) | Opcional |
| `RESEND_FROM` | Remitente de los emails | Opcional |
| `GEMINI_API_KEY` | IA: autoclasificación (Gemini) | Opcional |
| `GEMINI_MODELO` | Modelo de Gemini (por defecto `gemini-3.6-flash`) | Opcional |
| `VOYAGE_API_KEY` | Búsqueda semántica (embeddings Voyage) | Opcional |
| `VOYAGE_MODELO` | Modelo de embeddings (por defecto `voyage-4-lite`) | Opcional |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Leer documentos de Drive para clasificar | Opcional |

---

## 1. Gemini (autoclasificación) — `GEMINI_API_KEY`

**Qué es:** el motor de IA que propone tipo/etapas/edades/tags/descripción de un recurso.

**Cómo sacarla (gratis):**
1. Entra en **Google AI Studio** → https://aistudio.google.com/apikey
2. «Create API key» (puedes crearla en un proyecto de Google Cloud nuevo o existente).
3. Copia la clave (`AIza…`).

**Dónde ponerla:** `GEMINI_API_KEY` en `.env` y en Vercel.

**Modelo:** por defecto `gemini-3.6-flash` (jul 2026, el mejor Flash: potente y barato). Si
quieres otro, pon `GEMINI_MODELO`:
- `gemini-3.6-flash` — recomendado para clasificar (equilibrio calidad/precio).
- `gemini-3.5-flash-lite` — más barato/rápido, para lotes grandes.
- `gemini-flash-latest` — alias estable que apunta al Flash GA vigente (por si un día un
  nombre concreto se retira).

**Coste:** los Flash tienen free tier generoso; a nuestro volumen es prácticamente gratis.

---

## 2. Voyage (búsqueda semántica) — `VOYAGE_API_KEY`

**Qué es:** convierte cada recurso y cada búsqueda en un «embedding» (vector) para encontrar
por significado, no solo por palabras. Se guarda en pgvector (Supabase).

**Por qué Voyage:** **200 millones de tokens gratis** por cuenta. Indexar los ~1.500 recursos
son ~1-2M tokens **una sola vez**; las búsquedas, unos pocos tokens. No se agota ni de broma,
y si algún día pasa, `voyage-4-lite` cuesta **$0,02/millón** (calderilla). Calidad top.

**Cómo sacarla:**
1. https://www.voyageai.com/ → crea cuenta → **Dashboard → API Keys** → crea una.
2. Copia la clave.

**Dónde ponerla:** `VOYAGE_API_KEY` (y opcional `VOYAGE_MODELO`, por defecto `voyage-4-lite`).

**Cómo activarla del todo (una vez tengas la clave):**
1. Aplica la migración `supabase/migrations/00014_busqueda_semantica.sql` (crea la extensión
   `vector`, la columna `recurso.embedding` y la función `buscar_semantica`). Se aplica con el
   MCP de Supabase (`apply_migration`) o pegándola en el SQL Editor del dashboard.
2. Pon `VOYAGE_API_KEY` en el entorno (Vercel) y redespliega.
3. En **/admin/recursos**, pulsa **«Reindexar búsqueda»**. Genera los embeddings de los
   recursos publicados en tandas de ~128; si quedan más, vuelve a pulsar hasta que diga
   «Índice semántico al día». Al editar un recurso, su embedding se invalida y se regenera en
   la siguiente reindexación.

A partir de ahí, en el buscador público aparece la etiqueta **«por significado»** cuando la
IA añade recursos afines que la búsqueda por palabras no habría encontrado. Sin la clave, el
buscador funciona igual (solo por palabras) y la etiqueta no aparece.

> Ojo: Voyage **solo hace embeddings** (búsqueda), no clasifica. Clasificar sigue siendo Gemini.

---

## 3. Cuenta de servicio de Google (leer Drive) — `GOOGLE_SERVICE_ACCOUNT_JSON`

**Qué es y por qué es «mágico»:** ahora mismo la IA clasifica solo con el **título y las notas**
del recurso. Con la cuenta de servicio, la app puede **abrir el documento de Drive** (el PDF,
el Google Doc, la presentación) y **leer su texto**. Así la IA ve el contenido real —de qué va
la sesión, para qué edad, qué tipo de actividad— y clasifica **mucho** mejor. De «adivina por
el título» a «lo ha leído».

**Cómo crearla:**
1. **Google Cloud Console** → https://console.cloud.google.com/ (usa el mismo proyecto que la
   clave de Gemini si quieres).
2. **APIs y servicios → Biblioteca** → activa **Google Drive API** (y **Google Docs API** si
   quieres leer Google Docs con formato).
3. **APIs y servicios → Credenciales → Crear credenciales → Cuenta de servicio**. Ponle
   nombre (p. ej. `banco-recursos-lector`). No hace falta darle roles del proyecto.
4. En la cuenta creada → pestaña **Claves → Agregar clave → Crear clave nueva → JSON**. Se
   descarga un `.json` con `client_email`, `private_key`, etc.
5. **Compartir las carpetas del banco con la cuenta de servicio:** copia el `client_email` del
   JSON (algo como `banco-recursos-lector@tu-proyecto.iam.gserviceaccount.com`) y **comparte**
   con ese correo (permiso *lector*) las carpetas/archivos de Drive del banco. Sin esto, la
   cuenta no puede leer nada (Drive es privado).

**Dónde ponerla:** pega el **JSON entero en una sola línea** en `GOOGLE_SERVICE_ACCOUNT_JSON`.
(En Vercel se puede pegar tal cual; localmente, cuidado con los saltos de línea de la
`private_key` — deben quedar como `\n`.)

**¿Es la misma que edita el Google Sheet?** **No, y no hace falta.** Hoy el Sheet **no está
montado** (pendiente, ver SPEC-005): cuando lo montes, el Sheet **empuja** los datos a Supabase
con un **Apps Script** y una `SYNC_CLAVE` (no una cuenta de servicio). La cuenta de servicio de
aquí es **solo para leer documentos** de Drive de cara a la IA. Son cosas independientes; puedes
tener una, otra, las dos o ninguna.

---

## 4. Login de administración (usuario + contraseña)

**Qué es:** una forma de entrar al panel **sin depender de Google OAuth** (que aún está
pendiente de configurar). Es un login de email+contraseña normal de Supabase, con una entrada
**discreta** (enlace escondido en el pie de página). **No hay contraseña en el código** (eso
sería un agujero de seguridad): el usuario se crea en Supabase y la contraseña la eliges tú.

**Cómo crear tu usuario admin:**
1. **Supabase → Authentication → Providers:** asegúrate de que **Email** está habilitado
   (suele venir activado). Si quieres entrar sin verificar el correo, desactiva «Confirm email»
   o marca el usuario como confirmado al crearlo.
2. **Supabase → Authentication → Users → Add user →** email + contraseña (marca
   *Auto Confirm User*). Usa una contraseña larga y única.
3. Ese usuario nace como perfil con rol `consulta`. Para hacerlo admin, ejecuta en el **SQL
   editor** de Supabase:
   ```sql
   update recursos.perfil set rol = 'administrador' where email = 'TU_EMAIL';
   ```
   (o preautorízalo antes en `recursos.acceso_previo` con rol `administrador`, ver SPEC-001).
4. Entra en **`/entrar`** de la web (o pulsa el punto discreto del pie) con ese email y
   contraseña.

> Recomendación de seguridad: crea un usuario por persona (tú, cada admin), no uno compartido.
> Así puedes rotar/!desactivar contraseñas individualmente.

---

## 5. Google OAuth (login con Google) — pendiente

Para el login «Entrar con Google» del público (SPEC-001), en el dashboard de Supabase:
**Authentication → Providers → Google**, y pega el **Client ID/Secret** de una credencial
OAuth creada en Google Cloud (**APIs y servicios → Credenciales → ID de cliente de OAuth**,
tipo *Aplicación web*, con la URL de callback de Supabase). Mientras no esté, usa el login de
usuario+contraseña del punto 4.

---

## 6. Resend (emails) — `RESEND_API_KEY`

Para los correos de «envío aprobado/devuelto». https://resend.com → API Keys. Sin clave, los
emails se registran en el log y no se envían (la app no se rompe). Opcional: `RESEND_FROM`
(remitente; requiere dominio verificado en Resend).

---

## 7. Supabase — claves ya puestas + `SUPABASE_SECRET_KEY`

`PUBLIC_SUPABASE_URL` y `PUBLIC_SUPABASE_ANON_KEY` ya están. `SUPABASE_SECRET_KEY` (Settings →
API → *service_role* / secret) sirve para tareas server-only con permisos totales; guárdala
solo en el servidor, nunca en el cliente. `SYNC_CLAVE` es la clave del sync del Sheet
(`select clave from recursos.sync_config;`).

---

## Orden sugerido para el día de la configuración

1. **`GEMINI_API_KEY`** → enciende la autoclasificación (lo que más curro ahorra).
2. **Usuario admin** (punto 4) → para entrar cómodo sin OAuth.
3. **Cuenta de servicio** (punto 3) → la IA lee los documentos y clasifica de lujo.
4. **`VOYAGE_API_KEY`** → búsqueda semántica.
5. Resto (Resend, OAuth Google, Sheet) cuando toque.
