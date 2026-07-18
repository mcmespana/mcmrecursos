# SPEC-004 · Envío rápido de recursos y revisión

> **Estado:** borrador
> **Depende de:** SPEC-001, SPEC-002

## Objetivo

Que cualquier usuario con login pueda aportar recursos en segundos (múltiples de golpe,
metadatos mínimos) y que editores/admins los revisen, completen y publiquen.

## Modelo de datos (borrador)

- `envio` (perfil, título, enlace o archivo en Storage, notas, estado:
  `pendiente | en_revision | aprobado | rechazado`, recurso_id al aprobar, revisor, motivo).

## Experiencia de usuario

- `/enviar`: formulario ultraligero — pegar enlaces o arrastrar archivos (multi), título y
  poco más. Todo lo demás lo completa el revisor.
- Cola en `/admin/revision`: aprobar convierte el envío en `recurso` (y opcionalmente lo
  vuelca al Sheet o marca para catalogar); rechazar pide motivo.
- El remitente ve el estado de sus envíos.

## Criterios de aceptación

- [ ] Enviar 5 recursos (enlaces) cuesta < 1 minuto.
- [ ] Archivos suben a Supabase Storage; el revisor decide su destino final en Drive.
- [ ] Solo editor/admin ve la cola; el remitente solo sus envíos.

## Preguntas abiertas

- ¿Notificaciones (email) al remitente al aprobar/rechazar?
- ¿`edicion_local` revisa los envíos de su MCM local?
