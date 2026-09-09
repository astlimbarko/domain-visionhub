# Fotos de perfil — Diseño técnico

## Referencia ya funcionando: bucket de anuncios

`storage.buckets` (`anuncios`, privado, 5MB máx, solo jpeg/png/webp) +
3 políticas RLS en `storage.objects` (select/insert/delete), todas
comparando `(storage.foldername(name))[1]` (primer segmento de la ruta)
contra funciones de permiso ya existentes
(`private.fn_anuncio_es_supervisor`, `public.fn_es_lider_de_red_en_iglesia`).
Ruta: `{iglesiaId}/{uuid}.{ext}`. Servicio frontend en
`frontend/src/services/anuncio.service.ts`
(`subirImagenAnuncio`/`obtenerUrlFirmadaAnuncio`/`eliminarImagenAnuncio`).
Este mismo esqueleto se replica para el bucket de perfil, cambiando el
criterio de la política (por persona, no por Red/iglesia entera).

## Fase 1 — KAN-207: compresor reusable

Nuevo archivo `frontend/src/utils/comprimirImagen.ts`:

```ts
export interface OpcionesCompresion {
  ancho: number;
  alto: number;
  calidad?: number; // default 0.8
}

export async function comprimirImagen(archivo: File | Blob, opciones: OpcionesCompresion): Promise<Blob>
```

Implementación: `createImageBitmap` (o `Image` + `URL.createObjectURL` como
fallback si `createImageBitmap` no soporta el tipo) -> dibujar en
`<canvas>` de `ancho x alto` con "cover" (recorta excedente, no
distorsiona -- la imagen que entra ya viene recortada 1:1 desde KAN-209,
así que en la práctica el `canvas` casi nunca necesita recortar, solo
redimensionar) -> `canvas.toBlob('image/jpeg', calidad)`. Sin
dependencias nuevas, es Web API pura.

Reusar en 2 lugares: `AnuncioForm.tsx` (hoy solo valida ≤5MB, pasa a
comprimir antes de `subirImagenAnuncio`) y el nuevo flujo de avatar de
KAN-209.

## Fase 2 — KAN-210: bucket + políticas

- `storage.buckets`: `fotos-perfil`, privado, `file_size_limit` bajo
  (250x250 JPG 80% pesa poco, ~800KB máx para tener margen), solo
  `image/jpeg`.
- Ruta: `{iglesiaId}/{personaId}.jpg` (no UUID random -- a diferencia de
  anuncios, acá la foto SIEMPRE reemplaza a la anterior de esa persona,
  conviene ruta determinística: subir con `upsert: true` resuelve el
  "reemplazar sin dejar huérfanos" del requirement sin lógica extra de
  borrado).
- Políticas RLS en `storage.objects`, filtrando por
  `bucket_id = 'fotos-perfil'` y extrayendo iglesiaId/personaId de la
  ruta con `storage.foldername`/regex (mismo patrón que anuncios).
  **Antes de escribir las políticas**: buscar en las migraciones
  existentes qué función(es) ya usa la RLS de la propia tabla `persona`
  para decidir "puedo ver esta persona" / "puedo editar esta persona", y
  reusar exactamente esas -- no inventar una nueva regla de permiso
  paralela que pueda desincronizarse. Si no existe una función así de
  genérica (columna por columna en vez de una función), extraerla a una
  función nueva reusable ANTES de escribir la política de Storage, así
  ambas reglas (tabla y bucket) llaman a la misma fuente de verdad.
- Nueva columna en `persona`: `foto_perfil_path TEXT NULL` (la referencia
  estable -- nunca una URL firmada).
- Servicio frontend nuevo `frontend/src/services/persona-foto.service.ts`:
  `subirFotoPerfil(personaId, iglesiaId, blob)`,
  `obtenerUrlFirmadaFotoPerfil(path)`, `quitarFotoPerfil(personaId)`.

## Fase 3 — KAN-209: recorte + componente de avatar

- Librería para el recorte 1:1 con mover+zoom: usar una ya armada en vez
  de reinventar el arrastre a mano con canvas (`react-easy-crop` es la
  opción estándar más liviana para este caso puntual -- confirmar
  disponibilidad/versión compatible con React 19 antes de instalar, el
  proyecto ya usa Vite+React 19).
- Nuevo componente `AvatarPersona` (reemplaza gradualmente a
  `AvatarIniciales` donde haya foto real, cae a `AvatarIniciales` si
  `foto_perfil_path` es null) -- mismo contrato de props para que el
  reemplazo en cada pantalla sea mecánico.
- Nuevo componente `EditorFotoPerfilDialog` (selector de archivo -> crop
  1:1 con zoom -> canvas 250x250 -> `comprimirImagen` -> subir -> guardar
  `foto_perfil_path` en persona vía RPC).
- **Antes de tocar código de UI**: correr un grep fresco de
  `AvatarIniciales` + patrones de iniciales sueltas (no confiar en el
  inventario de esta sesión, que fue exploratorio) para tener la lista
  real y completa de pantallas a actualizar. Lo encontrado hasta ahora
  (no exhaustivo): `GestionSubliderVista.tsx`, `GestionEstructuraVista.tsx`,
  `AsignarCargoDialog.tsx`, `SeleccionarRol.tsx`,
  `PersonasDeCdpVista.tsx`, `PersonasDeRedVista.tsx`,
  `HistorialAsistencia.tsx`, más el avatar del usuario logueado en el
  navbar (`AppShell.tsx` o similar, sin confirmar el archivo exacto).

## Fuera de este diseño

Ver `open-questions.md` para decisiones que el owner todavía no cerró
(upscale de imágenes chicas, límite de tamaño exacto, si el fallback de
iniciales debe seguir existiendo permanentemente o es transitorio).
