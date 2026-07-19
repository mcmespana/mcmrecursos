# SPEC-006 · Vistas del catálogo y sistema de filtros

> **Estado:** borrador (anotado para desarrollar tras cerrar el modelo de datos)
> **Depende de:** SPEC-002

## Vistas (conmutables, misma búsqueda debajo)

1. **Galería (por defecto)** — grid de tarjetas grandotas: miniatura, tipo (badge con color
   por grupo), nombre, etapas, estrellas + nº votos, corazón. Animación `flip` al filtrar.
2. **Tabla densa** — estilo GEG pero moderna: una fila por recurso, columnas configurables,
   ordenable por cualquier columna (nombre, año, valoración, usos…). Para editores es la
   vista de trabajo.
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

- [ ] Cambiar de vista conserva búsqueda, filtros y scroll razonable.
- [ ] Cualquier estado de búsqueda es una URL compartible.
- [ ] Añadir una faceta nueva desde admin no requiere despliegue.
