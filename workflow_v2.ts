import { workflow, node, trigger, ifElse, switchCase, newCredential, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const DEV_CAPTURE_URL = 'https://n8n.geellow.com/webhook/la-anonima-dev-capture';

const webhookApp = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook App',
    parameters: { httpMethod: 'POST', path: 'la-anonima', responseMode: 'responseNode', options: {} },
    position: [0, 700]
  },
  output: [{ body: { call_sid: 'test123', speech: { alternatives: [{ transcript: 'si soy yo' }] }, customerData: { Nombre: 'Emmanuel Tartallini', CodCliente: '46892', Vencimiento: '27/05/2026' } }, headers: { host: 'n8n.geellow.com', 'x-forwarded-proto': 'https' } }]
});

const parseInput = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Input',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const body=inp.body||{};\n' +
        'const headers=inp.headers||{};\n' +
        'const speech=body.speech||{};\n' +
        'const raw=(speech.alternatives&&speech.alternatives[0])?(speech.alternatives[0].transcript||""):"";\n' +
        'const host=headers["x-forwarded-host"]||headers.host||"n8n.geellow.com";\n' +
        'const proto=headers["x-forwarded-proto"]||"https";\n' +
        'const actionHook=proto+"://"+host+"/webhook/la-anonima";\n' +
        'const cdRaw=body.customerData||{};\n' +
        'function safeParse(s){if(!s)return null;if(typeof s==="object")return s;try{return JSON.parse(s);}catch(e){return null;}}\n' +
        'const formasPago=safeParse(cdRaw.formas_de_pago)||[];\n' +
        'const motivosNoAcuerdo=safeParse(cdRaw.motivos_no_acuerdo)||[];\n' +
        'const smsConfig=safeParse(cdRaw.sms_config)||{};\n' +
        'const cd={\n' +
        '  Nombre:cdRaw.Nombre||"",\n' +
        '  CodCliente:cdRaw.CodCliente||"",\n' +
        '  Vencimiento:cdRaw.Vencimiento||"",\n' +
        '  Telefono:cdRaw.telefono_norm||cdRaw.Telefono||"",\n' +
        '  Deuda:cdRaw.Deuda||"",\n' +
        '  Entidad:cdRaw.Entidad||"La Anonima",\n' +
        '  Documento:cdRaw.Documento||"",\n' +
        '  campaign_id:cdRaw.campaign_id||"",\n' +
        '  record_index:cdRaw.record_index||"",\n' +
        '  resiliencia:parseInt(cdRaw.resiliencia)||2,\n' +
        '  tiempo_maximo:parseInt(cdRaw.tiempo_maximo)||200,\n' +
        '  intentos_acuerdo:parseInt(cdRaw.intentos_acuerdo)||1,\n' +
        '  intentos_acuerdo_2:parseInt(cdRaw.intentos_acuerdo_2)||parseInt(cdRaw.intentos_acuerdo)||1,\n' +
        '  saludo_inicial:cdRaw.saludo_inicial||"",\n' +
        '  saludo_despedida:cdRaw.saludo_despedida||"",\n' +
        '  limite_acuerdo:cdRaw.limite_acuerdo||"",\n' +
        '  formas_de_pago:formasPago,\n' +
        '  motivos_no_acuerdo:motivosNoAcuerdo,\n' +
        '  sms_config:smsConfig,\n' +
        '  sms_enabled:cdRaw.sms_enabled===true||cdRaw.sms_enabled==="true",\n' +
        '  backend_url:cdRaw.backend_url||"",\n' +
        '  backend_api_key:cdRaw.backend_api_key||"",\n' +
        '  prompt_original:cdRaw.prompt||""\n' +
        '};\n' +
        'return[{json:{call_sid:body.call_sid||"",rawTranscript:raw,customerData:cd,actionHook:actionHook}}];'
    },
    position: [240, 700]
  },
  output: [{ call_sid: 'test123', rawTranscript: 'si soy yo', customerData: { Nombre: 'Emmanuel Tartallini' }, actionHook: 'https://n8n.geellow.com/webhook/la-anonima' }]
});

const redisGetState = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Get State',
    parameters: { operation: 'get', propertyName: 'redisValue', key: expr('={{ "la-anonima:call:" + $json.call_sid }}'), options: {} },
    credentials: { redis: newCredential('Redis account') },
    position: [480, 700]
  },
  output: [{ call_sid: 'test123', rawTranscript: 'si soy yo', customerData: {}, actionHook: 'https://n8n.geellow.com/webhook/la-anonima', redisValue: null }]
});

const loadOrInitState = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Load or Init State',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const parsed=$("Parse Input").first().json;\n' +
        'let state=null;\n' +
        'if(inp.redisValue){try{state=JSON.parse(inp.redisValue);}catch(e){}}\n' +
        'if(!state){const cd=parsed.customerData||{};\n' +
        'state={machine_state:"SALUDO",customer:cd,\n' +
        'config:{max_intentos_id:cd.resiliencia||2,max_intentos_neg1:cd.intentos_acuerdo||1,max_intentos_neg2:cd.intentos_acuerdo_2||1,backend_url:cd.backend_url||"","backend_api_key":cd.backend_api_key||""},\n' +
        'intentos_id:0,intentos_neg1:0,intentos_neg2:0,identity_type:null,return_state:null,\n' +
        'motivo_no_pago:null,motivo_clasificado:null,resultado:null,history:[],\n' +
        'started_at:Math.floor(Date.now()/1000)};}\n' +
        'return[{json:{call_sid:parsed.call_sid,rawTranscript:parsed.rawTranscript,customerData:parsed.customerData,actionHook:parsed.actionHook,state:state,machine_state:state.machine_state}}];'
    },
    position: [720, 700]
  },
  output: [{ call_sid: 'test123', rawTranscript: 'si soy yo', customerData: {}, actionHook: 'https://n8n.geellow.com/webhook/la-anonima', state: { machine_state: 'SALUDO', config: {}, intentos_id: 0, intentos_neg1: 0, intentos_neg2: 0, history: [] }, machine_state: 'SALUDO' }]
});

const switchByState = switchCase({
  version: 3.4,
  config: {
    name: 'Switch by State',
    parameters: {
      rules: {
        values: [
          { outputKey: 'SALUDO', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('={{ $json.machine_state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'SALUDO' }], combinator: 'and' } },
          { outputKey: 'VALIDACION_IDENTIDAD', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('={{ $json.machine_state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'VALIDACION_IDENTIDAD' }], combinator: 'and' } },
          { outputKey: 'NEGOCIACION', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('={{ $json.machine_state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'NEGOCIACION' }], combinator: 'and' } },
          { outputKey: 'NEGOCIACION_2', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('={{ $json.machine_state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'NEGOCIACION_2' }], combinator: 'and' } },
          { outputKey: 'MOTIVO_NO_PAGO', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('={{ $json.machine_state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'MOTIVO_NO_PAGO' }], combinator: 'and' } },
          { outputKey: 'CONSULTAS_DUDA', renameOutput: true, conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' }, conditions: [{ leftValue: expr('={{ $json.machine_state }}'), operator: { type: 'string', operation: 'equals' }, rightValue: 'CONSULTAS_DUDA' }], combinator: 'and' } }
        ]
      },
      options: {}
    },
    position: [960, 700]
  }
});

// ===== BRANCH 0: SALUDO (no LLM) =====
const handlerSaludo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Handler SALUDO',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const state=inp.state;\n' +
        'const cd=state.customer||{};\n' +
        'const actionHook=inp.actionHook;\n' +
        'const nombre=(cd.Nombre||"usted").split(" ")[0];\n' +
        'const texto=cd.saludo_inicial||("Hola, buenos dias. Soy Sofia, le hablo de "+(cd.Entidad||"La Anonima")+". Me comunico con "+nombre+"?");\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString()});\n' +
        'state.machine_state="VALIDACION_IDENTIDAD";\n' +
        'const verbs=[\n' +
        '  {verb:"config",bargeIn:{enable:false}},\n' +
        '  {verb:"gather",input:["speech"],timeout:8,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}\n' +
        '];\n' +
        'const report={event:"turn",call_sid:inp.call_sid,campaign_id:cd.campaign_id||"",record_index:cd.record_index||"",state_before:stateBefore,state_after:state.machine_state,user_said:"",bot_said:texto,intentos:{id:state.intentos_id,neg1:state.intentos_neg1,neg2:state.intentos_neg2},terminal:false,timestamp:new Date().toISOString()};\n' +
        'return[{json:{call_sid:inp.call_sid,state:state,verbs:verbs,terminal:false,report:report}}];'
    },
    position: [1200, 100]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const redisSetSaludo = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (Saludo)',
    parameters: { operation: 'set', key: expr('={{ "la-anonima:call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1440, 100]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const reportSaludo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Turn (Saludo)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [1680, 100]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const respondSaludo = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Saludo',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [1920, 100]
  },
  output: [{}]
});

// ===== BRANCH 1: VALIDACION_IDENTIDAD (with LLM classifier) =====
const lmValidacion = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Validacion',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responsesApiEnabled: false,
      options: { temperature: 0.2, maxTokens: 200, timeout: 8000, maxRetries: 1 }
    },
    credentials: { openAiApi: newCredential('OpenAI La Anonima') },
    position: [1200, 300]
  }
});

const parserValidacion = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Parser Validacion',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"decision":"titular","razonamiento":"el cliente dijo que era el mismo"}'
    },
    position: [1340, 300]
  }
});

const llmValidacion = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'LLM Validacion',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.rawTranscript || "[silencio - sin respuesta]" }}'),
      hasOutputParser: true,
      messages: {
        messageValues: [
          { type: 'SystemMessagePromptTemplate', message: expr('=Eres Sofia, un agente de cobranzas de {{ $json.customerData.Entidad }}. Estas llamando a {{ $json.customerData.Nombre }} sobre una deuda.\n\nTu tarea: clasificar la primera respuesta del cliente al saludo inicial. Debes decidir entre:\n- "titular": El cliente confirma que es {{ $json.customerData.Nombre }} (dice si, soy yo, hablo yo, el mismo, asi es, etc.)\n- "tercero": Es otra persona que se hace cargo o tiene relacion (familiar, esposo/a, soy responsable, voy a pagar yo, etc.)\n- "desconocido": No conoce o numero equivocado (no soy, no es, numero equivocado, no vive, no conozco, etc.)\n- "consulta": Hace una pregunta o pide informacion antes de identificarse (cuanto?, quien?, de que?, para que?, etc.)\n- "silencio": No hubo respuesta (transcript vacio o solo silencio)\n- "ambiguo": No esta claro y no entra en ninguna categoria anterior\n\nReglas:\n- Si la respuesta es solo "no" o muy corta tipo "no, no", clasifica como "desconocido"\n- Si pregunta algo antes de confirmar identidad, es "consulta"\n- Si confirma con cualquier forma de "si" o "soy", es "titular"\n- Si se identifica como otra persona relacionada (familiar, responsable), es "tercero"\n\nDevuelve SOLO JSON con la clasificacion.') }
        ]
      }
    },
    subnodes: { model: lmValidacion, outputParser: parserValidacion },
    position: [1200, 350]
  },
  output: [{ output: { decision: 'titular', razonamiento: 'cliente confirmo identidad' } }]
});

const decideValidacion = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Validacion',
    parameters: {
      jsCode:
        'const llmOut=$input.first().json.output||{};\n' +
        'const decision=llmOut.decision||"ambiguo";\n' +
        'const razonamiento=llmOut.razonamiento||"";\n' +
        'const orig=$("Load or Init State").first().json;\n' +
        'const state=orig.state;\n' +
        'const cd=state.customer||{};\n' +
        'const actionHook=orig.actionHook;\n' +
        'const nombre=(cd.Nombre||"usted").split(" ")[0];\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'if(orig.rawTranscript)state.history.push({role:"user",content:orig.rawTranscript,ts:new Date().toISOString()});\n' +
        'let verbs,terminal,texto;\n' +
        'if(decision==="consulta"){\n' +
        '  state.return_state="VALIDACION_IDENTIDAD";\n' +
        '  state.machine_state="CONSULTAS_DUDA";\n' +
        '  texto="Claro, con gusto le respondo. Cual es su consulta?";\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:10,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(decision==="titular"){\n' +
        '  state.identity_type="titular";\n' +
        '  state.machine_state="NEGOCIACION";\n' +
        '  state.intentos_neg1=0;\n' +
        '  const deuda=cd.Deuda||"el importe pendiente";\n' +
        '  const venc=cd.Vencimiento||"";\n' +
        '  texto=nombre+", le contacto por una deuda pendiente con "+(cd.Entidad||"La Anonima")+" por "+deuda+(venc?(" con vencimiento el "+venc):"")+". Podra regularizarla dentro del plazo?";\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:12,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(decision==="tercero"){\n' +
        '  state.identity_type="tercero";\n' +
        '  state.machine_state="NEGOCIACION";\n' +
        '  state.intentos_neg1=0;\n' +
        '  const deuda=cd.Deuda||"el importe pendiente";\n' +
        '  texto="Perfecto. Le informo que "+(cd.Nombre||"el titular")+" tiene una deuda con "+(cd.Entidad||"La Anonima")+" por "+deuda+". Podra gestionar el pago?";\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:12,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(decision==="desconocido"){\n' +
        '  state.machine_state="DESPEDIDA_RAPIDA";\n' +
        '  state.resultado="numero_equivocado";\n' +
        '  texto="Disculpe la molestia, que tenga buen dia.";\n' +
        '  terminal=true;\n' +
        '  verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '}else{\n' +
        '  state.intentos_id=(state.intentos_id||0)+1;\n' +
        '  const maxId=(state.config&&state.config.max_intentos_id)||2;\n' +
        '  if(state.intentos_id>=maxId){\n' +
        '    state.machine_state="DESPEDIDA_RAPIDA";\n' +
        '    state.resultado=decision==="silencio"?"sin_respuesta":"no_identificado";\n' +
        '    texto="No pudimos completar la comunicacion. Que tenga buen dia.";\n' +
        '    terminal=true;\n' +
        '    verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '  }else{\n' +
        '    texto=decision==="silencio"?("Hola, hablo con "+nombre+"?"):("Disculpe, podria confirmar si hablo con "+nombre+"?");\n' +
        '    terminal=false;\n' +
        '    verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:8,bargein:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '  }\n' +
        '}\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString(),llm_decision:decision,llm_razonamiento:razonamiento});\n' +
        'const report={event:terminal?"call_ended":"turn",call_sid:orig.call_sid,campaign_id:cd.campaign_id||"",record_index:cd.record_index||"",state_before:stateBefore,state_after:state.machine_state,user_said:orig.rawTranscript||"",bot_said:texto,llm_decision:decision,intentos:{id:state.intentos_id,neg1:state.intentos_neg1,neg2:state.intentos_neg2},terminal:terminal,resultado:terminal?state.resultado:null,history:terminal?state.history:undefined,timestamp:new Date().toISOString()};\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:terminal,report:report}}];'
    },
    position: [1440, 350]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const terminalVI = ifElse({
  version: 2.2,
  config: {
    name: 'Terminal? (VI)',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('={{ $json.terminal }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }], combinator: 'and' }, options: {} },
    position: [1680, 350]
  }
});

const redisDelVI = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Delete (VI)',
    parameters: { operation: 'delete', key: expr('={{ "la-anonima:call:" + $json.call_sid }}') },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 280]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: true, report: {} }]
});

const reportTermVI = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Terminal (VI)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [2160, 280]
  },
  output: [{}]
});

const respondTermVI = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Terminal (VI)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2400, 280]
  },
  output: [{}]
});

const redisSetVI = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (VI)',
    parameters: { operation: 'set', key: expr('={{ "la-anonima:call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 420]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const reportContVI = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Continue (VI)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [2160, 420]
  },
  output: [{}]
});

const respondContVI = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Continue (VI)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2400, 420]
  },
  output: [{}]
});

// ===== BRANCH 2: NEGOCIACION (with LLM negotiator) =====
const lmNeg = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Negociacion',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responsesApiEnabled: false,
      options: { temperature: 0.5, maxTokens: 250, timeout: 10000, maxRetries: 1 }
    },
    credentials: { openAiApi: newCredential('OpenAI La Anonima') },
    position: [1200, 600]
  }
});

const parserNeg = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Parser Negociacion',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"respuesta":"Perfecto, gracias por su compromiso.","senal":"ACUERDO"}'
    },
    position: [1340, 600]
  }
});

const llmNeg = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'LLM Negociacion',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.rawTranscript || "[silencio - sin respuesta]" }}'),
      hasOutputParser: true,
      messages: {
        messageValues: [
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos Sofia, agente de cobranzas de {{ $json.customerData.Entidad }}. Hablas en espanol rioplatense, formal, de "usted", profesional, directa. Maximo 2 oraciones por respuesta. Una pregunta por turno.\n\nDATOS DE LA LLAMADA:\n- Cliente: {{ $json.customerData.Nombre }}\n- Deuda: {{ $json.customerData.Deuda }}\n- Vencimiento: {{ $json.customerData.Vencimiento }}\n- Codigo cliente: {{ $json.customerData.CodCliente }}\n\nESTAS EN LA FASE DE NEGOCIACION INICIAL. Ya identificaste al cliente. Tenes que gestionar su respuesta sobre el pago.\n\nCLASIFICA lo que dijo el cliente y respondele:\n\n- ACUERDO: Si confirma que va a pagar (acepta, dice "si", "voy a pagar", "lo pago", "puedo", "este viernes", "manana", da una fecha concreta, se compromete). Respuesta: confirma brevemente el compromiso, mencionar codigo de cliente {{ $json.customerData.CodCliente }} y despedirse. senal: ACUERDO.\n\n- FIN_NEGATIVO: Si claramente NO puede o NO quiere pagar ("no puedo", "no tengo plata", "imposible", "no voy a pagar"). Respuesta: breve acknowledge, pedir el motivo. senal: FIN.\n\n- CONSULTA: Si pregunta algo (cuanto?, como?, formas de pago?, plazos?). Respuesta: invitar a hacer la consulta. senal: CONSULTA.\n\n- CONTINUAR: Si duda, evade, no responde claro, da una respuesta ambigua. Respuesta: insistir profesionalmente, repreguntar si puede pagar dentro del plazo. senal: CONTINUAR.\n\nReglas estrictas:\n- NO ofrezcas cuotas, descuentos, refinanciacion ni alternativas.\n- NO inventes datos, fechas, consecuencias legales ni intereses.\n- Solo hablas de: deuda, pago, vencimiento, codigo cliente, motivo no pago.\n- Cuando hay ACUERDO, mencionar codigo {{ $json.customerData.CodCliente }} y despedirse brevemente.\n\nDevuelve JSON con respuesta (lo que vas a decir) y senal (ACUERDO/FIN/CONSULTA/CONTINUAR).') }
        ]
      }
    },
    subnodes: { model: lmNeg, outputParser: parserNeg },
    position: [1200, 650]
  },
  output: [{ output: { respuesta: 'Perfecto, su codigo es 46892.', senal: 'ACUERDO' } }]
});

const decideNeg = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Negociacion',
    parameters: {
      jsCode:
        'const llmOut=$input.first().json.output||{};\n' +
        'const respuestaLLM=llmOut.respuesta||"Disculpe, podria repetir?";\n' +
        'const senal=(llmOut.senal||"CONTINUAR").toUpperCase();\n' +
        'const orig=$("Load or Init State").first().json;\n' +
        'const state=orig.state;\n' +
        'const cd=state.customer||{};\n' +
        'const actionHook=orig.actionHook;\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'if(orig.rawTranscript)state.history.push({role:"user",content:orig.rawTranscript,ts:new Date().toISOString()});\n' +
        'let verbs,terminal,texto;\n' +
        'if(senal==="ACUERDO"){\n' +
        '  state.machine_state="DESPEDIDA_ACUERDO";\n' +
        '  state.resultado="acuerdo";\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=true;\n' +
        '  verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '}else if(senal==="CONSULTA"){\n' +
        '  state.return_state="NEGOCIACION";\n' +
        '  state.machine_state="CONSULTAS_DUDA";\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:10,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(senal==="FIN"){\n' +
        '  state.machine_state="MOTIVO_NO_PAGO";\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:15,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else{\n' +
        '  state.intentos_neg1=(state.intentos_neg1||0)+1;\n' +
        '  const maxN1=(state.config&&state.config.max_intentos_neg1)||1;\n' +
        '  if(state.intentos_neg1>=maxN1){\n' +
        '    state.machine_state="NEGOCIACION_2";\n' +
        '    state.intentos_neg2=0;\n' +
        '  }\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:12,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString(),llm_senal:senal});\n' +
        'const report={event:terminal?"call_ended":"turn",call_sid:orig.call_sid,campaign_id:cd.campaign_id||"",record_index:cd.record_index||"",state_before:stateBefore,state_after:state.machine_state,user_said:orig.rawTranscript||"",bot_said:texto,llm_senal:senal,intentos:{id:state.intentos_id,neg1:state.intentos_neg1,neg2:state.intentos_neg2},terminal:terminal,resultado:terminal?state.resultado:null,history:terminal?state.history:undefined,timestamp:new Date().toISOString()};\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:terminal,report:report}}];'
    },
    position: [1440, 650]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const terminalNEG = ifElse({
  version: 2.2,
  config: {
    name: 'Terminal? (NEG)',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('={{ $json.terminal }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }], combinator: 'and' }, options: {} },
    position: [1680, 650]
  }
});

const redisDelNEG = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Delete (NEG)',
    parameters: { operation: 'delete', key: expr('={{ "la-anonima:call:" + $json.call_sid }}') },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 580]
  },
  output: [{}]
});

const reportTermNEG = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Terminal (NEG)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [2160, 580]
  },
  output: [{}]
});

const respondTermNEG = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Terminal (NEG)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2400, 580]
  },
  output: [{}]
});

const redisSetNEG = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (NEG)',
    parameters: { operation: 'set', key: expr('={{ "la-anonima:call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 720]
  },
  output: [{}]
});

const reportContNEG = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Continue (NEG)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [2160, 720]
  },
  output: [{}]
});

const respondContNEG = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Continue (NEG)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2400, 720]
  },
  output: [{}]
});

// ===== BRANCH 3: NEGOCIACION_2 =====
const lmNeg2 = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Negociacion 2',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responsesApiEnabled: false,
      options: { temperature: 0.5, maxTokens: 250, timeout: 10000, maxRetries: 1 }
    },
    credentials: { openAiApi: newCredential('OpenAI La Anonima') },
    position: [1200, 900]
  }
});

const parserNeg2 = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Parser Negociacion 2',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"respuesta":"Entiendo. Para registrarlo, podria decirme el motivo?","senal":"FIN"}'
    },
    position: [1340, 900]
  }
});

const llmNeg2 = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'LLM Negociacion 2',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.rawTranscript || "[silencio - sin respuesta]" }}'),
      hasOutputParser: true,
      messages: {
        messageValues: [
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos Sofia, agente de cobranzas de {{ $json.customerData.Entidad }}. Espanol rioplatense, formal, "usted". Maximo 2 oraciones.\n\nDATOS:\n- Cliente: {{ $json.customerData.Nombre }}\n- Deuda: {{ $json.customerData.Deuda }}\n- Vencimiento: {{ $json.customerData.Vencimiento }}\n- Codigo: {{ $json.customerData.CodCliente }}\n\nESTAS EN NEGOCIACION SEGUNDARIA. El cliente ya rechazo una vez. Tu objetivo aca es:\n1. Ofrecer una ULTIMA oportunidad mencionando que regularizar es importante\n2. Aceptar el acuerdo si lo das, o cerrar respetuosamente preguntando el motivo\n\nCLASIFICA y responde:\n\n- ACUERDO: Acepta pagar ahora. Respuesta: confirmar, dar codigo {{ $json.customerData.CodCliente }}, despedir. senal: ACUERDO.\n\n- FIN_NEGATIVO: Sigue sin aceptar (no, no puedo, no tengo). Respuesta: aceptar con respeto, pedir el motivo principal para registrarlo. senal: FIN.\n\n- CONSULTA: Hace una pregunta. Respuesta: invitar a hacer la consulta. senal: CONSULTA.\n\n- CONTINUAR: Duda o evade. Respuesta: insistir UNA vez mas brevemente recordando la importancia de regularizar. senal: CONTINUAR.\n\nReglas:\n- NO ofrezcas cuotas, descuentos ni refinanciacion.\n- Es tu ULTIMO intento serio antes de cerrar.\n- Si CONTINUAR, hace una insistencia breve y firme pero respetuosa.\n\nDevuelve JSON con respuesta y senal (ACUERDO/FIN/CONSULTA/CONTINUAR).') }
        ]
      }
    },
    subnodes: { model: lmNeg2, outputParser: parserNeg2 },
    position: [1200, 950]
  },
  output: [{ output: { respuesta: 'Entiendo. Cual es el motivo?', senal: 'FIN' } }]
});

const decideNeg2 = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Negociacion 2',
    parameters: {
      jsCode:
        'const llmOut=$input.first().json.output||{};\n' +
        'const respuestaLLM=llmOut.respuesta||"Disculpe, podria repetir?";\n' +
        'const senal=(llmOut.senal||"CONTINUAR").toUpperCase();\n' +
        'const orig=$("Load or Init State").first().json;\n' +
        'const state=orig.state;\n' +
        'const cd=state.customer||{};\n' +
        'const actionHook=orig.actionHook;\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'if(orig.rawTranscript)state.history.push({role:"user",content:orig.rawTranscript,ts:new Date().toISOString()});\n' +
        'let verbs,terminal,texto;\n' +
        'if(senal==="ACUERDO"){\n' +
        '  state.machine_state="DESPEDIDA_ACUERDO";\n' +
        '  state.resultado="acuerdo_neg2";\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=true;\n' +
        '  verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '}else if(senal==="CONSULTA"){\n' +
        '  state.return_state="NEGOCIACION_2";\n' +
        '  state.machine_state="CONSULTAS_DUDA";\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:10,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(senal==="FIN"){\n' +
        '  state.machine_state="MOTIVO_NO_PAGO";\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:15,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else{\n' +
        '  state.intentos_neg2=(state.intentos_neg2||0)+1;\n' +
        '  const maxN2=(state.config&&state.config.max_intentos_neg2)||1;\n' +
        '  if(state.intentos_neg2>=maxN2){\n' +
        '    state.machine_state="MOTIVO_NO_PAGO";\n' +
        '  }\n' +
        '  texto=respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:12,bargein:true,actionHook:actionHook,say:{text:texto}}];\n' +
        '}\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString(),llm_senal:senal});\n' +
        'const report={event:terminal?"call_ended":"turn",call_sid:orig.call_sid,campaign_id:cd.campaign_id||"",record_index:cd.record_index||"",state_before:stateBefore,state_after:state.machine_state,user_said:orig.rawTranscript||"",bot_said:texto,llm_senal:senal,intentos:{id:state.intentos_id,neg1:state.intentos_neg1,neg2:state.intentos_neg2},terminal:terminal,resultado:terminal?state.resultado:null,history:terminal?state.history:undefined,timestamp:new Date().toISOString()};\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:terminal,report:report}}];'
    },
    position: [1440, 950]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const terminalNEG2 = ifElse({
  version: 2.2,
  config: {
    name: 'Terminal? (NEG2)',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('={{ $json.terminal }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }], combinator: 'and' }, options: {} },
    position: [1680, 950]
  }
});

const redisDelNEG2 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Delete (NEG2)',
    parameters: { operation: 'delete', key: expr('={{ "la-anonima:call:" + $json.call_sid }}') },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 880]
  },
  output: [{}]
});

const reportTermNEG2 = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Terminal (NEG2)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [2160, 880]
  },
  output: [{}]
});

const respondTermNEG2 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Terminal (NEG2)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2400, 880]
  },
  output: [{}]
});

const redisSetNEG2 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (NEG2)',
    parameters: { operation: 'set', key: expr('={{ "la-anonima:call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 1020]
  },
  output: [{}]
});

const reportContNEG2 = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Continue (NEG2)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [2160, 1020]
  },
  output: [{}]
});

const respondContNEG2 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Continue (NEG2)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2400, 1020]
  },
  output: [{}]
});

// ===== BRANCH 4: MOTIVO_NO_PAGO (always terminal, LLM classifies reason) =====
const lmMotivo = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Motivo',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responsesApiEnabled: false,
      options: { temperature: 0.1, maxTokens: 200, timeout: 8000, maxRetries: 1 }
    },
    credentials: { openAiApi: newCredential('OpenAI La Anonima') },
    position: [1200, 1200]
  }
});

const parserMotivo = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Parser Motivo',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"motivo_clasificado":"sin_empleo","despedida":"Gracias por su tiempo, le deseamos lo mejor. Que tenga buen dia."}'
    },
    position: [1340, 1200]
  }
});

const llmMotivo = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'LLM Motivo',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.rawTranscript || "[el cliente no respondio]" }}'),
      hasOutputParser: true,
      messages: {
        messageValues: [
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos Sofia, agente de cobranzas de {{ $json.customerData.Entidad }}. Espanol rioplatense, formal.\n\nTu tarea: clasificar el motivo por el que {{ $json.customerData.Nombre }} no puede pagar, y generar una despedida cordial.\n\nClasifica el motivo en UNA de estas categorias:\n- desconoce_deuda: dice que no conoce la deuda o no la reconoce\n- pago_automatico: dice que ya tiene pago automatico configurado\n- sin_empleo: perdio el trabajo, sin ingresos\n- enfermedad: problemas de salud, internado, enfermo\n- viaje: esta de viaje o fuera del pais\n- niega: simplemente no quiere pagar, no le interesa\n- otro: no encaja en las anteriores\n\nLa despedida debe ser:\n- Breve (1-2 oraciones)\n- Respetuosa y formal\n- NO debe insistir mas\n- NO debe ofrecer alternativas\n- Debe mostrar que se registro el motivo\n\nDevuelve JSON con motivo_clasificado y despedida (texto a decir).') }
        ]
      }
    },
    subnodes: { model: lmMotivo, outputParser: parserMotivo },
    position: [1200, 1250]
  },
  output: [{ output: { motivo_clasificado: 'sin_empleo', despedida: 'Gracias por su tiempo. Que tenga buen dia.' } }]
});

const decideMotivo = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Motivo',
    parameters: {
      jsCode:
        'const llmOut=$input.first().json.output||{};\n' +
        'const motivoClasificado=llmOut.motivo_clasificado||"otro";\n' +
        'const despedida=llmOut.despedida||(($("Load or Init State").first().json.state.customer.saludo_despedida)||"Gracias por su tiempo. Que tenga buen dia.");\n' +
        'const orig=$("Load or Init State").first().json;\n' +
        'const state=orig.state;\n' +
        'const cd=state.customer||{};\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'if(orig.rawTranscript){state.history.push({role:"user",content:orig.rawTranscript,ts:new Date().toISOString()});state.motivo_no_pago=orig.rawTranscript;}\n' +
        'state.motivo_clasificado=motivoClasificado;\n' +
        'state.machine_state="DESPEDIDA_SIN_ACUERDO";\n' +
        'state.resultado="sin_acuerdo";\n' +
        'state.history.push({role:"assistant",content:despedida,ts:new Date().toISOString(),motivo_clasificado:motivoClasificado});\n' +
        'const report={event:"call_ended",call_sid:orig.call_sid,campaign_id:cd.campaign_id||"",record_index:cd.record_index||"",state_before:stateBefore,state_after:state.machine_state,user_said:orig.rawTranscript||"",bot_said:despedida,motivo_no_pago:state.motivo_no_pago,motivo_clasificado:motivoClasificado,intentos:{id:state.intentos_id,neg1:state.intentos_neg1,neg2:state.intentos_neg2},terminal:true,resultado:state.resultado,history:state.history,timestamp:new Date().toISOString()};\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:[{verb:"say",text:despedida},{verb:"hangup"}],terminal:true,report:report}}];'
    },
    position: [1440, 1250]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: true, report: {} }]
});

const redisDelMotivo = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Delete (Motivo)',
    parameters: { operation: 'delete', key: expr('={{ "la-anonima:call:" + $json.call_sid }}') },
    credentials: { redis: newCredential('Redis account') },
    position: [1680, 1250]
  },
  output: [{}]
});

const reportMotivo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Terminal (Motivo)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [1920, 1250]
  },
  output: [{}]
});

const respondMotivo = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Motivo',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 1250]
  },
  output: [{}]
});

// ===== BRANCH 5: CONSULTAS_DUDA (never terminal, LLM answers) =====
const lmConsultas = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI Consultas',
    parameters: {
      model: { __rl: true, mode: 'list', value: 'gpt-4o-mini' },
      responsesApiEnabled: false,
      options: { temperature: 0.3, maxTokens: 200, timeout: 8000, maxRetries: 1 }
    },
    credentials: { openAiApi: newCredential('OpenAI La Anonima') },
    position: [1200, 1500]
  }
});

const parserConsultas = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Parser Consultas',
    parameters: {
      schemaType: 'fromJson',
      jsonSchemaExample: '{"respuesta":"La deuda es de 130000 pesos. Hablo con usted?"}'
    },
    position: [1340, 1500]
  }
});

const llmConsultas = node({
  type: '@n8n/n8n-nodes-langchain.chainLlm',
  version: 1.9,
  config: {
    name: 'LLM Consultas',
    parameters: {
      promptType: 'define',
      text: expr('={{ $json.rawTranscript || "[silencio]" }}'),
      hasOutputParser: true,
      messages: {
        messageValues: [
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos Sofia, agente de cobranzas de {{ $json.customerData.Entidad }}. Espanol rioplatense, formal, de "usted". Maximo 2 oraciones, profesional y directa.\n\n=== DATOS DISPONIBLES ===\n- Cliente: {{ $json.customerData.Nombre }}\n- Deuda: {{ $json.customerData.Deuda }}\n- Vencimiento: {{ $json.customerData.Vencimiento }}\n- Codigo de cliente: {{ $json.customerData.CodCliente }}\n- Entidad: {{ $json.customerData.Entidad }}\n- Formas de pago: {{ JSON.stringify($json.customerData.formas_de_pago) }}\n\n=== CONTEXTO CRITICO ===\nreturn_state = {{ $json.state.return_state }}\n\n- Si return_state es "VALIDACION_IDENTIDAD" → el cliente AUN NO confirmo su identidad\n- Si return_state es "NEGOCIACION" o "NEGOCIACION_2" → el cliente YA ESTA IDENTIFICADO como {{ $json.customerData.Nombre }}. NO le vuelvas a preguntar quien es, ya lo sabes.\n\n=== TU TAREA ===\nEl cliente dijo algo durante una pausa de consulta. Analiza que tipo de mensaje es y respondele segun el caso:\n\nCASO A - Hace una NUEVA pregunta concreta (cuanto?, como?, cuando?, quien?, etc.):\n- Responde con el dato exacto en UNA oracion\n- Agrega la redireccion correspondiente (ver REDIRECCION mas abajo)\n\nCASO B - Indica que ya entendio, agradece o cierra la consulta (ok, ya entendi, perfecto, gracias, bueno, dale, ya esta, etc.):\n- NO repitas la informacion anterior\n- Solo confirma brevemente con algo como "Perfecto" o "Bien"\n- Hace solo la redireccion (ver REDIRECCION)\n\nCASO C - Sigue sin entender o pregunta lo mismo de otra forma:\n- Aclara brevemente con otras palabras\n- Agrega la redireccion correspondiente\n\n=== REDIRECCION (al final de tu respuesta) ===\nElegi UNA segun return_state:\n\nSi return_state es "VALIDACION_IDENTIDAD":\n- "Hablo con {{ ($json.customerData.Nombre || "usted").split(" ")[0] }}?"\n\nSi return_state es "NEGOCIACION" o "NEGOCIACION_2" o null:\n- "Le parece bien que continuemos con el tema del pago?"\n- O: "Tiene alguna otra consulta o podemos seguir?"\n- O: "Podemos avanzar con la regularizacion?"\n- (Variarlas para no sonar robotica. NUNCA preguntes la identidad en este caso.)\n\n=== REGLAS ESTRICTAS ===\n- NO inventes datos. Si no tenes algun dato, deci "No dispongo de ese dato".\n- NO ofrezcas cuotas, descuentos, refinanciacion ni alternativas que no esten en formas de pago.\n- NO repitas literalmente lo que ya dijiste antes.\n- NUNCA preguntes "Hablo con X?" si return_state ya es NEGOCIACION/NEGOCIACION_2.\n- Maximo 2 oraciones en total (respuesta + redireccion).\n\nDevuelve JSON con "respuesta" (texto completo a decir, ya incluyendo la redireccion).') }
        ]
      }
    },
    subnodes: { model: lmConsultas, outputParser: parserConsultas },
    position: [1200, 1550]
  },
  output: [{ output: { respuesta: 'La deuda es de 130000 pesos. Hablo con usted?' } }]
});

const decideConsultas = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Decide Consultas',
    parameters: {
      jsCode:
        'const llmOut=$input.first().json.output||{};\n' +
        'const respuesta=llmOut.respuesta||"Entiendo su consulta. Podemos continuar?";\n' +
        'const orig=$("Load or Init State").first().json;\n' +
        'const state=orig.state;\n' +
        'const cd=state.customer||{};\n' +
        'const actionHook=orig.actionHook;\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'if(orig.rawTranscript)state.history.push({role:"user",content:orig.rawTranscript,ts:new Date().toISOString()});\n' +
        'const returnState=state.return_state||"VALIDACION_IDENTIDAD";\n' +
        'state.machine_state=returnState;\n' +
        'state.return_state=null;\n' +
        'state.history.push({role:"assistant",content:respuesta,ts:new Date().toISOString(),from:"consultas"});\n' +
        'const verbs=[{verb:"config",bargeIn:{enable:true}},{verb:"gather",input:["speech"],timeout:10,bargein:true,actionHook:actionHook,say:{text:respuesta}}];\n' +
        'const report={event:"turn",call_sid:orig.call_sid,campaign_id:cd.campaign_id||"",record_index:cd.record_index||"",state_before:stateBefore,state_after:state.machine_state,user_said:orig.rawTranscript||"",bot_said:respuesta,intentos:{id:state.intentos_id,neg1:state.intentos_neg1,neg2:state.intentos_neg2},terminal:false,timestamp:new Date().toISOString()};\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:false,report:report}}];'
    },
    position: [1440, 1550]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const redisSetConsultas = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (CD)',
    parameters: { operation: 'set', key: expr('={{ "la-anonima:call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1680, 1550]
  },
  output: [{}]
});

const reportConsultas = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Report Continue (CD)',
    parameters: { method: 'POST', url: DEV_CAPTURE_URL, sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($json.report) }}'), options: { timeout: 3000 } },
    onError: 'continueRegularOutput',
    position: [1920, 1550]
  },
  output: [{}]
});

const respondConsultas = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond Consultas',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 1550]
  },
  output: [{}]
});

export default workflow('VdmF9mjoZFiUpH4j', 'La Anonima')
  .add(webhookApp)
  .to(parseInput)
  .to(redisGetState)
  .to(loadOrInitState)
  .to(switchByState
    .onCase(0, handlerSaludo.to(redisSetSaludo).to(respondSaludo).to(reportSaludo))
    .onCase(1, llmValidacion.to(decideValidacion).to(
      terminalVI
        .onTrue(redisDelVI.to(respondTermVI).to(reportTermVI))
        .onFalse(redisSetVI.to(respondContVI).to(reportContVI))
    ))
    .onCase(2, llmNeg.to(decideNeg).to(
      terminalNEG
        .onTrue(redisDelNEG.to(respondTermNEG).to(reportTermNEG))
        .onFalse(redisSetNEG.to(respondContNEG).to(reportContNEG))
    ))
    .onCase(3, llmNeg2.to(decideNeg2).to(
      terminalNEG2
        .onTrue(redisDelNEG2.to(respondTermNEG2).to(reportTermNEG2))
        .onFalse(redisSetNEG2.to(respondContNEG2).to(reportContNEG2))
    ))
    .onCase(4, llmMotivo.to(decideMotivo).to(redisDelMotivo).to(respondMotivo).to(reportMotivo))
    .onCase(5, llmConsultas.to(decideConsultas).to(redisSetConsultas).to(respondConsultas).to(reportConsultas))
  );
