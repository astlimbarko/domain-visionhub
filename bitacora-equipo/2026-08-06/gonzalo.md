# Gonzalo — 2026-08-06

- [x] Verifiqué en vivo el ítem 9 (caso "correo ya existe", KAN-61): ya estaba resuelto desde 2026-08-02, sin cambios de código. Comenté KAN-61.
- [x] KAN-78 quedó sin asignado (reporter astlimbark) porque es para que Matías lo implemente después, no trabajo de esta sesión.
- [x] Empecé a mover tickets por todo su ciclo (no solo comentar): KAN-56, KAN-57, KAN-58 y KAN-61 pasaron a Finalizada, ya verificados en vivo. Actualicé CLAUDE.md con ambas reglas.
- [x] Departamento ya no abre directo el modal de asignar: primero abre un panel lateral (`PanelDepartamentoEstructura.tsx`, mismo patrón que Red/CdP); Afirmación tiene botón Asignar/Cambiar adentro, los otros 3 muestran "Próximamente".
- [x] Probado en vivo: Afirmación abre el modal anidado correctamente; Evangelismo muestra el panel sin acción. Comenté KAN-57.
- [x] El hex directo del color de Red ya funcionaba (clic en el swatch abre el selector nativo), pero no se notaba. Ícono final: gotero (Pipette) al final de la misma fila de colores, con tooltip.
- [x] Corregí una barra de desplazamiento fea que aparecía al pasar el mouse sobre los colores (el hover agrandaba las muestras y desbordaba la fila).
- [x] "Guardar cambios" del panel de Red ahora queda deshabilitado hasta que se cambie realmente el color. Comenté KAN-58.
- [x] Agregué "Quitar cargo" al panel de Afirmación (faltaba) y agregué confirmación (modal rojo + OTP) tanto ahí como en Quitar cargo de Líder/Supervisor de Red — antes quitaban al instante sin preguntar.
- [x] Extendí ConfirmarQuitarDialog (compartido) con OTP opcional, sin romper a quien ya lo usa (Calendario, Casas de Paz). Casas de Paz ya tenía confirmación propia, no necesitó cambios.
- [x] Probado en vivo ambos casos. Comenté KAN-57 y KAN-58.
- [x] Agregué "Eliminar Red" / "Reactivar Red" (soft-delete, agrisada 1 año, confirmación roja + OTP si aplica). Creé y finalicé KAN-79.
- [x] Bug encontrado en el camino: la política RLS de `red` ocultaba del todo las eliminadas en vez de agrisarlas — corregido con una migración nueva.
- [x] Ese fix reveló ~13 Redes de prueba viejas (de otras sesiones) que quedaron invisibles por el mismo bug — las dejé intactas (tienen referencias en fusión/multiplicación/invitaciones que no tocamos hoy), solo borré las 2 filas de prueba que creé yo mismo hoy.
- [x] Auditoría de contraste de texto en Red/Departamento (pedido explícito): encontré que varias etiquetas usaban opacidad reducida encima del color ya calculado, bajando el contraste real por debajo de lo legible en colores saturados. Quité esas opacidades — verificado con cálculo WCAG real, los 36 textos visibles ahora cumplen el mínimo.
- [ ] Pendiente: responsividad móvil (item 10, KAN-63), persistir cámara local (item 11), revisión visual autenticada (item 13), pruebas E2E de cierre (item 14).
