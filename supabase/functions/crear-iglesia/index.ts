import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const TIPOS_VALIDOS = ["HIJA", "SATELITE"];

// Bug reportado 2026-07-31: crear una iglesia y de paso invitar a su Pastor
// por correo pedia 2 codigos OTP (uno para fn_crear_iglesia, otro para
// invitar-usuario, que exige el suyo propio de forma independiente). Un solo
// codigo del Super Admin alcanza -- esta funcion hace las 3 escrituras
// (iglesia, invitacion de auth, cargo de Pastor) en UNA sola llamada de red,
// verificando el OTP una unica vez (dentro de fn_crear_iglesia). El paso de
// invitar por correo necesita service_role (auth.admin.inviteUserByEmail),
// por eso no puede vivir dentro de esa misma funcion de Postgres -- pero al
// estar en la MISMA request ya autenticada, fn_vincular_pastor_invitado
// (65_crear_iglesia_pastor_un_solo_pin.sql) no vuelve a pedir PIN.
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: {
      sufijo?: string;
      ciudad?: string;
      iglesiaPadreId?: string | null;
      tipo?: string;
      pastorUsuarioId?: string | null;
      pastorCorreoNuevo?: string | null;
      pin?: string;
      redirectTo?: string;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const sufijo = body.sufijo?.trim();
    const ciudad = body.ciudad?.trim();
    const tipo = body.tipo ?? "HIJA";
    const correoNuevo = body.pastorCorreoNuevo?.trim().toLowerCase();

    if (!sufijo || !ciudad) {
      return Response.json({ error: "Falta el nombre o la ciudad" }, { status: 400 });
    }
    if (!TIPOS_VALIDOS.includes(tipo)) {
      return Response.json({ error: "Tipo de iglesia invalido" }, { status: 400 });
    }

    const { data: iglesiaId, error: errorCrear } = await ctx.supabase.rpc("fn_crear_iglesia", {
      p_sufijo: sufijo,
      p_ciudad: ciudad,
      p_iglesia_padre_id: body.iglesiaPadreId ?? null,
      p_tipo: tipo,
      p_pastor_usuario_id: body.pastorUsuarioId ?? null,
      p_pin: body.pin ?? null,
    });

    if (errorCrear) {
      return Response.json({ error: errorCrear.message }, { status: 400 });
    }

    if (!correoNuevo) {
      return Response.json({ id: iglesiaId });
    }

    if (!correoNuevo.includes("@")) {
      return Response.json(
        { id: iglesiaId, error: "La iglesia se creo, pero el correo del Pastor no es valido -- invitalo desde Usuarios." },
        { status: 200 }
      );
    }

    const { data: invitado, error: errorInvitar } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correoNuevo, {
      redirectTo: body.redirectTo,
    });

    if (errorInvitar) {
      const mensaje =
        errorInvitar.status === 409 || errorInvitar.code === "email_exists"
          ? "La iglesia se creo, pero ya existe una cuenta con ese correo -- asignale el cargo de Pastor buscandola por correo desde Usuarios."
          : `La iglesia se creo, pero no se pudo invitar al Pastor: ${errorInvitar.message}`;
      return Response.json({ id: iglesiaId, error: mensaje }, { status: 200 });
    }

    const { error: errorVincular } = await ctx.supabase.rpc("fn_vincular_pastor_invitado", {
      p_iglesia_id: iglesiaId,
      p_usuario_id: invitado.user.id,
    });

    if (errorVincular) {
      return Response.json(
        { id: iglesiaId, error: `La iglesia se creo y se invito al Pastor, pero no se pudo asignar el cargo: ${errorVincular.message}` },
        { status: 200 }
      );
    }

    return Response.json({ id: iglesiaId, pastorInvitado: true });
  }),
};
