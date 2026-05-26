# WORKFLOW.md — Voice Bot La Anónima

Documentación detallada del funcionamiento interno del workflow.

---

## Arquitectura general

El workflow tiene **3 triggers** independientes que comparten estado vía Redis:

```
1. Webhook App      POST /la-anonima           → Conversación (turnos del cliente)
2. Webhook Status   POST /la-anonima-status    → Eventos del ciclo de vida (in-progress, completed, etc.)
3. Webhook AMD      POST /la-anonima-amd       → Detección de contestador automático
```

Cada llamada se identifica por su `call_sid` (provisto por Jambonz). El estado de cada llamada se persiste en Redis con la key `call:<call_sid>` y TTL de 3600 segundos.

---

## State machine (Trigger 1: conversación)

La conversación pasa por las siguientes fases:

```
SALUDO
   │  primer hit del webhook, saludo inicial
   ▼
VALIDACION_IDENTIDAD ────────────────► DESPEDIDA_RAPIDA (si dice "no soy", "número equivocado")
   │  cliente responde quién es
   ├──► tercero → NEGOCIACION (con frase para tercero)
   ▼
NEGOCIACION (monto total)
   │  insiste con el pago del importe completo
   │  reintenta hasta `intentos_acuerdo` veces (default 1)
   │
   ├─► ACUERDO → DESPEDIDA_ACUERDO + hangup
   ├─► CONSULTA → CONSULTAS_DUDA → vuelve a NEGOCIACION
   ├─► FIN_NEGATIVO → MOTIVO_NO_PAGO
   │
   ▼ (intentos agotados)
NEGOCIACION_2 (monto parcial alternativo)
   │  ofrece pagar solo `monto_acuerdo_2` hasta `fecha_acuerdo_2`
   │  reintenta hasta `intentos_acuerdo_2` veces (default 1)
   │
   ├─► ACUERDO → DESPEDIDA_ACUERDO + hangup
   ├─► CONSULTA → CONSULTAS_DUDA → vuelve a NEGOCIACION_2
   ├─► FIN_NEGATIVO → MOTIVO_NO_PAGO
   │
   ▼ (intentos agotados)
MOTIVO_NO_PAGO
   │  cliente explica por qué no puede pagar
   │  LLM clasifica el motivo
   ▼
DESPEDIDA_SIN_ACUERDO + hangup
```

### Crosscut: CONSULTAS_DUDA

En cualquier momento (VALIDACION, NEG1, NEG2), si el LLM detecta que el cliente hizo una pregunta, salta a `CONSULTAS_DUDA`. El LLM Consultas responde con datos de `customerData` y vuelve al estado anterior (guardado en `state.return_state`).

---

## Variables de `customerData` (todas opcionales con fallback)

### Datos del cliente y la deuda

| Variable | Tipo | Default | Uso |
|---|---|---|---|
| `Nombre` | string | `"usted"` | Cliente |
| `Entidad` | string | `"La Anonima"` | Empresa que cobra |
| `Deuda` | string/number | `""` | Monto total adeudado |
| `Vencimiento` | string `dd/mm/aaaa` | `""` | Fecha original de vencimiento |
| `CodCliente` | string | `""` | Código identificador del cliente |
| `Documento` | string | `""` | DNI/CUIT |
| `Telefono` o `telefono_norm` | string | `""` | Teléfono del cliente |
| `campaign_id` | string | `""` | ID de campaña para tracking |
| `record_index` | string | `""` | Índice del registro |

### Configuración de intentos y resiliencia

| Variable | Tipo | Default | Uso |
|---|---|---|---|
| `resiliencia` | int | `2` | Reintentos de identificación en VALIDACIÓN |
| `intentos_acuerdo` | int | `1` | Reintentos en NEG1 |
| `intentos_acuerdo_2` | int | `1` | Reintentos en NEG2 |
| `max_consultas` | int | `3` | Límite global de consultas |
| `tiempo_maximo` | int | `200` | Tiempo máximo de llamada (no enforced) |

### Oferta alternativa de NEG2 (pago parcial)

| Variable | Tipo | Uso |
|---|---|---|
| `monto_acuerdo_2` | string/number | Monto reducido aceptable en NEG2 |
| `fecha_acuerdo_2` | string `dd/mm/aaaa` | Nueva fecha límite para el pago parcial |

### Frases parametrizables

Todas opcionales. Si están vacías, el workflow usa un texto por defecto razonable. Todas aceptan **placeholders** (ver abajo).

#### SALUDO
| Variable | Cuándo se usa |
|---|---|
| `saludo_inicial` | Apertura de la llamada |
| `saludo_despedida` | Cierre genérico (poco usado, casi siempre se reemplaza por algo más específico) |

#### VALIDACIÓN
| Variable | Cuándo se usa |
|---|---|
| `frase_cobro_titular` | Cliente confirmó identidad → entrada a NEG1 |
| `frase_cobro_tercero` | Cliente es un familiar/responsable → entrada a NEG1 |
| `frase_no_titular` | Cliente dijo "número equivocado" → hangup |
| `frase_sin_respuesta` | Después de N reintentos sin identificar → hangup |
| `frase_reintento_silencio` | Hubo silencio, repreguntar identidad |
| `frase_reintento_ambiguo` | Respuesta ambigua, repreguntar identidad |
| `frase_consulta_puente` | Cliente pregunta antes de identificarse |

#### NEGOCIACIÓN
| Variable | Cuándo se usa |
|---|---|
| `frase_neg1_intento_2`, `_3`, `..._N` | Reintentos dentro de NEG1 (uno por intento) |
| `frase_neg2_entrada` | Transición NEG1 → NEG2 (primera vez en NEG2) |
| `frase_neg2_intento_2`, `_3`, `..._N` | Reintentos dentro de NEG2 |

#### ACUERDO Y CIERRE
| Variable | Cuándo se usa |
|---|---|
| `frase_acuerdo_neg1` | Cliente acepta pagar el monto total en NEG1 |
| `frase_acuerdo_neg2` | Cliente acepta el monto parcial en NEG2 |
| `frase_motivo_entrada` | Transición a MOTIVO_NO_PAGO (NEG → MOTIVO o NEG2 → MOTIVO) |
| `frase_limite_consultas` | Cliente superó `max_consultas` |

### Listas dinámicas

| Variable | Tipo | Uso |
|---|---|---|
| `motivos_no_acuerdo` | array | Categorías para clasificar el motivo (si vacío, usa defaults) |
| `formas_de_pago` | array | Métodos de pago disponibles (lo lee el LLM Consultas) |
| `sms_config` | object | Configuración para SMS post-llamada (opt-in via `sms_enabled`) |

### Identidad del bot

| Variable | Tipo | Default | Uso |
|---|---|---|---|
| `bot_name` | string | `"Sofia"` | Nombre del bot que se anuncia |

---

## Placeholders disponibles en frases

Cualquier frase parametrizable puede contener estos placeholders entre **una sola llave**:

| Placeholder | Mapea a |
|---|---|
| `{nombre}` | Primer nombre del cliente |
| `{bot_name}` | Nombre del bot |
| `{entidad}` | Empresa cobradora |
| `{deuda}` | Deuda total **en palabras** (ej. "once mil") |
| `{vencimiento}` | Vencimiento original **en formato hablado** (ej. "25 de mayo") |
| `{cod_cliente}` | Código identificador (no se convierte) |
| `{monto_acuerdo_2}` | Monto parcial **en palabras** |
| `{fecha_acuerdo_2}` | Fecha parcial **en formato hablado** |

### Importante sobre las conversiones

El workflow convierte automáticamente:

- **Números a palabras** para `{deuda}` y `{monto_acuerdo_2}`:
  - `"11000"` → `"once mil"`
  - `"150000"` → `"ciento cincuenta mil"`
  - `"5500000"` → `"cinco millones quinientos mil"`
  - Soporta hasta 999 millones
  - Si ya viene como texto (ej. `"cien mil pesos"`), pass-through

- **Fechas a formato hablado** para `{vencimiento}` y `{fecha_acuerdo_2}`:
  - `"25/05/2026"` → `"25 de mayo"` (sin año)
  - `"10-06-2026"` → `"10 de junio"` (acepta guiones)
  - `"10/06"` → `"10 de junio"` (acepta sin año)
  - Si ya viene como texto (ej. `"15 de marzo"`), pass-through

Esto mejora dramáticamente el TTS — el bot dice "once mil" en lugar de "uno uno cero cero cero".

**Nota:** los valores originales (`Deuda`, `Vencimiento`) se mantienen en el `state.customer` y se reportan al CRM en formato crudo. La conversión solo afecta lo que dice el bot.

---

## Doble llave `{{var}}` vs una llave `{var}`

Si tu CRM ya hace interpolación con `{{var}}` (doble llave), eso se procesa **antes** de que llegue al workflow:

```
En CRM:              "Hola {{Nombre}}, debe {deuda}"
Workflow recibe:     "Hola Pedro, debe {deuda}"
Bot dice:            "Hola Pedro, debe once mil"
```

El workflow solo interpola `{var}` (una llave). El doble llave lo resuelve el CRM antes de mandar.

---

## Flujo de turnos en la conversación

### Turno 1: SALUDO
- Bot dice `saludo_inicial` (default: "Hola, buenos días. Soy Sofia, le hablo de La Anónima. Me comunico con {nombre}?")
- Estado pasa a `VALIDACION_IDENTIDAD`

### Turno 2: cliente responde al saludo
LLM Validación clasifica entre 6 opciones:
- **`titular`**: confirma identidad → bot dice `frase_cobro_titular` (o default) → estado NEG
- **`tercero`**: es familiar/responsable → bot dice `frase_cobro_tercero` → estado NEG
- **`desconocido`**: niega o número equivocado → bot dice `frase_no_titular` + hangup
- **`consulta`**: pregunta antes de identificarse → bot dice `frase_consulta_puente` → estado CONSULTAS_DUDA
- **`silencio`**: transcript vacío → bot dice `frase_reintento_silencio` (re-pregunta)
- **`ambiguo`**: no clasifica → bot dice `frase_reintento_ambiguo` (re-pregunta)

Después de `resiliencia` reintentos sin éxito → `frase_sin_respuesta` + hangup.

### Turno 3+: NEGOCIACIÓN 1
LLM Negociación clasifica entre:
- **`ACUERDO`**: cliente acepta pagar → bot dice `frase_acuerdo_neg1` (o default LLM) + hangup
- **`FIN`** (FIN_NEGATIVO): cliente dice claramente que no puede → bot dice `frase_motivo_entrada` → estado MOTIVO
- **`CONSULTA`**: hace una pregunta → bot dice frase puente o respuesta directa → estado CONSULTAS_DUDA
- **`CONTINUAR`**: duda/evade →
  - Si `intentos_neg1 < intentos_acuerdo`: bot dice `frase_neg1_intento_(N+1)` o respuesta del LLM
  - Si `intentos_neg1 >= intentos_acuerdo`: pasa a NEG2 con `frase_neg2_entrada`

### Turno N: NEGOCIACIÓN 2
Mismo patrón pero ofreciendo el pago parcial. El LLM tiene acceso a `monto_acuerdo_2` y `fecha_acuerdo_2` en su prompt y los menciona como oferta alternativa.

Después de agotar `intentos_acuerdo_2` → pasa a MOTIVO_NO_PAGO con `frase_motivo_entrada`.

### Turno final: MOTIVO_NO_PAGO
LLM Motivo clasifica el motivo en una de las categorías de `motivos_no_acuerdo` (o defaults: `desconoce_deuda`, `pago_automatico`, `sin_empleo`, `enfermedad`, `viaje`, `niega`, `otro`).

Genera una despedida cordial + hangup.

---

## Crosscut: CONSULTAS_DUDA

Cuando el LLM (Validación / NEG / NEG2) detecta una consulta, salta acá. El LLM Consultas:

- **SOLO usa datos de `customerData`** — no inventa nada. Si no tiene el dato, dice "No dispongo de ese dato".
- **No revela el monto parcial ni la fecha alternativa de NEG2** si el cliente todavía está en NEG1 (no spoiler).
- Sí puede mencionarlos cuando `return_state` es `NEGOCIACION_2`.

Después de responder, vuelve al estado anterior.

### Límite de consultas

El counter `intentos_consultas` global se incrementa cada vez que el LLM clasifica como `CONSULTA`. Cuando alcanza `max_consultas`, las próximas consultas **no entran a `CONSULTAS_DUDA`**: el bot dice `frase_limite_consultas` y se mantiene en la fase actual.

---

## Trigger 2: Status events

Maneja el ciclo de vida de la llamada. Los eventos son:

| Status | ¿Es terminal? | Acción |
|---|---|---|
| `trying`, `ringing`, `early-media`, `in-progress` | No | Persistir state en Redis (init si no existe) + reportar al CRM `/webhooks/call-status` |
| `completed`, `no-answer`, `busy`, `failed`, `canceled`, `rejected` | **Sí** | Reportar al CRM `/webhooks/call-status` + `/webhooks/record-update` final + limpiar Redis |

El `record-update` final incluye:
- `campaign_id`, `call_sid`
- `gestion.resultado` (acuerdo / fin / no_responsable / contestador / sin_respuesta / identidad_no_confirmada)
- `gestion.acuerdo` (bool)
- `gestion.mensaje_asistente`, `gestion.mensaje_cliente` (últimos del history)
- `gestion.motivo_no_pago`, `gestion.motivo_clasificado`
- `gestion.duration`, `gestion.call_termination_by`
- `transcripcion` (history completo)

---

## Trigger 3: AMD (Answer Machine Detection)

Jambonz manda el evento cuando detecta el tipo de respuesta:

| Event | Acción |
|---|---|
| `amd_human_detected` | Bot **no cuelga** (devuelve verbs vacíos `[]`), continúa con la conversación |
| `amd_machine_detected` | Bot cuelga (`[{verb:"hangup"}]`), reporta al CRM con `resultado: "contestador"`, opcionalmente envía SMS |
| `amd_fax_detected` | Idem máquina |

El SMS al contestador es opt-in: requiere `sms_enabled: true` + `sms_config.url` + `sms_config.mensaje_contestador` en `customerData`.

---

## LLM nodes y sus prompts

El workflow usa **5 LLM nodes** con `gpt-4o-mini`, todos vinculados a la credencial `OpenAI La Anonima`:

| Node | Temperatura | Max tokens | Rol |
|---|---|---|---|
| `OpenAI Validacion` | 0.2 | 200 | Clasifica respuesta inicial (titular/tercero/desconocido/...) |
| `OpenAI Negociacion` | 0.5 | 250 | Clasifica intención en NEG1 y genera respuesta |
| `OpenAI Negociacion 2` | 0.5 | 250 | Idem NEG2 + ofrece pago parcial |
| `OpenAI Motivo` | 0.1 | 200 | Clasifica motivo de no pago + despedida |
| `OpenAI Consultas` | 0.3 | 200 | Responde consultas con datos de customerData |

Todos los prompts usan `outputParserStructured` para devolver JSON parseable.

---

## Persistencia en Redis

Cada turno escribe el state actualizado en Redis con key `call:<call_sid>` y TTL 3600s. La estructura del state es:

```js
{
  machine_state: "NEGOCIACION",          // estado actual
  customer: {...customerData parseado},
  config: {
    max_intentos_id: 2,
    max_intentos_neg1: 1,
    max_intentos_neg2: 1,
    max_consultas: 3
  },
  intentos_id: 0,
  intentos_neg1: 0,
  intentos_neg2: 0,
  intentos_consultas: 0,
  identity_type: "titular",
  return_state: null,                    // estado al cual volver desde CONSULTAS_DUDA
  motivo_no_pago: "perdi el trabajo",
  motivo_clasificado: "sin_empleo",
  resultado: "acuerdo",
  history: [                             // historial completo de la conversación
    {role: "assistant", content: "...", ts: "..."},
    {role: "user", content: "...", ts: "..."}
  ],
  started_at: 1716660000
}
```

Cuando llega el Status terminal (`completed`, `busy`, etc.), se lee este state, se arma el `record-update` y se borra Redis.

---

## Webhook URLs y configuración

URLs hardcoded en el código:

```
Backend record-update: https://voice1.progeny.com.ar/webhooks/record-update
Backend call-status:   https://voice1.progeny.com.ar/webhooks/call-status
API Key (X-API-Key):   vb_3W8DGWAJ3_uEX4NgWnIOCMOtzhp3ADDC0FH6iIaOWxI
```

Si tu backend usa otras URLs, hay que editar `workflow_consolidated.ts` en el nodo `Build Status Report`.

---

## Reglas del LLM (resumen)

### Validación
- Clasifica entre 6 categorías estrictas
- No inventa categorías

### Negociación (NEG1)
- Solo habla de: deuda, pago, vencimiento, código cliente, motivo
- **No ofrece** cuotas, descuentos, refinanciación, intereses, plazos legales, consecuencias
- En ACUERDO menciona el código de cliente y se despide

### Negociación 2 (NEG2)
- Tiene acceso a `monto_acuerdo_2` y `fecha_acuerdo_2` en su prompt
- Si están definidos, ofrece el pago parcial como segunda opción
- Si no, ofrece "última oportunidad" sin alternativa

### Consultas
- **Solo usa datos de la sección "DATOS DISPONIBLES"** del prompt
- Si no tiene el dato, responde "No dispongo de ese dato"
- **No revela** `monto_acuerdo_2` ni `fecha_acuerdo_2` si `return_state` es `VALIDACION` o `NEGOCIACION`
- Sí los menciona si `return_state` es `NEGOCIACION_2`

### Motivo
- Clasifica usando los `motivos_no_acuerdo` provistos en customerData (o defaults)
- Si nada encaja, usa `"otro"`
- Genera una despedida breve, respetuosa, sin insistir

---

## Ejemplo de `customerData` completo

```json
{
  "Nombre": "Emmanuel Tartallini",
  "Entidad": "La Anonima",
  "Documento": "31968694",
  "Telefono": "1170644828",
  "telefono_norm": "095491170644828",
  "Deuda": "150000",
  "Vencimiento": "25/05/2026",
  "CodCliente": "123456",
  "campaign_id": "campaign-001",
  "record_index": "0",

  "bot_name": "Sofia",

  "resiliencia": "2",
  "intentos_acuerdo": "2",
  "intentos_acuerdo_2": "2",
  "max_consultas": "3",

  "monto_acuerdo_2": "75000",
  "fecha_acuerdo_2": "10/06/2026",

  "saludo_inicial": "Hola, buenas tardes. Soy {bot_name} de {entidad}. ¿Hablo con {nombre}?",
  "frase_cobro_titular": "{nombre}, le contacto por una deuda de {deuda} con vencimiento el {vencimiento}. ¿Podrá regularizarla?",
  "frase_cobro_tercero": "Le informo que el titular tiene una deuda de {deuda}. ¿Podrá gestionar el pago?",
  "frase_no_titular": "Disculpe la molestia, buen día.",
  "frase_sin_respuesta": "No pudimos comunicarnos. Buen día.",
  "frase_reintento_silencio": "Hola, ¿hablo con {nombre}?",
  "frase_reintento_ambiguo": "Disculpe, ¿podría confirmar si hablo con {nombre}?",
  "frase_consulta_puente": "Claro, dígame su consulta.",

  "frase_neg1_intento_2": "{nombre}, le insisto, ¿hay alguna forma de regularizar los {deuda}?",
  "frase_neg2_entrada": "{nombre}, como alternativa puede pagar un parcial de {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. ¿Le interesa?",
  "frase_neg2_intento_2": "Es la última oportunidad: {monto_acuerdo_2} antes del {fecha_acuerdo_2}.",

  "frase_acuerdo_neg1": "Perfecto {nombre}, confirmo el pago de {deuda} antes del {vencimiento}. Código: {cod_cliente}. Muchas gracias.",
  "frase_acuerdo_neg2": "Perfecto {nombre}, confirmo el pago parcial de {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. Código: {cod_cliente}. Muchas gracias.",

  "frase_motivo_entrada": "Entiendo. Para registrarlo, ¿cuál es el motivo principal?",
  "frase_limite_consultas": "Disculpe, no puedo responder más consultas. ¿Podemos avanzar con el pago?",

  "motivos_no_acuerdo": [
    {"motivo": "desconoce_deuda"},
    {"motivo": "sin_empleo"},
    {"motivo": "enfermedad"},
    {"motivo": "viaje"},
    {"motivo": "mudanza"}
  ],

  "formas_de_pago": [
    {"metodo": "Caja de supermercado", "descripcion": "En efectivo en línea de cajas"},
    {"metodo": "Home Banking", "descripcion": "De forma digital"},
    {"metodo": "Mercado Pago", "descripcion": "Buscando La Anónima con su número de cliente"}
  ],

  "sms_enabled": false,
  "sms_config": {}
}
```

---

## Despliegue y mantenimiento

### Actualizar el workflow

1. Editar `workflow_consolidated.ts`
2. Validar sintaxis localmente con Node:
   ```bash
   node -e "new Function(require('fs').readFileSync('workflow_consolidated.ts','utf8').replace(/^import[^;]+;/m,'').replace(/^export default /m,''))"
   ```
3. Subir con el MCP de n8n (`mcp__n8n-mcp__update_workflow` + `publish_workflow`)
4. Ejecutar tests del directorio `tester/` o usar la UI del tester contra el endpoint

### Logs y debugging

En n8n web UI:
- `Executions` muestra cada ejecución con I/O por nodo
- Los Code nodes pueden tener `console.log()` que aparece en los logs del proceso n8n

Para inspeccionar Redis manualmente:
```bash
redis-cli GET "call:<call_sid>"
```

---

## Edge cases y comportamientos importantes

1. **Status llega antes que App**: si el primer evento es un `Status` (raro), se inicializa el state desde `body.customerData`. Las conversiones de números/fechas también se aplican en este caso.

2. **`Deuda` viene en texto** (ej. `"cien mil pesos"`): el workflow detecta que tiene letras y hace pass-through, no destruye el formato.

3. **`Vencimiento` vacío o malformado**: pass-through, el bot dice lo que sea (o vacío).

4. **`max_consultas=0`**: el bot rechaza cualquier consulta desde el primer intento.

5. **Cliente acepta el monto total durante NEG2**: el LLM lo trata como ACUERDO igual, aunque está en NEG2 (no es bug).

6. **Cliente vuelve a preguntar después de superar `max_consultas`**: el bot responde con `frase_limite_consultas`. Si insiste, cada turno seguirá clasificándose como CONSULTA pero el counter ya está bloqueado. Eventualmente el flujo avanza porque cada intento consume `intentos_neg`.

7. **Bot saluda y nadie responde** (silencio): después de `resiliencia` reintentos, cuelga con `frase_sin_respuesta`.

8. **AMD detecta humano pero el cliente no habla**: bot continúa, eventualmente cuelga por silencios consecutivos en validación.

---

## Tests automatizados

El directorio del tester incluye scripts bash (no en el repo, en `C:\tmp\lanonima-tests`) que validan:

- 55+ assertions cubriendo todas las features
- Conversiones de números y fechas
- Frases parametrizadas (saludo, validación, NEG, NEG2, motivo, consultas, acuerdo, límite)
- Motivos dinámicos
- AMD humano/máquina
- Status in-progress/completed
- Edge cases (fallback, pass-through, multi-millones, fechas sin año)

Para correr los tests contra el endpoint productivo:

```bash
bash C:/tmp/lanonima-tests/test-general-final.sh
```
