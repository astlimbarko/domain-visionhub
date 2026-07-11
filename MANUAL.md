# Manual — Agregar Informacion a VisionHub

## Flujo de Trabajo

### 1. Informacion nueva de dominio
Agregar al archivo Markdown correspondiente en `domain_knowledge/`:
- Info sobre cargos → `cargos/cargos.md`
- Info sobre casas de paz → `casas-de-paz/*.md`
- Info sobre iglesias → `iglesia/*.md`
- Info sobre redes → `redes/*.md`
- Info sobre departamentos → `departamentos/*.md`
- Info sobre ministerios → `ministerios/ministerios.md`
- Info sobre estados → `estados/estados.md`
- Info sobre finanzas → `finanzas/finanzas.md`
- Info sobre relaciones → `relaciones/*.md`

### 2. Si implica nuevos nodos/relaciones en el grafo
- Actualizar `neo4j/schema.cypher` (nuevos tipos de nodo o relacion)
- Actualizar `neo4j/seed_catalogs.cypher` (nuevos catalogos)

### 3. Si creas archivos o carpetas nuevas
- Actualizar `estructura.txt`
- Actualizar `domain_knowledge/README.md`
- Arreglar referencias rotas en otros archivos

### 4. Reglas importantes
- Leer `TAREA_CONSOLIDACION.txt` primero
- Condensar, no resumir (misma info, menos texto)
- No romper referencias existentes
- Commitear despues de cada cambio importante
