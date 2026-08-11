import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

// REQ-ASG-7 (pedido del owner, 2026-08-06): al designar Lider/Supervisor
// de Red, el sistema nunca avisaba por correo a la persona designada.
// Mismo patron SMTP de solicitar-otp, pero la identidad de remitente/firma
// es dinamica por iglesia (REQ-IG-5: nunca "VisionHub" como sustituto del
// nombre de la iglesia) -- por eso no se reutiliza la constante fija de ahi.
//
// KAN-117: la version original solo cubria Red. El mismo hueco (asignar a
// una persona ya registrada nunca avisaba por correo) existia igual para
// Lider/Sublider de Casa de Paz y para Pastor/Supervisor de la Vision en
// Accion -- se agrega soporte a los 3 sin tocar el contrato ya usado por
// PanelRedEstructura.tsx (sigue mandando { redId, personaId, cargo }).
const ETIQUETA_CARGO: Record<string, string> = {
  LIDER_RED: "Líder de Red",
  SUBLIDER_RED: "Supervisor de Red",
  LIDER_CDP: "Líder de Casa de Paz",
  SUBLIDER_CDP: "Sublíder de Casa de Paz",
  PASTOR: "Pastor",
  SUPERVISOR: "Supervisor de la Visión en Acción",
};

function armarHtml(personaNombre: string, cargoEtiqueta: string, contexto: string | null, iglesiaNombre: string): string {
  const linea = contexto
    ? `Hola ${personaNombre}, se le asignó el cargo de <strong>${cargoEtiqueta}</strong> en ${contexto}.`
    : `Hola ${personaNombre}, se le asignó el cargo de <strong>${cargoEtiqueta}</strong> en ${iglesiaNombre}.`;
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
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">Nueva designación</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                ${linea}
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
    let body: { redId?: string; cdpId?: string; iglesiaId?: string; personaId?: string; cargo?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const cargoEtiqueta = body.cargo ? ETIQUETA_CARGO[body.cargo] : undefined;
    const entidades = [body.redId, body.cdpId, body.iglesiaId].filter(Boolean);
    if (entidades.length !== 1 || !body.personaId || !cargoEtiqueta) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    // El mismo chequeo de permiso que usa la asignacion (private.fn_estructura_puede_administrar)
    // vive dentro de cada RPC -- si quien llama no administra esa red/CdP/iglesia, tira SIN_PERMISO.
    let persona_nombre: string, correo: string | null, contexto: string | null, contextoSubject: string, iglesia_nombre: string;
    if (body.redId) {
      const { data: filas, error: errorDatos } = await ctx.supabase.rpc("fn_estructura_datos_notificacion_cargo_red", {
        p_red_id: body.redId,
        p_persona_id: body.personaId,
      });
      if (errorDatos) return Response.json({ error: "No tenes permiso, o la persona/red no existe" }, { status: 403 });
      const fila = filas?.[0] as { persona_nombre: string; correo: string | null; red_nombre: string; iglesia_nombre: string } | undefined;
      if (!fila) return Response.json({ error: "No se encontro la persona en esa red" }, { status: 404 });
      ({ persona_nombre, correo, iglesia_nombre } = fila);
      contexto = `la red <strong>${fila.red_nombre}</strong>`;
      contextoSubject = ` en ${fila.red_nombre}`;
    } else if (body.cdpId) {
      const { data: filas, error: errorDatos } = await ctx.supabase.rpc("fn_estructura_datos_notificacion_cargo_cdp", {
        p_cdp_id: body.cdpId,
        p_persona_id: body.personaId,
      });
      if (errorDatos) return Response.json({ error: "No tenes permiso, o la persona/CdP no existe" }, { status: 403 });
      const fila = filas?.[0] as { persona_nombre: string; correo: string | null; cdp_nombre: string; iglesia_nombre: string } | undefined;
      if (!fila) return Response.json({ error: "No se encontro la persona en esa Casa de Paz" }, { status: 404 });
      ({ persona_nombre, correo, iglesia_nombre } = fila);
      contexto = `la Casa de Paz <strong>${fila.cdp_nombre}</strong>`;
      contextoSubject = ` en ${fila.cdp_nombre}`;
    } else {
      const { data: filas, error: errorDatos } = await ctx.supabase.rpc("fn_estructura_datos_notificacion_cargo_principal", {
        p_iglesia_id: body.iglesiaId,
        p_persona_id: body.personaId,
      });
      if (errorDatos) return Response.json({ error: "No tenes permiso, o la persona/iglesia no existe" }, { status: 403 });
      const fila = filas?.[0] as { persona_nombre: string; correo: string | null; iglesia_nombre: string } | undefined;
      if (!fila) return Response.json({ error: "No se encontro la persona en esa iglesia" }, { status: 404 });
      ({ persona_nombre, correo, iglesia_nombre } = fila);
      contexto = null;
      contextoSubject = ` en ${iglesia_nombre}`;
    }

    if (!correo) {
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
        from: `"${iglesia_nombre}" <acceso@somoscdv.com>`,
        to: correo,
        subject: `Fuiste designado como ${cargoEtiqueta}${contextoSubject}`,
        html: armarHtml(persona_nombre, cargoEtiqueta, contexto, iglesia_nombre),
      });
    } catch (e) {
      console.error("notificar-asignacion-cargo: fallo el envio por Brevo SMTP", e);
      return Response.json({ error: "No se pudo enviar el correo" }, { status: 500 });
    }

    return Response.json({ ok: true, enviado: true });
  }),
};
