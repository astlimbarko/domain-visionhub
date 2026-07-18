# Diseño — Pruebas con curl

## Resumen

Scripts de shell con curl puro contra la API de Supabase. Sin frontend, sin librerías, sin `SERVICE_ROLE_KEY`.

La razón de usar curl y no la web: **si una regla solo se cumple cuando el frontend la respeta, no se cumple**. Un sublíder curioso abre la consola del navegador y hace la misma petición a mano. El arnés hace exactamente eso, a propósito.

## Estructura

```
harness/12-pruebas-curl/
  correr.sh              # ejecuta todo, devuelve 0 o 1
  lib/
    assert.sh            # assert_igual, assert_vacio, assert_error, assert_contiene
    auth.sh              # obtener_jwt <email> <password>
    http.sh              # get, post, patch con el JWT en la cabecera
  auditoria.sql          # las 4 consultas de 11-esquema-bd
  escenarios/
    00_auditoria.sh
    01_tenancy.sh
    02_persona.sh
    03_estructura.sh
    04_reporte.sh
    05_estados.sh
    06_evangelismo.sh
    07_calendario.sh
    08_finanzas.sh
    09_dashboards.sh
    10_configuracion.sh
  .env.ejemplo           # plantilla, sin credenciales
```

`.env` va al `.gitignore`. `.env.ejemplo` se commitea con las claves vacías (Requisito 2.4).

## La biblioteca

```bash
# lib/http.sh
: "${SUPABASE_URL:?Falta SUPABASE_URL}"
: "${ANON_KEY:?Falta ANON_KEY}"

get() {
  local ruta="$1" jwt="$2"
  curl -s -X GET "${SUPABASE_URL}/rest/v1/${ruta}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${jwt}"
}

post() {
  local ruta="$1" jwt="$2" cuerpo="$3"
  curl -s -X POST "${SUPABASE_URL}/rest/v1/${ruta}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${jwt}" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=representation" \
    -d "${cuerpo}"
}

rpc() {
  local funcion="$1" jwt="$2" cuerpo="${3:-\{\}}"
  curl -s -X POST "${SUPABASE_URL}/rest/v1/rpc/${funcion}" \
    -H "apikey: ${ANON_KEY}" \
    -H "Authorization: Bearer ${jwt}" \
    -H "Content-Type: application/json" \
    -d "${cuerpo}"
}
```

`${VAR:?mensaje}` aborta si falta la variable, con un mensaje claro en vez de un 401 confuso (Requisito 2.3).

`apikey` es el `ANON_KEY` siempre. El `Authorization` lleva el JWT del rol. **Nunca el `SERVICE_ROLE_KEY`** (Requisito 3.5): ese salta RLS, así que toda prueba de permisos con él pasaría siempre y no probaría nada.

```bash
# lib/auth.sh
obtener_jwt() {
  local email="$1" password="$2"
  curl -s -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" \
  | jq -r '.access_token'
}
```

```bash
# lib/assert.sh
FALLOS=0
PRUEBAS=0

_ok()    { PRUEBAS=$((PRUEBAS+1)); echo "  OK   $1"; }
_fallo() { PRUEBAS=$((PRUEBAS+1)); FALLOS=$((FALLOS+1)); echo "  FALLO $1"; echo "       esperaba: $2"; echo "       recibio:  $3"; }

assert_igual() {
  local desc="$1" esperado="$2" recibido="$3"
  [ "$esperado" = "$recibido" ] && _ok "$desc" || _fallo "$desc" "$esperado" "$recibido"
}

assert_vacio() {
  local desc="$1" recibido="$2"
  local n; n=$(echo "$recibido" | jq 'length' 2>/dev/null || echo "-1")
  [ "$n" = "0" ] && _ok "$desc" || _fallo "$desc" "lista vacia []" "$recibido"
}

# Verifica que la operacion FALLA con un codigo de regla especifico
assert_error() {
  local desc="$1" codigo_regla="$2" recibido="$3"
  echo "$recibido" | grep -q "$codigo_regla" \
    && _ok "$desc" \
    || _fallo "$desc" "error $codigo_regla" "$recibido"
}

resumen() {
  echo
  echo "=== ${PRUEBAS} pruebas, ${FALLOS} fallos ==="
  [ "$FALLOS" -eq 0 ] || exit 1     # Req 2.5
}
```

`assert_error` busca el código de la regla (`ROL_AUTOASIGNACION`, `CARGO_TIPO_A_DUPLICADO`) y no el texto. Por eso [00-fundacion](../00-fundacion/design.md) exige el formato `NOMBRE_REGLA: explicación`: el prefijo es contrato, el texto puede cambiar.

## Escenarios

### Aislamiento — el que más importa

```bash
# escenarios/01_tenancy.sh
echo "== Tenancy y aislamiento =="

JWT_LIDER_MONTERO=$(obtener_jwt "$LIDER_MONTERO_EMAIL" "$LIDER_MONTERO_PASS")
JWT_LIDER_SC=$(obtener_jwt "$LIDER_SC_EMAIL" "$LIDER_SC_PASS")
JWT_PASTOR=$(obtener_jwt "$PASTOR_EMAIL" "$PASTOR_PASS")
JWT_INVITADO=$(obtener_jwt "$INVITADO_EMAIL" "$INVITADO_PASS")

# Req 4.1 y 4.2: lista vacia, NO un 403
r=$(get "persona?iglesia_id=eq.${IGLESIA_SC_ID}" "$JWT_LIDER_MONTERO")
assert_vacio "Lider de Montero no ve personas de Santa Cruz" "$r"

r=$(get "casa_de_paz?iglesia_id=eq.${IGLESIA_SC_ID}" "$JWT_LIDER_MONTERO")
assert_vacio "Lider de Montero no ve CdP de Santa Cruz" "$r"

r=$(get "finanzas_ingreso?iglesia_id=eq.${IGLESIA_SC_ID}" "$JWT_LIDER_MONTERO")
assert_vacio "Lider de Montero no ve ingresos de Santa Cruz" "$r"

# Sin filtro: solo lo suyo
r=$(get "persona?select=iglesia_id" "$JWT_LIDER_MONTERO")
n=$(echo "$r" | jq "[.[] | select(.iglesia_id != \"${IGLESIA_MONTERO_ID}\")] | length")
assert_igual "Sin filtro, el lider de Montero solo recibe su iglesia" "0" "$n"

# Req 4.3: SECURITY DEFINER no permite fugas
r=$(rpc "fn_dashboard_lider_cdp" "$JWT_LIDER_MONTERO" "{\"p_casa_de_paz_id\":\"${CDP_SC_ID}\"}")
assert_error "Dashboard de una CdP ajena falla" "DASHBOARD_FUERA_DE_ALCANCE" "$r"

r=$(rpc "fn_total_familias" "$JWT_LIDER_MONTERO" "{\"p_iglesia_id\":\"${IGLESIA_SC_ID}\"}")
assert_error "Conteo de familias de otra iglesia falla" "IGLESIA_FUERA_DE_ALCANCE" "$r"

# Pastor: las dos
r=$(rpc "fn_mis_iglesias_detalle" "$JWT_PASTOR")
assert_igual "El pastor ve sus 2 iglesias" "2" "$(echo "$r" | jq 'length')"

# Lider de CdP: una
r=$(rpc "fn_mis_iglesias_detalle" "$JWT_LIDER_MONTERO")
assert_igual "El lider de CdP ve 1 iglesia" "1" "$(echo "$r" | jq 'length')"

# Invitado: lee, no escribe
r=$(get "persona?limit=1" "$JWT_INVITADO")
assert_igual "El invitado puede leer" "1" "$(echo "$r" | jq 'length')"

r=$(post "persona" "$JWT_INVITADO" '{"primer_nombre":"X","primer_apellido":"Y","sexo":"M","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}')
assert_error "El invitado no puede escribir" "42501" "$r"

# Req 6.5 de 01-tenancy: nadie se auto-asigna
MI_USER=$(echo "$JWT_LIDER_MONTERO" | cut -d. -f2 | base64 -d 2>/dev/null | jq -r '.sub')
r=$(post "usuario_rol" "$JWT_LIDER_MONTERO" \
    "{\"usuario_id\":\"${MI_USER}\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\",\"rol\":\"SUPERVISOR_VISION_ACCION\"}")
assert_error "Nadie se auto-asigna un rol" "ROL_AUTOASIGNACION" "$r"
```

**Nota (2026-07-17):** este archivo usa el modelo de roles anterior (`ADMIN`, `INVITADO`) en varios lugares (`JWT_INVITADO` y el escenario que le sigue). Con los roles de dominio de [01-tenancy-iglesias](../01-tenancy-iglesias/design.md) ya no existe un rol `INVITADO` transversal, así que ese escenario completo (líneas de `JWT_INVITADO` en adelante) necesita rediseñarse: probablemente como "un `LIDER_CDP` de otra iglesia puede leer pero no escribir fuera de su alcance", en vez de un rol de solo lectura dedicado. **Pendiente para cuando se trabaje [12-pruebas-curl/tasks.md](tasks.md).**

La prueba de "lista vacía, no 403" es sutil y es la que valida el Requisito 4.4 de [01-tenancy](../01-tenancy-iglesias/requirements.md). Un 403 confirma que el recurso existe; `[]` no dice nada. Es la diferencia entre "no podés ver esa CdP" y "no hay tal CdP".

### Estados

```bash
# escenarios/05_estados.sh
echo "== Estados SSVA =="

JWT_LIDER=$(obtener_jwt "$LIDER_MONTERO_EMAIL" "$LIDER_MONTERO_PASS")

estado_de() {
  get "persona_estado?persona_id=eq.$1&fecha_fin=is.null&select=estado:estado_id(sigla)" "$JWT_LIDER" \
  | jq -r '.[0].estado.sigla'
}

# --- NC -> CRE con 2 visitas (Req 5.1) ---
P=$(post "persona" "$JWT_LIDER" '{"primer_nombre":"Ana","primer_apellido":"Test","sexo":"F","fecha_nacimiento":"2000-01-01","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
rpc "fn_transicionar_estado" "$JWT_LIDER" "{\"p_persona_id\":\"$P\",\"p_sigla\":\"NC\",\"p_fecha\":\"2026-01-01\",\"p_motivo\":\"prueba\",\"p_automatico\":false}" >/dev/null

R1=$(post "casa_de_paz_reporte" "$JWT_LIDER" '{"casa_de_paz_id":"'"${CDP_MONTERO_ID}"'","fecha_reunion":"2026-01-07","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R1\",\"persona_id\":\"$P\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
assert_igual "Con 1 visita sigue NC" "NC" "$(estado_de "$P")"

R2=$(post "casa_de_paz_reporte" "$JWT_LIDER" '{"casa_de_paz_id":"'"${CDP_MONTERO_ID}"'","fecha_reunion":"2026-01-14","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R2\",\"persona_id\":\"$P\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
assert_igual "Con 2 visitas consecutivas pasa a CRE" "CRE" "$(estado_de "$P")"

# Membresia automatica (Req 9.1)
r=$(get "casa_de_paz_membresia?persona_id=eq.$P&fecha_fin=is.null" "$JWT_LIDER")
assert_igual "2 visitas crean membresia" "1" "$(echo "$r" | jq 'length')"

# --- El menor no avanza (Req 5.4) ---
M=$(post "persona" "$JWT_LIDER" '{"primer_nombre":"Nino","primer_apellido":"Test","sexo":"M","fecha_nacimiento":"2018-01-01","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
rpc "fn_transicionar_estado" "$JWT_LIDER" "{\"p_persona_id\":\"$M\",\"p_sigla\":\"NC\",\"p_fecha\":\"2026-01-01\",\"p_motivo\":\"prueba\",\"p_automatico\":false}" >/dev/null
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R1\",\"persona_id\":\"$M\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R2\",\"persona_id\":\"$M\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
assert_igual "Un menor de 12 con 2 visitas sigue NC" "NC" "$(estado_de "$M")"

# --- RE antes que CRE (Req 6.1, riesgo de orden) ---
V=$(post "persona" "$JWT_LIDER" '{"primer_nombre":"Vuelve","primer_apellido":"Test","sexo":"F","fecha_nacimiento":"1990-01-01","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
RV=$(post "casa_de_paz_reporte" "$JWT_LIDER" '{"casa_de_paz_id":"'"${CDP_MONTERO_ID}"'","fecha_reunion":"2025-09-01","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$RV\",\"persona_id\":\"$V\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
# 120 dias despues
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R1\",\"persona_id\":\"$V\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
assert_igual "Vuelve tras 120 dias -> RE" "RE" "$(estado_de "$V")"

# --- SIM -> NC es manual (Req 4.3) ---
S=$(post "persona" "$JWT_LIDER" '{"primer_nombre":"Sim","primer_apellido":"Test","sexo":"M","fecha_nacimiento":"1990-01-01","iglesia_id":"'"${IGLESIA_MONTERO_ID}"'"}' | jq -r '.[0].id')
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R1\",\"persona_id\":\"$S\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
post "casa_de_paz_asistencia" "$JWT_LIDER" "{\"reporte_id\":\"$R2\",\"persona_id\":\"$S\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\"}" >/dev/null
assert_igual "Un SIM no avanza solo con asistencia" "SIM" "$(estado_de "$S")"

# --- Estado bloqueado (Req 1.3) ---
r=$(rpc "fn_transicionar_estado" "$JWT_LIDER" "{\"p_persona_id\":\"$P\",\"p_sigla\":\"DA\",\"p_fecha\":\"2026-01-20\",\"p_motivo\":\"prueba\",\"p_automatico\":false}")
assert_error "No se puede transicionar a DA en el Modulo 1" "ESTADO_NO_DISPONIBLE" "$r"
```

### Configuración

```bash
# escenarios/10_configuracion.sh
echo "== Configuracion =="

JWT_SUP=$(obtener_jwt "$SUPERVISOR_EMAIL" "$SUPERVISOR_PASS")
JWT_SUBLIDER=$(obtener_jwt "$SUBLIDER_EMAIL" "$SUBLIDER_PASS")

set_config() {
  rpc "fn_set_configuracion" "$JWT_SUP" \
    "{\"p_iglesia_id\":\"${IGLESIA_MONTERO_ID}\",\"p_codigo\":\"$1\",\"p_valor\":\"$2\"}"
}

# --- LA prueba: la restriccion vive en la base, no en el front (Req 6.2) ---
set_config "SUBLIDER_VE_OFRENDAS" "false" >/dev/null
r=$(get "finanzas_ingreso?casa_de_paz_id=eq.${CDP_MONTERO_ID}" "$JWT_SUBLIDER")
assert_vacio "Con la config apagada, el sublider NO ve ingresos por API directa" "$r"

set_config "SUBLIDER_VE_OFRENDAS" "true" >/dev/null
r=$(get "finanzas_ingreso?casa_de_paz_id=eq.${CDP_MONTERO_ID}" "$JWT_SUBLIDER")
n=$(echo "$r" | jq 'length')
[ "$n" -gt 0 ] && _ok "Con la config prendida, el sublider SI ve ingresos" \
               || _fallo "Con la config prendida, el sublider SI ve ingresos" ">0" "$n"

# --- Rango y tipo (Req 6.3, 6.4) ---
r=$(set_config "VISITAS_PARA_CRE" "0")
assert_error "Valor fuera de rango se rechaza" "CONFIG_FUERA_DE_RANGO" "$r"

r=$(set_config "VISITAS_PARA_CRE" "abc")
assert_error "Valor de tipo invalido se rechaza" "CONFIG_TIPO_INVALIDO" "$r"

r=$(set_config "SUBLIDER_VE_OFRENDAS" "si")
assert_error "Booleano con 'si' se rechaza" "CONFIG_TIPO_INVALIDO" "$r"

# --- Sin permiso (Req 1.2) ---
r=$(rpc "fn_set_configuracion" "$JWT_SUBLIDER" \
   "{\"p_iglesia_id\":\"${IGLESIA_MONTERO_ID}\",\"p_codigo\":\"VISITAS_PARA_CRE\",\"p_valor\":\"5\"}")
assert_error "Un sublider no configura" "CONFIG_SIN_PERMISO" "$r"

# --- Fuera de alcance (Req 1.5) ---
r=$(rpc "fn_set_configuracion" "$JWT_SUP" \
   "{\"p_iglesia_id\":\"${IGLESIA_SC_ID}\",\"p_codigo\":\"VISITAS_PARA_CRE\",\"p_valor\":\"5\"}")
assert_error "El supervisor de Montero no configura Santa Cruz" "CONFIG_FUERA_DE_ALCANCE" "$r"
```

> `fn_set_configuracion` no aparece en [10-panel-supervisor](../10-panel-supervisor/design.md): ahí la escritura va por `INSERT`/`UPSERT` sobre `configuracion_valor` con RLS. Hace falta una RPC de escritura para que el error salga con código de regla y no como violación de política. **Agregar a las tareas de [10](../10-panel-supervisor/tasks.md).**

### Integridad

```bash
# escenarios/00_auditoria.sh -- fragmento
echo "== Integridad =="

JWT=$(obtener_jwt "$LIDER_MONTERO_EMAIL" "$LIDER_MONTERO_PASS")

# Req 7.1: DELETE bloqueado
r=$(curl -s -X DELETE "${SUPABASE_URL}/rest/v1/persona?id=eq.${PERSONA_TEST_ID}" \
    -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${JWT}")
assert_error "DELETE fisico esta bloqueado" "P0001\|42501" "$r"

# Req 7.3 y 7.4: auditoria automatica, cliente ignorado
FALSO="00000000-0000-0000-0000-000000000000"
r=$(post "persona" "$JWT" "{\"primer_nombre\":\"Aud\",\"primer_apellido\":\"Test\",\"sexo\":\"M\",\"iglesia_id\":\"${IGLESIA_MONTERO_ID}\",\"creado_por\":\"${FALSO}\"}")
CP=$(echo "$r" | jq -r '.[0].creado_por')
[ "$CP" != "$FALSO" ] && [ "$CP" != "null" ] \
  && _ok "creado_por se calcula en el servidor e ignora al cliente" \
  || _fallo "creado_por se calcula en el servidor" "!= $FALSO" "$CP"

# Req 7.2: borrado logico oculta
ID=$(echo "$r" | jq -r '.[0].id')
curl -s -X PATCH "${SUPABASE_URL}/rest/v1/persona?id=eq.${ID}" \
  -H "apikey: ${ANON_KEY}" -H "Authorization: Bearer ${JWT}" \
  -H "Content-Type: application/json" -d '{"fecha_eliminacion":"now()"}' >/dev/null
r=$(get "persona?id=eq.${ID}" "$JWT")
assert_vacio "Una fila con borrado logico desaparece de las lecturas" "$r"
```

## Auditoría del esquema

Las cuatro consultas de [11-esquema-bd](../11-esquema-bd/design.md#auditoría-del-esquema) van en `auditoria.sql`. No se pueden correr por PostgREST — consultan catálogos del sistema — así que van por `psql`:

```bash
correr_auditoria() {
  local salida
  salida=$(psql "$DATABASE_URL" -t -A -f auditoria.sql)
  if [ -z "$(echo "$salida" | tr -d '[:space:]')" ]; then
    _ok "Auditoria de esquema: 0 filas en las 4 consultas"
  else
    _fallo "Auditoria de esquema" "0 filas" "$salida"
  fi
}
```

Es el único lugar donde el arnés usa una conexión directa. No es una prueba de permisos, así que no viola el Requisito 3.5.

## Decisiones y descartes

| Decisión | Alternativa descartada | Razón |
|----------|----------------------|-------|
| curl puro | Cliente JS o pytest | El objetivo es probar la API como la ve un atacante, sin capa que la suavice. Y no hay que instalar nada. |
| JWT por rol | `SERVICE_ROLE_KEY` | El service role salta RLS: toda prueba de permisos pasaría y no probaría nada. |
| `assert_error` por código de regla | Por texto del mensaje | El prefijo es contrato; el texto puede cambiar sin romper las pruebas. |
| `assert_vacio` y no `assert_403` | Esperar 403 | Un 403 confirma que el recurso existe. `[]` no filtra nada. |
| Auditoría por `psql` | Por PostgREST | Consultan `pg_tables` y `pg_proc`, que no están expuestos. |
| Un script por área | Un archivo gigante | Se corre un área sola mientras se la desarrolla. |

## Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| Las pruebas corren contra producción y crean personas de prueba. | El Requisito 2.7 lo prohíbe. `correr.sh` verifica que `SUPABASE_URL` no sea el de producción y aborta si lo es. Tarea 1.5. |
| Las pruebas dejan basura y la segunda corrida falla por duplicados. | Cada escenario crea sus datos con nombres únicos por corrida (sufijo de timestamp pasado por variable) o limpia al final. Decidir en la tarea 1.6. |
| El `.env` con credenciales se commitea. | En `.gitignore`. Solo se commitea `.env.ejemplo`. |
| Alguien usa `SERVICE_ROLE_KEY` para "que pase la prueba". | Es el peor error posible acá: convierte todo el arnés en teatro. `correr.sh` verifica que la variable ni siquiera esté definida en el entorno. Tarea 1.4. |
| Las pruebas pasan pero el front igual filtra datos. | El arnés prueba la API. Si el front tiene un bug, es otro problema — pero ningún dato sale de la API que no debiera. |
