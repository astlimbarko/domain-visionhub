# Matías — 2026-09-02

- [x] Diagnostiqué 3 bugs reportados por el owner (evangelizados, metas, supervisor de red)
- [x] Metas de evangelismo: RPC `fn_asignar_meta_cdp`/`fn_asignar_meta_red` para reasignar el mismo período sin error de "solapamiento" (baja lógica de la meta vigente + reinsert); migración aplicada en prod y probada con ROLLBACK
- [x] Frontend: `asignarMetaEvangelismo`/`asignarMetaRedEvangelismo` ahora llaman a los RPC
- [x] Evangelizados de líder de CdP no se guardaban: causa raíz = INSERT de persona sin `membresia_completada:false` (default true) + CI obligatorio → trigger rechaza. Fix ya venía en working tree (usa RPC `fn_registrar_evangelizado`); se despliega con este build
- [x] Merge a master + build + deploy de frontend
- [ ] Falta: supervisor de la red en acción no ve reportes — backend/ruteo verificados OK, es de frontend en vivo (usuario multi-rol) o cuenta puntual; pendiente reproducir con la cuenta concreta
