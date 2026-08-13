# Roadmap

Todo lo que ya está hecho — Fases 0 a 5, SPEC-012, SPEC-013, la auditoría de seguridad de
`plans/` — vive en **[`docs/archivo/roadmap-historico.md`](archivo/roadmap-historico.md)**,
con fechas y detalle, para no perder ningún porqué. Este archivo enseña **solo lo que queda
por hacer**, para que abrirlo no dé pereza.

Estado de las specs: la tabla de `docs/00-vision.md` dice de un vistazo cuál está implementada,
cuál en curso y cuál es solo un borrador.

## 👉 Orden acordado (actualizado 2026-08-13)

1. ~~Detección de duplicados~~ ✅ hecha (2026-08-04/06, migración `00019`, SPEC-008 §2).
2. ~~Panel de salud del banco y tareas del equipo~~ ✅ hecho (2026-08-13, SPEC-014, migraciones
   `00021`–`00023`) — detalle en `docs/archivo/roadmap-historico.md`.
3. **Reflexión de UI/UX a fondo** — una pasada completa, no parches: recorrer los caminos reales
   (buscar → abrir → llevárselo, aportar un recurso, catalogar una tanda) buscando lo que sobra,
   lo que falta y lo que se contradice, y salir con una lista priorizada. Lo hecho hasta ahora ha
   ido por síntomas concretos; toca mirar el conjunto.
4. **Itinerarios de recursos** — spec **escrita, pendiente de validar**: `docs/specs/
   SPEC-015-itinerarios.md`. Un conjunto ordenado de recursos (p. ej. 20) pensado para
   recorrerse en un orden concreto, con su propia explicación general, construido sobre una
   tabla que ya existe sin usar desde la migración 00002. Se propone que absorba también los
   «presets de mazo configurables» pendientes desde Descubre (Fase 3.5) — ver la spec para
   el porqué y las 5 preguntas abiertas.
5. **Miniaturas de verdad, cacheadas** — cuando se pueda. Las carpetas de Drive no tienen ninguna
   y los `?sz=` de Google fallan a veces. Un endpoint que pide la miniatura una vez, la guarda en
   Storage y sirve desde ahí, con el primer archivo de dentro para las carpetas.
6. **Tests automatizados en CI, más allá de la lógica pura** — cuando sobren créditos. Ya hay
   una base (Vitest + GitHub Actions + tests de lógica pura, ver el histórico); falta
   Playwright en CI reutilizando el banco de pruebas de SPEC-013 (PostgREST de mentira con Auth
   y mutaciones), para dejar de probar todo a mano y que se vaya con la sesión.
7. **Payload adelgazado y búsqueda en servidor** — cuando sobre tiempo. Paso 1 de SPEC-013:
   mandar la descripción recortada y pedir la completa al abrir la ficha (~40% menos payload).
   Paso 2, ya con umbral (~3.000 recursos): `pg_trgm` + paginación + facetas contadas en BD.

Aparte de esto, lo que queda es **configuración** — ver `docs/05-configuracion-servicios.md`
para las claves pendientes (Gemini, Voyage, cuenta de servicio de Drive).

## Pendiente corto (Fase 3.7 UI/UX, sin urgencia)

- [ ] **Repaso de móvil**: la ficha es un panel lateral; comprobar el gesto de cierre. Y el
      corazón del mazo de /descubre no avisa al quitar un favorito, a diferencia del catálogo
- [ ] «Vistos hace poco» en la portada (localStorage) e insignia «nuevo» para lo publicado en
      los últimos días, con orden «recién añadidos»
- [ ] Exportar una lista guardada a PDF o CSV — encaja con el «Llevártelo» de la ficha

## Aparcado (decisión ya tomada, no reabrir sin pedirlo)

- Conversión a PDF de un `.docx`/`.xlsx`/`.pptx` suelto en Drive: no hay atajo por URL y
  necesita scope de escritura en Drive (`files.copy` + exportar + borrar la copia).
- Subida de archivos a Supabase Storage desde `/enviar`: hoy solo se guardan enlaces, y el
  enlace evita duplicar el fichero y decidir su destino final.
