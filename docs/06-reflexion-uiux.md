# Reflexión de UI/UX a fondo

> **Fecha:** 2026-08-20 · **Estado:** análisis, pendiente de priorizar contigo
> Lo pedía `docs/03-roadmap.md`: «una pasada completa, no parches: recorrer los caminos reales
> buscando lo que sobra, lo que falta y lo que se contradice, y salir con una lista priorizada».

## Cómo se ha hecho

Levantando la app contra el proyecto Supabase **de producción** con la clave anónima y recorriendo
los caminos como los recorre quien entra: portada, búsqueda, ficha, Descubre, enviar, entrar, en
claro y oscuro y a 390 / 1440 / 1920 px. Después, código en mano, para separar «esto se ve mal» de
«esto está mal». Y por último unas consultas a la base de datos, porque varias de las decisiones de
interfaz solo se pueden juzgar sabiendo cuántos datos hay de verdad detrás.

**Lo que no he podido mirar:** no tengo credenciales, así que los caminos de `/admin` (catalogar
una tanda, revisar la cola) están **leídos en código, no usados**. Todo lo que digo de ellos lleva
esa advertencia. Tampoco he visto el buscador por IA de Descubre, que se apaga solo si falta la
clave de Gemini — en mi entorno falta.

## El dato que ordena todo lo demás

```
recursos totales ......... 11        valoraciones ..... 3
publicados ............... 7         favoritos ........ 3
visibles sin entrar ...... 7         listas ........... 1
perfiles ................. 5         envíos ........... 2
```

El banco tiene **siete recursos públicos**. Y encima tiene: búsqueda facetada con nueve facetas,
búsqueda semántica por embeddings, un recomendador conversacional con IA, un mazo tipo Tinder,
detección de duplicados, catorce señales de salud y un buzón de tareas.

No lo digo como reproche: casi todo eso está bien hecho y hará falta. Lo digo porque **cambia cuál
es el cuello de botella**. La app está optimizada para *encontrar* entre muchos, y el problema real
es *tener*. Con siete recursos, ninguna mejora del buscador mueve la aguja; lo único que la mueve es
que entre material nuevo. Eso reordena la prioridad de todo lo que viene abajo, y explica por qué el
hallazgo **F13** (en móvil no hay ninguna puerta para aportar) me parece el más grave de la lista
aunque sea el más pequeño de arreglar.

Segunda consecuencia: **la app se ve casi siempre en su estado más pobre**. Cualquier decisión que
solo luzca con doscientos recursos hoy resta.

---

## Camino 1 · Buscar → abrir → llevárselo

### F1 · El héroe no se aparta nunca (alto)

El bloque «Encuentra tu próximo recurso» + la línea de estadísticas + el buscador ocupan ~180 px
fijos en escritorio y **~380 px en móvil**, y siguen ahí exactamente igual cuando ya has buscado.
Busqué «adviento» y seguía teniendo el titular a tamaño completo encima de dos resultados.

En móvil eso significa que en la primera pantalla caben el titular, las estadísticas, el buscador,
la fila de facetas, el recuento, el conmutador galería/tabla… y **una tarjeta y media**. El primer
título de recurso aparece a 585 px de scroll.

Es el coste que paga cada visita, en el camino más transitado de la app, y contra el objetivo
declarado en `docs/04-diseno.md` §1: «optimizar *tiempo hasta el recurso correcto*».

**Qué haría:** que el héroe se encoja a una fila (buscador + recuento) en cuanto hay consulta o
filtro activo. El titular es una bienvenida, no un mueble.

### F2 · Dos recuentos que se contradicen a 140 px (alto, trivial de arreglar)

- Bajo el titular: **«7 recursos** · 2 autores · 141 aperturas»
- Bajo las facetas: **«2 recursos»**

Los dos dicen «recursos» y los dos son ciertos —uno es el total, el otro el resultado— pero juntos
en pantalla sin distinguirse se leen como un error. Y la línea de arriba nunca cambia, así que en
cuanto filtras deja de significar nada útil.

**Qué haría:** o el total se va con el héroe (F1), o se etiqueta distinto («7 en el banco»).

### F3 · Nueve facetas, y como mucho cuatro pueden filtrar algo (alto)

Contado sobre los 7 recursos visibles:

| Faceta | Opciones distintas | Recursos con el campo puesto |
| --- | --- | --- |
| Edades | 14 | 5 |
| Temática | 11 | 7 |
| Tipo | 6 | 7 |
| Soporte | 4 | 7 |
| Etapa | 4 | 7 |
| MCM Local | 2 | 6 |
| Nivel | 2 | **2** |
| **Formato** | **1** | **1** |
| **Idioma** | **1** | 7 |

**Idioma** tiene un solo valor posible: filtrar por él no puede cambiar nada nunca. **Formato** está
puesto en **1 recurso de 11**. **Nivel** está vacío en 5 de 7. Y **Edades** ofrece 14 opciones para
5 recursos: la lista del desplegable es más larga que el resultado.

Es decir: nueve chips de ancho de chrome, de los que dos son decorativos y uno casi. Y todos pesan
lo mismo visualmente, cuando el propio proyecto sabe que **Etapa es la que más se usa** (lo dice la
copia de las señales de salud: «invisibles al filtro que más se usa»).

**Qué haría:** esconder una faceta cuando tiene menos de dos valores distintos entre los resultados
—se resuelve solo cuando el catálogo crezca, sin decidir nada a mano— y dar a Etapa y Temática un
peso distinto del resto.

### F4 · «Soporte» y «Formato» preguntan lo mismo (medio)

En la ficha del recurso que abrí: `Soporte: PDF`. Y hay una faceta pública **Formato** aparte.
Para quien busca, «soporte PDF» y «formato PDF» son la misma pregunta hecha dos veces.

Lo interesante es que el código lo sabe. `lib/catalogo/formatos.ts` dice literalmente que el formato
«se DEDUCE del enlace y **solo sirve para poner el icono correcto** en el botón de abrir». Nació
como detalle de presentación (SPEC-011) y acabó promovido a faceta pública en la migración `00017`.

**Qué haría:** quitar Formato de las facetas públicas y dejarlo donde nació — el icono, y como filtro
interno en `/admin/recursos`, donde sí sirve (es una de las señales de salud).

### F5 · La tarjeta habla en siglas sin traducir (medio)

Cada tarjeta lleva una línea así:

```
MIC · COM · LC — 5º EP, 6º EP
```

Son **etapas** y **edades**, pero en la tarjeta van sin etiqueta y sin separación conceptual: un
guion largo hace de frontera entre dos taxonomías distintas. Solo abriendo la ficha (donde sí hay un
bloque «PARA QUIÉN → Etapa») se entiende qué era cada mitad.

Para quien lleva años en el MCM, MIC/COM/LC son transparentes. Para un monitor nuevo —que es
justo quien más necesita el banco— son ruido con aspecto de dato.

### F6 · Estado editorial interno enseñado al público (medio, arreglo de una línea)

`RecursoCard.svelte` pinta el badge **«Por clasificar»** sin comprobar rol: sale a cualquiera. Lo vi
en la portada sin haber entrado.

Significa «la IA todavía no ha propuesto metadatos». A quien viene a buscar una sesión para el
martes no le dice nada, y lo que comunica es «este recurso está a medio hacer» — desconfianza
gratuita sobre material que probablemente está perfecto.

**Qué haría:** que ese badge (y el de fuera-del-banco) solo salga a quien tiene rol de panel.

### F7 · La galería no tiene nada que mirar (medio, ya en el roadmap)

Las siete miniaturas son el **fallback generado** (patrón + icono del tipo). Está bien resuelto y es
mejor que un hueco gris, pero significa que la vista Galería —cuyo sentido es escanear con el ojo—
hoy son siete rectángulos de color pastel casi idénticos. La elección Galería/Tabla es una elección
sin consecuencia: la tabla da más información por píxel.

Está anotado en el roadmap (punto 7, «miniaturas de verdad, cacheadas»). Lo traigo aquí porque
**cambia la lectura de F1**: si la galería no aporta, gastar 380 px de móvil antes de la primera
tarjeta duele todavía más.

### F8 · «Sin valorar» cinco veces (bajo)

Con 3 valoraciones en todo el banco, cinco de las siete tarjetas dicen «Sin valorar». Es una fila
que ocupa sitio para informar de que no hay información. Con el catálogo lleno se arregla solo; hoy
resta.

**Qué haría:** no pintar la fila social cuando no hay ni valoración ni favoritos.

### F9 · Cuatro botones-icono sin etiqueta en la ficha (bajo)

Junto a «Abrir recurso» hay cuatro botones cuadrados seguidos: corazón, check, enlace, lista. Tienen
`aria-label` (bien para lector de pantalla), pero visualmente son cuatro incógnitas en fila. El check
—«lo he usado»— es el menos adivinable y probablemente el más valioso para el proyecto.

### F10 · En móvil las facetas se cortan, y el diseño especificaba otra cosa (medio)

La fila de facetas es un carrusel horizontal que **se corta a media palabra** («N…» de Nivel) sin
ninguna pista de que hay nueve. Y `docs/04-diseno.md` §4 especifica para móvil otra cosa: «drawer
inferior con las mismas facetas y botón *Ver N recursos*». No existe.

No es que el carrusel esté mal —es una decisión deliberada, el código lo comenta— es que **el
documento de diseño describe una app que no es esta** y nadie lo actualizó. Ver F20.

### F11 · La portada no tiene respuesta para «no sé qué busco» (alto en importancia, grande en esfuerzo)

`docs/04-diseno.md` §4 describe con detalle una capa editorial: «estanterías horizontales con
scroll-snap: *Mejor valorados*, *Más usados*, *Novedades*, tag destacado de temporada (Adviento en
noviembre…). **Aquí vive la personalidad editorial**».

No hay nada de eso. Cero. La portada es el buscador y una rejilla plana ordenada por… lo que toque.
Quien llega sin una palabra en la cabeza solo tiene `/descubre`, que es otra página y otro gesto.

Esto es lo que más separa «catálogo» de «banco de recursos que apetece abrir», y es la mitad no
construida de la tesis visual del proyecto («biblioteca luminosa… personalidad en la portada y las
estanterías»).

Aviso honesto: **con siete recursos, tres estanterías enseñarían tres veces los mismos siete**. Esto
es lo primero que hay que hacer *cuando entre material*, no ahora. Por eso lo pongo en P3 y no en P1,
aunque en importancia sea de las cosas más grandes de esta lista.

### F12 · Descubre explica demasiado (bajo)

Tres líneas fijas de instrucciones encima de la tarjeta: qué hace cada botón, que también van las
flechas, que si buscas algo concreto filtres en el buscador, y el «7 de 7 en el mazo». Un tutorial
clavado sobre una interfaz de una sola tarjeta.

Además el texto dice «**↑** abre la ficha» y el botón correspondiente es un **ojo**. Discrepancia
pequeña pero es exactamente el tipo de cosa que hace dudar.

---

## Camino 2 · Aportar un recurso

Este camino es, hoy, el que más importa (ver «el dato que ordena todo»). El formulario en sí es lo
mejor de la app: pegar un enlace y listo, sin cuenta, con clasificación opcional plegada y microcopia
honesta («Estás enviando sin cuenta, y no pasa nada»). Nada que tocar ahí dentro.

El problema es cómo se llega.

### F13 · En móvil, aportar está escondido detrás de la lupa (alto, arreglo pequeño)

> **Corrección (2026-08-20).** La primera versión de este documento decía que en móvil «no existe
> ninguna puerta» porque la paleta de comandos no ofrecía «Enviar recurso». **Era falso**: sí lo
> ofrece — busqué en `PaletaComandos.svelte`, que es solo el disparador, cuando las entradas viven en
> `PaletaDialogo.svelte` (se carga con `import()` al abrirla). El hallazgo se sostiene, pero es
> menos grave de lo que escribí.

Lo que de verdad pasa en móvil:

- El botón «Enviar recurso» de la cabecera es `hidden sm:inline-flex` → **desaparece por debajo de
  640 px**.
- La única vía que queda es **pulsar el icono de lupa** y, dentro, elegir «Enviar un recurso» en el
  grupo «Ir a».

Es decir: la acción de la que depende que el banco crezca vive **detrás de un icono de buscar**. Para
quien no ha abierto nunca esa paleta —la mayoría en un móvil— es indistinguible de no existir.

El proyecto entero depende de que los monitores suban lo que preparan, y los monitores están en el
móvil. Sigue siendo lo que arreglaría primero: es media hora.

### F14 · El campo que importa va segundo y sin marcar (bajo)

El formulario promete «Pega el enlace… y listo». El primer campo es **Título**, y el enlace va
debajo. El código confirma que basta el enlace («el título, si falta, lo pone el equipo»), pero la
interfaz no lo dice: *Notas* lleva «— opcional», *Tu nombre* y *Tu correo* llevan «(opcional)», y
**Título no lleva nada**, con lo que parece obligatorio por comparación.

**Qué haría:** enlace primero, y «(opcional)» en el título como en el resto.

### F15 · No se dice qué pasa después (bajo)

Al enviar no hay ninguna pista de plazos ni de dónde mirar. Existe `/envios` para quien ha entrado, y
los envíos anónimos se reclaman por dispositivo (bien pensado), pero nada de eso se cuenta en el
momento en que la persona acaba de dar algo y se pregunta si ha servido.

---

## Camino 3 · Catalogar una tanda

⚠️ **Leído en código, no usado.** Sin sesión no he podido cronometrar el camino real. La estructura
sí la he verificado; lo que no puedo medir es cuánto duele en la práctica.

### F16 · Publicar un envío correcto cuesta el formulario entero (medio)

En `/admin/revision` cada envío ofrece *Devolver*, *Descartar* y *Revisar y publicar*. El último abre
el `RecursoFormulario` completo —**12 campos**— y esa es la **única** vía de publicación: la acción
`?/publicar` está montada dentro de ese formulario, no existe suelta.

Para un envío que llega bien y solo hay que aprobar, no hay camino corto. Y con la IA proponiendo
metadatos, «llega aceptable» debería ser el caso normal, no la excepción.

Que la IA nunca publique sola es una decisión buena y explícita (SPEC-010). La pregunta no es esa: es
si **aceptar** su propuesta cuesta dos clics o doce campos.

### F17 · La tanda no es una tanda (medio)

`/admin/recursos` tiene selección múltiple y acciones en lote, y funcionan bien. La cola de revisión
**no tiene ninguna de las dos**: cero apariciones de selección o lote en su código. Se recorre envío
a envío abriendo y cerrando paneles.

Si entran treinta recursos de un campamento —el escenario que justifica el proyecto— el patrón bueno
ya existe a un clic de distancia, en la pantalla de al lado.

---

## Transversal

### F18 · Dos puertas de entrada, y la de los administradores es invisible (medio)

El botón **«Entrar»** de la cabecera **no da a elegir**: llama directamente a Google OAuth. El acceso
por correo y contraseña vive en `/entrar`, y el único enlace hacia allí es **un punto «·»** escondido
en el pie, con `title="Acceso"`.

Entiendo el porqué (que no se vea una puerta de administración) y es un truco simpático. Pero el
resultado es que quien administra con correo y contraseña tiene que conocer un huevo de pascua, y
quien pulsa «Entrar» esperando elegir se encuentra ya en Google.

### F19 · Dos buscadores a la vez en la portada (bajo)

Arriba a la derecha, el disparador de la paleta («Buscar… ⌘K»). En el centro, el buscador grande.
Los dos visibles, con el mismo verbo y distinto comportamiento. El documento de diseño defiende bien
el disparador visible («un atajo sin pista visible no existe»), pero en la portada compiten.

**Qué haría:** en la portada, que el de la cabecera no salga (o sea solo icono). En el resto de
páginas es donde de verdad hace falta.

### F20 · El documento de diseño describe una app que no es esta (medio, gratis de arreglar)

`docs/04-diseno.md` §4 especifica como existentes al menos dos cosas que no existen: las estanterías
editoriales de la portada (F11) y el drawer de facetas de móvil (F10). El documento es bueno y se usa
como referencia —yo mismo lo he seguido en dos rediseños esta semana— y por eso importa que no
mienta: la próxima persona que lo lea implementará contra una realidad falsa.

**Qué haría:** marcar en §4 qué es «hecho» y qué es «dirección no construida». Cuesta diez minutos y
evita que la deriva siga creciendo.

---

## Lo que NO tocaría

Un repaso así tiende a producir listas de cosas malas. Estas están bien y conviene no menearlas:

- **Deshacer en vez de confirmar** (`$lib/deshacer.ts`). Es la mejor decisión de interacción del
  proyecto y está aplicada con criterio, distinguiendo lo irreversible de lo reversible.
- **El formulario de `/enviar`** por dentro: fricción mínima, microcopia honesta, clasificación
  opcional plegada.
- **La ficha**: navegación ←/→ entre resultados, relacionados al pie, aviso cuando el material vive
  fuera del banco, vista previa empotrada con su salida cuando el sitio no se deja empotrar.
- **El modo oscuro.** Diseñado, no invertido. Se ve bien en todas las pantallas que he mirado.
- **El trabajo de accesibilidad**: `aria-live` en los recuentos, las estrellas como `radiogroup`, las
  clases `.toque` para los 44 px solo en punteros gruesos, el «saltar al contenido».
- **El buzón de avisos y las señales de salud**, recién rehechos.

---

## Lista priorizada

Ordenada por **valor / esfuerzo**, no por gravedad. El criterio: primero lo que desatasca el cuello
de botella real (entrar material), luego lo que cobra peaje en cada visita, luego lo que hace falta
cuando el catálogo crezca.

### P1 — Ahora (todo esto es media tarde)

1. **F13 · Puerta visible para aportar en móvil.** Que «Enviar recurso» no desaparezca por debajo de
   640 px (en la paleta ya está, pero detrás de una lupa no cuenta). *Mejor relación valor/esfuerzo
   de toda la lista.*
2. **F1 + F2 · Que el héroe se aparte al buscar,** y con él el recuento total que se contradice con
   el de resultados.
3. **F6 · Que «Por clasificar» no salga al público.** Una condición de rol.
4. **F14 · Enlace primero en `/enviar`** y «(opcional)» en el título.
5. **F20 · Sincerar `docs/04-diseno.md` §4** con lo que existe.

### P2 — Después (poda y legibilidad)

6. **F3 · Esconder las facetas que no pueden filtrar** (menos de dos valores distintos entre los
   resultados) y dar peso distinto a Etapa y Temática.
7. **F4 · Quitar «Formato» de las facetas públicas** y devolverlo a icono + filtro de admin.
8. **F5 · Etiquetar la línea de la tarjeta** o separar etapas de edades de forma legible.
9. **F8 · No pintar la fila social cuando está vacía.**
10. **F9 · Dar texto al menos al botón «lo he usado»** en la ficha.
11. **F19 · Un solo buscador visible en la portada.**
12. **F18 · Decidir la puerta de entrada:** o «Entrar» ofrece las dos vías, o se asume el huevo de
    pascua a sabiendas y se documenta.

### P3 — Cuando haya catálogo (o sesión para medir)

13. **F11 · La capa editorial de la portada** (estanterías). Lo más importante de la lista en
    ambición, y lo que menos sentido tiene hoy con siete recursos. En cuanto haya ~50, sube a P1.
14. **F16 + F17 · Camino de catalogar:** un «aceptar la propuesta y publicar» de dos clics, y
    selección múltiple en la cola como la que ya tiene `/admin/recursos`. Antes de construirlo,
    recorrerlo contigo delante con cronómetro — la estructura la he verificado, el dolor real no.
15. **F10 · Drawer de facetas en móvil** (o dejar el carrusel y arreglar solo la pista de que hay
    más).
16. **F12 · Adelgazar las instrucciones de Descubre** y cuadrar el icono con el texto.
17. **F7 · Miniaturas reales cacheadas.** Ya está en el roadmap; hasta entonces la vista Tabla es la
    útil y quizá debería ser la de por defecto en escritorio.

---

## Una pregunta de fondo, no de interfaz

Con siete recursos y cinco perfiles, la app tiene más máquina que material. Todo lo de arriba son
mejoras de interfaz, pero la pregunta que de verdad decide el próximo trimestre no es de interfaz:
**¿qué hace falta para que entren doscientos recursos?** Si la respuesta es «que veinte monitores
suban lo que ya tienen en su Drive», entonces P1.1 no es una corrección menor de responsive: es el
proyecto.
