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
    let body: { correo?: string; rol?: string; iglesiaId?: string | null; redirectTo?: string; pin?: string };
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

    // fn_exigir_pin solo pide algo si quien llama es Super Admin -- para
    // Pastor/Supervisor invitando dentro de su propia iglesia no cambia nada.
    const { error: errorPin } = await ctx.supabase.rpc("fn_exigir_pin", { p_pin: body.pin ?? null });
    if (errorPin) {
      return Response.json({ error: "PIN incorrecto" }, { status: 403 });
    }

    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: body.redirectTo,
    });

    if (error) {
      if (error.status === 409 || error.code === "email_exists") {
        // Mismo hallazgo que invitar-lider (2026-08-02): si la cuenta existe
        // pero nunca se le vinculo una Persona, "asignaselo desde su ficha"
        // es un callejon sin salida -- no hay ficha que buscar.
        const { data: tienePersona } = await ctx.supabase.rpc("fn_correo_tiene_persona", { p_correo: correo });
        return Response.json(
          {
            error: tienePersona
              ? "Ya existe una cuenta con ese correo. Esa persona ya puede iniciar sesion; si le falta un cargo, asignaselo desde su ficha."
              : "Ya existe una cuenta con ese correo, pero sin una Persona vinculada en el sistema (quedo a medias de un alta anterior). No se le puede asignar un cargo hasta que un Super Admin la vincule manualmente -- avisale al equipo tecnico.",
          },
          { status: 409 }
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
