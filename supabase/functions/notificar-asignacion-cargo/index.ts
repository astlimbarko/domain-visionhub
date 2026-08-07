import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

// REQ-ASG-7 (pedido del owner, 2026-08-06): al designar Lider/Supervisor
// de Red, el sistema nunca avisaba por correo a la persona designada.
// Mismo patron SMTP de solicitar-otp, pero la identidad de remitente/firma
// es dinamica por iglesia (REQ-IG-5: nunca "VisionHub" como sustituto del
// nombre de la iglesia) -- por eso no se reutiliza la constante fija de ahi.
const ETIQUETA_CARGO: Record<string, string> = {
  LIDER_RED: "Líder de Red",
  SUBLIDER_RED: "Supervisor de Red",
};

function armarHtml(personaNombre: string, cargoEtiqueta: string, redNombre: string, iglesiaNombre: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:36px 32px;">
            <tr><td style="text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;">${iglesiaNombre}</p>
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">Nueva designación</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                Hola ${personaNombre}, se le asignó el cargo de <strong>${cargoEtiqueta}</strong> en la red <strong>${redNombre}</strong>.
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                Si no reconoce esta acción, comuníquese con quien administra el sistema en su iglesia.
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
    let body: { redId?: string; personaId?: string; cargo?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const cargoEtiqueta = body.cargo ? ETIQUETA_CARGO[body.cargo] : undefined;
    if (!body.redId || !body.personaId || !cargoEtiqueta) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    // El mismo chequeo de permiso que usa la asignacion (private.fn_estructura_puede_administrar)
    // vive dentro de esta RPC -- si quien llama no administra esa red, tira SIN_PERMISO.
    const { data: filas, error: errorDatos } = await ctx.supabase.rpc("fn_estructura_datos_notificacion_cargo_red", {
      p_red_id: body.redId,
      p_persona_id: body.personaId,
    });
    if (errorDatos) {
      return Response.json({ error: "No tenes permiso, o la persona/red no existe" }, { status: 403 });
    }
    const fila = filas?.[0] as { persona_nombre: string; correo: string | null; red_nombre: string; iglesia_nombre: string } | undefined;
    if (!fila) {
      return Response.json({ error: "No se encontro la persona en esa red" }, { status: 404 });
    }
    if (!fila.correo) {
      // No es un error de la asignacion (que ya se hizo) -- la persona
      // simplemente no tiene ningun correo conocido (ni persona.correo ni
      // cuenta vinculada). No hay a quien avisar.
      return Response.json({ ok: true, enviado: false, motivo: "sin correo conocido" });
    }

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
        from: `"${fila.iglesia_nombre}" <acceso@somoscdv.com>`,
        to: fila.correo,
        subject: `Fuiste designado como ${cargoEtiqueta} en ${fila.red_nombre}`,
        html: armarHtml(fila.persona_nombre, cargoEtiqueta, fila.red_nombre, fila.iglesia_nombre),
      });
    } catch (e) {
      console.error("notificar-asignacion-cargo: fallo el envio por Brevo SMTP", e);
      return Response.json({ error: "No se pudo enviar el correo" }, { status: 500 });
    }

    return Response.json({ ok: true, enviado: true });
  }),
};
