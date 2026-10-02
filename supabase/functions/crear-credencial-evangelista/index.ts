import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

// VisionHub -- KAN-434: panel "Crear credencial para Evangelista" (boceto
// bocetoInvitacion.jpeg). Otorga el rol Evangelista (KAN-427,
// fn_otorgar_evangelista) a una Persona que YA EXISTE en el sistema --
// nunca crea una Persona nueva, a diferencia de invitar-lider.
//
// Dos caminos, segun si la Persona ya tiene cuenta de acceso (usuario_id):
//  - Ya tiene cuenta -> solo se otorga el rol, sin tocar auth.
//  - No tiene cuenta -> se crea una cuenta nueva con password fija
//    "12345678" (mismo patron que "contrasena directa" de
//    supabase/functions/invitar-lider/index.ts), se vincula a la Persona
//    existente, se le manda el correo de aviso, y se otorga el rol.
//
// Flujo de correo confirmado por el owner (2026-09-29): si la Persona no
// tiene correo guardado, se pide uno. Si ya tiene uno, el frontend le
// pregunta al admin si usar ese o ingresar otro -- y si elige otro, si
// eso debe reemplazar el correo de membresia o mantener ambos. Ese
// resultado llega aca ya resuelto (`correo` + `actualizarCorreoMembresia`).

function armarHtmlAviso(personaNombre: string, iglesiaNombre: string): string {
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
              <h1 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#1f2937;">Ya tenés acceso</h1>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#374151;">
                Hola ${personaNombre}, te habilitaron como Evangelista en <strong>${iglesiaNombre}</strong>. Te van a decir tu contraseña provisoria personalmente -- no llega por correo ni por mensaje.
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
                Este enlace no vence -- guardalo para cuando tengas tu contraseña.
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
      personaId?: string;
      iglesiaId?: string;
      correo?: string;
      actualizarCorreoMembresia?: boolean;
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const { personaId, iglesiaId } = body;
    if (!personaId || !iglesiaId) {
      return Response.json({ error: "Faltan datos" }, { status: 400 });
    }

    const { data: filas, error: errorDatos } = await ctx.supabase.rpc("fn_evangelista_datos_persona", {
      p_persona_id: personaId,
    });
    if (errorDatos) {
      return Response.json({ error: errorDatos.message }, { status: 403 });
    }
    const datos = filas?.[0] as
      | { nombre_completo: string; correo: string | null; usuario_id: string | null; tiene_cdp: boolean }
      | undefined;
    if (!datos) {
      return Response.json({ error: "No se encontro la persona" }, { status: 404 });
    }
    if (!datos.tiene_cdp) {
      return Response.json(
        { error: "Esta persona no pertenece a ninguna Casa de Paz todavía -- no se le puede otorgar el rol Evangelista" },
        { status: 400 },
      );
    }

    // Camino 1: ya tiene cuenta -- solo se otorga el rol, sin tocar auth.
    if (datos.usuario_id) {
      const { error: errorOtorgar } = await ctx.supabase.rpc("fn_otorgar_evangelista", {
        p_persona_id: personaId,
        p_iglesia_id: iglesiaId,
      });
      if (errorOtorgar) {
        return Response.json({ error: errorOtorgar.message }, { status: 500 });
      }
      return Response.json({ ok: true, cuentaNueva: false });
    }

    // Camino 2: no tiene cuenta -- hace falta un correo (el que ya tenia
    // en membresia, u otro elegido por el admin -- ya resuelto por el
    // frontend antes de llegar aca).
    const correo = body.correo?.trim().toLowerCase();
    if (!correo || !correo.includes("@")) {
      return Response.json({ error: "Correo invalido" }, { status: 400 });
    }
    const actualizarCorreoMembresia = Boolean(body.actualizarCorreoMembresia);

    const { data: creado, error: errorCrear } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: "12345678",
      email_confirm: true,
      user_metadata: { invitado_por_admin: true },
      app_metadata: { debe_cambiar_contrasena: true },
    });
    if (errorCrear) {
      if (errorCrear.status === 409 || errorCrear.code === "email_exists") {
        return Response.json(
          { error: "Ese correo ya tiene una cuenta en el sistema -- elegí otro correo para esta persona" },
          { status: 409 },
        );
      }
      return Response.json({ error: errorCrear.message }, { status: 500 });
    }
    const usuarioId = creado.user.id;

    const { error: errorVincular } = await ctx.supabase.rpc("fn_evangelista_vincular_usuario", {
      p_persona_id: personaId,
      p_usuario_id: usuarioId,
      p_correo: correo,
      p_actualizar_correo_membresia: actualizarCorreoMembresia,
    });
    if (errorVincular) {
      // No se puede borrar la cuenta de auth (podria quedar referenciada),
      // pero se banea para que no quede una cuenta utilizable huerfana --
      // mismo criterio que invitar-lider usa al cancelar una invitacion.
      await ctx.supabaseAdmin.auth.admin.updateUserById(usuarioId, { ban_duration: "876000h" });
      return Response.json({ error: errorVincular.message }, { status: 500 });
    }

    const { data: iglesiaFila } = await ctx.supabase.from("iglesia").select("nombre").eq("id", iglesiaId).single();
    const iglesiaNombre = iglesiaFila?.nombre ?? "VisionHub";

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
        subject: "Ya tenés acceso al sistema",
        html: armarHtmlAviso(datos.nombre_completo?.trim() || correo, iglesiaNombre),
      });
    } catch (e) {
      // No se corta el flujo por esto -- la cuenta y el rol ya quedaron
      // creados, el admin le va a decir la contraseña de palabra igual.
      console.error("crear-credencial-evangelista: fallo el envio por Brevo SMTP", e);
    }

    return Response.json({ ok: true, cuentaNueva: true, correo });
  }),
};
