import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

// 15-gestion-administrativa, Panel 1. Reemplaza el PIN estatico de Super
// Admin por un codigo de un solo uso enviado al correo de quien esta
// haciendo la accion. fn_generar_otp (58_otp_verificacion.sql) genera y
// guarda el hash; esta funcion es la unica que ve el codigo en texto plano,
// y solo para mandarlo por correo -- nunca se devuelve en la respuesta HTTP.
//
// No es un correo de Supabase Auth (no hay flujo de login/recovery de por
// medio), asi que se arma y se envia a mano por el mismo SMTP de Brevo ya
// configurado. Identidad de correspondencia: "Centro de Vida 4 Anillo",
// nunca "VisionHub" (harness/EMAILS-AUTH.md).
const REMITENTE = '"Centro de Vida 4 Anillo" <acceso@somoscdv.com>';

function armarHtml(codigo: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:36px 32px;">
            <tr><td style="text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.04em;color:#6b7280;text-transform:uppercase;">Centro de Vida 4 Anillo</p>
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">Código de confirmación</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                Use este código para confirmar la acción que está realizando en el sistema. Es válido por 10 minutos y solo se puede usar una vez.
              </p>
              <p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:.15em;color:#2f56e6;">${codigo}</p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                Si usted no solicitó este código, ignore este correo -- nadie podrá usarlo sin acceso a su cuenta.
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
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const { data: userData, error: errorUser } = await ctx.supabase.auth.getUser();
    if (errorUser || !userData?.user?.email) {
      return Response.json({ error: "No se pudo identificar al usuario" }, { status: 401 });
    }

    const { data: filas, error: errorGenerar } = await ctx.supabase.rpc("fn_generar_otp");
    if (errorGenerar) {
      const esRateLimit = errorGenerar.message?.includes("OTP_MUY_SEGUIDO");
      return Response.json({ error: errorGenerar.message }, { status: esRateLimit ? 429 : 500 });
    }
    const { codigo, expira_en: expiraEn } = (filas as { codigo: string; expira_en: string }[])[0];

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
        from: REMITENTE,
        to: userData.user.email,
        subject: "Su código de confirmación",
        html: armarHtml(codigo),
      });
    } catch (_e) {
      return Response.json({ error: "No se pudo enviar el correo" }, { status: 500 });
    }

    return Response.json({ ok: true, expiraEn });
  }),
};
