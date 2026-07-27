# SPEC-007 · "Descubre" — el tinder de recursos

> **Estado:** v1 (sin IA) IMPLEMENTADA en `/descubre` — mazo desde los filtros del buscador
> (misma sintaxis de URL), sesgo a mejor valorados con favoritos/usados al final, gestos
> táctiles con física (pointer events, solo `transform`), botones ✕/❤/ver, atajos ←/→/↑ y
> Z para deshacer, descartes por sesión (`sessionStorage`), «volver a barajar», misma ficha
> del buscador; sin login el ❤ cae en la capa local (SPEC-003) y el aviso invita a entrar.
> **Fase 2 (con IA) IMPLEMENTADA** — ver §«Recomiéndame…» más abajo.
> PENDIENTE: presets de mazo.
> **Depende de:** SPEC-002, SPEC-003 (favoritos); SPEC-010 (embeddings + Gemini) para la fase 2

## Objetivo

Modo de exploración lúdico: dices qué buscas ("sesión para 1º ESO sobre confianza, 45
min") y la app te va proponiendo recursos de uno en uno, a pantalla completa, estilo
swipe — descartar / guardar / abrir. Para cuando no sabes ni qué buscar: descubrimiento,
no búsqueda.

## Fases

1. **Sin IA (v1):** el "mazo" sale de los filtros normales (o de un preset) barajado con
   sesgo a mejor valorados / menos vistos por ti. Swipe izquierda = descartar (no repetir
   en esa sesión), derecha = ❤ favorito, arriba = abrir ficha completa. Contador de mazo,
   deshacer último swipe.
2. **Con IA (hecha):** describes lo que necesitas en texto libre; embeddings (pgvector)
   arman el mazo por similitud y cada tarjeta explica en una línea por qué te lo propone
   ("María + 1º ESO + 45 min"). El afinado en vivo se resolvió con chips de retoque en vez
   de con el feedback de los swipes: es explícito, se ve lo que has pedido y no gasta una
   llamada por cada ✕.

## Experiencia

- Gestos táctiles reales en móvil (arrastre con física, rotación sutil), botones en
  escritorio (✕ / ❤ / ver), atajos ← → ↑. Animaciones de salida con la firma de la app.
- Cada guardado cae en favoritos o en una lista elegida ("Campamento 2026").
- Requiere login para guardar; sin login se puede jugar pero invita a entrar al primer ❤.

## «Recomiéndame…» (fase 2, implementada)

Cuadro de texto en `/descubre`: cuentas lo que necesitas («una dinámica de confianza para 1º
ESO, 45 min») y el mazo se reordena con lo que encaja, con una línea por tarjeta explicando
por qué. Endpoint `POST /api/recomendar`.

### Cómo funciona (2 llamadas por consulta, no una por tarjeta)

1. **Voyage** convierte la consulta en embedding y `buscar_semantica` (pgvector, migración
   00014) devuelve los ~60 recursos más cercanos, con umbral más flojo que el del buscador
   (0.85) porque después hay un segundo filtro. La RLS manda: nadie recibe candidatos que no
   podría ver, y se respeta el opt-out `no_ia` de SPEC-010.
2. **Una sola llamada a Gemini** recibe esos candidatos (id, nombre, descripción recortada,
   tipo/etapas/edades/tags), elige, **ordena** y escribe el motivo de cada uno, además de
   interpretar la petición en el idioma de las facetas.

Sin `VOYAGE_API_KEY` el paso 1 cae a una criba léxica (`ilike` sobre nombre y descripción);
si Voyage falla en caliente, se degrada a lo mismo sin romper la consulta.

### La decisión de diseño: la IA **ordena**, no filtra

Lo que vuelve es una ordenación, no un mazo nuevo. Las tarjetas elegidas van primero y en su
orden; **detrás sigue el mazo de siempre** con su barajado por valoración. Dos motivos:

- **Los metadatos del banco son irregulares.** Filtrar duro por «ESO 1» deja fuera todo lo
  que no tenga la etapa puesta —que es mucho— y te planta un mazo de tres cartas. La
  ordenación semántica ya lleva la intención dentro sin castigar las fichas incompletas.
- **Una mala recomendación no puede dejarte peor que antes.** Si la IA se equivoca, sigue
  habiendo mazo que descubrir: es exactamente la pantalla de siempre con otro orden.

Por eso los filtros que la IA interpreta se **ofrecen** como chips «+ Taller», no se aplican
solos: endurecer el filtro es decisión de quien busca, y con un clic.

### Detalles

- **Conversacional de verdad, sin estado raro:** chips de retoque («más cortas», «para más
  mayores»…) que reenvían la consulta anterior más el matiz. El texto acumulado se ve y se
  edita en la caja: la consulta *es* el estado.
- **Compartible:** la consulta viaja en `?ia=…` y al abrir el enlace se lanza sola.
- **Anónimos incluidos** (Descubre es público), con tope de 12 consultas / 5 min por IP y
  consulta acotada a 220 caracteres. El texto se trata como petición de búsqueda, nunca como
  instrucciones; los ids que no estén entre los candidatos se descartan al sanear.

### Apagarlo (SPEC-008 §config)

Cuatro capas, de más fuerte a más débil:

1. `DESCUBRE_IA=off` en el entorno — freno de mano, gana siempre.
2. **`/admin/config` → Funciones** — el interruptor del día a día (tabla `recursos.ajuste`,
   migración 00018). Sin desplegar; tarda segundos (caché de 20 s).
3. **Fusible automático:** 3 fallos seguidos de Gemini y el endpoint se apaga solo 10
   minutos, sin llamar a nadie. Se rearma solo.
4. Sin `GEMINI_API_KEY` no aparece.

En cualquiera de los cuatro casos el cuadro de texto desaparece y Descubre funciona igual.

## Criterios de aceptación (borrador)

- [x] Un mazo nunca repite recurso descartado en la misma sesión (sessionStorage, por pestaña).
- [x] Deshacer funciona (restaura la tarjeta y revierte el ❤ si lo hubo). El swipe anima
      solo con `transform` y sin transición durante el arrastre; pendiente de validar
      60 fps en un móvil de gama media real.
- [x] Lo guardado aparece en favoritos al instante (optimista; en local sin sesión). El
      guardado directo a una lista elegida queda para una iteración posterior (la ficha
      ya permite «Guardar en lista»).
- [x] Una recomendación nunca deja el mazo más pobre que antes: reordena, no recorta.
- [x] Apagar la IA (panel, entorno o fusible automático) no rompe nada: el cuadro
      desaparece y el mazo sigue.
- [x] Un fallo de Gemini o de red se cuenta y no bloquea: aviso discreto y mazo normal.
- [x] Los ids inventados por el modelo se descartan (solo valen los candidatos enviados).
