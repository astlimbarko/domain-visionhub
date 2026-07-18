# Tareas — Pruebas con curl

## 1. Andamiaje

- [ ] 1.1 Crear la estructura de directorios de [design.md](design.md#estructura). — *Req 2.1*
- [ ] 1.2 Crear `.env.ejemplo` con las claves vacías y agregar `.env` al `.gitignore`. — *Req 2.4*
- [ ] 1.3 Crear `lib/http.sh`, `lib/auth.sh`, `lib/assert.sh`. — *Req 2.2*
- [ ] 1.4 **`correr.sh` debe abortar si `SERVICE_ROLE_KEY` está definida en el entorno.** Usarla convierte todo el arnés en teatro: salta RLS y toda prueba de permisos pasa. — *Req 3.5*
- [ ] 1.5 `correr.sh` debe abortar si `SUPABASE_URL` apunta a producción. — *Req 2.7*
- [ ] 1.6 **Decidir** la estrategia de limpieza: sufijo único por corrida, o limpieza al final. Sin esto, la segunda corrida falla por duplicados. — *Riesgo*
- [ ] 1.7 Verificar que `correr.sh` devuelve 1 si algo falla y 0 si todo pasa. — *Req 2.5*
- [ ] 1.8 Verificar que el fallo informa qué esperaba y qué recibió. — *Req 2.6*

## 2. Usuarios de prueba

- [ ] 2.1 Crear en Supabase Auth un usuario por rol: admin técnico, pastor, supervisor, líder de red, líder de CdP, sublíder, invitado. — *Req 3.3*
- [ ] 2.2 Crear los equivalentes de la segunda iglesia, para probar el aislamiento. — *Req 3.4*
- [ ] 2.3 Vincular cada usuario a su persona y asignarle su cargo. — *Req 3.1*
- [ ] 2.4 Verificar que `obtener_jwt` devuelve un token válido para cada uno. — *Req 3.1*

## 3. Escenarios

- [ ] 3.1 `00_auditoria.sh` — las 4 consultas de esquema + integridad. — *Req 1.5, 7*
- [ ] 3.2 `01_tenancy.sh` — aislamiento, roles, alta en cadena. — *Req 4*
- [ ] 3.3 `02_persona.sh` — nombres, apellido de casada, parentela, conteo de familias. — *Req 5.10*
- [ ] 3.4 `03_estructura.sh` — cargos, unicidad de vigentes, membresía. — *Req 1.1*
- [ ] 3.5 `04_reporte.sh` — reporte, asistencia por persona, totales. — *Req 5.9*
- [ ] 3.6 `05_estados.sh` — las transiciones. — *Req 5.1 a 5.8*
- [ ] 3.7 `06_evangelismo.sh` — metas, tasa, prioridad de la asignada. — *Req 1.1*
- [ ] 3.8 `07_calendario.sh` — rangos, retiros, 29 de febrero. — *Req 1.1*
- [ ] 3.9 `08_finanzas.sh` — monedas separadas, upsert de ingresos. — *Req 1.1*
- [ ] 3.10 `09_dashboards.sh` — las 5 RPC + pruebas de fuga. — *Req 4.3*
- [ ] 3.11 `10_configuracion.sh` — booleanos en sus dos estados, rangos, tipos. — *Req 6*

## 4. Las pruebas que no pueden faltar

Si alguna de estas falla, el sistema no sale a producción.

- [ ] 4.1 **Fuga entre iglesias:** líder de Montero pide personas, CdP, reportes e ingresos de Santa Cruz. Los cuatro deben devolver `[]`. — *Req 4.1, 4.5*
- [ ] 4.2 **Lista vacía y no 403.** Un 403 confirma que el recurso existe; `[]` no filtra nada. — *Req 4.2*
- [ ] 4.3 **Fuga por `SECURITY DEFINER`:** pasar un UUID de otra iglesia a cada función de dashboard y a `fn_total_familias`. Todas deben fallar con `*_FUERA_DE_ALCANCE`. — *Req 4.3*
- [ ] 4.4 **Aislamiento en toda tabla con `iglesia_id`.** Recorrer las 40. — *Req 4.4*
- [ ] 4.5 **`SUBLIDER_VE_OFRENDAS = false` bloquea por API directa**, no solo en el front. — *Req 6.2*
- [ ] 4.6 **`DELETE` bloqueado** en toda tabla de dominio. — *Req 7.1*
- [ ] 4.7 **`creado_por` enviado por el cliente se ignora.** — *Req 7.4*
- [ ] 4.8 **Auto-asignación de rol falla** con `ROL_AUTOASIGNACION`. — *01-tenancy Req 6.5*

## 5. Reglas de negocio

- [ ] 5.1 NC → CRE con 2 visitas consecutivas. — *Req 5.1*
- [ ] 5.2 Con 1 visita sigue NC. — *Req 5.1*
- [ ] 5.3 Menor de 12 con 2 visitas sigue NC. — *Req 5.2*
- [ ] 5.4 Vino, faltó, vino → sigue NC (la racha se rompió). Distingue "consecutivas" de "últimas N". — *05-estados Req 5.1*
- [ ] 5.5 Ausente 120 días y vuelve → RE. — *Req 5.3*
- [ ] 5.6 **RE antes que CRE:** NC ausente 120 días que vuelve queda RE, no CRE. — *Req 5.4*
- [ ] 5.7 Sin asistencia previa no hay RE. — *05-estados Req 6.5*
- [ ] 5.8 SIM con 2 visitas sigue SIM: la conversión es manual. — *05-estados Req 4.3*
- [ ] 5.9 Transicionar a DA falla con `ESTADO_NO_DISPONIBLE`. — *05-estados Req 1.3*
- [ ] 5.10 2 visitas crean membresía principal. — *Req 5.5*
- [ ] 5.11 8 visitas a otra CdP crean propuesta y **no** migran. — *Req 5.6*
- [ ] 5.12 Cambiar `VISITAS_PARA_CRE` a 4 cambia el comportamiento siguiente. — *Req 5.7*
- [ ] 5.13 Bajarlo de 4 a 2 **no** promueve retroactivamente. — *Req 5.8*
- [ ] 5.14 Totales de asistencia: 3 menores y 2 mayores, con uno clasificado por `es_menor`. — *Req 5.9*
- [ ] 5.15 Familia de 4 (padres + 2 hijos) da **un** núcleo, no cuatro. — *Req 5.10*
- [ ] 5.16 Persona sin relaciones da un núcleo de uno. — *02-persona Req 9.6*

## 6. Casos límite

- [ ] 6.1 Retiro del viernes 18:00 al domingo 12:00 se acepta. — *07-calendario Req 2.6*
- [ ] 6.2 29 de febrero en un año no bisiesto no rompe el calendario. — *07-calendario Req 4.7*
- [ ] 6.3 Evento que empieza antes del rango aparece igual. — *07-calendario Req 3.2*
- [ ] 6.4 `0.1 + 0.2` sobre `NUMERIC` da exactamente `0.3`. — *08-finanzas Req 1.5*
- [ ] 6.5 Registrar 500 y corregir a 550 deja **una** fila con 550. — *08-finanzas Req 6.5*
- [ ] 6.6 Metas con períodos solapados fallan. — *06-evangelismo Req 4.9*
- [ ] 6.7 Tasa con meta 0 devuelve `NULL` y no explota. — *06-evangelismo Req 5.5*
- [ ] 6.8 Dos reportes de la misma CdP y fecha: el segundo falla. — *04-reporte Req 1.3*
- [ ] 6.9 Segundo cargo Tipo A vigente falla. — *03-estructura Req 4.3*
- [ ] 6.10 Segundo líder vigente de la misma CdP falla. — *03-estructura Req 7.1*
- [ ] 6.11 Ciclo de iglesias falla con `IGLESIA_CICLO`. — *01-tenancy Req 1.5*
- [ ] 6.12 Relación familiar entre iglesias distintas falla. — *02-persona Req 7.9*

## 7. Pendientes que salieron de acá

- [ ] 7.1 **Agregar `fn_set_configuracion` a [10-panel-supervisor](../10-panel-supervisor/tasks.md).** Ese diseño resuelve la escritura con RLS sobre `configuracion_valor`, pero entonces el error sale como violación de política y no con código de regla. Hace falta una RPC de escritura. — *Req 6.3, 6.4*

## Dependencias

- [11-esquema-bd](../11-esquema-bd/) aplicado, con semillas y datos de prueba.
- `test_03_reportes.sql` con 52 semanas de asistencia por persona: sin eso, las pruebas de estado no corren.

## Bloquea a

La revisión de la IU y la conexión del frontend. Ningún front se conecta a una API que no pasó el arnés.
