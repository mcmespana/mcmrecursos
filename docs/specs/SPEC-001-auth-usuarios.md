# SPEC-001 · Autenticación, perfiles y roles

> **Estado:** validada (pendiente aplicar migración)
> **Depende de:** —

## Objetivo

Login opcional con Google para toda la plataforma. El perfil guarda lo mínimo: identidad
de Google, MCM local de referencia y rol. Los roles gobiernan qué se ve y qué se edita.

## Alcance

- Entra: OAuth Google (único método), tabla `perfil`, tabla `mcm_local`, enum de roles,
  trigger de alta automática, RLS base.
- Fuera: gestión de usuarios en panel admin (SPEC posterior), consulta externa con
  invitaciones (solo se deja el rol preparado).

## Modelo de datos

Ver `supabase/migrations/00001_esquema_inicial.sql` (canónico). Resumen:

- **`mcm_local`**: lista cerrada de sedes. Seed: MCM Castellón, MCM Nules. Solo admin la modifica.
- **`perfil`**: `id` (= `auth.users.id`), `email`, `nombre`, `apellidos`, `avatar_url`,
  `mcm_local_id` (nullable hasta que el usuario lo elija), `rol` (default `consulta`).
  Alta automática por trigger al primer login copiando los datos de Google.
- **enum `rol_usuario`**: `consulta`, `edicion_local`, `editor`, `administrador`, `consulta_externa`.

### Reglas de permisos (referencia para todas las specs)

| Acción | anon | consulta | edicion_local | editor | admin | consulta_externa |
|---|---|---|---|---|---|---|
| Ver catálogo público | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Ver campos/recursos protegidos | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Favoritos, listas, valorar, comentar, enviar | ❌ | ✅ | ✅ | ✅ | ✅ | ✅* |
| Editar recursos de su MCM local | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ |
| Editar todo / revisar envíos | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| Gestión usuarios, sync, stats | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

\* consulta_externa: por decidir si puede interactuar o solo leer.

## Experiencia de usuario

- Botón "Entrar con Google" en el header; al volver, avatar + menú (perfil, mis listas, salir).
- Primer login: mini-onboarding de un paso para elegir MCM local (saltable).
- Usuario sin login que intenta ❤️/valorar → dialog invitando a entrar (sin perder contexto).

## Criterios de aceptación

- [ ] Login/logout con Google funciona en local y producción.
- [ ] El primer login crea `perfil` con nombre, apellidos, email y avatar de Google.
- [ ] Un usuario solo puede editar su propio perfil (nunca su `rol`); solo admin cambia roles.
- [ ] `mcm_local` solo es escribible por admin; legible por todos.
- [ ] Las rutas `/admin/**` rechazan a no-admins en servidor (no solo UI).

## Preguntas abiertas

- ¿`consulta_externa` puede valorar/comentar o es solo lectura?
- ¿El MCM local es obligatorio para roles de edición? (propuesta: sí para `edicion_local`).
- ¿Restringir el login a un dominio de Google Workspace o abierto a cualquier Gmail? (propuesta: abierto,
  los permisos los da el rol, no el dominio).
