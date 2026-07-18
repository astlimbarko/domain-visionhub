// VisionHub Neo4j Seed Data - Catalogos
// Actualizado: 2026-07-14
// Basado en toda la documentacion actualizada de VisionHub

// ============================================
// 1. COBERTURA (Tenant raiz)
// ============================================

CREATE (cob:Cobertura {
  id: randomUUID(),
  nombre: "Red Apostolica del Ap. Edgar Ortuno",
  sede: "Cochabamba, Bolivia",
  apostol: "Edgar Ortuño",
  estado: "activa",
  created_at: datetime()
});

// ============================================
// 2. IGLESIAS (Despliegue inicial - 2 + Cochabamba)
// ============================================

// Iglesia madre real (no se da de alta en software aun)
CREATE (ig0:Iglesia {
  id: randomUUID(),
  nombre: "Centro de Vida Global",
  ciudad: "Cochabamba",
  tipo: "madre_real",
  activa: false,
  created_at: datetime()
});

// Iglesia hija - Santa Cruz (sede del despliegue)
CREATE (ig1:Iglesia {
  id: randomUUID(),
  nombre: "Centro de Vida Global 4 Anillo",
  ciudad: "Santa Cruz",
  tipo: "hija",
  activa: true,
  created_at: datetime()
});

// Iglesia hija - Montero
CREATE (ig2:Iglesia {
  id: randomUUID(),
  nombre: "Centro de Vida Global Montero",
  ciudad: "Montero",
  tipo: "hija",
  activa: true,
  created_at: datetime()
});

// Relaciones iglesia padre/hija
MATCH (cob:Cobertura {nombre: "Red Apostolica del Ap. Edgar Ortuno"})
MATCH (ig0:Iglesia {nombre: "Centro de Vida Global"})
MATCH (ig1:Iglesia {nombre: "Centro de Vida Global 4 Anillo"})
MATCH (ig2:Iglesia {nombre: "Centro de Vida Global Montero"})
CREATE (ig0)-[:PERTENECE_A]->(cob)
CREATE (ig1)-[:ES_HIJA_DE]->(ig0)
CREATE (ig2)-[:ES_HIJA_DE]->(ig0);

// ============================================
// 3. CARGOS (Catalogo global - 20 cargos)
// ============================================

// --- Nivel Vision (Macro) ---
CREATE (c0:Cargo {
  id: randomUUID(),
  nombre: "Lider de la Vision en Accion",
  tipo: "funcional",
  subtipo: "vision_macro",
  permanente: true,
  orden: 0,
  descripcion: "Cabeza administrativa del crecimiento. Brazo operativo del pastor. Permanente, solo el pastor lo remueve."
});

CREATE (c1v:Cargo {
  id: randomUUID(),
  nombre: "Encargado de Departamentos (Vision)",
  tipo: "funcional",
  subtipo: "vision_macro",
  permanente: false,
  orden: 1,
  descripcion: "Supervisa los 4 departamentos a nivel global. Rol DIFERENTE al Lider de Departamento local."
});

CREATE (c2v:Cargo {
  id: randomUUID(),
  nombre: "Encargado General de Ministerios (Vision)",
  tipo: "funcional",
  subtipo: "vision_macro",
  permanente: false,
  orden: 2,
  descripcion: "Audita participacion por red y ministerio. Enfoque global/analitico."
});

// --- Nivel Iglesia: 5 Ministerios (designados por apostol) ---
CREATE (c3:Cargo {
  id: randomUUID(),
  nombre: "Apostol",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 3,
  descripcion: "Maxima autoridad de cobertura. Designado por apostol superior."
});

CREATE (c4:Cargo {
  id: randomUUID(),
  nombre: "Pastor",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 4,
  descripcion: "Autoridad local de la iglesia. Junto con su esposa conforman el equipo pastoral."
});

CREATE (c5:Cargo {
  id: randomUUID(),
  nombre: "Profeta",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 5,
  descripcion: "Cargo alto con uncion profetica. No gerencia documentos. Puede mover personas ministerialmente. Designado por apostol."
});

CREATE (c6:Cargo {
  id: randomUUID(),
  nombre: "Evangelista",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 6,
  descripcion: "Evangeliza a escala mayor. Crea equipos y capacita. Designado por apostol."
});

CREATE (c7:Cargo {
  id: randomUUID(),
  nombre: "Maestro",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 7,
  descripcion: "Ensenanza teologica. Palabra revelada. Designado por apostol."
});

// --- Nivel Iglesia: Cargos Ministeriales inferiores ---
CREATE (c8:Cargo {
  id: randomUUID(),
  nombre: "Ministro",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 8,
  descripcion: "Por debajo de los 5 ministerios. Ejecuta tareas sobre redes. Designado por apostol."
});

CREATE (c9:Cargo {
  id: randomUUID(),
  nombre: "Anciano",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 9,
  descripcion: "Por encima de diacono. Predica, puede ser lider de red. Designado por equipo pastoral."
});

CREATE (c10:Cargo {
  id: randomUUID(),
  nombre: "Diacono",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 10,
  descripcion: "Servicio constante. Ejecutor de planes. Requisito: ser lider de CdP previamente. Designado por equipo pastoral."
});

CREATE (c11:Cargo {
  id: randomUUID(),
  nombre: "Mentor",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 11,
  descripcion: "Pendiente de definir."
});

// --- Nivel Red ---
CREATE (c12:Cargo {
  id: randomUUID(),
  nombre: "Lider de Red",
  tipo: "funcional",
  subtipo: "nivel_red",
  permanente: false,
  orden: 12,
  descripcion: "Supervisa casas de paz de su red. Cargo funcional, puede ser anciano/ministro/diacono. Designado por equipo pastoral."
});

CREATE (c13:Cargo {
  id: randomUUID(),
  nombre: "Encargado de Departamentos de Red",
  tipo: "funcional",
  subtipo: "nivel_red",
  permanente: false,
  orden: 13,
  descripcion: "OBLIGATORIO en cada red. Supervisa representantes de Ev, Af, Di, En a nivel local."
});

CREATE (c14:Cargo {
  id: randomUUID(),
  nombre: "Encargado de Ministerio de Red",
  tipo: "funcional",
  subtipo: "nivel_red",
  permanente: false,
  orden: 14,
  descripcion: "OBLIGATORIO en cada red. Coordina PERSONAS de la red que sirven en ministerios."
});

// --- Nivel CdP ---
CREATE (c15:Cargo {
  id: randomUUID(),
  nombre: "Lider de CdP",
  tipo: "funcional",
  subtipo: "nivel_cdp",
  permanente: false,
  orden: 15,
  descripcion: "Responsable principal de una casa de paz. Designado por equipo pastoral (lider de red propone, pastor aprueba)."
});

CREATE (c16:Cargo {
  id: randomUUID(),
  nombre: "Sublider de CdP",
  tipo: "funcional",
  subtipo: "nivel_cdp",
  permanente: false,
  orden: 16,
  descripcion: "Colaborador del lider. Puede llenar formulario de reporte. Dashboard configurable desde Supervision."
});

// --- Otros funcionales ---
CREATE (c17:Cargo {
  id: randomUUID(),
  nombre: "Lider de Departamento",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 17,
  descripcion: "Responsable de un departamento especifico (local). DIFERENTE al Encargado de Departamentos (Vision)."
});

CREATE (c18:Cargo {
  id: randomUUID(),
  nombre: "Operador",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 18,
  descripcion: "Apoyo en departamentos. Designado por pastor o lider de departamento."
});

CREATE (c19:Cargo {
  id: randomUUID(),
  nombre: "Contador/Contadora",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 19,
  descripcion: "Area administrativa-financiera. Minimo diacono + profesional."
});

// ============================================
// 4. ESTADOS (Catalogo global - 6 estados)
// ============================================

CREATE (e1:Estado {
  id: randomUUID(),
  nombre: "Evangelizado",
  sigla: "SIM",
  descripcion: "Persona evangelizada que no avanza. Estado inicial.",
  orden: 1
});

CREATE (e2:Estado {
  id: randomUUID(),
  nombre: "Nuevo Convertido",
  sigla: "NC",
  descripcion: "Persona que acepta a Jesus por primera vez.",
  orden: 2
});

CREATE (e3:Estado {
  id: randomUUID(),
  nombre: "Creyente",
  sigla: "CRE",
  descripcion: "Asistente regular mayor de 12 anos. Despues de 1 semana sin discipulado.",
  orden: 3
});

CREATE (e4:Estado {
  id: randomUUID(),
  nombre: "Reconciliado",
  sigla: "RE",
  descripcion: "Persona que estuvo +3 meses fuera y retorna.",
  orden: 4
});

CREATE (e5:Estado {
  id: randomUUID(),
  nombre: "Discipulo Activo",
  sigla: "DA",
  descripcion: "Persona que asiste al discipulado.",
  orden: 5
});

CREATE (e6:Estado {
  id: randomUUID(),
  nombre: "Discipulo Inactivo",
  sigla: "DI",
  descripcion: "Abandono 3 clases continuas. Nunca aplica sin ser DA primero.",
  orden: 6
});

// ============================================
// 5. TRANSICIONES DE ESTADOS
// ============================================

MATCH (e1:Estado {sigla: "SIM"}), (e2:Estado {sigla: "NC"})
CREATE (e1)-[:TRANSICIONA_A {criterio: "ora de fe", condicion: "acepta a Jesus"}]->(e2);

MATCH (e2:Estado {sigla: "NC"}), (e3:Estado {sigla: "CRE"})
CREATE (e2)-[:TRANSICIONA_A {criterio: "1 semana sin discipulado", condicion: "solo mayores de 12 anos"}]->(e3);

MATCH (e2:Estado {sigla: "NC"}), (e5:Estado {sigla: "DA"})
CREATE (e2)-[:TRANSICIONA_A {criterio: "asiste a discipulado", condicion: "al menos 1 vez"}]->(e5);

MATCH (e3:Estado {sigla: "CRE"}), (e5:Estado {sigla: "DA"})
CREATE (e3)-[:TRANSICIONA_A {criterio: "asiste a discipulado", condicion: "al menos 1 vez"}]->(e5);

MATCH (e5:Estado {sigla: "DA"}), (e6:Estado {sigla: "DI"})
CREATE (e5)-[:TRANSICIONA_A {criterio: "3 clases continuas ausentes", condicion: "abandona discipulado"}]->(e6);

MATCH (e6:Estado {sigla: "DI"}), (e5:Estado {sigla: "DA"})
CREATE (e6)-[:TRANSICIONA_A {criterio: "retoma asistencia", condicion: "vuelve a discipulado"}]->(e5);

MATCH (e4:Estado {sigla: "RE"}), (e5:Estado {sigla: "DA"})
CREATE (e4)-[:TRANSICIONA_A {criterio: "asiste a discipulado", condicion: "RE dura 1 dia"}]->(e5);

// ============================================
// 6. DEPARTAMENTOS (4 activos)
// ============================================

CREATE (d1:Departamento {
  id: randomUUID(),
  nombre: "Evangelismo",
  descripcion: "Alcanzar nuevas personas, registrar, dar seguimiento, motivar al altar.",
  activo: true
});

CREATE (d2:Departamento {
  id: randomUUID(),
  nombre: "Afirmacion",
  descripcion: "Confirmar llegada, acompanar al bautismo, integrar al RSLI, fidelizar.",
  activo: true
});

CREATE (d3:Departamento {
  id: randomUUID(),
  nombre: "Discipulado",
  descripcion: "Cursos, ensenanza, acompanamiento, capacitacion de lideres.",
  activo: true
});

CREATE (d4:Departamento {
  id: randomUUID(),
  nombre: "Envio",
  descripcion: "Evaluar, comisionar como lider de CdP, multiplicar.",
  activo: true
});

// ============================================
// 7. MINISTERIOS (14 - todos nivel iglesia)
// ============================================

CREATE (m1:Ministerio {id: randomUUID(), nombre: "Alabanza", nivel: "iglesia", descripcion: "Musica y canto. Musicos y cantantes.", nunca_se_cierra: true});
CREATE (m2:Ministerio {id: randomUUID(), nombre: "Danza", nivel: "iglesia", descripcion: "Danzas reverentes. Jovenes.", nunca_se_cierra: true});
CREATE (m3:Ministerio {id: randomUUID(), nombre: "Comunicacion", nivel: "iglesia", descripcion: "Transmisiones, foto, video, RRSS.", nunca_se_cierra: true});
CREATE (m4:Ministerio {id: randomUUID(), nombre: "Ninos", nivel: "iglesia", descripcion: "Ensenar palabra a ninos -12 anos.", nunca_se_cierra: true});
CREATE (m5:Ministerio {id: randomUUID(), nombre: "Jovenes", nivel: "iglesia", descripcion: "Ministrar a jovenes.", nunca_se_cierra: true});
CREATE (m6:Ministerio {id: randomUUID(), nombre: "Protocolo", nivel: "iglesia", descripcion: "Coordinar servicios, tiempos.", nunca_se_cierra: true});
CREATE (m7:Ministerio {id: randomUUID(), nombre: "Ujieres", nivel: "iglesia", descripcion: "Recibir, orientar, limpieza.", nunca_se_cierra: true});
CREATE (m8:Ministerio {id: randomUUID(), nombre: "Parqueo", nivel: "iglesia", descripcion: "Organizar vehiculos.", nunca_se_cierra: true});
CREATE (m9:Ministerio {id: randomUUID(), nombre: "Cocina", nivel: "iglesia", descripcion: "Preparar alimentos.", nunca_se_cierra: true});
CREATE (m10:Ministerio {id: randomUUID(), nombre: "Evangelismo (campo)", nivel: "iglesia", descripcion: "Anunciar evangelio fuera.", nunca_se_cierra: true});
CREATE (m11:Ministerio {id: randomUUID(), nombre: "Sonido", nivel: "iglesia", descripcion: "Equipos de audio.", nunca_se_cierra: true});
CREATE (m12:Ministerio {id: randomUUID(), nombre: "Testimonios", nivel: "iglesia", descripcion: "Recopilar testimonios.", nunca_se_cierra: true});
CREATE (m13:Ministerio {id: randomUUID(), nombre: "Escuderos", nivel: "iglesia", descripcion: "Asistencia a pastores.", nunca_se_cierra: true});
CREATE (m14:Ministerio {id: randomUUID(), nombre: "Intercesion", nivel: "iglesia", descripcion: "Oracion e intercesion.", nunca_se_cierra: true});

// ============================================
// 8. TIPOS DE REUNION
// ============================================

CREATE (tr1:TipoReunion {id: randomUUID(), tipo: "Casa de Paz", frecuencia: "semanal", lugar_default: "hogar", virtual_default: false, recauda: true});
CREATE (tr2:TipoReunion {id: randomUUID(), tipo: "Servicio Central", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: true});
CREATE (tr3:TipoReunion {id: randomUUID(), tipo: "Servicio Central Nocturno", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: true});
CREATE (tr4:TipoReunion {id: randomUUID(), tipo: "Servicio de Jovenes", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: true});
CREATE (tr5:TipoReunion {id: randomUUID(), tipo: "Discipulado", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: false});
CREATE (tr6:TipoReunion {id: randomUUID(), tipo: "Oracion", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: false});
CREATE (tr7:TipoReunion {id: randomUUID(), tipo: "Seminario", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: false});
CREATE (tr8:TipoReunion {id: randomUUID(), tipo: "Ayuno", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false, recauda: false});

// ============================================
// 9. TIPOS DE RELACION FAMILIAR
// ============================================

CREATE (trf1:TipoRelacion {id: randomUUID(), nombre: "Esposo", inverso: "Esposa"});
CREATE (trf2:TipoRelacion {id: randomUUID(), nombre: "Esposa", inverso: "Esposo"});
CREATE (trf3:TipoRelacion {id: randomUUID(), nombre: "Padre", inverso: "Hijo"});
CREATE (trf4:TipoRelacion {id: randomUUID(), nombre: "Madre", inverso: "Hijo"});
CREATE (trf5:TipoRelacion {id: randomUUID(), nombre: "Hijo", inverso: "Padre"});
CREATE (trf6:TipoRelacion {id: randomUUID(), nombre: "Hermano", inverso: "Hermano"});
CREATE (trf7:TipoRelacion {id: randomUUID(), nombre: "Abuelo", inverso: "Nieto"});
CREATE (trf8:TipoRelacion {id: randomUUID(), nombre: "Nieto", inverso: "Abuelo"});

// ============================================
// 10. EVENTOS ANUALES
// ============================================

CREATE (ea1:EventoAnual {id: randomUUID(), nombre: "RMS", descripcion: "Congreso de jovenes"});
CREATE (ea2:EventoAnual {id: randomUUID(), nombre: "MOS", descripcion: "Movimiento Sobrenatural"});
CREATE (ea3:EventoAnual {id: randomUUID(), nombre: "Congreso de Mujeres", descripcion: "Encuentro de mujeres"});
CREATE (ea4:EventoAnual {id: randomUUID(), nombre: "Congreso de Hombres", descripcion: "Encuentro de hombres"});
CREATE (ea5:EventoAnual {id: randomUUID(), nombre: "Congreso de Ninos", descripcion: "Encuentro de ninos"});

// ============================================
// 11. CRITERIOS POR DEFECTO (configurables por iglesia)
// ============================================

// Criterios de CdP
CREATE (cr1:Criterio {id: randomUUID(), categoria: "cdp", nombre: "VISITAS_PARA_MIEMBRO", valor: 2, descripcion: "Visitas consecutivas para ser miembro"});
CREATE (cr2:Criterio {id: randomUUID(), categoria: "cdp", nombre: "VISITAS_PARA_MIGRAR", valor: 8, descripcion: "Visitas consecutivas a otra CdP para migrar"});
CREATE (cr3:Criterio {id: randomUUID(), categoria: "cdp", nombre: "INASISTENCIAS_PARA_INACTIVO", valor: 12, descripcion: "Inasistencias consecutivas para inactivar"});
CREATE (cr4:Criterio {id: randomUUID(), categoria: "cdp", nombre: "MESES_PARA_RECONCILIADO", valor: 3, descripcion: "Meses fuera para ser Reconciliado"});

// Criterios de Estados SSVA
CREATE (cr5:Criterio {id: randomUUID(), categoria: "estados", nombre: "CLASES_PARA_DI", valor: 3, descripcion: "Clases ausentes para Discipulo Inactivo"});
CREATE (cr6:Criterio {id: randomUUID(), categoria: "estados", nombre: "SEMANAS_NC_PARA_CRE", valor: 1, descripcion: "Semanas sin discipulado NC a CRE"});
CREATE (cr7:Criterio {id: randomUUID(), categoria: "estados", nombre: "ASISTENCIAS_PARA_DA", valor: 1, descripcion: "Asistencias para ser Discipulo Activo"});
CREATE (cr8:Criterio {id: randomUUID(), categoria: "estados", nombre: "DIAS_RE_PARA_DA", valor: 1, descripcion: "Dias como RE antes de DA"});
CREATE (cr9:Criterio {id: randomUUID(), categoria: "estados", nombre: "EDAD_MINIMA_CRE", valor: 12, descripcion: "Edad minima para ser Creyente"});

// ============================================
// RESUMEN DE DATOS SEMILLA
// ============================================
// Cobertura: 1
// Iglesias: 3 (1 inactiva + 2 activas)
// Cargos: 20
// Estados: 6
// Transiciones: 7
// Departamentos: 4
// Ministerios: 14
// Tipos de Reunion: 8
// Tipos Relacion Familiar: 8
// Eventos Anuales: 5
// Criterios: 9
