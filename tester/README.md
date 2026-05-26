# La Anónima — Jambonz Tester

Mini-web local para testear los 3 webhooks del workflow **La Anónima** en n8n
(`/la-anonima`, `/la-anonima-status`, `/la-anonima-amd`) simulando exactamente lo
que Jambonz hace en una llamada real.

## Cómo levantarla

### Opción A: Docker Compose (recomendado)

```bash
cd C:\Development\n8n\LaAnonima\tester
docker compose up -d
```

Abrir → http://localhost:8080

Para ver logs: `docker compose logs -f`
Para parar: `docker compose down`
Para rebuildear: `docker compose up -d --build`

El `docker-compose.yml` bind-mountea `server.js` e `index.html` → editás los archivos y refrescás el browser, sin rebuild. Si querés modo "imagen pura" sin reflejo de cambios locales, comentá la sección `volumes`.

### Opción B: Node directo (sin Docker)

```bash
cd C:\Development\n8n\LaAnonima\tester
node server.js
```

Abrir → http://localhost:8080

**No necesita `npm install`.** Solo Node (16+). El server es HTTP nativo sin dependencias.

## Variables de entorno opcionales

```bash
# Docker Compose
PORT=9000 N8N_BASE=https://otro-host/webhook docker compose up -d

# O en un .env junto al docker-compose.yml:
#   PORT=9000
#   N8N_BASE=https://n8n-staging.geellow.com/webhook

# Node directo
PORT=9000 node server.js
N8N_BASE=https://otro-host node server.js
```

Default: apunta a `https://n8n.geellow.com/webhook` (producción).

## Qué podés hacer en la UI

La UI tiene 3 columnas:

### 1. CustomerData (columna izquierda)
- **Editor JSON** con todos los campos que Jambonz manda dentro de `body.customerData`
- Se persiste en `localStorage` (botón **💾 Guardar**)
- **📋 Cargar default** resetea el JSON al template con todos los campos comentados y ejemplos de placeholders
- **✨ Formatear JSON** indenta el JSON actual
- Podés agregar cualquier campo extra que tu workflow lea

### 2. Llamada
- **Call SID** se autogenera (UUID v4) cada vez que abrís la app o tocás 🆕
- Editable manualmente si querés simular una llamada específica
- **Teléfono destino/origen** editables (no afectan al workflow, solo simulan el contexto Jambonz)

### 3. Conversación (columna central)
- **📞 Iniciar llamada (saludo)** → POST a `/la-anonima` sin transcript (primer hit que hace Jambonz cuando el cliente atiende)
- **💬 Enviar turno** → POST con el texto que escribís (simula `speech.alternatives[0].transcript`)
- **🔇 Simular silencio** → POST con transcript vacío + `reason: timeout`
- **Atajos comunes**: botones para frases típicas (sí soy yo, no puedo pagar, etc.)
- El chat muestra lo que dijo el cliente y lo que respondió el bot, incluyendo cuándo cuelga

### 4. Status events (columna derecha)
Botones para cada `call_status` de Jambonz:
- **trying** / **ringing** / **early-media** / **in-progress (answered)** → eventos no terminales
- **completed** / **no-answer** / **busy** / **failed** / **canceled** → eventos terminales (te piden la duración)

Cuando enviás un status terminal, el workflow dispara el `record-update` final al CRM.

### 5. AMD events
- **👤 Humano** → POST con `type: amd_human_detected` (el bot NO debe interrumpir)
- **🤖 Máquina** → POST con `type: amd_machine_detected` (el bot DEBE colgar + reportar contestador)
- **📠 Fax** → idem máquina

### 6. Log de requests
Cada request muestra:
- Request body que se envió a n8n
- Response de n8n (los `verbs` que devolvió el bot)
- Latencia en ms
- Tag de color por tipo (App / Status / AMD / Error)

## Variables soportadas en el customerData del tester

Cuando hacés clic en **📋 Cargar default** el editor se llena con todas las variables que el workflow reconoce:

### Identidad y deuda
```json
"Nombre": "Emmanuel Tartallini",
"Entidad": "La Anónima",
"Documento": "31968694",
"Telefono": "1170644828",
"telefono_norm": "095491170644828",
"Deuda": "150000",
"Vencimiento": "25/05/2026",
"CodCliente": "123456",
"campaign_id": "test-campaign-001",
"record_index": "0",
"bot_name": "Sofia"
```

### Configuración de intentos
```json
"resiliencia": "2",
"intentos_acuerdo": "1",
"intentos_acuerdo_2": "1",
"max_consultas": "3",
"tiempo_maximo": "200"
```

### Oferta parcial NEG2
```json
"monto_acuerdo_2": "75000",
"fecha_acuerdo_2": "10/06/2026"
```

### Frases parametrizables (todas opcionales)
```json
"saludo_inicial": "Hola, buenas tardes! Soy {bot_name}. ¿Me comunico con {nombre}?",
"frase_cobro_titular": "{nombre}, debe {deuda} con vencimiento el {vencimiento}. ¿Podrá pagar?",
"frase_cobro_tercero": "El titular tiene una deuda de {deuda}. ¿Podrá gestionar el pago?",
"frase_no_titular": "Disculpe la molestia, buen día.",
"frase_sin_respuesta": "No pudimos comunicarnos, buen día.",
"frase_reintento_silencio": "Hola, ¿hablo con {nombre}?",
"frase_reintento_ambiguo": "Disculpe, ¿podría confirmar si hablo con {nombre}?",
"frase_consulta_puente": "Claro, dígame su consulta.",
"frase_neg1_intento_2": "{nombre}, insistimos por los {deuda}.",
"frase_neg1_intento_3": "{nombre}, último aviso.",
"frase_neg2_entrada": "Como alternativa, {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. ¿Le interesa?",
"frase_neg2_intento_2": "Considere los {monto_acuerdo_2}.",
"frase_neg2_intento_3": "Le pido que considere los {monto_acuerdo_2}, es el mínimo posible.",
"frase_acuerdo_neg1": "Confirmo {deuda} antes del {vencimiento}. Código: {cod_cliente}. Gracias.",
"frase_acuerdo_neg2": "Confirmo {monto_acuerdo_2} hasta el {fecha_acuerdo_2}. Código: {cod_cliente}. Gracias.",
"frase_motivo_entrada": "Para registrarlo, ¿cuál es el motivo?",
"frase_limite_consultas": "Disculpe, no puedo responder más consultas. ¿Avanzamos con el pago?"
```

### Listas dinámicas
```json
"motivos_no_acuerdo": [
  {"motivo": "desconoce_deuda"},
  {"motivo": "sin_empleo"},
  {"motivo": "mudanza"}
],
"formas_de_pago": [
  {"metodo": "Caja de supermercado", "descripcion": "En efectivo"},
  {"metodo": "Home Banking", "descripcion": "De forma digital"}
],
"sms_enabled": false,
"sms_config": {}
```

## Placeholders disponibles en frases

Cualquier frase parametrizable puede tener `{placeholder}` (una sola llave):

| Placeholder | Valor |
|---|---|
| `{nombre}` | Primer nombre del cliente |
| `{bot_name}` | Nombre del bot |
| `{entidad}` | Empresa |
| `{deuda}` | Deuda **en palabras** (`"11000"` → `"once mil"`) |
| `{vencimiento}` | Vencimiento **hablado** (`"25/05/2026"` → `"25 de mayo"`) |
| `{cod_cliente}` | Código de cliente |
| `{monto_acuerdo_2}` | Monto parcial **en palabras** |
| `{fecha_acuerdo_2}` | Fecha parcial **hablada** |

El workflow convierte automáticamente números y fechas para mejor TTS. Si el campo ya viene como texto (ej. `"cien mil pesos"`), el workflow hace pass-through.

## Flujo típico de prueba

1. **📋 Cargar default** y editar `customerData` con los datos que quieras testear (nombre, deuda, montos, fechas, frases custom)
2. **💾 Guardar** para persistir entre refrescos
3. 🆕 **Nueva llamada** (genera call_sid nuevo)
4. **Status: trying → ringing → in-progress** (simula el ciclo de vida que manda Jambonz)
5. **AMD: 👤 Humano** (simula que Jambonz detectó humano)
6. **📞 Iniciar llamada (saludo)** → bot saluda
7. Conversación: respondé con los atajos o tu propio texto
8. Cuando termina, **Status: completed** con la duración real → el workflow dispara `record-update` final al CRM
9. Mirá el log para ver la respuesta del workflow en cada turno

## Tip de testing

Cualquier variable que agregues en `customerData` (ej. `Deuda_USD`, `fecha_pago_promesa`, `historial_pagos`) va a viajar dentro del body de los 3 webhooks. Después en n8n podés leerla desde `body.customerData.Tu_Campo` en cualquier `parseInput` / `parseStatus` / `parseAmd`.

Para validar conversiones de números/fechas:
- `Deuda: "11000"` → bot dice "once mil"
- `Deuda: "150000"` → bot dice "ciento cincuenta mil"
- `Vencimiento: "25/05/2026"` → bot dice "25 de mayo" (sin año)
- `Deuda: "cien mil pesos"` → pass-through (ya en palabras)

## Troubleshooting

**El bot no responde nada o devuelve `[]` vacío**:
- Verificá que el workflow esté publicado en n8n
- Mirá los logs del workflow en n8n para ver si hay error en algún Code node

**Cambios en `index.html` no se ven**:
- Refrescá el browser con F5
- Si usás Docker y modificaste `docker-compose.yml`, hacé `docker compose down && docker compose up -d --force-recreate`

**El customerData no se persiste**:
- El navegador puede tener bloqueado `localStorage` (modo incógnito o similar)
- Probar en un browser estándar
