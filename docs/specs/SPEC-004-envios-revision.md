# SPEC-004 · Envío rápido de recursos y revisión

> **Estado:** IMPLEMENTADA (migraciones 00007 y 00015): /enviar multi-recurso **sin necesidad
> de cuenta**, /envios con corregir-y-reenviar, cola /admin/revision con catalogación al
> publicar, devolución con motivo, descarte y emails (Resend, degradando a log sin API key).
> Pendiente: subida de archivos a Storage (hoy solo enlaces).
> **Depende de:** SPEC-001, SPEC-002 · **Ampliada por:** SPEC-011

## Objetivo

Que cualquiera pueda aportar recursos en segundos (varios de golpe, metadatos mínimos, con o
sin cuenta) y que editores/admins los revisen, completen y publiquen.

## Envío sin cuenta (SPEC-011)

Pedir login antes de aportar es un peaje que sobra: quien tiene material en su Drive lo comparte
si le cuesta diez segundos, no si le cuesta darse de alta. Desde la migración 00015:

- El envío va por `recursos.crear_envio()`, que funciona con y sin sesión. Sin sesión queda
  atado al uuid del dispositivo (`envio.anon_id`) y, opcionalmente, a un email de contacto para
  poder avisar de la publicación o la devolución.
- Al iniciar sesión, `reclamar_envios()` traspasa a la cuenta lo enviado desde el dispositivo.
- Solo hace falta el enlace: el título, si falta, lo pone el equipo al catalogar. Los campos de
  clasificación son todos opcionales y viajan en `envio.clasificacion` como pista para el
  revisor.
- Freno de spam: 30 envíos por hora y remitente, aplicado dentro de la función.

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
