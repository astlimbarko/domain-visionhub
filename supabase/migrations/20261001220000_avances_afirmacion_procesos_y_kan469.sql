-- Avances (KAN-388) de la integración 2026-10-01: Bautismo, RSIL y Membresía
-- desde 0 (procesos de Afirmación) + corrección del cierre del anuncio (KAN-469).
-- Se agregan junto con el merge para no publicar funcionalidad visible sin su
-- entrada en /avances (ancla obligatoria). NO se aplican ahora a mano: se
-- aplican con las features en el próximo deploy (deploy en pausa), así no
-- aparecen antes de que la funcionalidad esté viva.

INSERT INTO avance (tipo, area, titulo, descripcion, alcance_codigo, fecha_publicacion) VALUES
(
  'TERMINADO', 'Afirmación',
  'Nueva pantalla para registrar bautismos',
  'En el menú de Afirmación entrá a "Bautismo". Buscá a la persona por su nombre (o agregala si todavía no está en el sistema) y registrá la fecha de su bautismo. Podés registrar más de una fecha; en la pestaña "Datos" ves todos los bautismos cargados. También está disponible desde el portal de Colaborar con un código.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Nueva pantalla para registrar el Retiro de Sanidad Interior (RSIL)',
  'En el menú de Afirmación entrá a "RSIL". Funciona igual que Altar y Bautismo: buscás a la persona (o la agregás) y registrás la fecha en que hizo el retiro. En la pestaña "Datos" ves el historial. También está disponible desde el portal de Colaborar.',
  'AFIRMACION', now()
),
(
  'TERMINADO', 'Afirmación',
  'Nuevo formulario de Membresía desde 0 (para gente nueva)',
  'En el menú de Afirmación entrá a "Membresía (Nuevos)". Es un formulario liviano, en una sola pantalla, para registrar a alguien recién captado: datos básicos, dirección, cómo llegó, si está en algún discipulado y su Casa de Paz (por quién lo invitó, eligiéndola de un buscador por Red —incluye iglesias satélite— o dejándola para asignar después). Se autoguarda mientras cargás y recién al tocar "Guardar membresía" pasa a la ficha real. Es distinto de "Membresía (Miembros)", que es el censo de los que ya son miembros.',
  'AFIRMACION', now()
),
(
  'CORRECCION', 'Anuncios',
  'El anuncio de inicio de sesión se cierra al instante',
  'Antes, al cerrar el anuncio que aparece al entrar a la aplicación, había una pequeña demora. Ahora se cierra (o pasa al siguiente anuncio) de inmediato al tocar la X, Escape o haciendo clic afuera.',
  'GLOBAL', now()
);
