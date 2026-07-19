import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ROLES_VALIDOS = ["LIDER_RED", "LIDER_CDP", "SUBLIDER_CDP"];

// Separado de invitar-usuario a proposito: ese es el camino de Super
// Admin/Pastor/Supervisor para dar de alta cuentas de sistema (correo +
// cargo, sin persona). Este es el camino operativo para dar de alta un
// Lider/Sublider de CdP o un Lider de Red que todavia no existe -- el
// destino (red o casa de paz puntual) importa para el permiso (un Lider de
// Red puede invitar dentro de su propia red), y el invitado queda obligado
// a llenar el formulario de membresia antes de ver su panel
// (fn_completar_membresia, 42_invitacion_lideres.sql).
//
// Dos acciones en la misma funcion: "invitar" (default) crea la cuenta y la
// invitacion pendiente; "reenviar" vuelve a mandar el correo de una
// invitacion que ya existe (el usuario nunca confirmo el primer enlace).
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: {
      accion?: "invitar" | "reenviar";
      correo?: string;
      rol?: string;
      redId?: string | null;
      casaDePazId?: string | null;
      invitacionId?: string;
      redirectTo?: string;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    if (body.accion === "reenviar") {
      if (!body.invitacionId) {
        return Response.json({ error: "Falta el id de la invitacion" }, { status: 400 });
      }
      const { data: correo, error: errorPermiso } = await ctx.supabase.rpc(
        "fn_correo_invitacion_lider_si_puedo_gestionar",
        { p_invitacion_id: body.invitacionId }
      );
      if (errorPermiso || !correo) {
        return Response.json({ error: "No tenes permiso, o la invitacion ya no esta pendiente" }, { status: 403 });
      }
      const { error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
        redirectTo: body.redirectTo,
      });
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    const correo = body.correo?.trim().toLowerCase();
    const rol = body.rol;
    const redId = body.redId ?? null;
    const casaDePazId = body.casaDePazId ?? null;

    if (!correo || !correo.includes("@")) {
      return Response.json({ error: "Correo invalido" }, { status: 400 });
    }
    if (!rol || !ROLES_VALIDOS.includes(rol)) {
      return Response.json({ error: "Rol invalido" }, { status: 400 });
    }
    if (rol === "LIDER_RED" && !redId) {
      return Response.json({ error: "Falta la red" }, { status: 400 });
    }
    if (rol !== "LIDER_RED" && !casaDePazId) {
      return Response.json({ error: "Falta la casa de paz" }, { status: 400 });
    }

    const { data: puedeInvitar, error: errorPermiso } = await ctx.supabase.rpc("fn_puede_invitar_lider", {
      p_rol: rol,
      p_red_id: redId,
      p_casa_de_paz_id: casaDePazId,
    });
    if (errorPermiso || !puedeInvitar) {
      return Response.json({ error: "No tenes permiso para invitar aqui" }, { status: 403 });
    }

    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: body.redirectTo,
    });

    if (error) {
      if (error.status === 409 || error.code === "email_exists") {
        return Response.json(
          {
            error:
              "Ya existe una cuenta con ese correo. Si esa persona ya tiene una Persona en el sistema, asignale el cargo buscandola por nombre en vez de invitarla de nuevo.",
          },
          { status: 409 }
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { error: errorInvitar } = await ctx.supabase.rpc("fn_invitar_lider", {
      p_usuario_id: data.user.id,
      p_correo: correo,
      p_rol: rol,
      p_red_id: redId,
      p_casa_de_paz_id: casaDePazId,
    });
    if (errorInvitar) {
      return Response.json({ error: errorInvitar.message }, { status: 500 });
    }

    return Response.json({ id: data.user.id, correo: data.user.email });
  }),
};
