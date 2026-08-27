import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

// VisionHub -- KAN: reenviar invitación desde la ficha de la entidad (Red,
// Casa de Paz, Departamento, Pastor/Supervisor), no solo mientras
// invitacion_lider sigue en estado PENDIENTE (ver
// 20260826070000_kan_reenviar_invitacion_cargo.sql para el detalle completo
// del motivo).
//
// Misma forma de body que notificar-asignacion-cargo/index.ts (una sola
// entidad no-nula + personaId), pero acá se decide DE QUÉ TIPO es el
// reenvío según el estado real de la cuenta, no un botón fijo:
//   - cuenta nunca confirmada (nunca aceptó ningún enlace) -> se reenvía el
//     mismo invite de Supabase Auth (auth.admin.inviteUserByEmail). Supabase
//     invalida el enlace anterior y genera uno nuevo -- el último enviado es
//     el único válido, no conviene ni hace falta llevar un historial de
//     enlaces vivos.
//   - cuenta ya confirmada (la persona ya inició sesión al menos una vez,
//     por eso ya tiene Persona/cargo) pero con la membresía incompleta -> no
//     se le puede volver a "invitar" (Supabase rechaza invitar a alguien ya
//     confirmado) -- se le manda un recordatorio propio por Brevo con un
//     enlace a /login, que sirve tanto para quien usa contraseña como para
//     quien entra con Google.
function armarHtmlRecordatorio(personaNombre: string, iglesiaNombre: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:36px 32px;">
            <tr><td style="text-align:center;">
              <img src="https://app.somoscdv.com/logo-correo.png" width="64" height="64" alt="Logo" style="display:block;margin:0 auto 12px auto;border-radius:14px;" />
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;">${iglesiaNombre}</p>
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">Te falta un paso</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                Hola ${personaNombre}, todavía no terminaste de completar tu ficha de membresía en <strong>${iglesiaNombre}</strong>. Ingresá de nuevo para terminarla -- te toma solo unos minutos.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
                <tr>
                  <td align="center" style="border-radius:10px;background-color:#2f56e6;">
                    <a href="https://app.somoscdv.com/login" target="_blank"
                       style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">
                      Ingresar ahora
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                Si no reconocés esto, comunicate con quien administra el sistema en tu iglesia.
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

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: {
      redId?: string;
      cdpId?: string;
      departamentoId?: string;
      iglesiaId?: string;
      personaId?: string;
      redirectTo?: string;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const entidades = [body.redId, body.cdpId, body.departamentoId, body.iglesiaId].filter(Boolean);
    if (entidades.length !== 1 || !body.personaId) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    let correo: string | null, persona_nombre: string, iglesia_nombre: string,
      usuario_id: string | null, membresia_completada: boolean, invitado_confirmado: boolean;

    if (body.redId) {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_red", {
        p_red_id: body.redId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/red no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en esa red" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id, membresia_completada, invitado_confirmado } = fila);
    } else if (body.cdpId) {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_cdp", {
        p_cdp_id: body.cdpId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/CdP no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en esa Casa de Paz" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id, membresia_completada, invitado_confirmado } = fila);
    } else if (body.departamentoId) {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_departamento", {
        p_departamento_id: body.departamentoId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/departamento no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en ese departamento" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id, membresia_completada, invitado_confirmado } = fila);
    } else {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_principal", {
        p_iglesia_id: body.iglesiaId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/iglesia no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en esa iglesia" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id, membresia_completada, invitado_confirmado } = fila);
    }

    if (!correo) {
      return Response.json({ error: "Esa persona no tiene ningún correo conocido" }, { status: 404 });
    }
    if (membresia_completada) {
      return Response.json({ error: "Esa persona ya completó su membresía" }, { status: 409 });
    }

    // Nunca confirmó ningún enlace (invitación original, o cuenta creada
    // pero jamás abierta) -> reenviar el invite real de Supabase Auth.
    if (!usuario_id || !invitado_confirmado) {
      const { error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
        redirectTo: body.redirectTo,
        data: { invitado_por_admin: true },
      });
      if (error) {
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ ok: true, tipo: "invitacion" });
    }

    // Ya confirmó (ya inició sesión al menos una vez) pero nunca terminó el
    // formulario -> recordatorio propio, no un invite nuevo (Supabase
    // rechaza re-invitar a alguien ya confirmado).
    const transporte = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: Deno.env.get("BREVO_SMTP_USER"),
        pass: Deno.env.get("BREVO_SMTP_PASS"),
      },
    });

    try {
      await transporte.sendMail({
        from: `"${iglesia_nombre}" <acceso@somoscdv.com>`,
        to: correo,
        subject: "Te falta completar tu ficha de membresía",
        html: armarHtmlRecordatorio(persona_nombre?.trim() || correo, iglesia_nombre),
      });
    } catch (e) {
      console.error("reenviar-invitacion-cargo: fallo el envio por Brevo SMTP", e);
      return Response.json({ error: "No se pudo enviar el recordatorio" }, { status: 500 });
    }

    return Response.json({ ok: true, tipo: "recordatorio" });
  }),
};
