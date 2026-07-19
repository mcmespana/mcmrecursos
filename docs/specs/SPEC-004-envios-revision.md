# SPEC-004 · Envío rápido de recursos y revisión

> **Estado:** IMPLEMENTADA (migración 00007): /enviar multi-recurso, /envios con
> corregir-y-reenviar, cola /admin/revision con catalogación al publicar, devolución
> con motivo, descarte y emails (Resend, degradando a log sin API key).
> Pendiente: subida de archivos a Storage (hoy solo enlaces).
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

## Preguntas abiertas — RESUELTAS en SPEC-008 (2026-07-19)

- Notificaciones: **email con Resend desde el principio** (degradando a log sin API key)
  + sección "Mis envíos". Ver SPEC-008 §5 y §7.
- Revisión: **editor/admin todo + `edicion_local` los envíos de su MCM local**.
- El modelo de datos concreto de `envio` y el flujo de aprobación viven en SPEC-008 §1 y §6.
