# SPEC-017 · Lista de espera, sugerencias y catálogo de demostración

> **Estado:** implementada (2026-08-30)
> **Depende de:** SPEC-001 (auth y perfil), SPEC-002 (catálogo), SPEC-004 (envíos)

## Objetivo

El banco tiene la maquinaria montada (buscador, filtros, valoraciones, itinerarios) y muy poco
contenido real. Quien entra hoy ve una herramienta que funciona sobre un catálogo casi vacío y
se va sin dejar rastro. Esta spec cierra ese hueco con tres piezas:

1. Un modal de bienvenida que explica la situación con honestidad y recoge el correo de quien
   quiere que le avisen — y, opcionalmente, quiere ayudar a construir el banco.
2. Un buzón de sugerencias abierto (idea / problema / recurso que falta / otro), sin fricción
   de cuenta ni correo obligatorio.
3. Un catálogo de recursos **de demostración**, marcado como tal en un campo (no en el título),
   para que la interfaz se pueda enseñar de verdad: facetas con varias opciones, relacionados,
   un itinerario con dos tramos, capa social con datos.

## Alcance

Dentro:
- Tabla `recursos.espera` y función `apuntarse_espera()` — alta idempotente por correo.
- Tabla `recursos.sugerencia` y función `crear_sugerencia()` — sin política de insert directa,
  todo pasa por la función `security definer` (mismo patrón que `crear_envio`, SPEC-004).
- `recursos.cuenta_espera()` pública (solo el número, nunca los correos).
- `recursos.sugerencia_a_tarea()` — conecta el buzón con las tareas del equipo (SPEC-016).
- `recurso.es_demo` — marca de recurso de muestra, sustituye al prefijo `[EJEMPLO]` en el título.
- Modal de bienvenida (`ModalBienvenida.svelte`), panel de sugerencias (`PanelSugerencias.svelte`
  + `FormularioSugerencia.svelte` compartido), botón flotante y página `/sugerencias`.
- Panel `/admin/comunidad`: lista de espera (solo editor/administrador) y sugerencias (también
  edición local), con exportar CSV, copiar correos y convertir en tarea.
- Correo de bienvenida a la lista de espera vía Resend (`emailBienvenidaEspera`).
- 19 recursos de demostración con metadatos, tags, autores, relaciones, valoraciones y accesos
  realistas, repartidos por tipo/etapa/edad; el itinerario «Buscad y encontraréis» pasa a dos
  tramos; los atajos de portada se renuevan.

Fuera (decisión explícita, no reabrir sin pedirlo):
- Envío masivo del aviso de lanzamiento a la lista de espera: se hace por fuera de la app
  (exportando el CSV desde `/admin/comunidad`), no hay campaña automática.
- Autenticación o CRM sobre la lista de espera: es una tabla de correos, no un producto aparte.
- Analítica de conversión del modal (tasas de apertura, A/B): fuera de alcance por ahora.

## Modelo de datos

```
recursos.espera
  id uuid pk, email text unique(lower), nombre text, quiere_ayudar boolean,
  ayudas text[] (aportar|catalogar|probar|difundir), mensaje text,
  origen text (modal|pagina|otro), anon_id uuid, perfil_id uuid,
  contactado_at timestamptz, notas text, created_at timestamptz

recursos.sugerencia
  id uuid pk, tipo text (idea|problema|falta|otro), mensaje text, email text,
  ruta text, estado text (nueva|vista|resuelta|descartada), anon_id uuid,
  perfil_id uuid, tarea_id uuid → tarea, created_at, updated_at

recursos.recurso.es_demo boolean not null default false
```

RLS: `espera` solo la lee/actualiza editor/administrador, nadie inserta directamente (la función
`security definer` es la única puerta). `sugerencia` la lee/actualiza también edición local;
tampoco tiene insert directo. `crear_version()` copia `es_demo` del origen para que una versión
de un recurso de muestra siga siendo de muestra.

## Experiencia de usuario

- **Modal de bienvenida**: sale ~900ms después de cargar la portada (para que se vea el banco
  detrás antes de la invitación), en cada visita hasta que se deja el correo. Un solo campo
  obligatorio (correo); «¿quieres ayudar?» es una pregunta opcional de un clic que despliega
  cuatro chips de cómo. Al enviar, un segundo paso recuerda que ya se pueden enviar recursos sin
  esperar a nadie. No aparece en `/admin/*` ni en `/enviar`.
- **Ficha de un recurso de muestra**: insignia ámbar «Demo» en tarjeta y ficha; el CTA «Abrir
  recurso» se sustituye por un aviso y un botón que reabre el modal; vista previa, descargas y
  copia editable se desactivan (el enlace no lleva a ningún archivo real).
- **Buzón de sugerencias**: botón flotante circular en toda la app pública (se esconde al
  hacer scroll hacia abajo), abre un panel con cuatro tarjetas de tipo → revela un textarea al
  elegir. Página `/sugerencias` con el mismo formulario y contexto adicional (enlazable desde
  fuera).
- **`/admin/comunidad`**: dos pestañas, tabla de espera con filtro y «marcar como escrito»,
  lista de sugerencias con filtro, cambio de estado y «convertir en tarea».

## Criterios de aceptación

- [x] El modal no aparece más de una vez por sesión de navegador tras dejar el correo.
- [x] Apuntarse dos veces con el mismo correo actualiza (no duplica) y no reenvía el correo de
      bienvenida.
- [x] Una sugerencia sin correo se guarda igual; con correo, viaja para poder contestar.
- [x] Ningún recurso de muestra intenta abrir su enlace ni mostrar vista previa.
- [x] `svelte-check`, `vitest` y `npm run build` pasan sin errores con los cambios.

## Preguntas abiertas

- Cuándo lanzar el correo de aviso masivo a la lista de espera: decisión de negocio, no técnica.
- Si el buzón de sugerencias crece, valorar filtros por `ruta` o agrupación por recurso.
