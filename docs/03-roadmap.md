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
6. **Itinerarios de recursos** — spec **validada (2026-08-20)**, lista para implementar:
   `docs/specs/SPEC-015-itinerarios.md`. **Es lo siguiente.** Un conjunto ordenado de recursos
   (p. ej. 20 sesiones) para recorrerse en un orden concreto, con su explicación general, sobre
   las tres tablas que existen vacías desde la migración 00002.

   Decidido al validar: **no** es lo mismo que los presets de mazo de Descubre (van aparte),
   **sin** progreso personal, `etapas` con el mismo vocabulario y el mismo selector que en el
   resto de la app, 10-12 itinerarios como techo (así que la parte pública es una rejilla sin
   buscador ni paginación) y escritura para editores y administradores, que es la RLS que ya
   está puesta.

   El encargo del editor es explícito: **pocos campos**. El itinerario tiene cuatro (nombre,
   descripción, etapas, estado) y los bloques están escondidos hasta que alguien pulsa «partir
   en tramos» — el caso normal es una sola lista ordenada. Vive en `/admin/itinerarios`.

   Primer paso listo y **sin aplicar**: `supabase/migrations/00026_itinerarios.sql` — `orden` en
   `recurso_bloque` (sin eso no hay itinerario), `estado` borrador/publicado, `etapa` → `etapas[]`,
   nombre de bloque opcional y lectura acotada a lo publicado.
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
