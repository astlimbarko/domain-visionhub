import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ROLES_VALIDOS = [
  "SUPER_ADMIN",
  "PASTOR",
  "SUPERVISOR_VISION_ACCION",
  "LIDER_RED",
  "LIDER_CDP",
  "SUBLIDER_CDP",
];

const ETIQUETA_ROL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  PASTOR: "Pastor",
  SUPERVISOR_VISION_ACCION: "Supervisor de la Visión en Acción",
  LIDER_RED: "Líder de Red",
  LIDER_CDP: "Líder de Casa de Paz",
  SUBLIDER_CDP: "Sublíder de Casa de Paz",
};

// Crea la cuenta de auth.users (EXIGE service_role) y de una vez le asigna
// el cargo -- las 2 escrituras en la MISMA request, con un solo codigo OTP.
// Bug real encontrado 2026-08-01: antes el frontend hacia una segunda
// llamada a fn_crear_usuario_rol con el mismo pin, pero fn_exigir_pin ya
// lo habia consumido aca mismo -- esa segunda verificacion siempre fallaba
// ("PIN_INCORRECTO"). fn_asignar_rol_recien_invitado (69_) no pide PIN
// propio, solo revalida el permiso (misma regla que fn_crear_usuario_rol,
// trg_validar_rol se aplica igual al insertar).
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: {
      correo?: string;
      rol?: string;
      iglesiaId?: string | null;
      redirectTo?: string;
      pin?: string;
      respetarOtpIglesia?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const correo = body.correo?.trim().toLowerCase();
    const rol = body.rol;
    const iglesiaId = body.iglesiaId ?? null;

    if (!correo || !correo.includes("@")) {
      return Response.json({ error: "Correo invalido" }, { status: 400 });
    }
    if (!rol || !ROLES_VALIDOS.includes(rol)) {
      return Response.json({ error: "Rol invalido" }, { status: 400 });
    }
    if (rol !== "SUPER_ADMIN" && !iglesiaId) {
      return Response.json({ error: "Este rol necesita una iglesia" }, { status: 400 });
    }

    const { data: puedeInvitar, error: errorPermiso } = await ctx.supabase.rpc(
      "fn_puede_invitar",
      { p_iglesia_id: iglesiaId }
    );
    if (errorPermiso || !puedeInvitar) {
      return Response.json({ error: "No tenes permiso para invitar usuarios aqui" }, { status: 403 });
    }

    // KAN-157: solo quien llama desde el constructor de Estructura
    // Organizacional (PanelPrincipalEstructura, respetarOtpIglesia=true)
    // respeta el switch estructura_organigrama.otp_requerido de esa iglesia
    // puntual -- el resto (Administracion.tsx/InvitarUsuarioDialog) sigue
    // exigiendo OTP siempre para Super Admin, sin cambios, vía fn_exigir_pin.
    const { error: errorPin } =
      body.respetarOtpIglesia && iglesiaId
        ? await ctx.supabase.rpc("fn_exigir_pin_iglesia", { p_iglesia_id: iglesiaId, p_pin: body.pin ?? null })
        : await ctx.supabase.rpc("fn_exigir_pin", { p_pin: body.pin ?? null });
    if (errorPin) {
      return Response.json({ error: "PIN incorrecto" }, { status: 403 });
    }

    const iglesiaFila = iglesiaId
      ? (await ctx.supabase.from("iglesia").select("nombre").eq("id", iglesiaId).single()).data
      : null;
    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: body.redirectTo,
      data: {
        ...(iglesiaFila ? { iglesia_nombre: iglesiaFila.nombre } : {}),
        rol_etiqueta: ETIQUETA_ROL[rol],
      },
    });

    if (error) {
      if (error.status === 409 || error.code === "email_exists") {
        // KAN-156: antes esto era un callejon sin salida -- avisaba "ya
        // existe una cuenta, asignaselo a mano desde Usuarios" y no hacia
        // nada mas. El owner pidio que el sistema no bloquee: si la cuenta
        // ya existe y tiene una Persona vinculada, se le asigna el cargo
        // en el mismo paso (mismo patron "un solo PIN" que crear-iglesia
        // con fn_vincular_pastor_invitado -- el PIN ya se consumio arriba,
        // fn_asignar_rol_recien_invitado no vuelve a pedir uno propio).
        const { data: tienePersona } = await ctx.supabase.rpc("fn_correo_tiene_persona", { p_correo: correo });
        if (tienePersona) {
          const { data: cuentas } = await ctx.supabase.rpc("fn_buscar_cuentas", { p_busqueda: correo });
          const cuenta = (cuentas ?? []).find(
            (c: { usuario_id: string; correo: string }) => c.correo?.toLowerCase() === correo
          );
          if (cuenta) {
            const { error: errorAsignar } = await ctx.supabase.rpc("fn_asignar_rol_recien_invitado", {
              p_usuario_id: cuenta.usuario_id,
              p_rol: rol,
              p_iglesia_id: iglesiaId,
            });
            if (!errorAsignar) {
              return Response.json({ id: cuenta.usuario_id, correo, yaExistia: true });
            }
            if (errorAsignar.message?.includes("ROL_AUTOASIGNACION")) {
              return Response.json({ error: "No podés asignarte un cargo a vos mismo -- probá con otra cuenta." }, { status: 200 });
            }
            return Response.json(
              { error: `Esa cuenta ya existía -- no se le pudo asignar el cargo: ${errorAsignar.message}` },
              { status: 200 }
            );
          }
        }
        return Response.json(
          {
            error: tienePersona
              ? "Esa cuenta ya existía y ya puede iniciar sesión; si le falta un cargo, asignaselo desde su ficha."
              : "Esa cuenta ya existía, pero sin una Persona vinculada en el sistema (quedó a medias de un alta anterior). No se le puede asignar un cargo hasta que un Super Admin la vincule manualmente -- avisale al equipo técnico.",
          },
          { status: 200 }
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { error: errorRol } = await ctx.supabase.rpc("fn_asignar_rol_recien_invitado", {
      p_usuario_id: data.user.id,
      p_rol: rol,
      p_iglesia_id: iglesiaId,
    });
    if (errorRol) {
      return Response.json(
        { id: data.user.id, correo: data.user.email, error: `Se invito a ${correo}, pero no se pudo asignar el cargo: ${errorRol.message}` },
        { status: 200 }
      );
    }

    return Response.json({ id: data.user.id, correo: data.user.email });
  }),
};
