# Gonzalo — 2026-09-05

- [x] Confirmado que el merge de KAN-278/279/280 a `master` (commit `7c14e50`) quedó bien pusheado en remoto
- [x] Diagnosticado por qué a Maria Vides no le pedía la contraseña nueva pese al flag seguir en `true`: el build de `app.somoscdv.com` estaba desactualizado (verificado descargando el JS real y comparando contra el código nuevo) -- no era un bug de código
- [x] Compilado y verificado un `dist/` local desde `master` con las 3 cadenas nuevas presentes, para tener listo el paquete correcto mientras se resuelve quién despliega
- [x] Buscados y clasificados los 52 tickets nuevos (KAN-281 a KAN-332) creados hoy, organizados por épica
- [x] Implementado y verificado en vivo **KAN-281/282/283 (Departamento de Evangelismo)**: rama `feature/kan281-departamento-evangelismo`, pusheada. Reutiliza el panel del Supervisor tal cual (cero duplicación), rol nuevo independiente con alcance iglesia completa, migración aplicada en producción. Probado con login real (cuenta de prueba `test@somoscdv.com`, iglesia Centro de Vida Genesis): rol visible en el selector, panel con datos reales, asignación de meta a Red específica funcionando
- [ ] Falta: aprobación para mergear KAN-281 a `master` + deploy
- [ ] Pendiente suelto (sin tocar hoy): tickets retroactivos del trabajo de Matías, y decidir el rol de centrodevidascz2@gmail.com
