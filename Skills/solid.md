# Principios SOLID para Sistemas con IA Agéntica

Guía de arquitectura para construir sistemas donde agentes de IA (autónomos o semi-autónomos) colaboran, ejecutan tareas y toman decisiones dentro de un ecosistema de software.

---

## Single Responsibility Principle (SRP) — Principio de Responsabilidad Única

### En sistemas tradicionales
Una clase/módulo debe tener una sola razón para cambiar.

### En sistemas con IA agéntica

**Cada agente debe tener un único propósito bien definido.**

Un agente no debe ser responsable de múltiples dominios no relacionados. Si un agente hace de todo (consulta bases de datos, escribe archivos, decide estrategias, evalúa resultados), se vuelve incontrolable, impredecible y difícil de depurar.

#### Cómo aplicarlo

- Define el propósito del agente en una sola frase. Si usas "y" en esa frase, probablemente tenga más de una responsabilidad.
- Separar por dominio de conocimiento: un agente para finanzas, otro para marketing, otro para atención al cliente.
- Separar por tipo de operación: un agente para leer/consultar, otro para escribir/ejecutar, otro para supervisar/validar.
- Separar por contexto: un agente para el contexto del usuario, otro para el contexto del sistema, otro para el contexto del negocio.

#### Ejemplo práctico

```
❌ Agente Único
- Analiza datos
- Decide acciones
- Ejecuta cambios
- Evalúa resultados
-> Se vuelve caja negra imposible de depurar

✅ Agentes separados
- AgenteAnalista: solo analiza datos y emite reportes
- AgentePlanificador: solo decide qué acciones ejecutar basado en reportes
- AgenteEjecutor: solo ejecuta acciones planificadas
- AgenteEvaluador: solo mide resultados y retroalimenta
-> Cada agente tiene un propósito y se puede mejorar/monitorear individualmente
```

#### Señales de que estás violando SRP

- El agente recibe prompts extremadamente largos porque debe hacer muchas cosas distintas.
- El agente tiene múltiples "modos" de operación.
- Si un agente falla, no sabes qué parte de su responsabilidad falló.
- Modificar el comportamiento en un área afecta el comportamiento en otra.

---

## Open/Closed Principle (OCP) — Principio de Abierto/Cerrado

### En sistemas tradicionales
Las entidades deben estar abiertas para extensión, pero cerradas para modificación.

### En sistemas con IA agéntica

**El sistema debe poder agregar nuevos agentes, herramientas, capacidades y flujos sin modificar el código existente.**

Los agentes son impredecibles por naturaleza. Si cada nuevo comportamiento requiere reescribir el núcleo del sistema, el proyecto muere. El sistema debe estar diseñado para que agregar un agente nuevo no implique tocar el código de los agentes existentes ni del orquestador central.

#### Cómo aplicarlo

- **Arquitectura basada en plugins/herramientas:** Los agentes descubren capacidades disponibles a través de un registro de herramientas. No hay un `if` por cada herramienta en el código del agente.
- **Interfaces de agente:** Define una interfaz/contrato base que todo agente implementa. El orquestador habla con la interfaz, no con el agente concreto.
- **Registro dinámico de agentes:** Nuevos agentes se registran automáticamente en un catálogo. El orquestador descubre agentes en tiempo de ejecución.
- **Contexto inyectado:** El conocimiento que necesita un agente se le inyecta desde fuera (prompts, RAG, tools), no está hardcodeado en su lógica.

#### Ejemplo práctico

```
// MAL - Modificar el orquestador cada vez que agregas un agente
if (tipo === "finanzas") usarAgenteFinanzas()
if (tipo === "marketing") usarAgenteMarketing()
if (tipo === "soporte") usarAgenteSoporte()
// Si agregas "ventas": modificas el orquestador -> VIOLA OCP

// BIEN - Registro de agentes, el orquestador no cambia
const agentes = catalogo.obtenerTodos()
const agente = catalogo.encontrarPorCapacidad(tipo)
agente.ejecutar(contexto)
// Nuevo agente solo se registra en el catálogo, el orquestador no se toca
```

#### Señales de que estás violando OCP

- El orquestador central tiene un `switch` o `if/else` por cada agente o capacidad.
- Agregar una nueva funcionalidad implica modificar 3+ archivos existentes.
- Existe un archivo "central" que crece sin control porque agrega lógica para cada nuevo caso.
- Los agentes tienen dependencias directas entre sí en lugar de pasar por una interfaz común.

---

## Liskov Substitution Principle (LSP) — Principio de Sustitución de Liskov

### En sistemas tradicionales
Los subtipos deben poder sustituir a sus tipos base sin alterar el comportamiento correcto del programa.

### En sistemas con IA agéntica

**Cualquier agente que implemente un contrato (interfaz, protocolo, rol) debe poder reemplazar a otro agente del mismo tipo sin romper el sistema.**

Si defines un "AgenteDeBusqueda", cualquier implementación concreta (AgenteBusquedaSQL, AgenteBusquedaVectorial, AgenteBusquedaWeb) debe poder intercambiarse sin que el sistema falle ni se comporte de manera impredecible.

#### Cómo aplicarlo

- **Define contratos de entrada/salida estrictos:** Todos los agentes de una misma categoría reciben el mismo tipo de contexto y devuelven el mismo tipo de resultado (aunque la lógica interna sea radicalmente distinta).
- **Sin efectos secundarios ocultos:** Un agente que reemplaza a otro no debe tener efectos secundarios que el otro no tenía. Si el agente original solo lee y el nuevo también escribe, no son intercambiables.
- **Misma semántica en errores:** Todos los agentes de un mismo tipo deben fallar de la misma manera (mismos códigos de error, mismos tipos de excepción).
- **Precondiciones y postcondiciones consistentes:** Un agente no puede exigir más requisitos de entrada que los definidos en su contrato, y no debe prometer menos en su salida.

#### Ejemplo práctico

```
Contrato: AgenteReportador
  Entrada: { periodo: string, tipo: string }
  Salida: { datos: array, total: number, errores: string[] }

✅ AgenteReportadorSQL
  Entrada: { periodo: "2024-01", tipo: "ventas" }
  Salida: { datos: [...], total: 15000, errores: [] }

✅ AgenteReportadorNoSQL
  Entrada: { periodo: "2024-01", tipo: "ventas" }
  Salida: { datos: [...], total: 15000, errores: [] }

❌ AgenteReportadorExperimental
  Entrada: { periodo: "2024-01", tipo: "ventas", configuracionExtra: {...} }
  // Pide más de lo que el contrato define -> ROMPE LSP

❌ AgenteReportadorMejorado
  Salida: { datos: [...], total: 15000 }
  // No devuelve errores como el contrato exige -> ROMPE LSP
```

#### Señales de que estás violando LSP

- El orquestador tiene que preguntar "qué tipo de agente eres" antes de enviarle datos.
- El orquestador trata diferente a agentes que supuestamente son del mismo tipo.
- Hay `if` que verifican la clase/instancia del agente antes de llamarlo.
- Un agente falla porque recibió datos que otro agente del mismo tipo procesó correctamente.
- Reemplazar un agente por otro del mismo tipo causa comportamientos inesperados en otras partes del sistema.

---

## Interface Segregation Principle (ISP) — Principio de Segregación de Interfaces

### En sistemas tradicionales
Los clientes no deben ser forzados a depender de interfaces que no usan.

### En sistemas con IA agéntica

**Los agentes no deben recibir herramientas, datos o capacidades que no necesitan para cumplir su propósito.**

Un agente de "lectura de reportes" no necesita tener acceso a herramientas de escritura en base de datos. Un agente de "atención al cliente" no necesita acceso a herramientas financieras sensibles. Dar más capacidades de las necesarias a un agente es un riesgo de seguridad, predictibilidad y calidad.

#### Cómo aplicarlo

- **Principio de mínimo privilegio:** Cada agente recibe exactamente las herramientas que necesita para cumplir su responsabilidad y ninguna más.
- **Interfaces específicas por rol:** No existe una interfaz "AgenteToolset" gigante con 50 herramientas donde cada agente solo usa 5. Existen interfaces pequeñas: `HerramientasDeLectura`, `HerramientasDeEscritura`, `HerramientasDeConsulta`, `HerramientasDeNotificacion`.
- **Segmentación del contexto:** El contexto/prompt que recibe un agente solo contiene la información relevante para su tarea. No se le pasa todo el contexto del sistema.
- **Herramientas con alcance limitado:** Si una herramienta tiene 10 parámetros pero un agente solo necesita 3, crea una versión simplificada para ese agente.

#### Ejemplo práctico

```
❌ Interfaz única enorme
AgenteBase {
  herramientas: [
    leerBaseDatos(),
    escribirBaseDatos(),
    eliminarBaseDatos(),
    leerArchivos(),
    escribirArchivos(),
    enviarEmail(),
    ejecutarComando(),
    llamarAPIExterna(),
    ...
  ]
}
// El AgenteLectorDeReportes recibe escribirBaseDatos, eliminarBaseDatos, ejecutarComando...
// Capacidades que no necesita y que son un riesgo

✅ Interfaces segregadas
HerramientasLectura { leerBaseDatos(), leerArchivos() }
HerramientasEscritura { escribirBaseDatos(), escribirArchivos() }
HerramientasComunicacion { enviarEmail(), notificar() }
HerramientasEjecucion { ejecutarComando(), llamarAPIExterna() }

AgenteLectorDeReportes -> solo recibe HerramientasLectura
AgenteGeneradorDeReportes -> recibe HerramientasLectura + HerramientasEscritura
AgenteNotificador -> solo recibe HerramientasComunicacion
```

#### Señales de que estás violando ISP

- El prompt del agente incluye herramientas que nunca usa pero están disponibles.
- Un agente ejecutó accidentalmente una herramienta que no debería tener disponible.
- Modificar una herramienta afecta a agentes que ni siquiera la usan.
- La interfaz de herramientas tiene métodos que lanzan "no implementado" o "no soportado".
- Tienes un solo archivo de herramientas que importan todos los agentes sin distinción.

---

## Dependency Inversion Principle (DIP) — Principio de Inversión de Dependencias

### En sistemas tradicionales
Los módulos de alto nivel no deben depender de módulos de bajo nivel. Ambos deben depender de abstracciones.

### En sistemas con IA agéntica

**Los agentes y orquestadores no deben depender directamente de implementaciones concretas (APIs específicas, modelos de IA concretos, bases de datos específicas). Deben depender de abstracciones.**

Si tu sistema depende directamente de GPT-4 y mañana quieres usar Claude o Gemini, cambiar de modelo no debería implicar reescribir agentes. Si tu sistema depende directamente de una base de datos vectorial específica y quieres migrar, no deberías tener que modificar la lógica de los agentes.

#### Cómo aplicarlo

- **Abstracción del LLM:** Crea una interfaz `ModeloDeIA` que define métodos como `generar()`, `analizar()`, `resumir()`. Las implementaciones concretas son `ModeloOpenAI`, `ModeloAnthropic`, `ModeloLocal`. Los agentes hablan con la interfaz, no con el modelo concreto.
- **Abstracción de almacenamiento:** Define interfaces para memoria, RAG, base de datos. Los agentes no escriben SQL directamente, llaman a métodos como `guardarContexto()`, `recuperarInformacion()`.
- **Abstracción de herramientas externas:** Si un agente necesita enviar un email, no depende de la API de Gmail o SendGrid directamente. Depende de una interfaz `ServicioDeEmail` con métodos como `enviar(destino, contenido)`.
- **Inyección de dependencias:** Las dependencias concretas se inyectan desde fuera. El agente no crea sus propias herramientas, las recibe. Esto permite cambiar implementaciones sin tocar al agente.

#### Ejemplo práctico

```
❌ Dependencia directa (MAL)
class AgenteReportador {
  async generarReporte(datos) {
    const modelo = new OpenAI({ model: "gpt-4" })
    return await modelo.generate(datos)
    // Si cambias a Claude: reescribes el agente
    // Si cambias a local: reescribes el agente
  }
}

✅ Inversión de dependencias (BIEN)
interface ModeloIA {
  async generar(contexto: string): Respuesta
}

class AgenteReportador {
  constructor(private modelo: ModeloIA) {}
  // El modelo se inyecta, no se crea internamente

  async generarReporte(datos) {
    return await this.modelo.generar(datos)
    // Puedes inyectar OpenAI, Claude, Gemini, local...
    // El agente no cambia
  }
}

// Uso
const agente = new AgenteReportador(new ModeloOpenAI())
// o
const agente = new AgenteReportador(new ModeloAnthropic())
// o
const agente = new AgenteReportador(new ModeloLocal())
```

#### Señales de que estás violando DIP

- Los agentes importan bibliotecas específicas de un proveedor (ej: `openai`, `@anthropic-ai/sdk`).
- Cambiar de modelo de IA implica modificar el código de múltiples agentes.
- Los agentes construyen sus propias conexiones a bases de datos o APIs externas.
- No puedes hacer pruebas unitarias de un agente sin conectarte al servicio real.
- Las dependencias están hardcodeadas en el constructor o en el cuerpo del agente.
- Existe un acoplamiento fuerte entre la versión del LLM y la lógica del agente (si cambia el modelo, cambia el comportamiento del agente).

---

## Bonus: Principios adicionales para IA agéntica

### Principio de Observabilidad (OP)
Cada agente debe exponer qué decisión tomó, por qué la tomó, y cuál fue el resultado. Sin observabilidad, un sistema multi-agente es una caja negra imposible de depurar.

### Principio de Acotamiento (BP)
Todo agente debe tener límites claros: tiempo máximo de ejecución, cantidad máxima de intentos, alcance de sus acciones, presupuesto de tokens, contexto máximo. Un agente sin límites es un riesgo de costos y comportamiento impredecible.

### Principio de Validación Humana (HVP)
Las acciones destructivas, financieras o irreversibles deben requerir validación humana explícita. Un agente no debería poder eliminar datos, realizar pagos o enviar comunicaciones críticas sin supervisión.

### Principio de Trazabilidad (TP)
Toda acción ejecutada por un agente debe ser trazable: qué agente la ejecutó, qué datos usó, qué modelo tomó la decisión, en qué momento, y cuál fue el resultado. Esto no es opcional, es la base para auditoría y mejora continua.
