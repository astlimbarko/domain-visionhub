-- VisionHub -- 68_otp_verificar_cualquier_vigente.sql
-- Bug real reportado 2026-08-01: fn_verificar_otp solo comparaba contra el
-- codigo MAS RECIENTE pedido (ORDER BY fecha_creacion DESC LIMIT 1). Si el
-- usuario pedia mas de un codigo (ej. tocar "Enviar codigo" de nuevo cuando
-- el boton se reactiva, antes de que llegara el primer correo -- el correo
-- de Brevo puede tardar, ver 66_/67_), el codigo anterior quedaba
-- "superado" por el nuevo aunque su propio vencimiento de 10 minutos
-- todavia no habia llegado -- se rechazaba como si hubiera expirado, pero
-- en realidad ya no era "el ultimo". Esto explica el reporte de "parece
-- caducar en segundos": no es un problema de vencimiento, es que cualquier
-- pedido nuevo invalidaba de hecho al anterior.
--
-- Fix: revisa TODOS los codigos vigentes (sin usar, sin vencer) del
-- usuario, no solo el ultimo -- el primero que hashee igual se marca usado.

CREATE OR REPLACE FUNCTION fn_verificar_otp(p_codigo TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE
  v_fila usuario_otp%ROWTYPE;
BEGIN
  FOR v_fila IN
    SELECT * FROM usuario_otp
    WHERE usuario_id = auth.uid() AND usado_en IS NULL AND expira_en > now()
    ORDER BY fecha_creacion DESC
  LOOP
    IF crypt(COALESCE(p_codigo, ''), v_fila.codigo_hash) = v_fila.codigo_hash THEN
      UPDATE usuario_otp SET usado_en = now() WHERE id = v_fila.id;
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;
