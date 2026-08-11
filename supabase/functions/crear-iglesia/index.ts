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

    const { data: iglesiaFila } = await ctx.supabase.from("iglesia").select("nombre").eq("id", iglesiaId).single();
    const { data: invitado, error: errorInvitar } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correoNuevo, {
      redirectTo: body.redirectTo,
      data: iglesiaFila ? { iglesia_nombre: iglesiaFila.nombre, rol_etiqueta: "Pastor" } : {},
    });

    if (errorInvitar) {
      if (errorInvitar.status === 409 || errorInvitar.code === "email_exists") {
        // KAN-156: la iglesia ya se creo; si el correo ya tiene cuenta, se
        // le asigna el Pastor directo en vez de solo avisar (mismo patron
        // "un solo PIN" -- fn_vincular_pastor_invitado no pide uno propio).
        const { data: cuentas } = await ctx.supabase.rpc("fn_buscar_cuentas", { p_busqueda: correoNuevo });
        const cuenta = (cuentas ?? []).find(
          (c: { usuario_id: string; correo: string }) => c.correo?.toLowerCase() === correoNuevo
        );
        if (cuenta) {
          const { error: errorVincularExistente } = await ctx.supabase.rpc("fn_vincular_pastor_invitado", {
            p_iglesia_id: iglesiaId,
            p_usuario_id: cuenta.usuario_id,
          });
          if (!errorVincularExistente) {
            // KAN-164: mismo aviso por correo que invitar-usuario -- si la
            // cuenta ya tenia una Persona en esta iglesia, se le notifica la
            // designacion. En la practica casi nunca aplica aca (la iglesia
            // recien se creo), pero cuesta cero dejarlo consistente.
            const { data: personaFila } = await ctx.supabase
              .from("persona")
              .select("id")
              .eq("usuario_id", cuenta.usuario_id)
              .eq("iglesia_id", iglesiaId)
              .is("fecha_eliminacion", null)
              .maybeSingle();
            if (personaFila) {
              await ctx.supabase.functions.invoke("notificar-asignacion-cargo", {
                body: { iglesiaId, personaId: personaFila.id, cargo: "PASTOR" },
              }).catch((e) => console.error("crear-iglesia: no se pudo notificar la designacion", e));
            }
            return Response.json({ id: iglesiaId, pastorInvitado: true, pastorYaExistia: true });
          }
          if (errorVincularExistente.message?.includes("ROL_AUTOASIGNACION")) {
            return Response.json(
              { id: iglesiaId, error: "La iglesia se creó, pero no podés asignarte el Pastor a vos mismo -- probá con otra cuenta." },
              { status: 200 }
            );
          }
          return Response.json(
            { id: iglesiaId, error: `La iglesia se creó, pero esa cuenta ya existía y no se le pudo asignar el Pastor: ${errorVincularExistente.message}` },
            { status: 200 }
          );
        }
        return Response.json(
          { id: iglesiaId, error: "La iglesia se creó. Ese correo ya tenía cuenta -- asignale el cargo de Pastor buscándola por correo desde Usuarios." },
          { status: 200 }
        );
      }
      return Response.json(
        { id: iglesiaId, error: `La iglesia se creo, pero no se pudo invitar al Pastor: ${errorInvitar.message}` },
        { status: 200 }
      );
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
