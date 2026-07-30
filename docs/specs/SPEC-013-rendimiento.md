# SPEC-013 · Rendimiento con catálogo de verdad

> **Estado:** implementada (primera vuelta, 2026-07-30)
> **Depende de:** SPEC-002 (catálogo y búsqueda), SPEC-006 (vistas y filtros)

## Objetivo

El banco se diseñó con búsqueda facetada instantánea: todo el catálogo viaja al navegador y ahí se
busca, se filtra y se cuenta sin ir al servidor. Con 8 recursos de ejemplo eso no se nota; con los
cientos que van a entrar por el Sheet, sí. Esta spec mide qué se rompe primero, arregla lo que se
puede arreglar sin renunciar a la búsqueda instantánea, y deja escrito **a partir de qué tamaño**
habría que cambiar de arquitectura.

## Alcance

Entra: portada (`/`), Descubre, tabla de `/admin/recursos`, paleta de comandos. Se mide con
catálogos sintéticos de 800 y 2.000 recursos.

No entra (y se explica por qué al final): mover la búsqueda al servidor, paginar en la base de
datos, virtualización con alturas calculadas, y recortar campos del payload.

## Cómo se mide

Banco de pruebas reproducible, en `scratchpad`:

- `mock-supabase.mjs` — PostgREST de mentira en `:5300` que sirve un catálogo sintético del tamaño
  que se le pida (`N=2000 node mock-supabase.mjs`), con gzip, y **cuenta cada petición**. Se apunta
  `PUBLIC_SUPABASE_URL` ahí y se hace `npm run build`: así se mide el build de producción de verdad,
  SSR incluido, que es lo que ve quien entra.
- `medir2.mjs` — abre la portada con Playwright y anota: bytes del HTML, peticiones del navegador,
  tiempo hasta la primera tarjeta y hasta el catálogo completo, nodos de DOM, memoria del heap,
  tareas largas (`PerformanceObserver`, bloqueo del hilo principal) y latencia de teclear, limpiar
  la búsqueda y abrir una ficha.
- `funcional.mjs`, `paleta.mjs`, `real.mjs` — que lo anterior no se haya llevado por delante el
  comportamiento (incluido un pase contra el Supabase real).

## Lo que se encontró

Build de producción, catálogo sintético, Chromium sin límite de CPU.

| | 800 antes | 800 después | 2.000 antes | 2.000 después |
| --- | --- | --- | --- | --- |
| HTML de la portada | 5.134 KB | **1.004 KB** | — | 2.088 KB |
| Peticiones REST del navegador | 4 (415 KB) | **0** | 4 (1.038 KB) | **0** |
| Primera tarjeta | 2.204 ms | **715 ms** | 798 ms¹ | 712 ms |
| Catálogo en pantalla | 2.226 ms | **732 ms** | 3.352 ms | **728 ms** |
| Nodos de DOM | 24.321 | **1.681** | 60.239 | **1.681** |
| Memoria (heap) | 54 MB | **13 MB** | 136 MB | **15 MB** |
| Bloqueo del hilo principal | 1.078 ms | **124 ms** | 2.345 ms | **104 ms** |
| Teclear → resultados | 48 ms | 60 ms | 153 ms | 109 ms |
| Limpiar la búsqueda | 745 ms | **75 ms** | 2.927 ms | **77 ms** |
| **Abrir una ficha** | 2.177 ms | **134 ms** | **13.959 ms** | **126 ms** |

¹ El «antes» de 2.000 pinta la primera tarjeta pronto y tarda 3,4 s en tener el catálogo entero:
la página aparece a medias y sigue trabajando. Lo comparable es la fila siguiente.

Los cuatro problemas, en orden de tamaño:

1. **El catálogo viajaba dos veces en cada visita en frío.** El `load` de la portada era universal
   (`+page.ts`), y el del layout crea el cliente de Supabase — que es distinto en servidor y en
   navegador, así que se ejecuta en los dos lados. Y cuando un `load` padre se reejecuta, los hijos
   también: los datos llegaban serializados dentro del HTML del SSR **y** otra vez en JSON al
   hidratar. Medido: 5,1 MB de HTML + 4 peticiones REST.
2. **Se pintaban todas las tarjetas.** 2.000 recursos son 60.000 nodos de DOM y 136 MB. Y lo peor
   no es el pintado inicial: **abrir una ficha tardaba 14 segundos**, porque la View Transition
   tiene que fotografiar el documento entero dos veces. La animación bonita se convertía en un
   castigo por tener catálogo.
3. **El índice de búsqueda se construía al cargar la página** —cuando nadie ha buscado nada— y se
   reconstruía entero en cada `invalidateAll()`, o sea cada vez que se guardaba un favorito.
4. **Los valores de faceta se recalculaban sin parar.** Filtrar y contar piden los valores de cada
   recurso muchas veces (contar una faceta implica filtrar por todas las demás): con 7 facetas y
   2.000 recursos, decenas de miles de llamadas por tecla pulsada, y la de `formato` desmonta URLs
   con expresiones regulares.

## Lo que se hizo

- **Carga en servidor** (`+page.server.ts` en portada y Descubre, con `depends('supabase:auth')`
  para que la capa social propia se refresque al cambiar la sesión). Los datos viajan una vez. El
  navegador ya no hace ninguna petición REST para el catálogo: comprobado con el contador del mock
  y contra el Supabase real.
- **Ventana de tarjetas**: se pintan 48 y crece de 48 en 48 al llegar al final (IntersectionObserver
  con 800 px de margen) o pulsando «Ver más recursos». El botón está **además** del centinela, no
  en su lugar: si el hueco nunca entra en pantalla el observador no salta, y quien navega con
  teclado necesita algo que pulsar. La ventana vuelve al principio al cambiar la búsqueda o los
  filtros, y **no** al refrescarse los contadores — si dependiera de la lista de resultados, guardar
  un favorito te devolvería al principio del catálogo sin haber tocado nada.
- **La tabla del catálogo y la del panel** también pintan por tandas (100). La ventana se aplica
  **después** de filtrar y ordenar: si se recortara antes, «ordenar por valoración» ordenaría solo
  las cien primeras filas y mentiría (hay prueba de esto).
- **Índice de búsqueda perezoso**: se construye la primera vez que alguien escribe y se reutiliza
  mientras la lista de ids no cambie. Un recurso editado con el mismo id no rehace el índice; da
  igual, porque editar es cosa del panel y al recargar nace de cero.
- **Extractores de faceta memoizados** con un `WeakMap` sobre el propio recurso: cada valor se
  calcula una vez y la memoria vieja se recoge sola cuando el `load` trae objetos nuevos.
- **La paleta de comandos reutiliza el catálogo que ya está en memoria** en portada y Descubre (antes
  se lo pedía entero al servidor en la primera ⌘K, mirando la misma lista), y pinta como mucho 40
  coincidencias con la cabecera «Recursos (40 de 134)» en vez de 2.000 entradas de golpe.

## Criterios de aceptación

- [x] Ninguna petición REST del navegador para cargar el catálogo en una visita en frío.
- [x] El DOM no crece con el catálogo: 1.681 nodos con 800 y con 2.000 recursos.
- [x] Abrir una ficha por debajo de 200 ms con 2.000 recursos.
- [x] Buscar, limpiar la búsqueda y filtrar por debajo de 150 ms con 2.000 recursos.
- [x] La cuenta de resultados sigue siendo la del catálogo entero, no la de la ventana pintada.
- [x] Ordenar la tabla ordena todo el catálogo, no la ventana.
- [x] Un enlace directo (`?r=`) abre un recurso que no está en la ventana pintada.
- [x] La paleta sigue navegándose con teclado y abriendo con Intro.

## Hasta dónde llega esto, y qué haríamos después

Lo que ya no escala es el **payload**: el catálogo entero viaja en el HTML, y eso crece en línea
recta — 1 MB con 800 recursos, 2 MB con 2.000 (en crudo; Vercel lo sirve comprimido, del orden de
80–190 KB). El resto de las métricas ya no dependen del tamaño del catálogo.

Umbral propuesto: **por encima de ~3.000 recursos**, o si el HTML comprimido pasa de ~300 KB, toca
cambiar de modelo, y en este orden:

1. **Adelgazar el payload de la lista**: la descripción es lo más gordo (unos 200 caracteres por
   recurso) y solo se usa en la ficha y en el índice de búsqueda. Se puede mandar recortada para el
   índice y pedir la completa al abrir la ficha.
2. **Búsqueda en el servidor** (`pg_trgm` + los embeddings que ya existen, SPEC-010) con paginación
   real, aceptando que la respuesta pase de 0 ms a un viaje de red. Es renunciar a parte de la
   promesa de SPEC-002, así que no se hace antes de tiempo.
3. **Facetas contadas en la base de datos** con una vista materializada, en vez de contar en el
   cliente.

Lo que **no** hace falta todavía: virtualización con alturas calculadas. La ventana con
IntersectionObserver da el mismo resultado con una fracción del código, mantiene Ctrl+F del
navegador funcionando y no pelea con `animate:flip`.

## Preguntas abiertas

- ¿48 tarjetas es la tanda buena? Son 4–8 filas según el ancho; se puede subir a 60 sin coste
  apreciable si se ve poco contenido en pantallas grandes.
- ¿Interesa recordar la ventana al volver de una ficha o de otra página? Hoy siempre vuelve a 48.
- Medir con CPU limitada (móvil de gama media, `4x slowdown`) para tener el número honesto de quien
  no lleva un portátil: lo de aquí es el suelo, no el techo.
