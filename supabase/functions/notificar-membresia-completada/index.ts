import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

// Pedido explicito del owner (2026-08-21): al completar el formulario de
// membresia (los 3 caminos -- registro publico por URL, registro interno de
// Afirmacion, MembresiaObligatoria), el sistema debe avisar por correo al
// que se escribio, dirigido al nombre de la persona.
//
// Callable SIN sesion a proposito -- el registro publico por URL es
// anonimo, asi que no puede llamar una funcion que exija auth:"user" (mismo
// patron que el resto de las funciones de este proyecto). Por eso NUNCA
// confia en nombre/correo que le pase el cliente, solo en el `personaId`.
//
// fn_notificar_membresia_datos (SECURITY DEFINER, GRANT a anon) hace la
// lectura + marca "enviado" de forma atomica -- se probo en vivo que el
// service role NO se salta RLS en este proyecto ("permission denied for
// table persona"), asi que esta funcion usa el mismo patron de seguridad
// que ya usa todo el registro anonimo (funcion angosta + clave anon
// normal), en vez de depender del service role.
function armarHtml(personaNombre: string, iglesiaNombre: string): string {
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
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">¡Bienvenido/a!</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                Hola ${personaNombre}, tu ficha de membresía en <strong>${iglesiaNombre}</strong> quedó registrada correctamente. ¡Nos alegra tenerte con nosotros!
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
                Si no reconocés este registro, comunicate con quien administra el sistema en tu iglesia.
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

// Sin withSupabase (necesita ser callable sin sesion) no hay manejo de CORS
// automatico -- lo agregamos a mano. supabase-js manda un preflight OPTIONS
// antes del POST real desde el navegador.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonConCors(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
      return jsonConCors({ error: "Método no permitido" }, 405);
    }

    let body: { personaId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonConCors({ error: "Cuerpo inválido" }, 400);
    }
    if (!body.personaId) {
      return jsonConCors({ error: "Falta personaId" }, 400);
    }

    const cliente = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { data: datos, error: errorDatos } = await cliente.rpc("fn_notificar_membresia_datos", {
      p_persona_id: body.personaId,
    });

    if (errorDatos) {
      console.error("notificar-membresia-completada: fallo fn_notificar_membresia_datos", errorDatos);
      return jsonConCors({ ok: false, enviado: false, motivo: "error consultando la persona" });
    }
    if (!datos) {
      // No existe, no tiene correo, o ya se le habia enviado -- la funcion
      // de la base ya cubrio los 3 casos de forma atomica.
      return jsonConCors({ ok: true, enviado: false, motivo: "no aplica" });
    }

    const { correo, nombre_completo: personaNombre, iglesia_nombre: iglesiaNombreRaw } = datos as {
      correo: string;
      nombre_completo: string;
      iglesia_nombre: string | null;
    };
    const iglesiaNombre = iglesiaNombreRaw ?? "tu iglesia";

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
        from: `"${iglesiaNombre}" <acceso@somoscdv.com>`,
        to: correo,
        subject: `Tu membresía en ${iglesiaNombre} fue registrada`,
        html: armarHtml(personaNombre, iglesiaNombre),
      });
    } catch (e) {
      // El flag ya quedo en `true` (UPDATE atomico de fn_notificar_membresia_datos)
      // -- si Brevo falla aca, no se reintenta solo. Aceptable: es un correo
      // de cortesia, no bloquea el alta ya hecha; se ve en los logs.
      console.error("notificar-membresia-completada: fallo el envio por Brevo SMTP", e);
      return jsonConCors({ error: "No se pudo enviar el correo" }, 500);
    }

    return jsonConCors({ ok: true, enviado: true });
  },
};
