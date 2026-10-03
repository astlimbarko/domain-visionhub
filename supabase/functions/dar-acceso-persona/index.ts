import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// KAN (2026-10-03): "Dar acceso" a una persona que YA existe en el sistema pero
// no tiene cuenta (ej. sublíder/líder asignado como "persona existente"). Crea
// la cuenta auth con una contraseña directa (por defecto 12345678, el usuario
// la cambia al entrar -- debe_cambiar_contrasena) SIN mandar correo, y la
// vincula a la persona existente POR persona_id (fn_dar_acceso_persona) -- sin
// crear una persona/invitación nueva (evita el duplicado que generaba el flujo
// de invitación por correo). Mismo criterio de seguridad que invitar-lider con
// contraseña directa (KAN-376) y establecer-contrasena-temporal (KAN-278).
//
// Body: { personaId: string, correo: string, contrasena?: string }
// Si la cuenta de ese correo ya existe (huérfana, de un alta a medias), se
// reutiliza y se le asigna la contraseña, en vez de fallar por email_exists.

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    let body: { personaId?: string; correo?: string; contrasena?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const personaId = body.personaId?.trim();
    const correo = body.correo?.trim().toLowerCase();
    const contrasena = (body.contrasena?.trim() || "12345678");

    if (!personaId) return Response.json({ error: "Falta personaId" }, { status: 400 });
    if (!correo) return Response.json({ error: "Falta el correo para crear la cuenta" }, { status: 400 });
    if (contrasena.length < 8) return Response.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });

    // 1) Crear la cuenta ya confirmada con la contraseña (sin correo de invitación).
    //    invitado_por_admin=true para pasar el hook que restringe altas no-Google
    //    (mismo que usa invitar-lider). debe_cambiar_contrasena en app_metadata.
    let usuarioId: string | null = null;
    const { data: creada, error: errorCrear } = await ctx.supabaseAdmin.auth.admin.createUser({
      email: correo,
      password: contrasena,
      email_confirm: true,
      user_metadata: { invitado_por_admin: true },
      app_metadata: { debe_cambiar_contrasena: true },
    });

    if (errorCrear) {
      // La cuenta ya existe (huérfana o de otra alta): reutilizarla y asignarle
      // la contraseña, en vez de fallar. Si ya está vinculada a otra persona,
      // fn_dar_acceso_persona lo rechazará más abajo (CUENTA_YA_VINCULADA).
      // deno-lint-ignore no-explicit-any
      const status = (errorCrear as any).status;
      // deno-lint-ignore no-explicit-any
      const code = (errorCrear as any).code;
      if (status === 409 || code === "email_exists") {
        const { data: existenteId } = await ctx.supabase.rpc("fn_usuario_huerfano_por_correo", { p_correo: correo });
        // fn_usuario_huerfano_por_correo devuelve el id si la cuenta existe sin
        // persona vinculada; si devuelve null, la cuenta ya tiene persona.
        if (!existenteId) {
          const { data: filas } = await ctx.supabase.rpc("fn_persona_por_correo_cuenta", { p_correo: correo });
          const persona = (filas as { id: string; nombre: string }[] | null)?.[0];
          return Response.json(
            {
              error: persona
                ? `Ese correo ya tiene una cuenta, asociada a ${persona.nombre?.trim() || correo}.`
                : "Ese correo ya tiene una cuenta en el sistema.",
            },
            { status: 409 },
          );
        }
        const { error: errorPass } = await ctx.supabaseAdmin.auth.admin.updateUserById(existenteId as string, {
          password: contrasena,
          email_confirm: true,
          ban_duration: "none",
          app_metadata: { debe_cambiar_contrasena: true },
        });
        if (errorPass) return Response.json({ error: errorPass.message }, { status: 500 });
        usuarioId = existenteId as string;
      } else {
        return Response.json({ error: errorCrear.message }, { status: 500 });
      }
    } else {
      usuarioId = creada.user.id;
    }

    // 2) Vincular la cuenta a la persona existente + asegurar sus roles.
    const { error: errorVincular } = await ctx.supabase.rpc("fn_dar_acceso_persona", {
      p_persona_id: personaId,
      p_usuario_id: usuarioId,
    });
    if (errorVincular) {
      return Response.json({ error: errorVincular.message }, { status: 400 });
    }

    return Response.json({ usuarioId, correo, vinculada: true });
  }),
};
