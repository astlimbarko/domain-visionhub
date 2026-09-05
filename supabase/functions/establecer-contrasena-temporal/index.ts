import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import nodemailer from "nodemailer";

// VisionHub -- KAN-278: asignarle una contraseña temporal a una cuenta YA
// CONFIRMADA, sin pasar por ningún enlace de un solo uso. Pensado para
// personas a las que "les cuesta la tecnología" (caso real que lo disparó:
// mariajulietavm2020@gmail.com -- su enlace de "olvidé mi contraseña" daba
// "no es válido o ya venció" sin haber pasado ni un día útil; el sospechoso
// real es un escáner de seguridad del propio correo -- Gmail/iPhone suelen
// "previsitar" los links apenas llegan -- que gasta el token de un solo uso
// antes de que la persona lo toque de verdad. Evitar esto de raíz: contraseña
// puesta directo por un admin, dicha de palabra, nunca por escrito).
//
// Reusa las mismas 4 RPC de solo lectura que reenviar-invitacion-cargo (mismo
// chequeo de permiso ya probado: Líder/Supervisor de Red en su propia red,
// Super Admin/Pastor/Supervisor en el resto), pero SIN el filtro de
// membresia_completada -- acá aplica a cualquier cuenta confirmada, no solo a
// quien quedó a medio formulario.
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
                Hola ${personaNombre}, te asignaron una contraseña provisoria para entrar a <strong>${iglesiaNombre}</strong>. Te la va a decir personalmente quien administra el sistema -- no llega por correo ni por mensaje.
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
      redId?: string;
      cdpId?: string;
      departamentoId?: string;
      iglesiaId?: string;
      personaId?: string;
      contrasena?: string;
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
    const contrasena = body.contrasena?.trim();
    if (!contrasena || contrasena.length < 8) {
      return Response.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    let correo: string | null, persona_nombre: string, iglesia_nombre: string, usuario_id: string | null;

    if (body.redId) {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_red", {
        p_red_id: body.redId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/red no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en esa red" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id } = fila);
    } else if (body.cdpId) {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_cdp", {
        p_cdp_id: body.cdpId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/CdP no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en esa Casa de Paz" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id } = fila);
    } else if (body.departamentoId) {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_departamento", {
        p_departamento_id: body.departamentoId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/departamento no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en ese departamento" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id } = fila);
    } else {
      const { data: filas, error } = await ctx.supabase.rpc("fn_estructura_datos_reenvio_cargo_principal", {
        p_iglesia_id: body.iglesiaId,
        p_persona_id: body.personaId,
      });
      if (error) return Response.json({ error: "No tenes permiso, o la persona/iglesia no existe" }, { status: 403 });
      const fila = filas?.[0];
      if (!fila) return Response.json({ error: "No se encontro la persona en esa iglesia" }, { status: 404 });
      ({ correo, persona_nombre, iglesia_nombre, usuario_id } = fila);
    }

    if (!usuario_id) {
      return Response.json(
        { error: "Esa persona todavía no tiene ninguna cuenta creada -- usá 'Invitar' en vez de esto" },
        { status: 409 },
      );
    }
    if (!correo) {
      return Response.json({ error: "Esa persona no tiene ningún correo conocido" }, { status: 404 });
    }

    const { data: usuarioActual, error: errorGet } = await ctx.supabaseAdmin.auth.admin.getUserById(usuario_id);
    if (errorGet || !usuarioActual?.user) {
      return Response.json({ error: "No se pudo leer la cuenta" }, { status: 500 });
    }

    const { error: errorUpdate } = await ctx.supabaseAdmin.auth.admin.updateUserById(usuario_id, {
      password: contrasena,
      app_metadata: { ...usuarioActual.user.app_metadata, debe_cambiar_contrasena: true },
    });
    if (errorUpdate) {
      return Response.json({ error: errorUpdate.message }, { status: 500 });
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
        subject: "Ya tenés acceso al sistema",
        html: armarHtmlAviso(persona_nombre?.trim() || correo, iglesia_nombre),
      });
    } catch (e) {
      // No se corta el flujo por esto -- la contraseña ya quedó asignada, el
      // admin se la va a decir de palabra de todas formas.
      console.error("establecer-contrasena-temporal: fallo el envio por Brevo SMTP", e);
    }

    return Response.json({ ok: true });
  }),
};
