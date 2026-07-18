-- VisionHub -- 01_enums.sql
-- Todos los tipos enumerados del sistema. moneda NO es enum: es tabla (ver 03_tenancy.sql).

CREATE TYPE sexo_enum AS ENUM ('M', 'F');

CREATE TYPE estado_civil_enum AS ENUM ('SOLTERO', 'CASADO', 'VIUDO', 'DIVORCIADO');

CREATE TYPE grado_instruccion_enum AS ENUM (
  'SIN_INSTRUCCION', 'PRIMARIA_INCOMPLETA', 'PRIMARIA_COMPLETA',
  'SECUNDARIA_INCOMPLETA', 'SECUNDARIA_COMPLETA', 'TECNICO_MEDIO',
  'TECNICO_SUPERIOR', 'LICENCIATURA_INGENIERIA', 'DIPLOMADO',
  'MAESTRIA', 'DOCTORADO'
);

-- Roles de dominio (decision del owner, 2026-07-17). Reemplaza al enum
-- generico SUPER_ADMIN/ADMIN/USUARIO/INVITADO.
CREATE TYPE rol_sistema_enum AS ENUM (
  'SUPER_ADMIN', 'PASTOR', 'SUPERVISOR_VISION_ACCION',
  'LIDER_RED', 'LIDER_CDP', 'SUBLIDER_CDP'
);

CREATE TYPE tipo_cargo_enum AS ENUM ('A', 'B');

CREATE TYPE escala_evangelismo_enum AS ENUM ('CASA_DE_PAZ', 'RED', 'IGLESIA', 'COBERTURA');

CREATE TYPE tipo_configuracion_enum AS ENUM ('BOOLEANO', 'NUMERICO', 'TEXTO');

-- Override manual de familia (02-persona-parentela, agregado 2026-07-17)
CREATE TYPE familia_override_tipo_enum AS ENUM ('EXCLUIR', 'INCLUIR_CON');

-- Estado de la CasaPazURL (13-registro-publico-cdp, agregado 2026-07-18)
CREATE TYPE estado_url_enum AS ENUM ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');
