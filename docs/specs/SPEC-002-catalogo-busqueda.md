# SPEC-002 · Catálogo y búsqueda facetada

> **Estado:** borrador — ⚠️ bloqueada hasta definir las ~25 columnas del Sheet real
> **Depende de:** SPEC-001

## Objetivo

La pantalla principal: buscar entre ~1.500 recursos combinando texto libre y filtros por
facetas con contadores en vivo, resultados instantáneos (índice Orama en cliente) y ficha
rica por recurso.

## Alcance

- Entra: tabla `recurso`, endpoint JSON del índice, buscador, tarjetas, ficha, contador de accesos.
- Fuera: capa social (SPEC-003), envíos (SPEC-004), sync (SPEC-005).

## Modelo de datos (borrador a validar con el Sheet real)

Campos previsibles de `recurso`: id estable, título, descripción, tipo de recurso,
destinatarios (niños/jóvenes/adultos), franja de edad, duración, nº participantes,
espacio (interior/exterior), materiales, temática/valores, idioma, autor, MCM local origen,
enlace Drive / enlace externo, miniatura, fecha, estado (publicado/pendiente/retirado),
visibilidad (público/protegido).

**Pendiente:** mapear columna a columna cuando el usuario pase el Sheet.

## Experiencia de usuario

- Búsqueda como en la referencia GEG pero moderna: campo de texto grande + chips de filtros
  activos + facetas con contadores que se recalculan al combinar (estilo tienda online).
- Grid de tarjetas con miniatura, tipo, edades, valoración; animación `flip` al reordenar/filtrar.
- Ficha en sheet/dialog con View Transition desde la tarjeta; botón "Abrir en Drive" (cuenta acceso).
- Stats de cabecera: nº recursos, autores, valoraciones (como GEG, pero bonito).

## Criterios de aceptación

- [ ] Filtrar por 3 facetas + texto responde < 16 ms en cliente (sin red).
- [ ] Los contadores de cada faceta reflejan la selección del resto.
- [ ] URL refleja el estado de búsqueda (compartible).
- [ ] Cada apertura de enlace incrementa `acceso` (sin bloquear la navegación).
- [ ] Campos protegidos invisibles para anon (verificado a nivel de API, no de UI).

## Preguntas abiertas

- Lista definitiva de columnas y cuáles son facetas vs. solo ficha vs. protegidas.
- ¿Miniaturas desde Drive (thumbnail API) o subidas a Storage?
