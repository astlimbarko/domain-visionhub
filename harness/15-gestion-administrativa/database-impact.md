# 15 — Gestión administrativa — database-impact.md

> Inventario preciso de lo que HOY existe vs. lo que se PROPONE. Verificado
> leyendo `origin/master` (incluye PR #7). Nada de esto está implementado aún.

## 1. Lo que YA existe (reutilizar, no recrear)

### Esquema / backend
| Objeto | Archivo | Qué aporta |
|---|---|---|
| `iglesia` (con `iglesia_padre_id`) | `03_tenancy.sql` | Jerarquía madre/hija. **Sin** campo `tipo`. |
| `rol_sistema_enum` | `01_enums.sql` | 6 roles. **Sin** Supervisor de Red. |
| `fn_es_pastor_en`, `fn_validar_asignacion_rol`, `fn_dashboard_pastor` | `40_acotar_super_admin.sql` | Super-Admin acotado; jerarquía de asignación. |
| `fn_es_operativo_en` (solo Supervisor), `fn_mis_iglesias_detalle` (+`es_pastor`) | `43_pastor_no_operativo.sql` | Pastor = solo lectura. |
| `fn_crear_iglesia(p_sufijo,p_ciudad,p_pin)` | `30_fusiones_y_pin.sql` | Crea iglesia (hoy Super-Admin). |
| `usuario_pin`, `fn_establecer_pin`, `fn_verificar_pin`, `fn_exigir_pin` | `30_fusiones_y_pin.sql` | PIN estático de Super-Admin. |
| `fn_dashboard_super_admin`, `fn_listar_usuarios`, `fn_crear_usuario_rol` | `41_`, `29_`, admin | Panorama + usuarios. |
| `departamento` (id, iglesia_id, codigo, nombre, activo) | `08_estructura.sql` | 4 deptos por iglesia. **Sin** columna `color`. |
| `departamento_cargo` + RLS (escritura `fn_es_operativo_en`) + `fn_validar_departamento_cargo` | `47_departamento_cargo.sql` | Modelo de líder de departamento (backend listo). |
| Seed 4 departamentos (EVANGELISMO/AFIRMACION/DISCIPULADO/ENVIO) | `seeds/seed_04_por_iglesia.sql` | Códigos internos (sustantivos). |
| Edge Functions `invitar-lider`, `invitar-usuario` | `supabase/functions/` | Invitación por correo. |

### Frontend
| Objeto | Archivo |
|---|---|
| Permisos centralizados (`RUTAS_POR_ROL`, `CATALOGO_NAV`, `determinarRolUI`…) | `utils/permisos.ts` |
| Guards `RequiereRol`, `RequiereCapacidad` | `components/layout/` |
| Página admin + diálogos | `pages/Administracion.tsx`, `components/admin/{CrearIglesia,InvitarUsuario}Dialog.tsx` |
| Alta dual (buscar/invitar) | `components/casas-de-paz/{BuscadorPersona,AsignarCargoDialog}.tsx` |
| Hover azul | `CAMPO_ESTILO` en `components/shared/CamposMembresiaFields.tsx` |
| Sistema de diseño | `frontend/.claude/skills/frontend-style/SKILL.md`, `components/dashboard/DashboardUI.tsx`, `components/shared/SeccionPerfil.tsx` |
| Store de sesión | `store/auth.store.ts`, `services/sesion.service.ts` |

## 2. Lo que se PROPONE (nuevo)

> Próximos números de migración libres: **55+** (el 54 es el último ocupado).
> Numeración sujeta a ajuste al implementar (evitar colisión con trabajo de Matías).

### Migraciones nuevas
| # propuesto | Contenido | Riesgo |
|---|---|---|
| `55_iglesia_tipo.sql` | `iglesia_tipo_enum` + `iglesia.tipo NOT NULL DEFAULT 'HIJA'` | Bajo (aditivo; nadie consulta `tipo` hoy). |
| `56_departamento_color.sql` | `departamento.color` + CHECK + seed por código | Bajo (aditivo; patrón `tipo_evento.color`). |
| `57_usuario_otp.sql` | Tabla `usuario_otp` + RLS + índices | Bajo (tabla nueva). |
| `58_otp_verificacion.sql` | `fn_exigir_pin` pasa a verificar OTP (misma firma) | **Medio** (toca la verificación que usan ~10 funciones; probar cada una). |
| `59_supervisor_red.sql` | `ALTER TYPE rol_sistema_enum ADD VALUE 'SUPERVISOR_RED_VISION_ACCION'` + ramas en `fn_validar_asignacion_rol` + RLS/nav asociada | **Medio** (enum aditivo seguro; la lógica de permisos requiere cuidado). |
| `60_gestion_admin_rpc.sql` | `fn_actualizar_iglesia`, `fn_toggle_iglesia_activa`, `fn_eliminar_iglesia`, `fn_actualizar_usuario_rol`, `fn_toggle/remover_usuario_rol`, `fn_convertir_tipo_iglesia`, `fn_designar/remover_lider_departamento`, ampliación de `fn_crear_iglesia` (Pastor) | **Medio** (varias RPC; cada una con permiso + OTP + soft delete). |

### Edge Functions nuevas
| Nombre | Rol |
|---|---|
| `solicitar-otp` | Genera OTP, lo guarda hasheado y lo envía por SMTP Brevo (HTML propio, identidad "Centro de Vida 4 Anillo"). |

### Frontend nuevo / modificado
| Acción | Archivo(s) |
|---|---|
| Acciones de gestión en admin (editar/suspender/eliminar iglesia y usuario) | `pages/Administracion.tsx` + nuevos diálogos en `components/admin/` |
| Alta dual en admin (Opción 1 buscar) | extender `InvitarUsuarioDialog` / nuevo `AltaPersonaConDobleVia` |
| Pantalla de gestión del Pastor | nueva `pages/` + ruta + item nav + guard |
| Ítem "Departamentos" + pantalla | nueva `pages/Departamentos.tsx` + ruta + `CATALOGO_NAV`/`RUTAS_SUPERVISOR` |
| Rol Supervisor de Red | `utils/permisos.ts`, `types/auth.types.ts`, `Administracion.tsx` |
| Diálogo OTP compartido | nuevo `ConfirmarConCodigoDialog` (reemplaza input de PIN) |
| Pie de soporte | `components/layout/AppShell.tsx` |
| Hover azul estándar + doc | extraer `CAMPO_ESTILO` + `frontend-style/SKILL.md` |
| Colores/tipos como tokens | `DashboardUI` / design system |

## 3. Verificación de no-destrucción (satélite y OTP)

- **`iglesia.tipo`**: ninguna política RLS de `iglesia` (16_rls.sql) ni dashboard
  filtra por `tipo`; usan `iglesia_padre_id`/`fn_mis_iglesias`. `DEFAULT 'HIJA'`
  deja las filas actuales idénticas. → sin migración de datos, sin ruptura.
- **OTP sobre `fn_exigir_pin`**: al conservar nombre y parámetro `p_pin`, las
  funciones que hoy hacen `PERFORM fn_exigir_pin(p_pin)` no cambian de firma.
  Riesgo acotado a la lógica interna de verificación → cubrir con pruebas curl
  por cada función sensible antes de dar por cerrado.
- **Enum nuevo**: `ALTER TYPE ... ADD VALUE` es aditivo; los `Record<RolUI,...>`
  del frontend deben cubrir el nuevo valor (TypeScript lo fuerza en `permisos.ts`).

## 4. Dependencias y orden

Ver `implementation-plan.md`. Resumen: primero infraestructura transversal
(OTP, satélite, color, enum) y cimientos de UI; después la gestión por rol
(Super-Admin → Supervisor/Departamentos → Pastor); satélite diferenciado y
Supervisor de Red al final por mayor riesgo/alcance.
