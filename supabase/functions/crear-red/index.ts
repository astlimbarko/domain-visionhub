import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Menu "Gestion de Redes" del Supervisor (2026-08-01, pedido del owner):
// crear una Red y, opcionalmente, designar su Lider en el mismo paso -- un
// solo codigo OTP para las dos escrituras, igual patron que crear-iglesia
// (65_/crear-iglesia). Si el Lider se busca entre personas existentes,
// fn_crear_red_supervisor ya lo asigna en la misma llamada RPC. Si se
// invita por correo (cuenta nueva), esa escritura necesita service_role
// (auth.admin.inviteUserByEmail), por eso no puede vivir dentro de esa
// misma funcion de Postgres -- pero al estar en la MISMA request ya
// autenticada y con el OTP ya verificado, fn_invitar_lider no vuelve a
// pedir codigo.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: {
      iglesiaId?: string;
      nombre?: string;
      liderPersonaId?: string | null;
      liderCorreoNuevo?: string | null;
      pin?: string;
      redirectTo?: string;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const iglesiaId = body.iglesiaId;
    const nombre = body.nombre?.trim();
    const correoNuevo = body.liderCorreoNuevo?.trim().toLowerCase();

    if (!iglesiaId || !nombre) {
      return Response.json({ error: "Falta la iglesia o el nombre de la red" }, { status: 400 });
    }

    const { data: redId, error: errorCrear } = await ctx.supabase.rpc("fn_crear_red_supervisor", {
      p_iglesia_id: iglesiaId,
      p_nombre: nombre,
      p_lider_persona_id: body.liderPersonaId ?? null,
      p_pin: body.pin ?? null,
    });

    if (errorCrear) {
      return Response.json({ error: errorCrear.message }, { status: 400 });
    }

    if (!correoNuevo) {
      return Response.json({ id: redId });
    }

    if (!correoNuevo.includes("@")) {
      return Response.json(
        { id: redId, error: "La red se creo, pero el correo del Lider no es valido -- invitalo desde Gestion de Redes." },
        { status: 200 }
      );
    }

    const { data: iglesiaFila } = await ctx.supabase.from("iglesia").select("nombre").eq("id", iglesiaId).single();
    const { data: invitado, error: errorInvitar } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correoNuevo, {
      redirectTo: body.redirectTo,
      data: iglesiaFila ? { iglesia_nombre: iglesiaFila.nombre, rol_etiqueta: "Líder de Red", entidad_nombre: nombre } : {},
    });

    if (errorInvitar) {
      const mensaje =
        errorInvitar.status === 409 || errorInvitar.code === "email_exists"
          ? "La red se creo, pero ya existe una cuenta con ese correo -- asignale el cargo de Lider buscandola por nombre desde Gestion de Redes."
          : `La red se creo, pero no se pudo invitar al Lider: ${errorInvitar.message}`;
      return Response.json({ id: redId, error: mensaje }, { status: 200 });
    }

    const { error: errorAsignar } = await ctx.supabase.rpc("fn_invitar_lider", {
      p_usuario_id: invitado.user.id,
      p_correo: correoNuevo,
      p_rol: "LIDER_RED",
      p_red_id: redId,
      p_casa_de_paz_id: null,
      p_departamento_id: null,
    });

    if (errorAsignar) {
      return Response.json(
        { id: redId, error: `La red se creo y se invito al Lider, pero no se pudo registrar la invitacion: ${errorAsignar.message}` },
        { status: 200 }
      );
    }

    return Response.json({ id: redId, liderInvitado: true });
  }),
};
