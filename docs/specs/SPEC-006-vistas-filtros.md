# SPEC-006 · Vistas del catálogo y sistema de filtros

> **Estado:** PARCIALMENTE IMPLEMENTADA — §1 galería, §2 tabla admin (/admin/recursos),
> §2b tabla pública (toggle `?vista=tabla`, columnas configurables en localStorage,
> componente `RecursoTabla`), filtros por facetas dirigidos por la tabla `faceta`
> (editable en /admin/config), chips activos y URL sincronizada. PENDIENTE: §3 itinerario,
> §4 top/descubrir, presets rápidos y faceta de rango (año).
> **Depende de:** SPEC-002

## Vistas (conmutables, misma búsqueda debajo)

1. **Galería (por defecto)** — grid de tarjetas grandotas: miniatura, tipo (badge con color
   por grupo), nombre, etapas, estrellas + nº votos, corazón. Animación `flip` al filtrar.
2. **Tabla densa** — estilo GEG pero moderna: una fila por recurso, columnas configurables,
   ordenable por cualquier columna (nombre, año, valoración, usos…). Para editores es la
   vista de trabajo (implementada en /admin/recursos).
2b. **Tabla para usuarios normales** (anotado e implementado 2026-07-19) — vista alternativa del buscador
   público, conmutable con la galería: filas compactas SIN imagen (o miniatura muy pequeña
   ~32px), columnas configurables por el usuario (mostrar/ocultar: tipo, etapas, edades,
   año, idioma, soporte, valoración, MCM local…) con su elección recordada en
   localStorage, ordenable por columna, y los mismos filtros/facetas/URL del buscador.
   Referencia conceptual: la tabla de GEG Spain, pero moderna. Pensada para quien quiere
   comparar muchos recursos de un vistazo.
3. **Itinerario** — navegación estructural: eliges etapa (MIC/COM/LC) → itinerario → bloques
   en orden con sus recursos colgando. La vista "programática" para preparar el curso.
4. **Top / Descubrir** — estanterías horizontales: mejor valorados, más usados, novedades,
   por temática destacada (tags). La portada cuando no buscas nada concreto.
5. (futura) **Listas** — las listas propias y compartidas como vista más.

## Filtros

- **Barra de búsqueda de texto grande** (nombre + descripción + tags + autor) con resultados
  al teclear (Orama, <16 ms).
- **Facetas combinables con contadores en vivo**: al marcar "MIC" los contadores del resto
  de facetas se recalculan (estilo tienda online). Orden y visibilidad de facetas dirigidos
  por la tabla `faceta` (añadir filtro nuevo = configuración, no código).
- **Chips de filtros activos** encima de los resultados, quitables de un toque + "limpiar todo".
- **Multiselect dentro de una faceta = OR** (MIC o COM); **entre facetas = AND** (MIC ∧ PDF).
- **URL sincronizada** con el estado completo de búsqueda → compartible y con historial.
- **Presets rápidos** (chips sugeridos): "Adviento", "Para monitores", "Lo mejor de este año"…
  configurables por admin.
- Facetas previstas al inicio: tipo, etapas, edades, tags, nivel, mcm_local, idioma, soporte,
  año, valoración mínima, solo favoritos (con login), estado (solo editores).

## Detalles de experiencia

- Ficha de recurso en panel lateral (sheet) sobre la búsqueda sin perder el estado; View
  Transition desde la tarjeta; navegable con ←/→ entre resultados.
- Estados vacíos con sugerencia ("sin resultados con estos 4 filtros — prueba quitando X").
- Búsqueda con debounce 0 (es local); skeletons solo en la carga inicial del índice.
- Mobile-first: facetas en drawer inferior, chips siempre visibles.

## Criterios de aceptación (borrador)

- [x] Cambiar de vista conserva búsqueda, filtros y scroll razonable.
- [x] Cualquier estado de búsqueda es una URL compartible (incluye `vista` y `r`).
- [x] Añadir una faceta nueva desde admin no requiere despliegue (facetas select/multiselect;
      las de rango tendrán su UI más adelante).
