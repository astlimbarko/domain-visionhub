// VisionHub Neo4j Schema
// Basado en VisionHub_Grafo_v2_Final.md
// Fecha: 2026-07-11

// ============================================
// 1. CONSTRAINTS (Unicidad)
// ============================================

// Organizacion
CREATE CONSTRAINT org_id_unique IF NOT EXISTS
FOR (o:Organizacion) REQUIRE o.id IS UNIQUE;

// Iglesia
CREATE CONSTRAINT iglesia_id_unique IF NOT EXISTS
FOR (i:Iglesia) REQUIRE i.id IS UNIQUE;

// Red
CREATE CONSTRAINT red_id_unique IF NOT EXISTS
FOR (r:Red) REQUIRE r.id IS UNIQUE;

// CasaDePaz
CREATE CONSTRAINT cdp_id_unique IF NOT EXISTS
FOR (c:CasaDePaz) REQUIRE c.id IS UNIQUE;

// Persona
CREATE CONSTRAINT persona_id_unique IF NOT EXISTS
FOR (p:Persona) REQUIRE p.id IS UNIQUE;

// Departamento
CREATE CONSTRAINT depto_id_unique IF NOT EXISTS
FOR (d:Departamento) REQUIRE d.id IS UNIQUE;

// Ministerio
CREATE CONSTRAINT ministerio_id_unique IF NOT EXISTS
FOR (m:Ministerio) REQUIRE m.id IS UNIQUE;

// Cargo
CREATE CONSTRAINT cargo_id_unique IF NOT EXISTS
FOR (c:Cargo) REQUIRE c.id IS UNIQUE;

// Estado
CREATE CONSTRAINT estado_id_unique IF NOT EXISTS
FOR (e:Estado) REQUIRE e.id IS UNIQUE;

// TipoReunion
CREATE CONSTRAINT tipo_reunion_id_unique IF NOT EXISTS
FOR (tr:TipoReunion) REQUIRE tr.id IS UNIQUE;

// InstanciaReunion
CREATE CONSTRAINT instancia_reunion_id_unique IF NOT EXISTS
FOR (ir:InstanciaReunion) REQUIRE ir.id IS UNIQUE;

// Ofrenda
CREATE CONSTRAINT ofrenda_id_unique IF NOT EXISTS
FOR (o:Ofrenda) REQUIRE o.id IS UNIQUE;

// Reporte
CREATE CONSTRAINT reporte_id_unique IF NOT EXISTS
FOR (r:Reporte) REQUIRE r.id IS UNIQUE;

// Vision
CREATE CONSTRAINT vision_id_unique IF NOT EXISTS
FOR (v:Vision) REQUIRE v.id IS UNIQUE;

// EventoAnual
CREATE CONSTRAINT evento_anual_id_unique IF NOT EXISTS
FOR (ea:EventoAnual) REQUIRE ea.id IS UNIQUE;

// EventoBautizo
CREATE CONSTRAINT evento_bautizo_id_unique IF NOT EXISTS
FOR (eb:EventoBautizo) REQUIRE eb.id IS UNIQUE;

// ============================================
// 2. INDEXES (Busquedas frecuentes)
// ============================================

// Indexes para busquedas por nombre
CREATE INDEX iglesia_nombre IF NOT EXISTS
FOR (i:Iglesia) ON (i.nombre);

CREATE INDEX red_nombre IF NOT EXISTS
FOR (r:Red) ON (r.nombre);

CREATE INDEX cdp_nombre IF NOT EXISTS
FOR (c:CasaDePaz) ON (c.nombre);

CREATE INDEX persona_nombre IF NOT EXISTS
FOR (p:Persona) ON (p.nombre, p.apellido);

CREATE INDEX cargo_nombre IF NOT EXISTS
FOR (c:Cargo) ON (c.nombre);

CREATE INDEX estado_sigla IF NOT EXISTS
FOR (e:Estado) ON (e.sigla);

// Indexes para filtros por tenant
CREATE INDEX org_nombre IF NOT EXISTS
FOR (o:Organizacion) ON (o.nombre);

// Indexes para relaciones temporales
CREATE INDEX persona_estado_fecha IF NOT EXISTS
FOR ()-[r:TIENE_ESTADO]-() ON (r.fecha_inicio);

CREATE INDEX persona_cargo_fecha IF NOT EXISTS
FOR ()-[r:OCUPA_CARGO]-() ON (r.fecha_inicio);

// ============================================
// 3. FULLTEXT INDEXES (Busqueda de texto)
// ============================================

CREATE FULLTEXT INDEX persona_fulltext IF NOT EXISTS
FOR (p:Persona) ON EACH [p.nombre, p.apellido, p.email];

// ============================================
// SCHEMA COMPLETO
// ============================================
// Labels de nodo: 16
//   Organizacion, Iglesia, Red, CasaDePaz, Persona,
//   Departamento, Ministerio, Cargo, Estado,
//   TipoReunion, InstanciaReunion, Ofrenda, Reporte,
//   Vision, EventoAnual, EventoBautizo
//
// Tipos de relacion: 24
//   PERTENECE_A, MIEMBRO_DE, TIENE_ESTADO, TRANSICIONA_A,
//   FUE_BAUTIZADA_EN, OCUPA_CARGO, DESIGNA, CADENA_MANDO,
//   DIRIGE, SIRVE_COMO_ANFITRION, TIENE, TIENE_REPRESENTANTE,
//   TIENE_RESPONSABLE, SIRVE_A, PARTICIPA_EN, TIENE_LIDER,
//   PROGRAMA, TIENE_INSTANCIA, REALIZADA_EN, ASISTE_A,
//   RECAUDA, CONTRIBUYE, AGREGA_EN, ESTABLECE_VISION,
//   ADOPTA_VISION, CREA, CUENTA_CON
