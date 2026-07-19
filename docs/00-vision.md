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

Ver [03-roadmap.md](03-roadmap.md). La fase 5 (búsqueda con IA/embeddings) condiciona
elecciones de hoy: Orama y pgvector dejan el camino pavimentado.
