# La Anónima — Campos adicionales recomendados en customerData

## Campos que YA llegan en el payload (de tu ejemplo Jambonz - Flujo 3)
Estos los uso tal cual:

| Campo | Tipo | Uso |
|---|---|---|
| `Nombre` | string | Saludo, prompts LLM, primer nombre vía `.split(" ")[0]` |
| `CodCliente` | string | Mencionado en NEGOCIACION al cerrar ACUERDO |
| `Vencimiento` | string DD/MM/YYYY | Mensaje de deuda, consultas |
| `telefono_norm` | string | Mapeado a `Telefono` para reporting |
| `campaign_id` | string | Reporting a backend |
| `record_index` | string | Reporting a backend |
| `resiliencia` | string→int | `max_intentos_id` (default 2) |
| `intentos_acuerdo` | string→int | `max_intentos_neg1` (default 1) |
| `saludo_inicial` | string | Sobreescribe saludo SALUDO |
| `saludo_despedida` | string | Default para DESPEDIDA_SIN_ACUERDO |
| `limite_acuerdo` | string DD/MM/YYYY | Disponible pero aún no se usa en prompts |
| `formas_de_pago` | JSON string array | Parseado, usado en LLM Consultas |
| `motivos_no_acuerdo` | JSON string array | Parseado, disponible (aún no usado activamente) |
| `sms_config` | JSON string object | Parseado, disponible (no se envía SMS por ahora) |
| `tiempo_maximo` | string→int | Guardado en state pero aún no se usa |
| `prompt` | string | **IGNORADO** por ahora (vos lo dijiste). Guardado como `prompt_original` en customer |
| `webhook_contestador` | string | Aún no usado (AMD queda para después) |

## Campos NUEVOS que recomiendo agregar

### 🔴 CRÍTICOS (sin estos, el bot no tiene info para negociar)

| Campo | Tipo | Por qué | Default actual |
|---|---|---|---|
| **`Deuda`** | string | Monto de la deuda. Actualmente solo está embebido en `prompt`. Lo necesito separado para los LLMs (Validacion, Negociacion, NEG2, Consultas) y para el mensaje cuando se confirma identidad. | `"el importe pendiente"` (genérico, malo) |
| **`Entidad`** | string | Nombre de la entidad acreedora ("La Anónima"). También solo en `prompt` ahora. | `"La Anonima"` (hardcodeado) |

**Ejemplo de cómo deberían llegar:**
```json
{
  "Nombre": "Emmanuel Tartallini",
  "Deuda": "130000 pesos",
  "Entidad": "La Anonima",
  "CodCliente": "46892",
  ...
}
```

### 🟡 RECOMENDADOS (para producción)

| Campo | Tipo | Por qué |
|---|---|---|
| `Documento` | string | DNI/CUIT del cliente, usado en reporting al backend |
| `intentos_acuerdo_2` | string→int | Iteraciones distintas para NEGOCIACION_2 (default = `intentos_acuerdo`) |
| `backend_url` | string | URL de tu API para reporting en producción. Si no viene, se usa el dev-capture |
| `backend_api_key` | string | X-API-Key para autenticar al backend de producción |
| `sms_enabled` | boolean | Cuando implementemos AMD/SMS, sirve para activarlo por llamada |

### 🟢 OPCIONALES (mejoran el bot, no son críticos)

| Campo | Tipo | Por qué |
|---|---|---|
| `mensaje_deuda` | string | Plantilla custom del pitch de deuda. Si no viene, se arma con Nombre+Entidad+Deuda+Vencimiento |
| `fecha_hoy` | string DD/MM/YYYY | Para que el LLM tenga contexto temporal exacto. Si no viene, usa ISO actual |
| `dias_para_vencimiento` | int | Número computado, sirve para que el LLM ajuste urgencia |
| `historial_pagos` | string/array | Si el cliente tiene historial bueno o malo, el LLM puede modular |

## Configuración OpenAI

**ANTES DE ACTIVAR EL WORKFLOW** tenés que crear la credencial OpenAI:

1. En n8n UI → Credentials → Add Credential
2. Tipo: `OpenAI API`
3. Nombre: **`OpenAI La Anonima`** (exacto, sin tilde)
4. API Key: `<TU_OPENAI_API_KEY>` (pegá la key real, no la subas a git)
5. Save

Esto va a aplicarse automáticamente a los 5 nodos OpenAI (Validacion, Negociacion, Negociacion 2, Motivo, Consultas) porque todos referencian el mismo nombre.

## Endpoints

| Workflow | URL | Estado |
|---|---|---|
| **La Anonima** (principal) | `https://n8n.geellow.com/webhook/la-anonima` | ⚠️ INACTIVO — activar después de crear credencial OpenAI |
| **La Anonima Dev Capture** (reports) | `https://n8n.geellow.com/webhook/la-anonima-dev-capture` | ✅ ACTIVO |

Para inspeccionar reports capturados durante desarrollo:
```bash
redis-cli LRANGE la-anonima:devcapture:reports 0 -1
# Para vaciar:
redis-cli DEL la-anonima:devcapture:reports
```

## Estructura del state object en Redis

Key: `la-anonima:call:<call_sid>`, TTL: 3600s

```json
{
  "machine_state": "NEGOCIACION",
  "customer": { /* customerData parseado */ },
  "config": {
    "max_intentos_id": 2,
    "max_intentos_neg1": 1,
    "max_intentos_neg2": 1,
    "backend_url": "",
    "backend_api_key": ""
  },
  "intentos_id": 0,
  "intentos_neg1": 0,
  "intentos_neg2": 0,
  "identity_type": "titular",
  "return_state": null,
  "motivo_no_pago": null,
  "motivo_clasificado": null,
  "resultado": null,
  "history": [
    { "role": "assistant", "content": "...", "ts": "..." },
    { "role": "user", "content": "...", "ts": "..." }
  ],
  "started_at": 1700000000
}
```

## Tests ejecutados

| # | Test | Resultado |
|---|---|---|
| 1 | SALUDO inicial (sin transcript) | ✅ Genera saludo correcto, transiciona a VALIDACION_IDENTIDAD, persiste state, responde verbs JSON |
| 2 | actionHook dinámico desde headers | ✅ Construye `https://n8n.geellow.com/webhook/la-anonima` correctamente |
| 3 | Carga state desde Redis en 2da llamada | ✅ Recupera estado previo, machine_state correcto |
| 4 | Switch by State enruta a output correcto | ✅ Output 1 (VALIDACION_IDENTIDAD) hit cuando corresponde |
| 5 | Report HTTP a dev-capture | ✅ POST exitoso, dev-capture devuelve `{"status":"captured"}` |
| 6 | Parsing de customerData con JSON strings | ✅ formas_de_pago, motivos_no_acuerdo, sms_config se parsean OK |
| 7 | LLM Validacion ejecuta | ❌ Falla por credencial OpenAI faltante (esperado) |

## Pendientes después de configurar OpenAI

1. Re-test del flujo VALIDACION_IDENTIDAD con transcript "sí él habla" → debería clasificar `titular` y pasar a NEGOCIACION
2. Test NEGOCIACION con "no puedo pagar" → debería ir a NEGOCIACION_2
3. Test NEGOCIACION_2 con "no, imposible" → debería ir a MOTIVO_NO_PAGO
4. Test MOTIVO_NO_PAGO con "perdí el trabajo" → debería clasificar `sin_empleo` y terminar con DESPEDIDA_SIN_ACUERDO
5. Test CONSULTAS_DUDA: cliente pregunta "cuánto debo?" durante negociación → LLM responde y vuelve al return_state
6. Implementar AMD (webhook_contestador) cuando lo pidas
7. Implementar SMS opt-in (sms_enabled flag + sms_config) cuando lo pidas
