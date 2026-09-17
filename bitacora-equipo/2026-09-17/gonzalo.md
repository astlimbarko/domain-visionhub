# Gonzalo — 2026-09-17

- [x] KAN-367/386: mergeado PR #69 y desplegado a producción (falta probar con usuario real)
- [x] Análisis completo de arquitectura KAN-251 (madre/satélite/hija), plan de acción entregado
- [x] KAN-387: toggle graduar Satélite→Hija implementado (rama aparte, con Magnus), aplicado a producción — sin desplegar frontend
- [x] KAN-389: panel Membresía por CdP, refactorizado a componente compartido real con Afirmación, verificado en vivo
- [x] KAN-390: RE manual (checkbox "se reconcilió"), registrado en Evangelismo, verificado end-to-end en Génesis
- [x] KAN-391: buscador unificado de asistencia (nuevos+regulares+niños en 1 campo) + origen de CdP, verificado en vivo
- [x] KAN-394: anotado en cola (Pastor/Supervisor, panel agregado de iglesias hijas+satélites) — no implementar todavía
- [x] KAN-395 (bug real, sin tocar): 2 motores de RE corriendo en paralelo sobre persona_estado — documentado para revisión
- [x] KAN-396 (bug real, mitigado): obtenerMiembrosCdp podía duplicar una persona — dedup en frontend, raíz sin arreglar
- [ ] KAN-387: encontré un caso real de rol cruzado (4 Anillo↔Montero) sin resolver — NO probé el toggle contra iglesias reales, falta decisión de cómo resolverlo antes de usarlo en producción
- [ ] Falta desplegar a producción: KAN-389, KAN-390, KAN-391 (solo DB aplicada, frontend no)
- [ ] Falta: mecanismo de RE ↔ chip "RE" del panel Membresía siguen siendo conceptos separados (no unificados a propósito, ver memoria)
