import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ROLES_VALIDOS = ["LIDER_RED", "SUPERVISOR_RED", "LIDER_CDP", "SUBLIDER_CDP"];

// Pedido del owner (2026-08-07): el correo de invitacion de Supabase Auth
// ("Aceptar invitacion") no decia para que rol/iglesia fue invitada la
// persona (proyecto multi-tenant, GoTrue no sabe de "iglesias"). En vez de
// mandar un segundo correo aparte, se le pasan variables custom a
// inviteUserByEmail (disponibles en la plantilla como {{ .Data.algo }} --
// ver supabase/templates/invite.html) para que el UNICO correo real ya
// las incluya. Todas opcionales: si no se puede resolver el nombre de la
// entidad/iglesia (permiso, dato faltante), la invitacion sigue igual, solo
// sin esas variables (la plantilla tiene su propio fallback generico).
const ETIQUETA_CARGO_INVITACION: Record<string, string> = {
  LIDER_RED: "Líder de Red",
  SUPERVISOR_RED: "Supervisor de Red",
  LIDER_CDP: "Líder de Casa de Paz",
  SUBLIDER_CDP: "Sublíder de Casa de Paz",
};

async function datosInvitacionParaCorreo(
  ctx: { supabase: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }> } },
  rol: string | null,
  redId: string | null,
  casaDePazId: string | null,
  departamentoId: string | null,
): Promise<Record<string, string>> {
  try {
    const { data: filas } = await ctx.supabase.rpc("fn_estructura_datos_invitacion", {
      p_red_id: redId,
      p_casa_de_paz_id: casaDePazId,
      p_departamento_id: departamentoId,
    });
    const datos = (filas as { entidad_nombre: string; iglesia_nombre: string }[] | null)?.[0];
    if (!datos) return {};
    const cargoEtiqueta = rol ? ETIQUETA_CARGO_INVITACION[rol] : undefined;
    return {
      iglesia_nombre: datos.iglesia_nombre,
      entidad_nombre: datos.entidad_nombre,
      rol_etiqueta: cargoEtiqueta ?? `Líder de ${datos.entidad_nombre}`,
    };
  } catch {
    return {};
  }
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
      accion?: "invitar" | "reenviar" | "cancelar" | "corregir" | "descartar_huerfana";
      correo?: string;
      rol?: string;
      redId?: string | null;
      casaDePazId?: string | null;
      departamentoId?: string | null;
      invitacionId?: string;
      redirectTo?: string;
      pin?: string;
      // KAN-424: id de la cuenta huérfana a descartar (accion "descartar_huerfana").
      usuarioId?: string;
      // KAN-424: código de confirmación (mismo patrón que fn_exigir_pin usa
      // para el resto de acciones sensibles de Super Admin).
      pinDescarte?: string;
      // KAN-376 seguimiento (2026-09-13, pedido explicito del owner): en vez
      // de mandar el correo de invitacion (persona sin tecnologia a mano, o
      // no confia en el correo), permite crear la cuenta ya con esta
      // contrasena y el correo confirmado -- se la dice el admin de palabra,
      // igual que ya hace establecer-contrasena-temporal (KAN-278).
      contrasena?: string;
      // KAN-376 seguimiento (2026-09-14, pedido explicito del owner): junto
      // con la contrasena directa, tambien crea la Persona y el cargo real
      // de una sola vez (fn_alta_directa_lider_cdp) -- sin esto, la cuenta
      // quedaba en un estado intermedio raro (contrasena + invitacion
      // PENDIENTE, sin rol real hasta que alguien completara el wizard).
      // Acotado a Lider/Sublider de CdP -- ver fn_alta_directa_lider_cdp.
      datosPersona?: {
        primerNombre?: string;
        segundoNombre?: string;
        primerApellido?: string;
        segundoApellido?: string;
        sexo?: string;
      };
    };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    // KAN-424 (2026-09-23, pedido explicito del owner): panel de Super Admin
    // para descartar una cuenta huerfana que no se va a usar mas -- se banea
    // en forma definitiva (no se puede borrar fisicamente si alguna vez
    // quedo referenciada por un usuario_rol/invitacion_lider soft-eliminado,
    // por la FK) para que deje de aparecer en el listado y nadie la vuelva a
    // topar por accidente.
    if (body.accion === "descartar_huerfana") {
      if (!body.usuarioId) {
        return Response.json({ error: "Falta el usuarioId" }, { status: 400 });
      }
      const { data: esSuperAdmin, error: errorSuperAdmin } = await ctx.supabase.rpc("fn_es_super_admin");
      if (errorSuperAdmin || !esSuperAdmin) {
        return Response.json({ error: "Solo un Super Admin puede descartar cuentas huérfanas" }, { status: 403 });
      }
      const { error: errorPin } = await ctx.supabase.rpc("fn_exigir_pin", { p_pin: body.pinDescarte ?? null });
      if (errorPin) {
        return Response.json({ error: "El código de confirmación es incorrecto, expiró, o no fue solicitado" }, { status: 403 });
      }
      const { error: errorDescartar } = await ctx.supabaseAdmin.auth.admin.updateUserById(body.usuarioId, {
        ban_duration: "876000h",
      });
      if (errorDescartar) {
        return Response.json({ error: errorDescartar.message }, { status: 500 });
      }
      return Response.json({ ok: true });
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
      const { data: filaInvitacion } = await ctx.supabase
        .from("invitacion_lider")
        .select("rol, red_id, casa_de_paz_id, departamento_id")
        .eq("id", body.invitacionId)
        .single();
      const dataCorreo = filaInvitacion
        ? await datosInvitacionParaCorreo(ctx, filaInvitacion.rol, filaInvitacion.red_id, filaInvitacion.casa_de_paz_id, filaInvitacion.departamento_id)
        : {};
      const { error } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
        redirectTo: body.redirectTo,
        // KAN-201: marca que el hook_restringir_alta_no_google (Before User
        // Created) usa para distinguir esta alta de un registro publico.
        data: { ...dataCorreo, invitado_por_admin: true },
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
      // KAN-16x: antes llamaba a fn_verificar_otp (generica, exige codigo
      // siempre) -- ahora respeta estructura_organigrama.otp_requerido de
      // la iglesia, igual que ya hace fn_estructura_validar_otp_red arriba.
      const { data: otpOk, error: errorOtp } = await ctx.supabase.rpc("fn_estructura_validar_otp_departamento", {
        p_departamento_id: departamentoId,
        p_codigo: body.pin ?? null,
      });
      if (errorOtp || !otpOk) {
        return Response.json({ error: "El código de confirmación es incorrecto, expiró, o no fue solicitado" }, { status: 403 });
      }
    }

    const contrasenaDirecta = body.contrasena?.trim();
    if (contrasenaDirecta && contrasenaDirecta.length < 8) {
      return Response.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }

    // KAN-376 seguimiento (2026-09-14, pedido explicito): nombre/apellido/
    // sexo son OPCIONALES con contrasena directa -- si no vienen, la cuenta
    // se crea solo con contrasena (sigue el flujo de siempre, la persona
    // completa su propio nombre/apellido/sexo en el wizard de membresia al
    // entrar por primera vez). Si vienen, se exigen los 3 juntos (no tiene
    // sentido un estado a medias) y se crea la Persona/cargo real de una
    // sola vez -- acotado a Lider/Sublider de CdP, mismo alcance que
    // permiteContrasenaDirecta en el frontend.
    let datosPersonaValidados:
      | { primerNombre: string; segundoNombre?: string; primerApellido: string; segundoApellido?: string; sexo: string }
      | null = null;
    if (contrasenaDirecta && body.datosPersona) {
      const dp = body.datosPersona;
      const primerNombre = dp.primerNombre?.trim();
      const primerApellido = dp.primerApellido?.trim();
      const sexo = dp.sexo?.trim();
      const algunoCompletado = primerNombre || primerApellido || sexo;
      if (algunoCompletado) {
        if (!primerNombre || !primerApellido || !sexo) {
          return Response.json({ error: "Si completás nombre/apellido/sexo, se necesitan los 3 juntos (o dejalos todos vacíos)" }, { status: 400 });
        }
        if (rol !== "LIDER_CDP" && rol !== "SUBLIDER_CDP") {
          return Response.json({ error: "Contraseña directa solo está disponible para Líder/Sublíder de Casa de Paz por ahora" }, { status: 400 });
        }
        datosPersonaValidados = {
          primerNombre,
          segundoNombre: dp.segundoNombre?.trim() || undefined,
          primerApellido,
          segundoApellido: dp.segundoApellido?.trim() || undefined,
          sexo,
        };
      }
    }

    const dataCorreo = await datosInvitacionParaCorreo(ctx, rol, redId, casaDePazId, departamentoId);
    // KAN-376 seguimiento: con contrasena directa, se crea la cuenta YA
    // confirmada y con esa contrasena -- no se manda ningun correo (createUser,
    // no inviteUserByEmail). Sin ella, sigue el flujo de siempre.
    const { data, error } = contrasenaDirecta
      ? await ctx.supabaseAdmin.auth.admin.createUser({
          email: correo,
          password: contrasenaDirecta,
          email_confirm: true,
          // KAN-201: hook_restringir_alta_no_google (Before User Created) lee
          // invitado_por_admin de user_metadata, no de app_metadata -- mismo
          // campo que ya usa inviteUserByEmail vía `data`, ver
          // 20260815010000_fix_hook_invitacion_admin_bloqueada.sql:39.
          user_metadata: { ...dataCorreo, invitado_por_admin: true },
          // debe_cambiar_contrasena sí va en app_metadata -- mismo campo que
          // ya lee auth.service.ts (KAN-278, establecer-contrasena-temporal).
          app_metadata: { debe_cambiar_contrasena: true },
        })
      : await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(correo, {
          redirectTo: body.redirectTo,
          data: { ...dataCorreo, invitado_por_admin: true },
        });

    let usuarioId: string;
    let usuarioCorreo: string;
    // KAN-425 (2026-09-23, pedido explicito del owner): si el correo ya
    // tenia cuenta pero SIN Persona vinculada (huerfana -- quedo a medias
    // de un alta anterior, o su invitacion se cancelo despues de que
    // confirmo), antes esto era un callejon sin salida ("avisale al equipo
    // tecnico"). Ahora se recupera sola: se reusa el usuario_id existente
    // (no se puede crear una cuenta duplicada para el mismo correo) y se le
    // arma una invitacion pendiente nueva, igual que si fuera un alta
    // recien creada. Caso real que lo disparo: juannylp@gmail.com.
    let cuentaHuerfanaReparada = false;

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
        //
        // KAN-24x (2026-08-22): antes, para Departamento y Casa de Paz, esto
        // asignaba directo sin preguntar (silencioso) -- inconsistente con
        // Red, que siempre pregunta antes de asignar. Se unifica: los tres
        // caminos devuelven el mismo 409 con personaId/personaNombre, y es
        // el frontend el que pide confirmacion explicita antes de asignar
        // (mismo patron ya probado en Red desde 2026-08-13).
        const { data: filas } = await ctx.supabase.rpc("fn_persona_por_correo_cuenta", { p_correo: correo });
        const persona = filas?.[0] as { id: string; nombre: string } | undefined;

        if (persona) {
          return Response.json(
            {
              // persona.nombre puede venir vacio ("") si esa Persona
              // todavia no completo el formulario de Membresia (KAN-179,
              // guardado progresivo) -- antes eso dejaba el mensaje como
              // "asociada a ." (bug real 2026-08-11).
              error: `Ya existe una cuenta con ese correo, asociada a ${persona.nombre?.trim() || correo}.`,
              personaId: persona.id,
              personaNombre: persona.nombre,
            },
            { status: 409 }
          );
        }

        const { data: usuarioHuerfanoId } = await ctx.supabase.rpc("fn_usuario_huerfano_por_correo", { p_correo: correo });
        if (!usuarioHuerfanoId) {
          // No deberia pasar (el 409 fue justo porque el correo existe),
          // pero queda el mensaje anterior como red de seguridad.
          return Response.json(
            {
              error: "Ya existe una cuenta con ese correo, pero sin una Persona vinculada en el sistema (quedo a medias de un alta anterior). No se le puede asignar un cargo hasta que un Super Admin la vincule manualmente -- avisale al equipo tecnico.",
            },
            { status: 409 }
          );
        }

        if (contrasenaDirecta) {
          // El admin ya eligio "contrasena directa" -- se la asignamos a la
          // cuenta existente en vez de mandar ningun correo (mismo criterio
          // que establecer-contrasena-temporal, KAN-278).
          const { data: usuarioActual } = await ctx.supabaseAdmin.auth.admin.getUserById(usuarioHuerfanoId);
          const { error: errorPass } = await ctx.supabaseAdmin.auth.admin.updateUserById(usuarioHuerfanoId, {
            password: contrasenaDirecta,
            email_confirm: true,
            ban_duration: "none",
            app_metadata: { ...usuarioActual?.user?.app_metadata, debe_cambiar_contrasena: true },
          });
          if (errorPass) {
            return Response.json({ error: errorPass.message }, { status: 500 });
          }
        } else {
          // Sin contrasena directa: no se puede mandar un nuevo correo de
          // "invitacion" (Supabase Auth ya rechazo el alta duplicada), pero
          // SI se puede mandar un correo de "restablecer contrasena" --
          // llega igual, ella entra con una contrasena propia y el sistema
          // la lleva al wizard de membresia (fn_completar_membresia ya
          // encuentra la invitacion pendiente que se crea mas abajo).
          await ctx.supabaseAdmin.auth.resetPasswordForEmail(correo, { redirectTo: body.redirectTo });
        }

        usuarioId = usuarioHuerfanoId;
        usuarioCorreo = correo;
        cuentaHuerfanaReparada = true;
      } else {
        return Response.json({ error: error.message }, { status: 500 });
      }
    } else {
      usuarioId = data.user.id;
      usuarioCorreo = data.user.email!;
    }

    // KAN-376 seguimiento (2026-09-14): con datosPersonaValidados, se crea
    // la Persona y el cargo real de una sola vez (fn_alta_directa_lider_cdp)
    // -- sin invitacion PENDIENTE de por medio. Sin ellos, sigue el flujo de
    // siempre (fn_invitar_lider/fn_estructura_invitar_supervisor_red).
    const { error: errorInvitar } = datosPersonaValidados
      ? await ctx.supabase.rpc("fn_alta_directa_lider_cdp", {
          p_usuario_id: usuarioId,
          p_correo: usuarioCorreo,
          p_rol: rol,
          p_casa_de_paz_id: casaDePazId,
          p_primer_nombre: datosPersonaValidados.primerNombre,
          p_segundo_nombre: datosPersonaValidados.segundoNombre ?? null,
          p_primer_apellido: datosPersonaValidados.primerApellido,
          p_segundo_apellido: datosPersonaValidados.segundoApellido ?? null,
          p_sexo: datosPersonaValidados.sexo,
        })
      : rol === "SUPERVISOR_RED"
        ? await ctx.supabase.rpc("fn_estructura_invitar_supervisor_red", {
            p_usuario_id: usuarioId,
            p_correo: usuarioCorreo,
            p_red_id: redId,
          })
        : await ctx.supabase.rpc("fn_invitar_lider", {
            p_usuario_id: usuarioId,
            p_correo: usuarioCorreo,
            p_rol: rol,
            p_red_id: redId,
            p_casa_de_paz_id: casaDePazId,
            p_departamento_id: departamentoId,
          });
    if (errorInvitar) {
      return Response.json({ error: errorInvitar.message }, { status: 500 });
    }

    return Response.json({ id: usuarioId, correo: usuarioCorreo, cuentaHuerfanaReparada });
  }),
};
