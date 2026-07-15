# Manual de Neo4j para VisionHub

## Indice

1. [Instalacion](#1-instalacion)
2. [Configuracion](#2-configuracion)
3. [Carga de Schema](#3-carga-de-schema)
4. [Carga de Datos Semilla](#4-carga-de-datos-semilla)
5. [Consultas de Ejemplo](#5-consultas-de-ejemplo)
6. [Mantenimiento](#6-mantenimiento)

---

## 1. Instalacion

### 1.1 Opcion: Docker (Recomendado)

```bash
# Descargar imagen de Neo4j
docker pull neo4j:5.15

# Ejecutar contenedor
docker run -d \
  --name visionhub-neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/visionhub2024 \
  -e NEO4J_PLUGINS='["apoc"]' \
  -v neo4j_data:/data \
  -v neo4j_logs:/logs \
  neo4j:5.15
```

### 1.2 Opcion: Neo4j Desktop

1. Descargar Neo4j Desktop desde https://neo4j.com/download/
2. Instalar y crear una nueva base de datos
3. Configurar contrasena

### 1.3 Acceso

- **Browser:** http://localhost:7474
- **Bolt:** bolt://localhost:7687
- **Usuario:** neo4j
- **Contrasena:** visionhub2024

---

## 2. Configuracion

### 2.1 Plugins Necesarios

El plugin APOC es necesario para funciones como `randomUUID()`.

```cypher
// Verificar que APOC esta instalado
CALL apoc.help('apoc')
```

### 2.2 Configuracion de Memoria

Para produccion, se recomienda:

```properties
# neo4j.conf
dbms.memory.heap.initial_size=1G
dbms.memory.heap.max_size=2G
dbms.memory.pagecache.size=1G
```

---

## 3. Carga de Schema

### 3.1 Cargar Schema Completo

```bash
# Usando neo4j-shell
cat neo4j/schema.cypher | neo4j-shell -u neo4j -p visionhub2024

# Usando cypher-shell
cat neo4j/schema.cypher | cypher-shell -u neo4j -p visionhub2024
```

### 3.2 Verificar Schema

```cypher
// Listar todos los nodos
CALL db.labels()

// Listar todas las relaciones
CALL db.relationshipTypes()

// Listar todos los constraints
SHOW CONSTRAINTS

// Listar todos los indexes
SHOW INDEXES
```

---

## 4. Carga de Datos Semilla

### 4.1 Cargar Catalogos

```bash
# Usando neo4j-shell
cat neo4j/seed_catalogs.cypher | neo4j-shell -u neo4j -p visionhub2024

# Usando cypher-shell
cat neo4j/seed_catalogs.cypher | cypher-shell -u neo4j -p visionhub2024
```

### 4.2 Verificar Datos

```cypher
// Contar nodos por label
MATCH (n) RETURN labels(n)[0] as Label, count(n) as Total

// Ver todas las iglesias
MATCH (i:Iglesia) RETURN i.nombre, i.ciudad, i.tipo

// Ver todos los cargos
MATCH (c:Cargo) RETURN c.nombre, c.tipo, c.orden ORDER BY c.orden

// Ver todos los estados
MATCH (e:Estado) RETURN e.sigla, e.nombre, e.orden ORDER BY e.orden
```

---

## 5. Consultas de Ejemplo

### 5.1 Estructura Jerarquica

```cypher
// Ver jerarquia de iglesias
MATCH (i:Iglesia)
OPTIONAL MATCH (i)-[:ES_HIJA_DE]->(madre:Iglesia)
RETURN i.nombre, i.ciudad, i.tipo, madre.nombre as Madre

// Ver redes por iglesia
MATCH (r:Red)-[:PERTENECE_A]->(i:Iglesia)
RETURN i.nombre, collect(r.nombre) as Redes
```

### 5.2 Personas y Estados

```cypher
// Buscar personas por nombre
MATCH (p:Persona)
WHERE p.primer_nombre CONTAINS 'Juan'
RETURN p.primer_nombre, p.primer_apellido, p.ci

// Ver estado actual de personas
MATCH (p:Persona)-[r:TIENE_ESTADO]->(e:Estado)
WHERE r.fecha_fin IS NULL
RETURN p.primer_nombre, p.primer_apellido, e.sigla

// Personas en estado NC
MATCH (p:Persona)-[:TIENE_ESTADO]->(e:Estado {sigla: 'NC'})
RETURN p.primer_nombre, p.primer_apellido, p.fecha_registro
```

### 5.3 Cargos y Designaciones

```cypher
// Ver cargo actual de cada persona
MATCH (p:Persona)-[r:OCUPA_CARGO]->(c:Cargo)
WHERE r.fecha_fin IS NULL
RETURN p.primer_nombre, p.primer_apellido, c.nombre

// Ver cadena de mando
MATCH (superior:Persona)-[:CADENA_MANDO]->(inferior:Persona)
RETURN superior.primer_nombre, superior.primer_apellido,
       inferior.primer_nombre, inferior.primer_apellido
```

### 5.4 Casas de Paz

```cypher
// Ver CdPs por red
MATCH (c:CasaDePaz)-[:PERTENECE_A]->(r:Red)
RETURN r.nombre, collect(c.nombre) as CasasDePaz

// Ver miembros de una CdP
MATCH (p:Persona)-[:MIEMBRO_DE]->(c:CasaDePaz {nombre: 'CdP Vida Nueva'})
RETURN p.primer_nombre, p.primer_apellido
```

### 5.5 Asistencia

```cypher
// Asistencia a una reunion especifica
MATCH (p:Persona)-[:ASISTE_A]->(ir:InstanciaReunion)
WHERE ir.fecha = date('2024-01-15')
RETURN p.primer_nombre, p.primer_apellido

// Estadisticas de asistencia por CdP
MATCH (p:Persona)-[:MIEMBRO_DE]->(c:CasaDePaz)
RETURN c.nombre, count(p) as Miembros
```

### 5.6 Finanzas

```cypher
// Ofrendas por tipo
MATCH (o:Ofrenda)
RETURN o.tipo, sum(o.monto) as Total, o.moneda

// Ofrendas por persona
MATCH (p:Persona)-[:CONTRIBUYE]->(o:Ofrenda)
RETURN p.primer_nombre, p.primer_apellido, sum(o.monto) as Total
```

### 5.7 Ministerios

```cypher
// Ver ministerios y participantes
MATCH (m:Ministerio)<-[:PARTICIPA_EN]-(p:Persona)
RETURN m.nombre, collect(p.primer_nombre) as Participantes

// Ver participacion por red
MATCH (p:Persona)-[:PARTICIPA_EN]->(m:Ministerio)
MATCH (p)-[:MIEMBRO_DE]->(c:CasaDePaz)-[:PERTENECE_A]->(r:Red)
RETURN r.nombre, m.nombre, count(p) as Participantes
```

---

## 6. Mantenimiento

### 6.1 Backup

```bash
# Backup completo
neo4j-admin database dump neo4j --to-path=/backups/

# Backup con fecha
neo4j-admin database dump neo4j --to-path=/backups/neo4j_$(date +%Y%m%d).dump
```

### 6.2 Restaurar

```bash
# Restaurar desde backup
neo4j-admin database load neo4j --from-path=/backups/neo4j_20240115.dump
```

### 6.3 Monitoreo

```cypher
// Ver uso de base de datos
CALL dbms.security.listUsers()

// Ver estadisticas
CALL dbms.queryJmx('org.neo4j:instance=kernel#0,name=Store file sizes')
```

### 6.4 Limpieza de Datos de Prueba

```cypher
// ELIMINAR TODOS LOS DATOS (CUIDADO!)
MATCH (n) DETACH DELETE n

// Eliminar solo personas de prueba
MATCH (p:Persona)
WHERE p.ci STARTS WITH 'TEST'
DETACH DELETE p
```

---

## 7. Solucion de Problemas

### 7.1 Error de APOC

```cypher
// Si randomUUID() no funciona, verificar APOC
CALL apoc.help('apoc.create.uuid')
```

### 7.2 Error de Constraints

```cypher
// Si un constraint ya existe, ignorar el error
// Los archivos usan "IF NOT EXISTS"
```

### 7.3 Rendimiento

```cypher
// Verificar indices activos
SHOW INDEXES

// Analizar query lento
PROFILE MATCH (p:Persona) WHERE p.ci = '12345678' RETURN p
```

---

## 8. Enlaces Utiles

- **Documentacion Neo4j:** https://neo4j.com/docs/
- **Cypher Manual:** https://neo4j.com/docs/cypher-manual/
- **APOC Documentation:** https://neo4j.com/labs/apoc/
- **Neo4j Browser:** http://localhost:7474

---

**Version:** 2.0
**Fecha:** 2026-07-14
**Autor:** VisionHub Team
