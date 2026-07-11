// VisionHub Neo4j Seed Data - Catalogos
// Basado en VisionHub_Grafo_v2_Final.md
// Fecha: 2026-07-11

// ============================================
// 1. ORGANIZACION (Tenant raiz)
// ============================================

CREATE (org:Organizacion {
  id: randomUUID(),
  nombre: "Red Apostolica del Ap. Edgar Ortuno",
  sede: "Centro de Vida Global, Cochabamba, Bolivia",
  plan: "iglesia",
  estado: "activa",
  created_at: datetime()
});

// ============================================
// 2. CARGOS (Catalogo global - 15 cargos)
// ============================================

// Nivel 1: Los 5 Ministerios (mayor jerarquia espiritual)
CREATE (c1:Cargo {
  id: randomUUID(),
  nombre: "Apostol",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 1,
  descripcion: "Maxima autoridad de cobertura. Designado por apostol superior. Toma decisiones teocraticas."
});

CREATE (c2:Cargo {
  id: randomUUID(),
  nombre: "Pastor",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 2,
  descripcion: "Autoridad local de la iglesia. Lidera la congregacion en lo espiritual y administrativo."
});

CREATE (c3:Cargo {
  id: randomUUID(),
  nombre: "Profeta",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 3,
  descripcion: "Cargo alto con uncion profetica. No gerencia documentos ni toma decisiones."
});

CREATE (c4:Cargo {
  id: randomUUID(),
  nombre: "Evangelista",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 4,
  descripcion: "Evangeliza a escala mayor. Crea equipos y capacita. Predica en servicios especiales."
});

CREATE (c5:Cargo {
  id: randomUUID(),
  nombre: "Maestro",
  tipo: "ministerial",
  subtipo: "ministerial_supremo",
  permanente: true,
  orden: 5,
  descripcion: "Ensenanza de la palabra a nivel teologico. Usa palabra revelada."
});

// Nivel 2: Cargos Ministeriales (rangos inferiores)
CREATE (c6:Cargo {
  id: randomUUID(),
  nombre: "Ministro",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 6,
  descripcion: "Cargo alto por debajo de los 5 ministerios. Ejecuta tareas sobre redes."
});

CREATE (c7:Cargo {
  id: randomUUID(),
  nombre: "Anciano",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 7,
  descripcion: "Por encima de diacono, por debajo de ministro. Predica, puede ser lider de red."
});

CREATE (c8:Cargo {
  id: randomUUID(),
  nombre: "Diacono",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 8,
  descripcion: "Persona de servicio. Ejecutor de planes. Oficios varios."
});

CREATE (c9:Cargo {
  id: randomUUID(),
  nombre: "Mentor",
  tipo: "ministerial",
  subtipo: "ministerial",
  permanente: true,
  orden: 9,
  descripcion: "Pendiente de definir."
});

// Nivel 3: Cargos Funcionales (temporales)
CREATE (c10:Cargo {
  id: randomUUID(),
  nombre: "Lider de Red",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 10,
  descripcion: "Supervisa casas de paz de su red. Autonomo en su gestion."
});

CREATE (c11:Cargo {
  id: randomUUID(),
  nombre: "Lider de CdP",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 11,
  descripcion: "Responsable principal de una casa de paz."
});

CREATE (c12:Cargo {
  id: randomUUID(),
  nombre: "Sublider de CdP",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 12,
  descripcion: "Colaborador del lider de casa de paz. Futuro lider."
});

CREATE (c13:Cargo {
  id: randomUUID(),
  nombre: "Lider de Departamento",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 13,
  descripcion: "Responsable de un departamento especifico."
});

CREATE (c14:Cargo {
  id: randomUUID(),
  nombre: "Operador",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 14,
  descripcion: "Persona de apoyo en departamentos."
});

CREATE (c15:Cargo {
  id: randomUUID(),
  nombre: "Contador/Contadora",
  tipo: "funcional",
  subtipo: "funcional",
  permanente: false,
  orden: 15,
  descripcion: "Area administrativa-financiera. Minimo diacono + profesional."
});

// ============================================
// 3. ESTADOS (Catalogo global - 6 estados)
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
  descripcion: "Persona que acepto a Jesus. Asistentes regulares.",
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
  descripcion: "Persona que abandono 3 clases continuas del discipulado.",
  orden: 6
});

// ============================================
// 4. TRANSICIONES DE ESTADOS
// ============================================

// SIM -> NC
MATCH (e1:Estado {sigla: "SIM"}), (e2:Estado {sigla: "NC"})
CREATE (e1)-[:TRANSICIONA_A {
  criterio: "ora de fe",
  condicion: "acepta a Jesus"
}]->(e2);

// NC -> CRE
MATCH (e2:Estado {sigla: "NC"}), (e3:Estado {sigla: "CRE"})
CREATE (e2)-[:TRANSICIONA_A {
  criterio: "1 semana sin discipulado",
  condicion: "no asiste a discipulado"
}]->(e3);

// NC -> DA
MATCH (e2:Estado {sigla: "NC"}), (e5:Estado {sigla: "DA"})
CREATE (e2)-[:TRANSICIONA_A {
  criterio: "asiste a discipulado",
  condicion: "asiste al menos 1 vez"
}]->(e5);

// CRE -> DA
MATCH (e3:Estado {sigla: "CRE"}), (e5:Estado {sigla: "DA"})
CREATE (e3)-[:TRANSICIONA_A {
  criterio: "asiste a discipulado",
  condicion: "asiste al menos 1 vez"
}]->(e5);

// DA -> DI
MATCH (e5:Estado {sigla: "DA"}), (e6:Estado {sigla: "DI"})
CREATE (e5)-[:TRANSICIONA_A {
  criterio: "3 clases continuas ausentes",
  condicion: "abandona discipulado"
}]->(e6);

// DI -> DA
MATCH (e6:Estado {sigla: "DI"}), (e5:Estado {sigla: "DA"})
CREATE (e6)-[:TRANSICIONA_A {
  criterio: "retoma asistencia",
  condicion: "vuelve a discipulado"
}]->(e5);

// RE -> DA
MATCH (e4:Estado {sigla: "RE"}), (e5:Estado {sigla: "DA"})
CREATE (e4)-[:TRANSICIONA_A {
  criterio: "asiste a discipulado",
  condicion: "RE dura 1 dia"
}]->(e5);

// ============================================
// 5. DEPARTAMENTOS (4 activos)
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
// 6. MINISTERIOS (14)
// ============================================

CREATE (m1:Ministerio {id: randomUUID(), nombre: "Alabanza", descripcion: "Musica y canto. Musicos y cantantes. Ensayos periodicos.", nunca_se_cierra: true});
CREATE (m2:Ministerio {id: randomUUID(), nombre: "Danza", descripcion: "Danzas reverentes. Jovenes. Ensayos periodicos.", nunca_se_cierra: true});
CREATE (m3:Ministerio {id: randomUUID(), nombre: "Comunicacion", descripcion: "Transmisiones, fotografia, video, redes sociales, apoyo tecnico.", nunca_se_cierra: true});
CREATE (m4:Ministerio {id: randomUUID(), nombre: "Ninos", descripcion: "Ensenar palabra a ninos -12 anos. Clases adaptadas.", nunca_se_cierra: true});
CREATE (m5:Ministerio {id: randomUUID(), nombre: "Jovenes", descripcion: "Ministrar a jovenes. Servicio semanal.", nunca_se_cierra: true});
CREATE (m6:Ministerio {id: randomUUID(), nombre: "Protocolo", descripcion: "Coordinar servicios, programas, tiempos, invitados.", nunca_se_cierra: true});
CREATE (m7:Ministerio {id: randomUUID(), nombre: "Ujieres", descripcion: "Recibir, orientar, orden, limpieza, uniforme, turnos.", nunca_se_cierra: true});
CREATE (m8:Ministerio {id: randomUUID(), nombre: "Parqueo", descripcion: "Organizar ingreso/ubicacion/salida de vehiculos.", nunca_se_cierra: true});
CREATE (m9:Ministerio {id: randomUUID(), nombre: "Cocina", descripcion: "Preparar alimentos para actividades, eventos, delegaciones.", nunca_se_cierra: true});
CREATE (m10:Ministerio {id: randomUUID(), nombre: "Evangelismo (campo)", descripcion: "Anunciar evangelio fuera de la iglesia. Visitas, alcance.", nunca_se_cierra: true});
CREATE (m11:Ministerio {id: randomUUID(), nombre: "Sonido", descripcion: "Operacion y mantenimiento de equipos de audio.", nunca_se_cierra: true});
CREATE (m12:Ministerio {id: randomUUID(), nombre: "Testimonios", descripcion: "Recopilar, documentar, presentar testimonios.", nunca_se_cierra: true});
CREATE (m13:Ministerio {id: randomUUID(), nombre: "Escuderos", descripcion: "Apoyo y asistencia a pastores o invitados especiales.", nunca_se_cierra: true});
CREATE (m14:Ministerio {id: randomUUID(), nombre: "Intercesion", descripcion: "Oracion, intercesion, clamor, apoyo espiritual.", nunca_se_cierra: true});

// ============================================
// 7. TIPOS DE REUNION (8)
// ============================================

CREATE (tr1:TipoReunion {id: randomUUID(), tipo: "Discipulado", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});
CREATE (tr2:TipoReunion {id: randomUUID(), tipo: "Oracion", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});
CREATE (tr3:TipoReunion {id: randomUUID(), tipo: "Seminario", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});
CREATE (tr4:TipoReunion {id: randomUUID(), tipo: "Ayuno", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});
CREATE (tr5:TipoReunion {id: randomUUID(), tipo: "Casa de Paz", frecuencia: "semanal", lugar_default: "hogar", virtual_default: false});
CREATE (tr6:TipoReunion {id: randomUUID(), tipo: "Servicio de Jovenes", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});
CREATE (tr7:TipoReunion {id: randomUUID(), tipo: "Servicio Central", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});
CREATE (tr8:TipoReunion {id: randomUUID(), tipo: "Servicio Central Nocturno", frecuencia: "semanal", lugar_default: "iglesia", virtual_default: false});

// ============================================
// 8. EVENTOS ANUALES (5)
// ============================================

CREATE (ea1:EventoAnual {id: randomUUID(), nombre: "RMS", descripcion: "Congreso de jovenes"});
CREATE (ea2:EventoAnual {id: randomUUID(), nombre: "MOS", descripcion: "Movimiento Sobrenatural"});
CREATE (ea3:EventoAnual {id: randomUUID(), nombre: "Congreso de Mujeres", descripcion: "Encuentro de mujeres"});
CREATE (ea4:EventoAnual {id: randomUUID(), nombre: "Congreso de Hombres", descripcion: "Encuentro de hombres"});
CREATE (ea5:EventoAnual {id: randomUUID(), nombre: "Congreso de Ninos", descripcion: "Encuentro de ninos"});

// ============================================
// RESUMEN DE DATOS SEMILLA
// ============================================
// Organizacion: 1
// Cargos: 15
// Estados: 6
// Transiciones: 7
// Departamentos: 4
// Ministerios: 14
// Tipos de Reunion: 8
// Eventos Anuales: 5
