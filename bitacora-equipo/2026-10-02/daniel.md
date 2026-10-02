# Daniel — 2026-10-02

- [ ] Deploy del edge function `crear-credencial-evangelista`: bloqueado, el token de Supabase que pasó Gonzalo dejó de funcionar (401 en todo, incluso `projects list`) -- avisado, pendiente de un token nuevo
- [x] Expliqué a Gonzalo (WhatsApp) el hallazgo de las 134 migraciones sin registrar -- no es grave hoy, riesgo a futuro si no se repara
- [x] Frontend completo del panel personal de Evangelista (KAN-428/429/430/431/432/433/434), usando los bocetos de `basura_no_leer` (evangelismo1/2/3.jpeg, bannerEvangelismo.jpeg, fuego/fuego.svg):
  - Paleta propia UI v2 (`evangelista-colores.ts`)
  - Banner + racha (`EvangelistaBanner`, ícono de fuego real)
  - Dashboard con indicadores y gráfico mensual (`pages/Evangelista.tsx`)
  - Nueva persona con borrador en localStorage + detección de duplicados (`pages/EvangelistaNuevo.tsx`)
  - Historial con búsqueda y filtro de 30 días (`pages/EvangelistaHistorial.tsx`)
  - Seguimiento/contacto (`pages/EvangelistaSeguimiento.tsx`)
  - Panel "Crear credencial para Evangelista" con el flujo de correo completo (`pages/EvangelistaCredenciales.tsx`)
  - Rutas nuevas (`/evangelista*`), accesibles para cualquier rol con la capacidad (no por RolUI) -- ítem de nav condicional en `AppShell.tsx`
- [x] `npm install` (nunca se habían instalado dependencias en esta máquina), `tsc -b`, `npm run lint` y `npm run build` -- todo limpio, sin errores nuevos
- [ ] Falta: verificación visual en navegador real (sin `.env` con URL+anon key de Supabase en esta máquina) -- comparar contra los bocetos como pidió Daniel
- [ ] Falta: simplificación conocida -- "Contactar ahora" no abre WhatsApp/llamada todavía (necesitaría exponer el teléfono de la persona en `fn_evangelista_historial`, no se tocó la base hoy a propósito)
- [ ] Falta: Jira, entradas en `/avances`
