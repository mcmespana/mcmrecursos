# Sistema de diseño — Banco de Recursos MCM

> **Estado:** dirección validable. Tokens ya aplicados en `app/src/app.css`.
> Método: fundamentos de diseño editorial + tematización + dataviz (form-first, paleta computada).

## 1. Lectura del encargo

No es una landing ni un documento: es una **herramienta que se escanea y se opera**,
usada por monitores con prisa ("necesito una sesión de Adviento para 5º EP, es martes por
la noche"). El diseño debe optimizar *tiempo hasta el recurso correcto*, y a la vez tener
el calor de un movimiento educativo cristiano — no la frialdad de un panel corporativo ni
el ruido de una web parroquial recargada. Personalidad en la portada y las estanterías;
sobriedad quirúrgica en filtros, tabla y ficha.

**Tesis visual: "biblioteca luminosa"** — mucho aire, tarjetas como fichas de biblioteca,
un teal profundo como identidad (consolación: agua, calma) y un ámbar cálido como chispa
(estrellas, corazones, lo vivo). El contenido (miniaturas de los recursos) es el color
protagonista; el chrome se aparta.

## 2. Color

Los tokens viven en `app/src/app.css` (OKLCH). Regla: **el teal manda, el ámbar acentúa,
los neutros llevan un sesgo de matiz hacia el teal** (elegidos, no heredados).

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--primary` | teal 195° L .45 | teal 195° L .72 | acciones, enlaces, faceta activa, foco |
| `--warm` (nuevo) | ámbar 75° L .75 | ámbar 75° L .78 | estrellas, corazones, "top", badges de destacado |
| `--background` | blanco con matiz teal | azul-noche L .16 (no negro puro) | fondo |
| `--muted` / `--border` | grises con matiz 200° | ídem oscurecidos | chrome recesivo |
| Semánticos | verde/ámbar/rojo propios | ídem | estados (publicado/pendiente/retirado) — nunca se reciclan como color de serie |

- **Modo oscuro diseñado, no invertido**: fondo azul-noche (no #000), primary sube de
  luminosidad para mantener contraste AA, las miniaturas ganan un borde sutil para no
  "flotar", sombras → bordes. Se conmuta con `mode-watcher` (clase `.dark`), respetando
  la preferencia del sistema por defecto.
- **Color por familia de tipo** (5 familias de `tipo`): cada familia tiene un tinte fijo
  de badge (Sesiones=teal, Actividades=verde, Celebración=violeta, Audiovisual=ámbar,
  Documentos=gris-azul). El color sigue a la entidad, nunca a la posición; la paleta
  categórica se validará con `validate_palette.js` (CVD ΔE ≥ 8) en claro y oscuro antes
  de fijarla en código.

## 3. Tipografía

Dos familias variables autoalojadas vía Fontsource (sin CDN, sin FOUT):

- **Display: Bricolage Grotesque** — titulares, número-héroe de stats, portada. Cálida,
  con carácter, nada de "grotesca por defecto". Solo en tamaños ≥ 24 px y pesos 600-800.
- **Texto e interfaz: Figtree** — todo lo demás. Legible, redonda sin ser blanda,
  excelente con diacríticos españoles. `tabular-nums` en contadores, tablas y stats.

Escala fija (rem): 0.75 / 0.875 / 1 / 1.125 / 1.5 / 2 / 2.75 / 3.5. Línea ~65 caracteres
en descripciones; `text-wrap: balance` en titulares; labels uppercase con +0.04 em de
tracking solo en eyebrows de sección y cabeceras de faceta.

## 4. Layout y vistas

Estructura general: **header fino y pegajoso** (logo, búsqueda global, avatar) →
**barra de facetas** → **resultados**. Densidad: cómoda en galería, compacta en tabla.
Grid de 4 px; radios 10 px (ya en `--radius`); sombras solo 2 niveles (reposo/elevado).

- **Galería (defecto)**: tarjetas verticales ~280 px, miniatura 16:10 con fallback
  generado (patrón geométrico teal + inicial del tipo — nunca un hueco gris), badge de
  familia, título 2 líneas máx, fila meta (etapas · edades), fila social (★ 4,6 · 23 ·
  ❤). Hover: elevación + acción rápida. Móvil: 1 columna a 2 según ancho; escritorio:
  hasta 4-5 columnas — **excelente en escritorio significa usar el ancho**, no un tubo
  centrado de 700 px.
- **Tabla densa** (editores): columnas configurables y ordenables, fila 44 px, estado
  como pill semántica, edición rápida inline donde sea trivial.
- **Itinerario**: columna izquierda con etapas/itinerarios, centro con bloques ordenados
  como secciones y recursos colgando en mini-tarjetas horizontales.
- **Top / Descubrir** (portada sin búsqueda activa): stats-héroe (recursos, autores,
  valoraciones — número grande display + sparkline sutil) y estanterías horizontales
  con scroll-snap: "Mejor valorados", "Más usados", "Novedades", tag destacado de
  temporada (Adviento en noviembre…). Aquí vive la personalidad editorial.
- **Ficha**: sheet lateral (escritorio) / bottom sheet a pantalla casi completa (móvil)
  sobre la búsqueda sin destruir su estado. Héroe con miniatura grande, CTA primario
  "Abrir recurso" (cuenta el acceso), metadatos en definición-lista de dos columnas,
  social debajo, relacionados al pie como mini-carrusel. Navegación ←/→ entre resultados.

**Filtros**: chips activos siempre visibles bajo la búsqueda (quitables, "limpiar todo");
facetas en popover-combobox con contadores en vivo y buscador interno cuando > 8 opciones;
móvil: drawer inferior con las mismas facetas y botón "Ver N recursos". La faceta activa
tiñe su trigger de primary.

## 5. Movimiento

Poco y orquestado; todo bajo `prefers-reduced-motion`.

- Reordenado de resultados: `animate:flip` ~220 ms ease-out — la firma de la app.
- Tarjeta → ficha: View Transition (la miniatura viaja). 250 ms máx.
- Micro: corazón con pop de escala (spring), estrellas que se rellenan en cascada 40 ms,
  contadores que cuentan (solo en stats-héroe).
- Nada de parallax, nada de reveals por scroll en la herramienta.

## 6. Dataviz (panel de stats, fase 4)

Método del skill dataviz: la forma primero (top = barras horizontales con data-ends
redondeados; evolución de accesos = línea/área con crosshair; distribución por etapa =
barras, jamás donut de 8 quesitos), color al final y computado — secuencial = teal
claro→oscuro, categórica = la de familias validada, semánticos reservados. Un eje, nunca
dos. Tooltips por defecto; `tabular-nums`; vista tabla accesible para cada gráfica.

## 7. Accesibilidad y calidad

- Contraste AA en ambos temas (validador en CI de la paleta cuando se fije).
- Foco visible siempre (`--ring` teal, offset 2 px); toda la búsqueda operable por teclado;
  facetas con roles ARIA de combobox/listbox (los da Bits UI).
- Targets táctiles ≥ 44 px en móvil; textos de sistema en castellano claro ("Publicado",
  no "OK"); errores con acción ("Sin resultados con estos 4 filtros — prueba quitando *Vídeo*").
- Imágenes de recurso siempre con `alt` (nombre + tipo).

## 8. Anti-defaults (lo que NO haremos)

Hero gigante con gradiente morado; Inter por inercia; emojis como iconografía de sección;
todo centrado; tarjetas `rounded-lg` con borde-acento genérico; modo oscuro por inversión;
donuts multicolor; skeletons eternos (solo en la carga inicial del índice).
