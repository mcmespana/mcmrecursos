# CLAUDE.md — Guía para agentes

## Qué es este proyecto

Banco de Recursos del Movimiento Consolación para el Mundo (MCM): catálogo web de recursos
de tiempo libre (actividades, vídeos, materiales) enlazados a Google Drive o URLs externas,
con búsqueda facetada instantánea, valoraciones, favoritos, listas y flujo de envío/revisión.

## Flujo de trabajo: spec-driven

1. **Antes de implementar una funcionalidad, lee su spec** en `docs/specs/`. Si no existe,
   créala a partir de `docs/specs/_TEMPLATE.md` y valídala con el usuario antes de codificar.
2. Las decisiones de arquitectura viven en `docs/01-arquitectura.md`. No las contradigas
   sin actualizar el documento.
3. El esquema de BD es la suma de `supabase/migrations/*.sql`, en orden. Nunca edites una
   migración ya aplicada: crea una nueva.

## Comandos

```bash
cd app
npm run dev      # servidor de desarrollo
npm run check    # svelte-check + typecheck (debe quedar a 0 errores)
npm run build    # build de producción
```

## Convenciones

- **Svelte 5 con runes** (`$state`, `$derived`, `$props`) — modo runes forzado en `vite.config.ts`.
  Nada de sintaxis legacy (`export let`, `$:`).
- **Componentes UI**: shadcn-svelte en `app/src/lib/components/ui/` (generados, se pueden
  retocar). Componentes propios en `app/src/lib/components/`. Añadir más primitivas con
  `npx shadcn-svelte@latest add <componente> -y`.
- **Tema**: variables en `app/src/app.css`. El acento de marca es `--primary` (teal) y
  `--warm` (ámbar) para la capa social. Soporte claro/oscuro vía clase `.dark`
  (mode-watcher). El sistema de diseño completo está en `docs/04-diseno.md` — síguelo.
- **Tipografías**: Bricolage Grotesque Variable (display, h1/h2) y Figtree Variable
  (resto), autoalojadas vía Fontsource e importadas en `app.css`.
- **Idioma**: interfaz y contenido en español. Código (variables, funciones) en inglés;
  tablas y columnas de BD en español (coherente con otros proyectos MCM).
- **Supabase**: cliente vía `@supabase/ssr` (patrón hooks + locals de SvelteKit).
  Toda tabla con RLS activado y políticas explícitas. Los roles se definen en
  `docs/specs/SPEC-001-auth-usuarios.md`.
- **Iconos**: `@lucide/svelte`.

## Estado del proyecto Supabase

El Banco de Recursos vive en el **esquema Postgres `recursos`** del proyecto compartido
`mcmvotaciones` (`sjhxhsdckvungsrbquve`, org "MCM Developers") — no hay hueco free para un
proyecto propio (ver AD-6 en `docs/01-arquitectura.md`). Reglas:

- **Todo lo del banco va en el esquema `recursos`**, nunca en `public` (que es de la app
  de votaciones y no se toca). Los clientes JS llevan `db: { schema: 'recursos' }`.
- El esquema está expuesto en PostgREST vía `alter role authenticator set pgrst.db_schemas`
  (tras cada cambio DDL: `notify pgrst, 'reload schema';`).
- La migración `00001` YA ESTÁ APLICADA en remoto. Las siguientes se aplican con el MCP
  de Supabase (`apply_migration`) y se versionan también en `supabase/migrations/`.
- ⚠️ Google OAuth como proveedor de Auth está PENDIENTE de configurar en el dashboard
  (necesita client ID/secret de Google Cloud; no se puede por MCP).

## Qué no hacer

- No crear PRs sin que se pidan.
- No tocar los proyectos Supabase `mcmvotaciones` ni `mcmbank` (son otras apps en producción).
- No introducir librerías de estado globales ni frameworks CSS adicionales.
