# SPEC-005 · Sincronización Google Sheet → BD

> **Estado:** borrador
> **Depende de:** SPEC-002 (modelo de `recurso`)

## Objetivo

El Sheet maestro es la herramienta de catalogación masiva. Un sync idempotente lo vuelca a
Postgres: la web nunca lee del Sheet.

## Diseño

- Lectura del Sheet con cuenta de servicio de Google (API Sheets, solo lectura).
- **Upsert por columna `id`** (estable, nunca se recicla). Filas sin `id` → se les asigna y
  se escribe de vuelta al Sheet (única escritura permitida).
- Filas desaparecidas del Sheet → `recurso.estado = 'retirado'` (nunca DELETE: preserva
  valoraciones, favoritos, accesos).
- Disparo: botón "Sincronizar" en `/admin` + cron opcional. Log de cada sync (filas
  creadas/actualizadas/retiradas, errores de validación por fila).
- Validación por fila con reporte claro (fila 217: falta 'tipo') sin abortar el resto.

## Criterios de aceptación

- [ ] Sync completo de 1.500 filas < 30 s y es idempotente (re-ejecutar no cambia nada).
- [ ] Editar una celda del Sheet y sincronizar actualiza solo ese recurso.
- [ ] Borrar una fila retira el recurso sin perder su capa social.
- [ ] El log del sync es visible en `/admin`.

## Preguntas abiertas

- ¿Escritura inversa BD → Sheet cuando se edita desde la web? (propuesta fase 3: sí, para
  que el Sheet no quede obsoleto).
- Formato exacto del Sheet (pestañas, cabeceras) — junto a SPEC-002.
