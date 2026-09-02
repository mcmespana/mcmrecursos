# 003 · El héroe no se aparta nunca (F1)

**Superficie:** portada, catálogo · **Riesgo:** bajo · **Depende de:** nada

## Contexto

Hallazgo **F1** de `docs/06-reflexion-uiux.md`, marcado **alto**:

> El bloque «Encuentra tu próximo recurso» + la línea de estadísticas + el buscador ocupan
> ~180 px fijos en escritorio y **~380 px en móvil**, y siguen ahí exactamente igual cuando ya
> has buscado. En móvil el primer título de recurso aparece a **585 px de scroll**.

Va directamente contra el objetivo declarado en `docs/04-diseno.md` §1 —optimizar *tiempo
hasta el recurso correcto*— y contra `design.md` §1 (claridad primero). Es el coste que paga
**cada visita** en el camino más transitado de la app.

## Qué hacer

En la portada/catálogo (`app/src/routes/+page.svelte` y lo que cuelgue de ahí):

1. Estado **sin consulta ni filtro activo**: el héroe como está hoy. Es una bienvenida y está
   bien que lo sea.
2. Estado **con consulta o con al menos una faceta activa**: el héroe se encoge a **una fila**
   — buscador + recuento de resultados. El titular y la línea de estadísticas desaparecen.
3. La transición entre los dos estados se anima con `--ease-brio`, ~200 ms, y respeta
   `prefers-reduced-motion` (`design.md` §3.4). No animes `height`: usa `grid-template-rows`
   de `0fr`/`1fr` o un `translate` + `opacity`, que no provocan layout por fotograma.
4. Al **limpiar** todos los filtros, el héroe vuelve. Es la señal de "estás otra vez en la
   portada".

## Qué NO tocar

El buscador no se mueve de sitio ni cambia de tamaño entre los dos estados: es el ancla de la
pantalla y si salta, se pierde el foco visual (y a veces el del teclado).

## Validación

`cd app && npm run check && npm run build`. A 390 px: buscar «adviento» y medir a qué altura
de scroll aparece el primer título de recurso — el objetivo es **que se vea sin hacer
scroll**. Comprobar en escritorio a 1440 px, en claro y oscuro, y con `reduced-motion`
activado. Actualizar F1 en `docs/06-reflexion-uiux.md`.
