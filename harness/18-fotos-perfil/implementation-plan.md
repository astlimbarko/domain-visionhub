# Fotos de perfil — Plan de implementación

Rama `feature/fotos-perfil-compresor-storage`. Un commit al cerrar cada
fase (con `tsc -b` + lint limpios y verificación en vivo antes de
comitear), no un solo commit gigante al final.

## Fase 1 — KAN-207: compresor reusable (frontend puro)

1. `frontend/src/utils/comprimirImagen.ts` (ver firma en `technical-design.md`).
2. Integrar en `AnuncioForm.tsx` (reemplaza la validación de "máx. 5MB" por
   comprimir antes de subir -- confirmar con el owner si el límite de
   entrada cambia o se mantiene como filtro previo).
3. Verificar en vivo: subir una imagen de prueba pesada a un anuncio,
   confirmar en Supabase Storage que lo que quedó guardado es liviano.
4. Commit.

## Fase 2 — KAN-210: Storage + políticas (backend)

1. Investigar la función real que ya usa la RLS de `persona` para
   "puedo ver/editar esta persona" (grep en migraciones antes de escribir
   nada nuevo).
2. Migración: bucket `fotos-perfil` + 3 políticas + columna
   `persona.foto_perfil_path`.
3. Aplicar con `supabase db query --linked -f` (nunca `db push` completo).
4. `frontend/src/services/persona-foto.service.ts`.
5. Verificar en vivo con 2 cuentas de iglesias distintas: cruce de acceso
   debe fallar.
6. Commit.

## Fase 3 — KAN-209: recorte + avatar (UI)

1. Confirmar/instalar librería de crop 1:1 con zoom.
2. `EditorFotoPerfilDialog` (selector -> crop -> 250x250 -> comprimir ->
   subir -> guardar referencia).
3. Componente `AvatarPersona` (foto real o fallback a `AvatarIniciales`).
4. Grep fresco de todos los lugares con iniciales/avatar de persona,
   reemplazar uno por uno.
5. Verificar en vivo (desktop + mobile, Playwright): subir, reemplazar,
   quitar foto; confirmar que aparece en cada pantalla tocada.
6. Commit final de la fase.

## Al terminar las 3 fases

- Actualizar `harness/README.md` (agregar fila `18-fotos-perfil` a la
  tabla de áreas).
- Jira: mover KAN-207/210/209 por su ciclo real (En curso -> En revisión
  cuando el código esté listo -> Finalizada solo cuando esté verificado en
  vivo), con un comentario en cada cambio de estado.
- PR + merge (con confirmación del owner, como el resto de la sesión).
