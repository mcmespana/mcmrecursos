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
- **Tema**: variables en `app/src/app.css`. El acento de marca es `--primary` (teal).
  Soporte claro/oscuro vía clase `.dark` (mode-watcher).
- **Idioma**: interfaz y contenido en español. Código (variables, funciones) en inglés;
  tablas y columnas de BD en español (coherente con otros proyectos MCM).
- **Supabase**: cliente vía `@supabase/ssr` (patrón hooks + locals de SvelteKit).
  Toda tabla con RLS activado y políticas explícitas. Los roles se definen en
  `docs/specs/SPEC-001-auth-usuarios.md`.
- **Iconos**: `@lucide/svelte`.

## Estado del proyecto Supabase

⚠️ El proyecto Supabase remoto AÚN NO EXISTE (límite de proyectos free alcanzado en la org
"MCM Developers"). Las migraciones de `supabase/migrations/` están listas para aplicarse
cuando se cree (nombre previsto: `mcm-banco-recursos`, región `eu-west-3`). No inventes
credenciales: pide al usuario liberar hueco o crear el proyecto, y entonces aplica las
migraciones en orden con el MCP de Supabase.

## Qué no hacer

- No crear PRs sin que se pidan.
- No tocar los proyectos Supabase `mcmvotaciones` ni `mcmbank` (son otras apps en producción).
- No introducir librerías de estado globales ni frameworks CSS adicionales.
