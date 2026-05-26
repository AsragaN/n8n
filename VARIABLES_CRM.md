# VARIABLES_CRM.md

Guía completa de las variables que el CRM debe enviar al workflow La Anónima dentro del `customerData` de cada llamada.

---

## ¿Qué es `customerData`?

Cada vez que Jambonz inicia una llamada hacia el workflow, le manda un payload con un campo `customerData` que contiene **toda la info de la persona y la configuración del bot para esa llamada**. El workflow lee esos campos y arma la conversación.

Estructura del request que Jambonz manda al webhook `/la-anonima`:

```json
{
  "call_sid": "abc-123-uuid",
  "from": "+541112345678",
  "to": "+549123456789",
  "speech": { ... },
  "customerData": {
    // ← todo lo que documentamos en este archivo va acá
  }
}
```

Desde el CRM tenés que armar el objeto `customerData` y pasárselo a Jambonz cuando dispara la llamada.

---

## Resumen rápido

| Categoría | Cantidad | ¿Obligatorio? |
|---|---|---|
| Datos del cliente | 7 campos | Solo `Nombre` y `Deuda` son críticos |
| Configuración numérica | 5 campos | Todos opcionales, tienen default |
| Oferta parcial NEG2 | 2 campos | Opcionales (sin ellos, NEG2 sin alternativa) |
| Frases parametrizables | 18 frases | Todas opcionales (tienen default) |
| Listas dinámicas | 3 arrays | Todas opcionales |
| SMS | 2 campos | Opcionales (opt-in) |
| Tracking | 2 campos | Opcionales (para reporting al CRM) |

**Total: ~39 campos posibles**, de los cuales solo **4-5 son críticos** para que el bot funcione bien.

---

## 1. Datos del cliente y la deuda

### Campos críticos (recomiendo mandar siempre)

#### `Nombre`
- **Tipo**: string
- **Default si falta**: `"usted"`
- **Ejemplo**: `"Pedro Garcia"`
- **Uso**: El bot saluda con el primer nombre. Si mandás "Pedro Garcia", dice "Pedro". El LLM también lo usa para clasificar identidad ("hablo con Pedro?" → titular si responde sí).

#### `Deuda`
- **Tipo**: string o number
- **Default si falta**: `""`
- **Ejemplo**: `"150000"` o `"150.000"` o `"$150000"`
- **Uso**: Monto total adeudado. **El workflow lo convierte automáticamente a palabras** para el TTS (`"150000"` → "ciento cincuenta mil"). Si ya viene como texto (`"ciento cincuenta mil pesos"`), pass-through. Acepta puntos, comas, $.

#### `Entidad`
- **Tipo**: string
- **Default si falta**: `"La Anonima"`
- **Ejemplo**: `"La Anónima"`
- **Uso**: Nombre de la empresa cobradora. El bot lo dice en el saludo y en frases. Si vas a usar el mismo workflow para varias empresas, mandalo siempre.

#### `Vencimiento`
- **Tipo**: string (formato `dd/mm/aaaa` o `dd-mm-aaaa`)
- **Default si falta**: `""`
- **Ejemplo**: `"25/05/2026"`
- **Uso**: Fecha original del vencimiento de la deuda. **El workflow lo convierte automáticamente** a formato hablado (`"25/05/2026"` → "25 de mayo", sin año). Acepta también `"10/06"` (sin año). Si ya viene como texto, pass-through.

#### `CodCliente`
- **Tipo**: string
- **Default si falta**: `""`
- **Ejemplo**: `"123456"`
- **Uso**: Identificador del cliente que el bot menciona al confirmar el acuerdo (para que el cliente lo use al pagar). Se reporta al CRM en el resultado de la llamada.

### Campos adicionales

#### `Documento`
- **Tipo**: string
- **Default**: `""`
- **Ejemplo**: `"31968694"`
- **Uso**: DNI/CUIT. El LLM puede usarlo si el cliente pide verificación. No tiene placeholder propio.

#### `Telefono` / `telefono_norm`
- **Tipo**: string
- **Default**: `""`
- **Ejemplo**: `"1170644828"` / `"095491170644828"`
- **Uso**: Teléfono del cliente. `telefono_norm` se prefiere (ya normalizado). Se usa en SMS y se reporta al CRM.

---

## 2. Configuración numérica de la llamada

### `resiliencia`
- **Tipo**: int o string numérico
- **Default**: `2`
- **Ejemplo**: `"2"`
- **Uso**: Cuántas veces re-pregunta la identidad si el cliente responde ambiguo o se queda en silencio en VALIDACIÓN. Después de N intentos sin identificar, cuelga.

### `intentos_acuerdo`
- **Tipo**: int o string numérico
- **Default**: `1`
- **Ejemplo**: `"2"`
- **Uso**: Cuántas veces insiste en NEG1 (monto total) antes de pasar a NEG2 (monto parcial). Con `1`, basta un "no" para pasar. Con `3`, el bot insiste 3 veces.

### `intentos_acuerdo_2`
- **Tipo**: int o string numérico
- **Default**: igual a `intentos_acuerdo`
- **Ejemplo**: `"2"`
- **Uso**: Idem para NEG2. Define cuántas veces insiste con el pago parcial antes de irse a MOTIVO_NO_PAGO.

### `max_consultas`
- **Tipo**: int o string numérico
- **Default**: `3`
- **Ejemplo**: `"3"`
- **Uso**: Cuántas consultas máximas puede hacer el cliente en TODA la llamada (counter global). A partir de la consulta `max_consultas + 1`, el bot dice `frase_limite_consultas` y NO responde más preguntas.

### `tiempo_maximo`
- **Tipo**: int (segundos)
- **Default**: `200`
- **Ejemplo**: `"180"`
- **Uso**: **Guardrail global de duración**. Al inicio de cada turno, el workflow calcula `elapsed = now − started_at`. Si `elapsed ≥ tiempo_maximo`, fuerza el estado a `TIMEOUT_FIN`, dice `frase_timeout` y cuelga, independientemente del estado en que se encuentre la conversación (excepto el primer SALUDO, donde `elapsed=0`).
- En el record-update final llegan dos campos: `gestion.elapsed_seconds` (segundos reales) y `gestion.tiempo_maximo` (configurado), y `gestion.resultado = "timeout"`.

### `frase_timeout`
- **Tipo**: string
- **Default**: `""` (usa fallback interno: *"Disculpe {nombre}, debemos finalizar la comunicacion. En breve nos contactaremos nuevamente. Que tenga buen dia."*)
- **Ejemplo**: `"Disculpe {nombre}, debemos finalizar la comunicación por tiempo. Lo llamaremos nuevamente. Buen día."`
- **Placeholders**: `{nombre}`, `{bot_name}`, `{entidad}`, `{deuda}`, `{vencimiento}`, `{cod_cliente}`.
- **Uso**: Frase que dice el bot justo antes de colgar cuando se supera `tiempo_maximo`.

---

## 3. Oferta parcial de NEG2

Si el cliente rechaza el monto total en NEG1, el bot puede ofrecer un pago parcial alternativo en NEG2. Estas variables definen esa oferta.

### `monto_acuerdo_2`
- **Tipo**: string o number
- **Default**: `""` (si vacío, NEG2 no ofrece alternativa)
- **Ejemplo**: `"75000"`
- **Uso**: Monto reducido aceptable. **Se convierte a palabras automáticamente**. El LLM tiene acceso a esto en su prompt y lo ofrece como segunda opción si el cliente rechaza el monto total.

### `fecha_acuerdo_2`
- **Tipo**: string (`dd/mm/aaaa`)
- **Default**: `""`
- **Ejemplo**: `"10/06/2026"`
- **Uso**: Nueva fecha límite para el pago parcial. **Se convierte a "dd de mes"** automáticamente.

**Importante**: si **no mandás** estos campos (o los dejás vacíos), NEG2 funciona como "última oportunidad" sin oferta concreta. El LLM solo insiste pero no propone un monto distinto.

---

## 4. Identidad del bot

### `bot_name`
- **Tipo**: string
- **Default**: `"Sofia"`
- **Ejemplo**: `"Lucia"`
- **Uso**: Nombre del bot que se anuncia en el saludo y aparece como `{bot_name}` en cualquier frase.

---

## 5. Frases parametrizables

Todas opcionales. Si las dejás vacías o no las mandás, el bot usa un texto por defecto razonable. Todas aceptan **placeholders entre una sola llave** (ver sección "Placeholders").

### 5.1. Saludo

#### `saludo_inicial`
- **Cuándo se usa**: Primer turno de la llamada, antes que hable el cliente.
- **Default**: `"Hola, buenos dias. Soy {bot_name}, le hablo de {entidad}. Me comunico con {nombre}?"`
- **Ejemplo custom**: `"Hola {nombre}, buenas tardes! Soy {bot_name}. Lo llamamos por una deuda con {entidad}."`

#### `saludo_despedida`
- **Cuándo se usa**: Despedida genérica (raramente activa).
- **Default**: `"Gracias por su tiempo. Que tenga buen dia."`

### 5.2. Validación de identidad

#### `frase_cobro_titular`
- **Cuándo se usa**: Cliente confirma identidad ("sí soy yo") → entrada a NEG1.
- **Default**: `"{nombre}, le contacto por una deuda pendiente con {entidad} por {deuda} con vencimiento el {vencimiento}. Podra regularizarla dentro del plazo?"`
- **Ejemplo custom**: `"{nombre}, le contacto por una deuda de {deuda} con vencimiento el {vencimiento}. ¿Puede regularizarla hoy?"`

#### `frase_cobro_tercero`
- **Cuándo se usa**: Cliente es familiar/responsable ("soy la esposa") → entrada a NEG1.
- **Default**: `"Perfecto. Le informo que {nombre_completo} tiene una deuda con {entidad} por {deuda}. Podra gestionar el pago?"`
- **Ejemplo custom**: `"Le informo que el titular tiene una deuda de {deuda}. ¿Podrá gestionar el pago?"`

#### `frase_no_titular`
- **Cuándo se usa**: Cliente dice "número equivocado", "no soy yo", "no vive acá". Bot cuelga.
- **Default**: `"Disculpe la molestia, que tenga buen dia."`
- **Ejemplo custom**: `"Disculpe, debe ser un error del sistema. Buen día."`

#### `frase_sin_respuesta`
- **Cuándo se usa**: Después de `resiliencia` reintentos sin identificar al cliente. Bot cuelga.
- **Default**: `"No pudimos completar la comunicacion. Que tenga buen dia."`

#### `frase_reintento_silencio`
- **Cuándo se usa**: Hubo silencio (transcript vacío). Bot re-pregunta identidad.
- **Default**: `"Hola, hablo con {nombre}?"`
- **Ejemplo custom**: `"Hola? ¿Está ahí, {nombre}?"`

#### `frase_reintento_ambiguo`
- **Cuándo se usa**: Respuesta del cliente no se entiende. Bot re-pregunta identidad.
- **Default**: `"Disculpe, podria confirmar si hablo con {nombre}?"`

#### `frase_consulta_puente`
- **Cuándo se usa**: Cliente hace una pregunta **antes de identificarse** ("¿de qué se trata?", "¿cuánto debo?"). El bot **NO responde** la pregunta — actúa como filtro de seguridad y exige identificación primero.
- **Importante**: Cada vez que el cliente pregunta sin identificarse, cuenta como un intento de identificación fallido (incrementa `intentos_id`). Después de `resiliencia` intentos, el bot cuelga con `frase_sin_respuesta`.
- **Default**: `"Primero debemos validar su identidad. Hablo con {nombre}?"`
- **Ejemplo custom**: `"Disculpe, antes de continuar necesito confirmar si hablo con {nombre}."`
- **Nota**: una vez que el cliente se identifica, ya entra a NEG y ahí puede preguntar libremente — las consultas en NEG/NEG2 se responden inline.

### 5.3. Negociación 1 (monto total)

#### `frase_neg1_intento_2`, `frase_neg1_intento_3`, `frase_neg1_intento_N`
- **Cuándo se usa**: Reintentos dentro de NEG1 cuando el cliente sigue dudando.
- **Cantidad**: Dependé de `intentos_acuerdo`. Con `intentos_acuerdo: "3"` se usan `_2` y `_3`. Con `intentos_acuerdo: "5"` podés definir hasta `_5`. Sin límite máximo de N.
- **Default**: Si la frase del intento no está definida, el LLM genera la respuesta.
- **Ejemplo**:
  ```json
  "intentos_acuerdo": "3",
  "frase_neg1_intento_2": "{nombre}, le insisto. ¿No puede afrontar los {deuda}?",
  "frase_neg1_intento_3": "{nombre}, último aviso antes de tomar otras medidas."
  ```

### 5.4. Negociación 2 (monto parcial alternativo)

#### `frase_neg2_entrada`
- **Cuándo se usa**: Transición NEG1 → NEG2 (primera vez en NEG2). Acá se presenta la oferta parcial.
- **Default**: el LLM genera el texto (si no querés controlar, dejá vacío y el LLM ofrece el parcial automáticamente porque ve `monto_acuerdo_2` en su prompt).
- **Ejemplo custom**: `"{nombre}, como alternativa puede abonar un pago parcial de {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. ¿Le interesa?"`

#### `frase_neg2_intento_2`, `_3`, `_N`
- **Cuándo se usa**: Reintentos dentro de NEG2 (cliente sigue dudando del parcial).
- **Ejemplo**:
  ```json
  "intentos_acuerdo_2": "2",
  "frase_neg2_intento_2": "Es realmente la última oportunidad. {nombre}, ¿acepta los {monto_acuerdo_2}?"
  ```

### 5.5. Confirmación de acuerdo

Estas frases se dicen cuando el cliente acepta pagar. **Recomendado mandarlas siempre** porque el LLM a veces omite datos importantes (código, monto, fecha) en la despedida.

#### `frase_acuerdo_neg1`
- **Cuándo se usa**: Cliente acepta el monto total en NEG1.
- **Default**: el LLM genera (puede omitir el código).
- **Ejemplo custom**: `"Perfecto {nombre}, confirmo el acuerdo de pago por {deuda} con vencimiento el {vencimiento}. Su código de cliente es {cod_cliente}. Muchas gracias!"`

#### `frase_acuerdo_neg2`
- **Cuándo se usa**: Cliente acepta el monto parcial en NEG2.
- **Default**: el LLM genera.
- **Ejemplo custom**: `"Perfecto {nombre}, confirmo el acuerdo por el pago parcial de {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. Código: {cod_cliente}. Muchas gracias!"`

### 5.6. Motivo y límite de consultas

#### `frase_motivo_entrada`
- **Cuándo se usa**: Transición NEG/NEG2 → MOTIVO_NO_PAGO (cliente no acepta pagar). Bot pregunta el motivo.
- **Default**: el LLM genera (algo como "Entiendo. ¿Podría indicarme el motivo?").
- **Ejemplo custom**: `"Entiendo. Para registrarlo en el sistema, ¿cuál es el motivo principal por el cual no puede afrontar el pago?"`

#### `frase_limite_consultas`
- **Cuándo se usa**: Cliente superó `max_consultas`. Bot corta consultas.
- **Default**: `"Disculpe, ya respondi varias consultas. Es importante que avancemos con el tema del pago. Podemos continuar?"`
- **Ejemplo custom**: `"Disculpe {nombre}, basta de preguntas. ¿Podemos avanzar con el pago?"`

---

## 6. Listas dinámicas

### `motivos_no_acuerdo`
- **Tipo**: array de objetos `[{motivo: "..."}]` o array de strings `["..."]`
- **Default**: si no se manda, usa 7 motivos hardcoded (`desconoce_deuda`, `pago_automatico`, `sin_empleo`, `enfermedad`, `viaje`, `niega`, `otro`).
- **Uso**: Lista de categorías que el LLM puede usar para clasificar el motivo de no pago del cliente. Se reporta al CRM en `gestion.motivo_clasificado`. **Siempre incluye `otro` como fallback**, aunque no lo definas explícitamente.
- **Ejemplo**:
  ```json
  "motivos_no_acuerdo": [
    {"motivo": "desconoce_deuda"},
    {"motivo": "sin_empleo"},
    {"motivo": "mudanza"},
    {"motivo": "robo_o_emergencia"}
  ]
  ```

### `formas_de_pago`
- **Tipo**: array de objetos
- **Default**: `[]`
- **Uso**: El LLM Consultas las menciona si el cliente pregunta cómo pagar. Más opciones → más completa la respuesta del bot.
- **Ejemplo**:
  ```json
  "formas_de_pago": [
    {"metodo": "Caja de supermercado", "descripcion": "En efectivo, acreditación 24h", "sms": false},
    {"metodo": "Home Banking", "descripcion": "De forma digital", "sms": false},
    {"metodo": "Mercado Pago", "descripcion": "Buscar La Anónima e indicar código de cliente", "sms": false}
  ]
  ```

### `sms_config`
- **Tipo**: object (string JSON también funciona)
- **Default**: `{}`
- **Uso**: Configuración para enviar SMS al contestador (cuando AMD detecta máquina). Requiere `sms_enabled: true` para activar.
- **Ejemplo**:
  ```json
  "sms_config": {
    "url": "https://desarrollo.ttsa.ar/api/v1/envios/masivo/json",
    "api_key": "pk_live_xxx",
    "mensaje_contestador": "Hola {nombre}, regularizá tu deuda con La Anónima."
  }
  ```

### `sms_enabled`
- **Tipo**: boolean o string `"true"`/`"false"`
- **Default**: `false`
- **Uso**: Si `true` + `sms_config` está completo, se envía SMS cuando AMD detecta máquina. Es opt-in para evitar gastar SMS por accidente.

---

## 7. Tracking y reporting

### `campaign_id`
- **Tipo**: string
- **Default**: `""`
- **Ejemplo**: `"campaign-mayo-2026"`
- **Uso**: ID de la campaña en tu CRM. Se incluye en el `record-update` final que el workflow manda al backend (`gestion.campaign_id`).

### `record_index`
- **Tipo**: string o number
- **Default**: `""`
- **Ejemplo**: `"42"`
- **Uso**: Índice del registro dentro de la campaña. Para que el CRM sepa exactamente qué llamada se completó.

### `limite_acuerdo`
- **Tipo**: string (fecha)
- **Default**: `""`
- **Uso**: Campo legacy, se recibe pero **no se usa actualmente** en la lógica. Lo dejamos por compatibilidad.

---

## 8. Placeholders disponibles en frases

Cualquier frase parametrizable puede contener placeholders entre **una sola llave**. El workflow los reemplaza al armar el texto que el bot dice.

| Placeholder | Mapea a | Conversión automática |
|---|---|---|
| `{nombre}` | Primer nombre del cliente | — |
| `{bot_name}` | `bot_name` o "Sofia" | — |
| `{entidad}` | `Entidad` | — |
| `{deuda}` | `Deuda` | ✅ Número → palabras (`"11000"` → `"once mil"`) |
| `{vencimiento}` | `Vencimiento` | ✅ Fecha → hablado (`"25/05/2026"` → `"25 de mayo"`) |
| `{cod_cliente}` | `CodCliente` | — (se dice tal cual) |
| `{monto_acuerdo_2}` | `monto_acuerdo_2` | ✅ Número → palabras |
| `{fecha_acuerdo_2}` | `fecha_acuerdo_2` | ✅ Fecha → hablado |

---

## 9. Doble llave `{{var}}` vs una llave `{var}`

⚠️ **Importante** si tu CRM ya hace interpolación de variables:

- **Si tu CRM usa `{{Variable}}`** (doble llave): el CRM resuelve esos placeholders **antes** de mandar el payload. Al workflow le llega el texto ya armado.
- **Si querés que el workflow resuelva el placeholder**: usá `{variable}` (**una sola llave**).

### Ejemplo combinado

Si en el CRM definís la frase:
```
"Hola {{NombreReal}}, le habla {bot_name}, debe {deuda}"
```

El CRM resuelve `{{NombreReal}}` con el valor real del campo "NombreReal" en tu base, y al workflow le llega:
```
"Hola Pedro Garcia, le habla {bot_name}, debe {deuda}"
```

Después el workflow resuelve `{bot_name}` y `{deuda}`, y el bot finalmente dice:
```
"Hola Pedro Garcia, le habla Sofia, debe once mil"
```

Esto te da el control de qué resuelve cada sistema.

---

## 10. Conversiones automáticas

El workflow convierte automáticamente:

### Números a palabras (para `Deuda` y `monto_acuerdo_2`)

| Input | Output |
|---|---|
| `"11000"` | `"once mil"` |
| `"150000"` | `"ciento cincuenta mil"` |
| `"75000"` | `"setenta y cinco mil"` |
| `"5500000"` | `"cinco millones quinientos mil"` |
| `"1500000000"` | `"1500000000"` (sin convertir si > 999M) |
| `"$11.000"` | `"once mil"` (limpia puntos y símbolos) |
| `"cien mil pesos"` | `"cien mil pesos"` (pass-through, ya en palabras) |

Soporta hasta **999 millones**. Si necesitás más, podemos extender.

### Fechas a formato hablado (para `Vencimiento` y `fecha_acuerdo_2`)

| Input | Output |
|---|---|
| `"25/05/2026"` | `"25 de mayo"` |
| `"10-06-2026"` | `"10 de junio"` (acepta guiones) |
| `"10/06"` | `"10 de junio"` (sin año funciona) |
| `"01/12/2025"` | `"1 de diciembre"` |
| `"15 de marzo"` | `"15 de marzo"` (pass-through) |
| `"32/13/2026"` | `"32/13/2026"` (inválido, pass-through) |

**No incluye el año** (a propósito, suena más natural).

### Qué NO se convierte

- **`CodCliente`**: se dice tal cual ("123456" se pronuncia como dígitos individuales).
- **`Documento`**: idem.
- **Cualquier otro campo numérico custom** que mandes en customerData.
- **`Telefono`**: idem.

---

## 11. Lo que el workflow REPORTA al CRM

Al final de cada llamada (status terminal: completed, busy, no-answer, failed, canceled), el workflow manda un POST al CRM con el resultado:

**Endpoint**: `https://voice1.progeny.com.ar/webhooks/record-update`
**Header**: `X-API-Key: vb_3W8DGWAJ3_uEX4NgWnIOCMOtzhp3ADDC0FH6iIaOWxI`

### Payload del record-update

```json
{
  "campaign_id": "tu-campaign-id",
  "call_sid": "uuid-de-jambonz",
  "gestion": {
    "resultado": "acuerdo",
    "acuerdo": true,
    "tipo_acuerdo": "total",
    "identity_type": "titular",
    "descripcion": "El cliente confirmo que va a pagar la deuda",
    "mensaje_asistente": "Perfecto Pedro, confirmo...",
    "mensaje_cliente": "si pago manana",
    "motivo_no_pago": null,
    "motivo_clasificado": null,
    "duration": 45,
    "call_termination_by": "jambonz",
    "sip_status": 200,
    "intentos_consumidos": {
      "identidad": 0,
      "negociacion_1": 0,
      "negociacion_2": 0,
      "consultas": 0
    }
  },
  "transcripcion": [
    {"role": "assistant", "content": "Hola Pedro...", "timestamp": "..."},
    {"role": "user", "content": "si soy yo", "timestamp": "..."},
    ...
  ]
}
```

### Campos enriquecidos del payload

| Campo | Tipo | Valores | Significado |
|---|---|---|---|
| `tipo_acuerdo` | string \| null | `"total"` / `"parcial"` / `null` | `total` si aceptó el monto completo (NEG1). `parcial` si aceptó la oferta de NEG2. `null` si no hubo acuerdo |
| `identity_type` | string \| null | `"titular"` / `"tercero"` / `null` | `titular` si el cliente confirmó ser la persona. `tercero` si dijo ser familiar/responsable. `null` si no se identificó |
| `intentos_consumidos.identidad` | int | 0+ | Cuántos reintentos de identificación se gastaron |
| `intentos_consumidos.negociacion_1` | int | 0+ | Cuántos reintentos en NEG1 (monto total) |
| `intentos_consumidos.negociacion_2` | int | 0+ | Cuántos reintentos en NEG2 (monto parcial) |
| `intentos_consumidos.consultas` | int | 0+ | Cuántas consultas hizo el cliente |

### Valores posibles de `gestion.resultado`

| Valor | Cuándo aparece |
|---|---|
| `acuerdo` | Cliente aceptó pagar (NEG1 o NEG2) |
| `fin` | Cliente rechazó y dio un motivo |
| `no_responsable` | Número equivocado / no es la persona |
| `contestador` | AMD detectó máquina |
| `sin_respuesta` | Cliente no respondió tras N intentos en validación |
| `identidad_no_confirmada` | Cliente no se pudo identificar tras N intentos |
| `desconocido` | Llamada cortada sin clasificación clara |

### ⚠️ Importante: los valores en el reporte son los **originales**

- `Deuda` en customerData = `"150000"` → en el reporte va como `"150000"` (no como "ciento cincuenta mil").
- `Vencimiento` = `"25/05/2026"` → en el reporte va como `"25/05/2026"`.

La conversión a palabras solo afecta lo que el bot **dice**, no lo que se reporta. Esto es a propósito: el CRM debe recibir datos crudos para procesar.

---

## 12. Ejemplo completo de `customerData` para una campaña típica

```json
{
  "Nombre": "Pedro Garcia",
  "Entidad": "La Anonima",
  "Documento": "31968694",
  "Telefono": "1170644828",
  "telefono_norm": "095491170644828",
  "Deuda": "150000",
  "Vencimiento": "25/05/2026",
  "CodCliente": "123456",
  "campaign_id": "mayo-2026-rosario",
  "record_index": "42",

  "bot_name": "Sofia",

  "resiliencia": "2",
  "intentos_acuerdo": "2",
  "intentos_acuerdo_2": "2",
  "max_consultas": "3",

  "monto_acuerdo_2": "75000",
  "fecha_acuerdo_2": "10/06/2026",

  "saludo_inicial": "Hola, soy {bot_name}. ¿Hablo con {nombre}?",
  "frase_cobro_titular": "{nombre}, le contacto por una deuda de {deuda} con vencimiento el {vencimiento}. ¿Podrá regularizarla?",
  "frase_cobro_tercero": "Le informo que el titular tiene una deuda de {deuda}. ¿Podrá gestionar?",
  "frase_no_titular": "Disculpe la molestia, buen día.",
  "frase_sin_respuesta": "No pudimos comunicarnos, buen día.",
  "frase_consulta_puente": "Claro, dígame su consulta.",

  "frase_neg1_intento_2": "{nombre}, le insistimos. ¿No puede afrontar los {deuda}?",
  "frase_neg2_entrada": "{nombre}, como alternativa, ¿puede pagar {monto_acuerdo_2} hasta el {fecha_acuerdo_2}?",
  "frase_neg2_intento_2": "Es la última oportunidad: {monto_acuerdo_2} antes del {fecha_acuerdo_2}.",

  "frase_acuerdo_neg1": "Perfecto {nombre}, confirmo el pago de {deuda} antes del {vencimiento}. Código: {cod_cliente}. Muchas gracias.",
  "frase_acuerdo_neg2": "Perfecto {nombre}, confirmo el pago parcial de {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. Código: {cod_cliente}. Muchas gracias.",
  "frase_motivo_entrada": "Entiendo. ¿Cuál es el motivo principal?",
  "frase_limite_consultas": "Disculpe, no puedo responder más. ¿Avanzamos con el pago?",

  "motivos_no_acuerdo": [
    {"motivo": "desconoce_deuda"},
    {"motivo": "sin_empleo"},
    {"motivo": "enfermedad"},
    {"motivo": "viaje"},
    {"motivo": "mudanza"}
  ],

  "formas_de_pago": [
    {"metodo": "Caja de supermercado", "descripcion": "En efectivo"},
    {"metodo": "Home Banking", "descripcion": "Digital"},
    {"metodo": "Mercado Pago", "descripcion": "Buscando La Anonima"}
  ],

  "sms_enabled": false,
  "sms_config": {}
}
```

---

## 13. Configuración mínima viable

Si querés arrancar rápido sin parametrizar todo, este es el mínimo que el bot necesita para funcionar (los demás campos usan defaults):

```json
{
  "Nombre": "Pedro Garcia",
  "Entidad": "La Anonima",
  "Deuda": "150000",
  "Vencimiento": "25/05/2026",
  "CodCliente": "123456",
  "campaign_id": "test-001",
  "record_index": "0"
}
```

Con esto, el bot:
- Usa "Sofia" como nombre por default
- Permite 2 intentos de identificación
- Permite 1 intento en NEG1 antes de pasar a NEG2
- NEG2 funciona como "última oportunidad" (sin oferta parcial concreta)
- Permite 3 consultas
- Usa los 7 motivos default para clasificación
- No envía SMS

---

## 14. Checklist para configurar una nueva campaña en el CRM

- [ ] `Nombre` del cliente
- [ ] `Entidad` (si no es La Anónima)
- [ ] `Deuda` (en número crudo, el workflow lo convierte)
- [ ] `Vencimiento` en formato `dd/mm/aaaa`
- [ ] `CodCliente` (para mencionar en confirmación)
- [ ] `campaign_id` y `record_index` (para tracking en CRM)
- [ ] `Telefono` o `telefono_norm` (para que llegue Jambonz)
- [ ] Definir `intentos_acuerdo` (¿cuánto insiste antes de pasar a NEG2?)
- [ ] Si hay descuento/parcial: `monto_acuerdo_2` y `fecha_acuerdo_2`
- [ ] Definir `intentos_acuerdo_2` (¿cuánto insiste con el parcial?)
- [ ] Frases custom si el tono default no encaja (mínimo recomiendo personalizar `frase_acuerdo_neg1` y `frase_acuerdo_neg2`)
- [ ] `motivos_no_acuerdo` adaptado a tu industria
- [ ] `formas_de_pago` con tus métodos reales

---

## 15. Errores comunes

### "El bot no menciona el código de cliente al confirmar el acuerdo"
→ Definí `frase_acuerdo_neg1` y `frase_acuerdo_neg2` incluyendo `{cod_cliente}`. El LLM no siempre lo dice si lo dejás generar la confirmación.

### "El bot dice los números como dígitos individuales (uno cinco cero cero cero cero)"
→ Tu CRM ya está mandando el número en formato que el TTS interpreta mal. Verificá que `Deuda` venga como string numérico simple (`"150000"`). El workflow convierte automáticamente.

### "El bot dice la fecha como números (veinticinco barra cinco barra dos mil veintiseis)"
→ Verificá que `Vencimiento` venga en formato `dd/mm/aaaa` (`"25/05/2026"`). El workflow convierte automáticamente a "25 de mayo".

### "El bot revela el monto parcial cuando el cliente pregunta en NEG1"
→ No debería pasar (el LLM está instruido específicamente para no hacerlo). Si pasa, reportar el caso. Se puede reforzar el prompt.

### "El cliente queda preguntando para siempre y el bot no avanza"
→ Bajá `max_consultas` (default 3). Con `max_consultas: 1`, el cliente puede hacer solo 1 consulta antes de que el bot lo corte.

### "El bot insiste demasiado con el monto total y nunca llega a ofrecer el parcial"
→ Bajá `intentos_acuerdo` a `1`. Con `1` basta un "no" para pasar a NEG2.

### "El LLM clasifica mal los motivos de no pago"
→ Definí `motivos_no_acuerdo` con categorías específicas de tu industria. El LLM las usa con prioridad sobre los defaults.

---

## 16. Cómo extender

### Agregar una nueva variable de cliente
Si necesitás que el bot use un campo extra (ej. `historial_pagos`), tenés que:
1. Definir el campo en customerData del CRM
2. Editar el workflow para parsearlo en `parseInput`
3. Si querés que sea un placeholder de frase, agregarlo a las funciones `interp()`
4. Si querés que el LLM lo use, agregarlo al prompt del LLM relevante

Esto requiere intervención en el código del workflow (`workflow_consolidated.ts`).

### Cambiar las URLs del backend
Las URLs del CRM están hardcoded en `parseInput` y `buildStatusReport`. Hay que editar el archivo y republicar el workflow.

### Soportar otro idioma
Hay que reescribir los prompts del LLM en el idioma destino y la función `numToWords` y `dateToWords`. No es trivial.

---

## Referencias

- [README.md](README.md) — Overview del proyecto
- [WORKFLOW.md](WORKFLOW.md) — Documentación técnica del workflow
- [tester/README.md](tester/README.md) — Cómo probar localmente sin llamadas reales
- [CAMPOS_ADICIONALES.md](CAMPOS_ADICIONALES.md) — Notas misceláneas sobre customerData
