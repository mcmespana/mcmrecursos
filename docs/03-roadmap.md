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
5. ~~Reflexión de UI/UX a fondo~~ ✅ hecha y ejecutada P1+P2 (2026-08-20) → **[`docs/06-reflexion-uiux.md`](06-reflexion-uiux.md)**.
   20 hallazgos verificados recorriendo la app contra producción, con un apartado de lo que conviene
   **no** tocar. **P1 y P2 ya están hechos** (ver §Estado de ejecución del documento): puerta visible
   para aportar en móvil, héroe que se aparta al buscar, marcas de trabajo interno solo para el
   equipo, poda de facetas que no pueden filtrar, y legibilidad de la tarjeta.

   **Queda de ahí**, y son los tres que necesitan algo que hoy no hay:
   - **F11 · estanterías editoriales de la portada** — espera catálogo: con siete recursos
     enseñarían tres veces los mismos siete. En cuanto haya ~50, sube a lo primero.
   - **F16 + F17 · camino de catalogar** — un «aceptar la propuesta de la IA y publicar» de dos clics
     y selección múltiple en la cola de revisión. Antes hay que recorrerlo con sesión y cronómetro.
   - **F4 · decisión de taxonomía**: si «Soporte» y «Formato» preguntan lo mismo, cuál se queda.

   El documento deja además una pregunta de fondo que no es de interfaz: el banco tiene **7 recursos
   públicos** y máquina para miles, así que el cuello de botella no es encontrar, es **tener**. Eso
   reordena todo lo demás.
6. ~~Itinerarios de recursos~~ ✅ hecho (2026-08-20/21, SPEC-015, migraciones `00026` y `00028`) —
   `/admin/itinerarios` con el editor de cuatro campos y lista ordenada, y `/itinerarios` +
   `/itinerarios/[id]` en público. La segunda vuelta cerró la ficha con anterior/siguiente **dentro**
   del itinerario, reordenar los tramos entre sí, arrastrar y soltar, `imagen` y `edades`. Queda solo
   «recorrerlo en Descubre», y se descarta asignar bloques desde el Sheet.
7. ~~Presets de filtros («Atajos» / «Mazos»)~~ ✅ hecho (2026-08-21, migración `00029`, SPEC-006
   §Filtros + SPEC-007 §Mazos guardados) — un preset es una **combinación de filtros con nombre**,
   guardada en la misma sintaxis de URL que ya usaban el buscador y Descubre, así que el mismo chip
   recorta la rejilla en `/` y arma el mazo en `/descubre`. Se crean desde el propio buscador
   («Guardar como atajo», con los filtros puestos y viendo cuántos recursos dejan) y se gestionan en
   Ajustes → Atajos. Con esto cae también la última pieza pendiente de SPEC-007. La **asignación de
   bloques de itinerario desde el Sheet** se descarta por decisión del usuario en la misma sesión.
8. **Miniaturas de verdad, cacheadas** — cuando se pueda. Las carpetas de Drive no tienen ninguna
   y los `?sz=` de Google fallan a veces. Un endpoint que pide la miniatura una vez, la guarda en
   Storage y sirve desde ahí, con el primer archivo de dentro para las carpetas.
9. **Tests automatizados en CI, más allá de la lógica pura** — cuando sobren créditos. Ya hay
   una base (Vitest + GitHub Actions + tests de lógica pura, ver el histórico); falta
   Playwright en CI reutilizando el banco de pruebas de SPEC-013 (PostgREST de mentira con Auth
   y mutaciones), para dejar de probar todo a mano y que se vaya con la sesión.
10. **Payload adelgazado y búsqueda en servidor** — cuando sobre tiempo. Paso 1 de SPEC-013:
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
