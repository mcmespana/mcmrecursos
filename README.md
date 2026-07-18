# 📚 Banco de Recursos MCM

Plataforma del **Movimiento Consolación para el Mundo** para catalogar, buscar y compartir
recursos de tiempo libre (actividades, dinámicas, vídeos, materiales) para niños, jóvenes y adultos.

> Los recursos viven en Google Drive; aquí se catalogan, se buscan y se valoran.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | [SvelteKit](https://svelte.dev/docs/kit) + Svelte 5 (runes) + TypeScript |
| Estilos | Tailwind CSS v4 + [shadcn-svelte](https://shadcn-svelte.com) (base zinc, acento teal) |
| Backend | [Supabase](https://supabase.com) — Postgres, Auth (Google), Storage, RLS |
| Búsqueda | [Orama](https://orama.com) en cliente (facetas + texto, instantánea) |
| Gráficas | LayerChart |
| Despliegue | Vercel |

## Estructura del repositorio

```
app/          → aplicación SvelteKit
supabase/     → migraciones SQL (fuente de verdad del esquema)
docs/         → visión, arquitectura y especificaciones (spec-driven)
```

## Desarrollo

```bash
cd app
npm install
cp .env.example .env   # rellenar credenciales de Supabase
npm run dev
```

## Documentación

Empieza por [`docs/00-vision.md`](docs/00-vision.md) y el índice de specs en
[`docs/specs/`](docs/specs/). Cada funcionalidad se define en una spec antes de implementarse.
Para agentes de IA: [`CLAUDE.md`](CLAUDE.md).
