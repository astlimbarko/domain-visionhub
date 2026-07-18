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

// Lo unico que esta funcion hace es lo unico que EXIGE la service_role key:
// crear la cuenta de auth.users y mandar el correo de invitacion. La regla
// fina de "quien puede asignar que rol" no se duplica aca -- ya vive en
// trg_validar_rol (05_funciones_acceso.sql) y se aplica cuando el frontend
// inserta en usuario_rol despues de esta llamada. Aca solo hay un filtro
// grueso (fn_puede_invitar) para que nadie gaste invitaciones sin motivo.
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
        return Response.json(
          { error: "Ya existe una cuenta con ese correo. Esa persona ya puede iniciar sesion; si le falta un cargo, asignaselo desde su ficha." },
          { status: 409 }
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ id: data.user.id, correo: data.user.email });
  }),
};
