import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// VisionHub -- KAN-278: apaga app_metadata.debe_cambiar_contrasena de la
// PROPIA cuenta que llama (el id sale del JWT de la sesión, nunca del body)
// justo después de que la persona haya puesto su contraseña real vía el
// mecanismo de siempre (supabase.auth.updateUser en el cliente). Aparte
// porque app_metadata solo lo puede escribir el service role, nunca el
// propio usuario con updateUser -- si no, cualquiera podría sacarse el flag
// sin cambiar nada de verdad.
export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const { data: actual, error: errorUser } = await ctx.supabase.auth.getUser();
    if (errorUser || !actual?.user) {
      return Response.json({ error: "Sesion invalida" }, { status: 401 });
    }
    const { error } = await ctx.supabaseAdmin.auth.admin.updateUserById(actual.user.id, {
      app_metadata: { ...actual.user.app_metadata, debe_cambiar_contrasena: false },
    });
    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  }),
};
