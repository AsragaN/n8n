# La Anónima — Voice Bot de Cobranzas

Workflow de n8n para un bot de voz que gestiona la cobranza telefónica de deudas vencidas a través de [Jambonz](https://www.jambonz.org/). Diseñado para campañas de cobranzas en español rioplatense, formal, con state machine, integración con LLM (gpt-4o-mini) para clasificación e improvisación contextual, persistencia en Redis y reporting al CRM.

## Estructura del repositorio

```
.
├── README.md                       ← Este archivo
├── WORKFLOW.md                     ← Documentación detallada del workflow
├── VARIABLES_CRM.md                ← Guía completa de variables de customerData para el CRM
├── CAMPOS_ADICIONALES.md           ← Notas misceláneas sobre customerData
├── workflow_consolidated.ts        ← Source del workflow (TypeScript con n8n SDK)
├── workflow_v2.ts                  ← Versión previa (archivada)
└── tester/                         ← App web de testing local
    ├── README.md                   ← Cómo levantar y usar el tester
    ├── index.html                  ← UI del tester
    ├── server.js                   ← Proxy Node.js sin dependencias
    ├── Dockerfile
    ├── docker-compose.yml
    └── .dockerignore
```

## Quickstart

### 1. Subir el workflow a n8n

El workflow está escrito en TypeScript usando `@n8n/workflow-sdk`. Para subirlo a una instancia de n8n existente, hay que usar el MCP de n8n (`mcp__n8n-mcp__update_workflow`) o reconstruirlo manualmente desde el código en `workflow_consolidated.ts`.

El workflow está publicado en producción en `https://n8n.geellow.com` con id `VdmF9mjoZFiUpH4j`.

### 2. Configurar Jambonz

Apuntar 3 webhooks en la aplicación de Jambonz:

```
Call webhook:      https://<n8n>/webhook/la-anonima
Call status:       https://<n8n>/webhook/la-anonima-status
AMD webhook:       https://<n8n>/webhook/la-anonima-amd
```

### 3. Levantar el tester local (opcional)

Para probar sin hacer llamadas reales:

```bash
cd tester
docker compose up -d
# Abrir http://localhost:8080
```

Ver [tester/README.md](tester/README.md) para más detalles.

## Características principales

- **State machine** con 5 fases: SALUDO → VALIDACIÓN → NEGOCIACIÓN 1 → NEGOCIACIÓN 2 → MOTIVO_NO_PAGO + crosscut CONSULTAS_DUDA
- **20+ variables parametrizables** vía `customerData` (frases, montos, fechas, intentos, etc.)
- **Conversión automática** de números a palabras (`11000` → "once mil") y fechas a formato hablado (`25/05/2026` → "25 de mayo") para mejor TTS
- **2 etapas de negociación**: pago total (NEG1) y pago parcial alternativo (NEG2) con montos y fechas distintos
- **Límite global de consultas** para evitar loops infinitos
- **Motivos de no pago dinámicos** definidos en runtime desde el CRM
- **Detección de contestador (AMD)**: humano sigue, máquina cuelga
- **Reporting al CRM** vía HTTP POST al endpoint del backend al finalizar la llamada
- **Persistencia en Redis** entre webhooks (key: `call:<call_sid>`, TTL 1 hora)

## Documentación

- 📖 **[WORKFLOW.md](WORKFLOW.md)** — Funcionamiento detallado: arquitectura, state machine, todas las variables, prompts del LLM
- 📋 **[VARIABLES_CRM.md](VARIABLES_CRM.md)** — Guía completa de todas las variables que el CRM debe enviar, con tipos, defaults, ejemplos y troubleshooting
- 🧪 **[tester/README.md](tester/README.md)** — Cómo usar la app de testing local
- 📝 **[CAMPOS_ADICIONALES.md](CAMPOS_ADICIONALES.md)** — Notas misceláneas sobre customerData

## Dependencias del workflow

- **n8n** ≥ 1.0 con `@n8n/n8n-nodes-langchain` instalado
- **Redis** disponible como credencial en n8n (clave: `"Redis account"`)
- **OpenAI API** con credencial `"OpenAI La Anonima"` (usa `gpt-4o-mini`)
- **Jambonz** para el frontend de voz (STT/TTS + telefonía)
- **CRM backend** que reciba el `record-update` final (URL hardcoded en el workflow)

## Variables principales en `customerData`

Mínimo viable:

```json
{
  "Nombre": "Pedro Perez",
  "Entidad": "La Anonima",
  "Deuda": "150000",
  "Vencimiento": "25/05/2026",
  "CodCliente": "123456"
}
```

Configuración avanzada — ver [WORKFLOW.md](WORKFLOW.md) para lista completa.

## Stack

- n8n (workflow automation)
- Jambonz (voice gateway con TTS/STT)
- OpenAI gpt-4o-mini
- Redis (state persistence)
- Node.js (tester)
- Docker (deploy del tester)

## Licencia

Propietario.
