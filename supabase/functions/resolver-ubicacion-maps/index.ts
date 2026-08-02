import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

// Casas de Paz: pedido del owner (2026-08-02), corrige que el mapa de la CdP
// mostraba una ubicacion basada en el texto de calle/zona en vez del link de
// Google Maps pegado. La mayoria de esos links son short links
// (maps.app.goo.gl, generados por el boton "Compartir" de la app de Maps) que
// no traen coordenadas visibles -- Google las resuelve recien al seguir la
// redireccion. Un fetch desde el navegador no puede leer esa redireccion por
// CORS; esta funcion la sigue del lado del servidor y devuelve las
// coordenadas ya resueltas.
//
// No hace falta auth mas estricta que "cualquier usuario logueado" -- no
// expone ni escribe nada de la base, solo sigue una redireccion HTTP publica.

function extraerCoordenadas(url: string): { lat: number; lng: number } | null {
  // Prioridad al pin exacto (!3d{lat}!4d{lng}), que es mas preciso que el
  // centro del viewport que aparece en @lat,lng.
  const porPin = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (porPin) return { lat: Number(porPin[1]), lng: Number(porPin[2]) };

  const porArroba = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (porArroba) return { lat: Number(porArroba[1]), lng: Number(porArroba[2]) };

  // Un pin suelto sin nombre de lugar (lo mas comun al compartir "mi casa"
  // desde la app) resuelve a /maps/search/-17.35,+-63.25 -- el "+" es un
  // espacio codificado entre la coma y el signo del segundo numero, no un
  // separador real. Confirmado con un link real del owner (2026-08-02).
  const porBusqueda = url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (porBusqueda) return { lat: Number(porBusqueda[1]), lng: Number(porBusqueda[2]) };

  const porQuery = url.match(/[?&](?:q|query|ll)=(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (porQuery) return { lat: Number(porQuery[1]), lng: Number(porQuery[2]) };

  return null;
}

export default {
  fetch: withSupabase({ auth: "user" }, async (req) => {
    let body: { url?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Cuerpo invalido" }, { status: 400 });
    }

    const url = body.url?.trim();
    if (!url || !/^https:\/\/[\w.-]*google\.[\w.]+\/maps|^https:\/\/maps\.app\.goo\.gl\//.test(url)) {
      return Response.json({ error: "No es un link de Google Maps" }, { status: 400 });
    }

    // Solo interesa la URL final tras la redireccion, no el cuerpo.
    let respuesta: Response;
    try {
      respuesta = await fetch(url, { method: "GET", redirect: "follow" });
    } catch (e) {
      console.error("resolver-ubicacion-maps: fallo el fetch", e);
      return Response.json({ error: "No se pudo abrir el enlace" }, { status: 502 });
    }

    const coords = extraerCoordenadas(respuesta.url);
    if (!coords) {
      return Response.json({ error: "El enlace no tiene coordenadas reconocibles" }, { status: 422 });
    }

    return Response.json(coords);
  }),
};
