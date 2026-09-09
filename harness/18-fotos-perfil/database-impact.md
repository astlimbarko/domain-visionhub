# Fotos de perfil — Impacto en base de datos

## EXISTE

- Bucket `anuncios` (privado) + 3 políticas RLS en `storage.objects` --
  patrón de referencia, no se toca.
- Tabla `persona` con RLS propia por iglesia/rol (SELECT/UPDATE) -- la
  fuente de verdad a reusar para las políticas del bucket nuevo (ver
  `technical-design.md`, Fase 2).
- Componente `AvatarIniciales` (fallback visual, se mantiene).

## PROPUESTO

| Objeto | Tipo | Fase |
|---|---|---|
| `storage.buckets` row `fotos-perfil` | Insert (bucket privado) | 2 |
| 3 políticas RLS en `storage.objects` (select/insert/delete, `bucket_id = 'fotos-perfil'`) | Nuevo | 2 |
| `persona.foto_perfil_path` | Columna nueva, `TEXT NULL` | 2 |
| Función de permiso reusable "puedo ver/editar esta persona" (si no existe ya una genérica) | Nueva o extraída de RLS existente | 2 |

## Riesgos

- **Cruce entre iglesias**: mismo riesgo que ya se mitigó en anuncios --
  la ruta debe incluir `iglesiaId` y la política debe validarlo, no
  confiar solo en `personaId`.
- **Fotos huérfanas**: mitigado por diseño (ruta determinística
  `{iglesiaId}/{personaId}.jpg` + `upsert: true`, no hace falta borrar la
  anterior antes de subir la nueva).
- **Reventar la RLS de `persona` sin querer** al extraer la función de
  permiso compartida -- cualquier cambio a esa función debe verificarse
  contra la tabla `persona` en vivo, no solo contra el bucket nuevo.

## Verificación antes de aplicar a producción

- Confirmar con una fila de prueba en 2 iglesias distintas que ninguna
  puede leer/escribir la foto de la otra (mismo test que ya se hizo para
  anuncios).
- `supabase db query --linked -f <migración>` (nunca `db push` completo,
  mismo criterio que el resto de la sesión) + verificar
  `pg_get_function_identity_arguments`/políticas activas antes de dar por
  aplicado.
