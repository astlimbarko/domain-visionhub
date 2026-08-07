import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

const ROLES_VALIDOS = ["LIDER_RED", "SUPERVISOR_RED", "LIDER_CDP", "SUBLIDER_CDP"];

// Pedido del owner (2026-08-07): el correo de invitacion de Supabase Auth
// ("Aceptar invitacion") no dice para que rol fue invitada la persona, y
// esa plantilla no se puede tocar desde esta sesion (dashboard, protegido
// con hCaptcha). Se manda un segundo correo propio, mismo patron Brevo que
// notificar-asignacion-cargo, aclarando el rol y la entidad. Nunca bloquea
// la respuesta de la invitacion si falla -- es un aviso extra, no el alta.
const ETIQUETA_CARGO_INVITACION: Record<string, string> = {
  LIDER_RED: "Líder de Red",
  SUPERVISOR_RED: "Supervisor de Red",
  LIDER_CDP: "Líder de Casa de Paz",
  SUBLIDER_CDP: "Sublíder de Casa de Paz",
};

function armarHtmlInvitacion(cargoEtiqueta: string, entidadNombre: string, iglesiaNombre: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:36px 32px;">
            <tr><td style="text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;">${iglesiaNombre}</p>
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">Detalle de su invitación</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                Fue invitado como <strong>${cargoEtiqueta}</strong> en <strong>${entidadNombre}</strong>. Revise también el otro correo ("Aceptar invitación") para crear su contraseña y acceder al sistema.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                Si no esperaba esta invitación, puede ignorar este mensaje.
              </p>
            </td></tr>
          </table>
          <p style="margin:20px 0 0;font-size:11px;color:#9ca3af;">Este es un mensaje automático. No responda a este correo.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Separado de invitar-usuario a proposito: ese es el camino de Super
// Admin/Pastor/Supervisor para dar de alta cuentas de sistema (correo +
// cargo, sin persona). Este es el camino operativo para dar de alta un
// Lider/Sublider de CdP o un Lider de Red que todavia no existe -- el
// destino (red o casa de paz puntual) importa para el permiso (un Lider de
// Red puede invitar dentro de su propia red), y el invitado queda obligado
// a llenar el formulario de membresia antes de ver su panel
// (fn_completar_membresia, 42_invitacion_lideres.sql).
//
// Cuatro acciones en la misma funcion: "invitar" (default) crea la cuenta y
// la invitacion pendiente; "reenviar" vuelve a mandar el correo de una
// invitacion que ya existe (el usuario nunca confirmo el primer enlace);
// "cancelar" da de baja una invitacion equivocada (banea la cuenta huerfana
// de auth.users si nunca se completo el alta -- no se puede borrar, queda
// referenciada por FK desde el soft-delete de invitacion_lider/usuario_rol);
// "corregir" es cancelar +
// re-invitar con el correo nuevo, mismo rol/destino (REQ-ASG-10: invalidar
// el enlace anterior).
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: {
      accion?: "invitar" | "reenviar" | "cancelar" | "corregir";
      correo?: string;
      rol?: string;
      redId?: string | null;
      casaDePazId?: string | null;
      departamentoId?: string | null;
      invitacionId?: string;
      redirectTo?: string;
      pin?: string;
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

    let rol: string | null = body.rol ?? null;
    let redId = body.redId ?? null;
    let casaDePazId = body.casaDePazId ?? null;
    const departamentoId = body.departamentoId ?? null;

    if (body.accion === "cancelar" || body.accion === "corregir") {
      if (!body.invitacionId) {
        return Response.json({ error: "Falta el id de la invitacion" }, { status: 400 });
      }
      const { data: resultado, error: errorCancelar } = await ctx.supabase.rpc("fn_cancelar_invitacion_lider", {
        p_invitacion_id: body.invitacionId,
      });
      if (errorCancelar) {
        return Response.json({ error: "No tenes permiso, o la invitacion ya no esta pendiente" }, { status: 403 });
      }
      if (resultado?.usuario_id_a_borrar) {
        // No se puede borrar: invitacion_lider/usuario_rol quedan (soft-delete)
        // referenciando ese auth.users por FK. Banear invalida el enlace
        // anterior igual de bien (no puede autenticarse ni completar el alta).
        await ctx.supabaseAdmin.auth.admin.updateUserById(resultado.usuario_id_a_borrar, {
          ban_duration: "876000h",
        });
      }
      if (body.accion === "cancelar") {
        return Response.json({ ok: true });
      }
      // "corregir": cae al flujo de invitar de abajo con el rol/destino original.
      rol = resultado.cargo_codigo === "SUBLIDER_RED" ? "SUPERVISOR_RED" : resultado.rol;
      redId = resultado.red_id;
      casaDePazId = resultado.casa_de_paz_id;
    }

    const correo = body.correo?.trim().toLowerCase();

    if (!correo || !correo.includes("@")) {
      return Response.json({ error: "Correo invalido" }, { status: 400 });
    }
    if (!departamentoId) {
      if (!rol || !ROLES_VALIDOS.includes(rol)) {
        return Response.json({ error: "Rol invalido" }, { status: 400 });
      }
      if ((rol === "LIDER_RED" || rol === "SUPERVISOR_RED") && !redId) {
        return Response.json({ error: "Falta la red" }, { status: 400 });
      }
      if (rol !== "LIDER_RED" && rol !== "SUPERVISOR_RED" && !casaDePazId) {
        return Response.json({ error: "Falta la casa de paz" }, { status: 400 });
      }
    }

    const { data: puedeInvitar, error: errorPermiso } = await ctx.supabase.rpc("fn_puede_invitar_lider", {
      p_rol: rol === "SUPERVISOR_RED" ? "LIDER_RED" : rol,
      p_red_id: redId,
      p_casa_de_paz_id: casaDePazId,
      p_departamento_id: departamentoId,
    });
    if (errorPermiso || !puedeInvitar) {
      return Response.json({ error: "No tenes permiso para invitar aqui" }, { status: 403 });
    }

    // Designar Lider de Red o Lider de Departamento es delicado (pedido del
    // owner, 2026-08-01): siempre exige codigo de confirmacion, sin importar
    // quien invite. LIDER_CDP/SUBLIDER_CDP quedan afuera a proposito (area
    // de Matias, mismo hallazgo pendiente de que el lo aplique ahi).
    if (rol === "LIDER_RED" || rol === "SUPERVISOR_RED") {
      const { data: otpOk, error: errorOtp } = await ctx.supabase.rpc("fn_estructura_validar_otp_red", {
        p_red_id: redId,
        p_codigo: body.pin ?? null,
      });
      if (errorOtp || !otpOk) {
        return Response.json({ error: "El código de confirmación es incorrecto, expiró, o no fue solicitado" }, { status: 403 });
      }
    } else if (departamentoId) {
      const { data: otpOk, error: errorOtp } = await ctx.supabase.rpc("fn_verificar_otp", { p_codigo: body.pin ?? null });
      if (errorOtp || !otpOk) {
        return Response.json({ error: "El código de confirmación es incorrecto, expiró, o no fue solicitado" }, { status: 403 });
      }
    }

    const { data, error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
      redirectTo: body.redirectTo,
    });

    if (error) {
      if (error.status === 409 || error.code === "email_exists") {
        // Bug real 2026-08-02: si la cuenta existe pero nunca se le vinculo
        // una Persona (alta vieja que quedo a medias), "buscala por nombre"
        // es un callejon sin salida -- no hay nada que buscar. Se distingue
        // el caso para no dejar al admin sin ninguna pista de que hacer.
        //
        // Pedido explicito del owner (2026-08-06): si SI tiene Persona
        // vinculada, devolver directamente quien es (personaId/personaNombre)
        // para que el frontend pueda ofrecer "asignarla de todas formas" sin
        // que el admin tenga que ir a buscarla a mano en otra pestaña.
        const { data: filas } = await ctx.supabase.rpc("fn_persona_por_correo_cuenta", { p_correo: correo });
        const persona = filas?.[0] as { id: string; nombre: string } | undefined;
        return Response.json(
          persona
            ? {
                error: `Ya existe una cuenta con ese correo, asociada a ${persona.nombre}.`,
                personaId: persona.id,
                personaNombre: persona.nombre,
              }
            : {
                error: "Ya existe una cuenta con ese correo, pero sin una Persona vinculada en el sistema (quedo a medias de un alta anterior). No se le puede asignar un cargo hasta que un Super Admin la vincule manualmente -- avisale al equipo tecnico.",
              },
          { status: 409 }
        );
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    const { error: errorInvitar } = rol === "SUPERVISOR_RED"
      ? await ctx.supabase.rpc("fn_estructura_invitar_supervisor_red", {
          p_usuario_id: data.user.id,
          p_correo: correo,
          p_red_id: redId,
        })
      : await ctx.supabase.rpc("fn_invitar_lider", {
          p_usuario_id: data.user.id,
          p_correo: correo,
          p_rol: rol,
          p_red_id: redId,
          p_casa_de_paz_id: casaDePazId,
          p_departamento_id: departamentoId,
        });
    if (errorInvitar) {
      return Response.json({ error: errorInvitar.message }, { status: 500 });
    }

    try {
      const cargoEtiqueta = rol ? ETIQUETA_CARGO_INVITACION[rol] : undefined;
      const { data: filasDatos } = await ctx.supabase.rpc("fn_estructura_datos_invitacion", {
        p_red_id: redId,
        p_casa_de_paz_id: casaDePazId,
        p_departamento_id: departamentoId,
      });
      const datos = filasDatos?.[0] as { entidad_nombre: string; iglesia_nombre: string } | undefined;
      if (datos) {
        const transporte = nodemailer.createTransport({
          host: "smtp-relay.brevo.com",
          port: 587,
          secure: false,
          auth: {
            user: Deno.env.get("BREVO_SMTP_USER"),
            pass: Deno.env.get("BREVO_SMTP_PASS"),
          },
        });
        await transporte.sendMail({
          from: `"${datos.iglesia_nombre}" <acceso@somoscdv.com>`,
          to: correo,
          subject: `Detalle de su invitación en ${datos.iglesia_nombre}`,
          html: armarHtmlInvitacion(cargoEtiqueta ?? `Líder de ${datos.entidad_nombre}`, datos.entidad_nombre, datos.iglesia_nombre),
        });
      }
    } catch (e) {
      console.error("invitar-lider: fallo el correo de detalle de invitacion (no bloquea el alta)", e);
    }

    return Response.json({ id: data.user.id, correo: data.user.email });
  }),
};
