# Roadmap

Todo lo que ya está hecho — Fases 0 a 5, SPEC-012, SPEC-013, la auditoría de seguridad de
`plans/` — vive en **[`docs/archivo/roadmap-historico.md`](archivo/roadmap-historico.md)**,
con fechas y detalle, para no perder ningún porqué. Este archivo enseña **solo lo que queda
por hacer**, para que abrirlo no dé pereza.

Estado de las specs: la tabla de `docs/00-vision.md` dice de un vistazo cuál está implementada,
cuál en curso y cuál es solo un borrador.

## 👉 Orden acordado (actualizado 2026-08-15)

1. ~~Detección de duplicados~~ ✅ hecha (2026-08-04/06, migración `00019`, SPEC-008 §2).
2. ~~Panel de salud del banco y tareas del equipo~~ ✅ hecho (2026-08-13, SPEC-014, migraciones
   `00021`–`00023`) — detalle en `docs/archivo/roadmap-historico.md`.
3. ~~Buzón de avisos y tareas en toda la app~~ ✅ hecho (2026-08-15, SPEC-016, migración `00025`).
4. ~~Rediseñar la rejilla de señales de `/admin/salud`~~ ✅ hecho (2026-08-15) — tres niveles de
   gravedad que deciden el peso visual, el número como héroe de cada tarjeta y el resumen contando
   señales en vez de sumar unidades distintas.
5. ~~Reflexión de UI/UX a fondo~~ ✅ hecha (2026-08-20) → **[`docs/06-reflexion-uiux.md`](06-reflexion-uiux.md)**.
   20 hallazgos verificados recorriendo la app contra producción, con lista priorizada P1/P2/P3 y un
   apartado de lo que conviene **no** tocar. Pendiente: **decidir contigo la priorización** y
   ejecutar. Los cinco P1 son media tarde en total; el primero (en móvil no hay ninguna puerta para
   aportar un recurso) es la corrección con mejor valor/esfuerzo de todo el documento.

   El documento deja además una pregunta de fondo que no es de interfaz: el banco tiene **7 recursos
   públicos** y máquina para miles, así que el cuello de botella no es encontrar, es **tener**. Eso
   reordena todo lo demás.
6. **Itinerarios de recursos** — spec **escrita, pendiente de validar**: `docs/specs/
   SPEC-015-itinerarios.md`. Un conjunto ordenado de recursos (p. ej. 20) pensado para
   recorrerse en un orden concreto, con su propia explicación general, construido sobre una
   tabla que ya existe sin usar desde la migración 00002. Se propone que absorba también los
   «presets de mazo configurables» pendientes desde Descubre (Fase 3.5) — ver la spec para
   el porqué y las 5 preguntas abiertas.
7. **Miniaturas de verdad, cacheadas** — cuando se pueda. Las carpetas de Drive no tienen ninguna
   y los `?sz=` de Google fallan a veces. Un endpoint que pide la miniatura una vez, la guarda en
   Storage y sirve desde ahí, con el primer archivo de dentro para las carpetas.
8. **Tests automatizados en CI, más allá de la lógica pura** — cuando sobren créditos. Ya hay
   una base (Vitest + GitHub Actions + tests de lógica pura, ver el histórico); falta
   Playwright en CI reutilizando el banco de pruebas de SPEC-013 (PostgREST de mentira con Auth
   y mutaciones), para dejar de probar todo a mano y que se vaya con la sesión.
9. **Payload adelgazado y búsqueda en servidor** — cuando sobre tiempo. Paso 1 de SPEC-013:
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
