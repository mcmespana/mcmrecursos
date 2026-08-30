# Visión — Banco de Recursos MCM

## El problema

El MCM acumula cientos de recursos de tiempo libre (actividades, dinámicas, oraciones,
vídeos, libritos) dispersos en carpetas de Google Drive. Encontrar "una dinámica de
confianza para jóvenes de 45 minutos en interior" hoy exige conocer las carpetas de memoria.
Un intento anterior con Nextcloud se rompió y se abandonó.

## La solución

Un catálogo web donde cada recurso es una ficha con metadatos ricos (~25 campos) que enlaza
al archivo real en Drive o a una URL externa. La web no almacena los recursos: los indexa,
los hace **buscables al instante** y les añade la capa social (valoraciones, favoritos,
comentarios, contadores de uso).

## Principios

1. **Buscar, no navegar.** Nadie va a leer 1.500 fichas. La experiencia central es una
   búsqueda facetada instantánea (texto + filtros combinables con contadores en vivo).
2. **Catalogar debe ser trivial.** Los colaboradores mantienen el catálogo desde una hoja
   de cálculo de Google (edición masiva) que se sincroniza a la BD, o desde la propia web.
   Si catalogar cuesta, el banco muere.
3. **El banco está vivo.** Cualquiera puede enviar recursos en segundos; los editores
   revisan y aprueban. Valoraciones y contadores de uso hacen emerger lo mejor.
4. **Login opcional, valor progresivo.** Sin login se busca y se accede a todo lo público.
   Con login (Google) llegan favoritos, listas, valoraciones y campos protegidos.

## Usuarios

| Perfil | Descripción |
|---|---|
| Anónimo | Busca y accede al catálogo público |
| Consulta | Usuario MCM con login: favoritos, listas, valorar, comentar, enviar recursos |
| Edición local | Además edita los recursos de su MCM local |
| Editor | Edita todo el catálogo y revisa envíos |
| Administrador | Todo + gestión de usuarios, sync del Sheet, estadísticas |
| Consulta externa | Persona ajena al MCM con acceso concedido a contenido protegido |

Cada usuario pertenece a un **MCM local** de una lista cerrada (inicial: MCM Castellón, MCM Nules).

## Referencia (y anti-referencia)

Banco de recursos de GEG Spain (Awesome Table sobre un Sheet): el concepto es correcto
—filtros con contadores, stats globales, valoración por fila— pero la ejecución visual y
la experiencia son mejorables. Nuestro objetivo: mismo concepto, interfaz moderna, rápida
y con identidad propia.

## Fases

Ver [03-roadmap.md](03-roadmap.md) para **lo que queda por hacer** — lo ya cerrado vive en
[archivo/roadmap-historico.md](archivo/roadmap-historico.md), para no agobiar a quien solo
quiere saber qué toca ahora. La fase 5 (búsqueda con IA/embeddings) condicionó elecciones de
entonces: Orama y pgvector dejaron el camino pavimentado.

## Specs, de un vistazo

| Spec | Tema | Estado |
|---|---|---|
| [001](specs/SPEC-001-auth-usuarios.md) | Auth y usuarios | ✅ implementada |
| [002](specs/SPEC-002-catalogo-busqueda.md) | Catálogo y búsqueda facetada | ✅ implementada |
| [003](specs/SPEC-003-interaccion-social.md) | Interacción social | ✅ implementada |
| [004](specs/SPEC-004-envios-revision.md) | Envíos y revisión | ✅ implementada |
| [005](specs/SPEC-005-sync-sheet.md) | Sincronización con el Sheet | ✅ backend implementado — falta crear el Sheet real (15 min) |
| [006](specs/SPEC-006-vistas-filtros.md) | Vistas del catálogo y filtros | 🟡 parcial — §3 itinerario ya está (SPEC-015) y los presets rápidos también; faltan §4 top/descubrir y faceta de rango |
| [007](specs/SPEC-007-descubre-swipe.md) | Descubre (swipe + IA) | ✅ implementada, presets de mazo incluidos (migración `00029`) |
| [008](specs/SPEC-008-panel-admin.md) | Panel de administración | ✅ implementada (el editor de itinerarios acabó en `/admin/itinerarios`, ver SPEC-015) |
| [009](specs/SPEC-009-versiones-recurso.md) | Versiones de un recurso | ✅ implementada |
| [010](specs/SPEC-010-ia-busqueda-clasificacion.md) | IA: clasificación y búsqueda semántica | ✅ implementada |
| [011](specs/SPEC-011-formatos-archivos.md) | Formatos de archivo y descargas | ✅ implementada |
| [012](specs/SPEC-012-pulido-interfaz.md) | Pulido de interfaz | ✅ implementada |
| [013](specs/SPEC-013-rendimiento.md) | Rendimiento con catálogo de verdad | ✅ implementada (primera vuelta; umbral y siguientes pasos anotados) |
| [014](specs/SPEC-014-salud-tareas.md) | Salud del banco y tareas del equipo | ✅ implementada (2026-08-13) |
| [015](specs/SPEC-015-itinerarios.md) | Itinerarios de recursos | ✅ implementada (2026-08-20) — migración `00026`, editor y parte pública |
| [016](specs/SPEC-016-avisos-panel.md) | Avisos y tareas: el buzón del equipo | ✅ implementada (2026-08-15) |
| [017](specs/SPEC-017-espera-sugerencias.md) | Lista de espera, sugerencias y catálogo de demostración | ✅ implementada (2026-08-30) |

Plantilla para specs nuevas: [`specs/_TEMPLATE.md`](specs/_TEMPLATE.md).
