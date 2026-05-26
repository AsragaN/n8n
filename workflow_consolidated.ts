import { workflow, node, trigger, ifElse, switchCase, newCredential, languageModel, outputParser, expr } from '@n8n/workflow-sdk';

const DEV_CAPTURE_URL = 'https://n8n.geellow.com/webhook/la-anonima-dev-capture';
const BACKEND_RECORD_URL = 'https://voice1.progeny.com.ar/webhooks/record-update';
const BACKEND_STATUS_URL = 'https://voice1.progeny.com.ar/webhooks/call-status';
const BACKEND_API_KEY = 'vb_3W8DGWAJ3_uEX4NgWnIOCMOtzhp3ADDC0FH6iIaOWxI';

// ============================================================================
// TRIGGER 1: CONVERSATION  (POST /la-anonima)
// ============================================================================

const webhookApp = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook App',
    parameters: { httpMethod: 'POST', path: 'la-anonima', responseMode: 'responseNode', options: {} },
    position: [0, 700]
  },
  output: [{ body: { call_sid: 'test123', speech: { alternatives: [{ transcript: 'si soy yo' }] }, customerData: { Nombre: 'Emmanuel Tartallini' } }, headers: { host: 'n8n.geellow.com', 'x-forwarded-proto': 'https' } }]
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
        'const actionHook=inp.webhookUrl||("https://"+host+"/webhook/la-anonima");\n' +
        'const cdRaw=body.customerData||{};\n' +
        'function safeParse(s){if(!s)return null;if(typeof s==="object")return s;try{return JSON.parse(s);}catch(e){return null;}}\n' +
        'function dateToWords(s){if(s==null||s==="")return "";s=String(s);var m=s.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})/);if(!m)return s;var dia=parseInt(m[1],10),mes=parseInt(m[2],10);if(dia<1||dia>31||mes<1||mes>12)return s;var meses=["","enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];return dia+" de "+meses[mes];}\n' +
        'function numToWords(s){if(s==null||s==="")return "";s=String(s);if(/[a-zA-Z]/.test(s))return s;var n=parseInt(s.replace(/[^0-9]/g,""),10);if(isNaN(n))return s;if(n===0)return "cero";var u=["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve"];var e=["diez","once","doce","trece","catorce","quince","dieciseis","diecisiete","dieciocho","diecinueve"];var d=["","","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];var c=["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];function g(num){if(num===0)return "";if(num===100)return "cien";var r="",cc=Math.floor(num/100),dd=Math.floor((num%100)/10),uu=num%10,rr=num%100;if(cc>0)r+=c[cc];if(rr>0){if(r)r+=" ";if(rr<10)r+=u[rr];else if(rr<20)r+=e[rr-10];else if(rr===20)r+="veinte";else if(rr<30)r+="veinti"+u[rr-20];else{r+=d[dd];if(uu>0)r+=" y "+u[uu];}}return r;}if(n<1000)return g(n);if(n<1000000){var m=Math.floor(n/1000),r=n%1000,res;if(m===1)res="mil";else res=g(m)+" mil";if(r>0)res+=" "+g(r);return res;}if(n<1000000000){var mm=Math.floor(n/1000000),rrr=n%1000000,res;if(mm===1)res="un millon";else res=g(mm)+" millones";if(rrr>0){if(rrr>=1000){var miles=Math.floor(rrr/1000),rmil=rrr%1000;if(miles===1)res+=" mil";else res+=" "+g(miles)+" mil";if(rmil>0)res+=" "+g(rmil);}else{res+=" "+g(rrr);}}return res;}return String(n);}\n' +
        'const formasPago=safeParse(cdRaw.formas_de_pago)||[];\n' +
        'const motivosNoAcuerdo=safeParse(cdRaw.motivos_no_acuerdo)||[];\n' +
        'const smsConfig=safeParse(cdRaw.sms_config)||{};\n' +
        'const cd={\n' +
        '  Nombre:cdRaw.Nombre||"",\n' +
        '  CodCliente:cdRaw.CodCliente||"",\n' +
        '  Vencimiento:cdRaw.Vencimiento||"",\n' +
        '  Vencimiento_palabras:dateToWords(cdRaw.Vencimiento||""),\n' +
        '  Telefono:cdRaw.telefono_norm||cdRaw.Telefono||"",\n' +
        '  Deuda:cdRaw.Deuda||"",\n' +
        '  Deuda_palabras:numToWords(cdRaw.Deuda||""),\n' +
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
        '  bot_name:cdRaw.bot_name||"Sofia",\n' +
        '  monto_acuerdo_2:cdRaw.monto_acuerdo_2||"",\n' +
        '  monto_acuerdo_2_palabras:numToWords(cdRaw.monto_acuerdo_2||""),\n' +
        '  fecha_acuerdo_2:cdRaw.fecha_acuerdo_2||"",\n' +
        '  fecha_acuerdo_2_palabras:dateToWords(cdRaw.fecha_acuerdo_2||""),\n' +
        '  max_consultas:parseInt(cdRaw.max_consultas)||3,\n' +
        '  frase_limite_consultas:cdRaw.frase_limite_consultas||"",\n' +
        '  frase_acuerdo_neg1:cdRaw.frase_acuerdo_neg1||"",\n' +
        '  frase_acuerdo_neg2:cdRaw.frase_acuerdo_neg2||"",\n' +
        '  frase_cobro_titular:cdRaw.frase_cobro_titular||"",\n' +
        '  frase_cobro_tercero:cdRaw.frase_cobro_tercero||"",\n' +
        '  frase_no_titular:cdRaw.frase_no_titular||"",\n' +
        '  frase_sin_respuesta:cdRaw.frase_sin_respuesta||"",\n' +
        '  frase_reintento_silencio:cdRaw.frase_reintento_silencio||"",\n' +
        '  frase_reintento_ambiguo:cdRaw.frase_reintento_ambiguo||"",\n' +
        '  frase_consulta_puente:cdRaw.frase_consulta_puente||"",\n' +
        '  frase_neg2_entrada:cdRaw.frase_neg2_entrada||"",\n' +
        '  frase_motivo_entrada:cdRaw.frase_motivo_entrada||"",\n' +
        '  prompt_original:cdRaw.prompt||""\n' +
        '};\n' +
        'Object.keys(cdRaw).forEach(function(k){if(/^frase_(neg1|neg2)_intento_\\d+$/.test(k))cd[k]=cdRaw[k];});\n' +
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
    parameters: { operation: 'get', propertyName: 'redisValue', key: expr('={{ "call:" + $json.call_sid }}'), options: {} },
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
        'config:{max_intentos_id:cd.resiliencia||2,max_intentos_neg1:cd.intentos_acuerdo||1,max_intentos_neg2:cd.intentos_acuerdo_2||1,max_consultas:cd.max_consultas||3,backend_url:cd.backend_url||"","backend_api_key":cd.backend_api_key||""},\n' +
        'intentos_id:0,intentos_neg1:0,intentos_neg2:0,intentos_consultas:0,identity_type:null,return_state:null,\n' +
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
        'const botName=cd.bot_name||"Sofia";\n' +
        'const entidad=cd.Entidad||"La Anonima";\n' +
        'function interp(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:nombre,bot_name:botName,entidad:entidad,deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        'const texto=interp(cd.saludo_inicial)||("Hola, buenos dias. Soy "+botName+", le hablo de "+entidad+". Me comunico con "+nombre+"?");\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString()});\n' +
        'state.machine_state="VALIDACION_IDENTIDAD";\n' +
        'const verbs=[\n' +
        '  {verb:"config",bargeIn:{enable:false}},\n' +
        '  {verb:"gather",input:["speech"],timeout:8,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}\n' +
        '];\n' +
        'return[{json:{call_sid:inp.call_sid,state:state,verbs:verbs,terminal:false}}];'
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
    parameters: { operation: 'set', key: expr('={{ "call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1440, 100]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const respondSaludo = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Saludo',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [1680, 100]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

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
          { type: 'SystemMessagePromptTemplate', message: expr('=Eres {{ $json.customerData.bot_name }}, un agente de cobranzas de {{ $json.customerData.Entidad }}. Estas llamando a {{ $json.customerData.Nombre }} sobre una deuda.\n\nTu tarea: clasificar la primera respuesta del cliente al saludo inicial. Debes decidir entre:\n- "titular": El cliente confirma que es {{ $json.customerData.Nombre }} (dice si, soy yo, hablo yo, el mismo, asi es, etc.)\n- "tercero": Es otra persona que se hace cargo o tiene relacion (familiar, esposo/a, soy responsable, voy a pagar yo, etc.)\n- "desconocido": No conoce o numero equivocado (no soy, no es, numero equivocado, no vive, no conozco, etc.)\n- "consulta": Hace una pregunta o pide informacion antes de identificarse (cuanto?, quien?, de que?, para que?, etc.)\n- "silencio": No hubo respuesta (transcript vacio o solo silencio)\n- "ambiguo": No esta claro y no entra en ninguna categoria anterior\n\nReglas:\n- Si la respuesta es solo "no" o muy corta tipo "no, no", clasifica como "desconocido"\n- Si pregunta algo antes de confirmar identidad, es "consulta"\n- Si confirma con cualquier forma de "si" o "soy", es "titular"\n- Si se identifica como otra persona relacionada (familiar, responsable), es "tercero"\n\nDevuelve SOLO JSON con la clasificacion.') }
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
        'const botName=cd.bot_name||"Sofia";\n' +
        'const entidad=cd.Entidad||"La Anonima";\n' +
        'const deuda=cd.Deuda_palabras||cd.Deuda||"el importe pendiente";\n' +
        'const venc=cd.Vencimiento_palabras||cd.Vencimiento||"";\n' +
        'function interp(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:nombre,nombre_completo:cd.Nombre||"el titular",bot_name:botName,entidad:entidad,deuda:deuda,vencimiento:venc,cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        'const stateBefore=state.machine_state;\n' +
        'state.history=state.history||[];\n' +
        'if(orig.rawTranscript)state.history.push({role:"user",content:orig.rawTranscript,ts:new Date().toISOString()});\n' +
        'let verbs,terminal,texto;\n' +
        'if(decision==="consulta"){\n' +
        '  const _maxConsV=(state.config&&state.config.max_consultas)||3;\n' +
        '  const _curConsV=state.intentos_consultas||0;\n' +
        '  if(_curConsV>=_maxConsV){\n' +
        '    state.machine_state="VALIDACION_IDENTIDAD";\n' +
        '    texto=interp(cd.frase_limite_consultas)||("Disculpe, ya respondi varias consultas. Le pido que confirme si hablo con "+nombre+".");\n' +
        '    terminal=false;\n' +
        '    verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:10,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '  }else{\n' +
        '    state.intentos_consultas=_curConsV+1;\n' +
        '    state.return_state="VALIDACION_IDENTIDAD";\n' +
        '    state.machine_state="CONSULTAS_DUDA";\n' +
        '    texto=interp(cd.frase_consulta_puente)||"Claro, con gusto le respondo. Cual es su consulta?";\n' +
        '    terminal=false;\n' +
        '    verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:10,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '  }\n' +
        '}else if(decision==="titular"){\n' +
        '  state.identity_type="titular";\n' +
        '  state.machine_state="NEGOCIACION";\n' +
        '  state.intentos_neg1=0;\n' +
        '  texto=interp(cd.frase_cobro_titular)||(nombre+", le contacto por una deuda pendiente con "+entidad+" por "+deuda+(venc?(" con vencimiento el "+venc):"")+". Podra regularizarla dentro del plazo?");\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:12,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(decision==="tercero"){\n' +
        '  state.identity_type="tercero";\n' +
        '  state.machine_state="NEGOCIACION";\n' +
        '  state.intentos_neg1=0;\n' +
        '  texto=interp(cd.frase_cobro_tercero)||("Perfecto. Le informo que "+(cd.Nombre||"el titular")+" tiene una deuda con "+entidad+" por "+deuda+". Podra gestionar el pago?");\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:12,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(decision==="desconocido"){\n' +
        '  state.machine_state="DESPEDIDA_RAPIDA";\n' +
        '  state.resultado="numero_equivocado";\n' +
        '  texto=interp(cd.frase_no_titular)||"Disculpe la molestia, que tenga buen dia.";\n' +
        '  terminal=true;\n' +
        '  verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '}else{\n' +
        '  state.intentos_id=(state.intentos_id||0)+1;\n' +
        '  const maxId=(state.config&&state.config.max_intentos_id)||2;\n' +
        '  if(state.intentos_id>=maxId){\n' +
        '    state.machine_state="DESPEDIDA_RAPIDA";\n' +
        '    state.resultado=decision==="silencio"?"sin_respuesta":"no_identificado";\n' +
        '    texto=interp(cd.frase_sin_respuesta)||"No pudimos completar la comunicacion. Que tenga buen dia.";\n' +
        '    terminal=true;\n' +
        '    verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '  }else{\n' +
        '    if(decision==="silencio"){\n' +
        '      texto=interp(cd.frase_reintento_silencio)||("Hola, hablo con "+nombre+"?");\n' +
        '    }else{\n' +
        '      texto=interp(cd.frase_reintento_ambiguo)||("Disculpe, podria confirmar si hablo con "+nombre+"?");\n' +
        '    }\n' +
        '    terminal=false;\n' +
        '    verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:8,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '  }\n' +
        '}\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString(),llm_decision:decision,llm_razonamiento:razonamiento});\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:terminal}}];'
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

const respondTermVI = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Terminal (VI)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 280]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: true, report: {} }]
});

const redisSetVI = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (VI)',
    parameters: { operation: 'set', key: expr('={{ "call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 420]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

const respondContVI = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Continue (VI)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 420]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: false, report: {} }]
});

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
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos {{ $json.customerData.bot_name }}, agente de cobranzas de {{ $json.customerData.Entidad }}. Hablas en espanol rioplatense, formal, de "usted", profesional, directa. Maximo 2 oraciones por respuesta. Una pregunta por turno.\n\nDATOS DE LA LLAMADA:\n- Cliente: {{ $json.customerData.Nombre }}\n- Deuda: {{ $json.customerData.Deuda_palabras || $json.customerData.Deuda }}\n- Vencimiento: {{ $json.customerData.Vencimiento_palabras || $json.customerData.Vencimiento }}\n- Codigo cliente: {{ $json.customerData.CodCliente }}\n\nESTAS EN LA FASE DE NEGOCIACION INICIAL. Ya identificaste al cliente. Tenes que gestionar su respuesta sobre el pago.\n\nCLASIFICA lo que dijo el cliente y respondele:\n\n- ACUERDO: Si confirma que va a pagar (acepta, dice "si", "voy a pagar", "lo pago", "puedo", "este viernes", "manana", da una fecha concreta, se compromete). Respuesta: confirma brevemente el compromiso, mencionar codigo de cliente {{ $json.customerData.CodCliente }} y despedirse. senal: ACUERDO.\n\n- FIN_NEGATIVO: Si claramente NO puede o NO quiere pagar ("no puedo", "no tengo plata", "imposible", "no voy a pagar"). Respuesta: breve acknowledge, pedir el motivo. senal: FIN.\n\n- CONSULTA: Si pregunta algo (cuanto?, como?, formas de pago?, plazos?). Respuesta: invitar a hacer la consulta. senal: CONSULTA.\n\n- CONTINUAR: Si duda, evade, no responde claro, da una respuesta ambigua. Respuesta: insistir profesionalmente, repreguntar si puede pagar dentro del plazo. senal: CONTINUAR.\n\nReglas estrictas:\n- NO ofrezcas cuotas, descuentos, refinanciacion ni alternativas.\n- NO inventes datos, fechas, consecuencias legales ni intereses.\n- Solo hablas de: deuda, pago, vencimiento, codigo cliente, motivo no pago.\n- Cuando hay ACUERDO, mencionar codigo {{ $json.customerData.CodCliente }} y despedirse brevemente.\n\nDevuelve JSON con respuesta (lo que vas a decir) y senal (ACUERDO/FIN/CONSULTA/CONTINUAR).') }
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
        '  const _nombreA=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpAN1(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombreA,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  texto=_interpAN1(cd.frase_acuerdo_neg1)||respuestaLLM;\n' +
        '  terminal=true;\n' +
        '  verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '}else if(senal==="CONSULTA"){\n' +
        '  const _maxConsN=(state.config&&state.config.max_consultas)||3;\n' +
        '  const _curConsN=state.intentos_consultas||0;\n' +
        '  const _nombreCN=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpLimN(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombreCN,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  if(_curConsN>=_maxConsN){\n' +
        '    state.machine_state="NEGOCIACION";\n' +
        '    texto=_interpLimN(cd.frase_limite_consultas)||"Disculpe, ya respondi varias consultas. Es importante que avancemos con el tema del pago. Podemos continuar?";\n' +
        '  }else{\n' +
        '    state.intentos_consultas=_curConsN+1;\n' +
        '    state.return_state="NEGOCIACION";\n' +
        '    state.machine_state="CONSULTAS_DUDA";\n' +
        '    texto=respuestaLLM;\n' +
        '  }\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:10,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(senal==="FIN"){\n' +
        '  state.machine_state="MOTIVO_NO_PAGO";\n' +
        '  const _nombreF=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpFinNeg(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombreF,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  texto=_interpFinNeg(cd.frase_motivo_entrada)||respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:15,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else{\n' +
        '  state.intentos_neg1=(state.intentos_neg1||0)+1;\n' +
        '  const maxN1=(state.config&&state.config.max_intentos_neg1)||1;\n' +
        '  const _nombreN1=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpN1(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombreN1,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"el importe pendiente",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  if(state.intentos_neg1>=maxN1){\n' +
        '    state.machine_state="NEGOCIACION_2";\n' +
        '    state.intentos_neg2=0;\n' +
        '    texto=_interpN1(cd.frase_neg2_entrada)||respuestaLLM;\n' +
        '  }else{\n' +
        '    const _numIntento=state.intentos_neg1+1;\n' +
        '    texto=_interpN1(cd["frase_neg1_intento_"+_numIntento])||respuestaLLM;\n' +
        '  }\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:12,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString(),llm_senal:senal});\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:terminal}}];'
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

const respondTermNEG = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Terminal (NEG)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 580]
  },
  output: [{ verbs: [], report: {} }]
});

const redisSetNEG = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (NEG)',
    parameters: { operation: 'set', key: expr('={{ "call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 720]
  },
  output: [{ verbs: [], report: {} }]
});

const respondContNEG = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Continue (NEG)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 720]
  },
  output: [{ verbs: [], report: {} }]
});

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
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos {{ $json.customerData.bot_name }}, agente de cobranzas de {{ $json.customerData.Entidad }}. Espanol rioplatense, formal, "usted". Maximo 2 oraciones.\n\nDATOS:\n- Cliente: {{ $json.customerData.Nombre }}\n- Deuda total: {{ $json.customerData.Deuda_palabras || $json.customerData.Deuda }}\n- Vencimiento original: {{ $json.customerData.Vencimiento_palabras || $json.customerData.Vencimiento }}\n- Codigo: {{ $json.customerData.CodCliente }}\n\nOFERTA ALTERNATIVA DISPONIBLE EN ESTA FASE:\n- Monto parcial aceptable: {{ $json.customerData.monto_acuerdo_2_palabras || $json.customerData.monto_acuerdo_2 }}\n- Nueva fecha limite para ese pago parcial: {{ $json.customerData.fecha_acuerdo_2_palabras || $json.customerData.fecha_acuerdo_2 }}\n\nESTAS EN NEGOCIACION SEGUNDARIA. El cliente ya rechazo el pago total. Tu objetivo aca es:\n1. Si HAY oferta alternativa (monto parcial y fecha definidos arriba), proponer ese pago parcial con la nueva fecha como una segunda opcion mas accesible.\n2. Si NO hay oferta alternativa (los campos estan vacios o "undefined"), ofrecer una ULTIMA oportunidad mencionando que regularizar es importante, sin alternativas.\n3. Aceptar el acuerdo si lo da, o cerrar respetuosamente preguntando el motivo.\n\nCLASIFICA y responde:\n\n- ACUERDO: Acepta pagar (sea el monto total o el monto parcial). Respuesta: confirmar el acuerdo mencionando el monto y la fecha pactada, dar codigo {{ $json.customerData.CodCliente }}, despedir. senal: ACUERDO.\n\n- FIN_NEGATIVO: Sigue sin aceptar ni siquiera el monto parcial (no, no puedo, no tengo nada). Respuesta: aceptar con respeto, pedir el motivo principal para registrarlo. senal: FIN.\n\n- CONSULTA: Hace una pregunta. Respuesta: invitar a hacer la consulta. senal: CONSULTA.\n\n- CONTINUAR: Duda o evade. Respuesta: insistir UNA vez mas brevemente recordando la oferta parcial (si existe) o la importancia de regularizar. senal: CONTINUAR.\n\nReglas:\n- NO inventes montos ni fechas. Usar SOLO los datos provistos arriba.\n- Si NO hay oferta alternativa definida, NO ofrezcas cuotas, descuentos ni refinanciacion por tu cuenta.\n- Es tu ULTIMO intento serio antes de cerrar.\n- Si CONTINUAR, hace una insistencia breve y firme pero respetuosa.\n\nDevuelve JSON con respuesta y senal (ACUERDO/FIN/CONSULTA/CONTINUAR).') }
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
        '  const _nombreA2=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpAN2(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombreA2,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  texto=_interpAN2(cd.frase_acuerdo_neg2)||respuestaLLM;\n' +
        '  terminal=true;\n' +
        '  verbs=[{verb:"say",text:texto},{verb:"hangup"}];\n' +
        '}else if(senal==="CONSULTA"){\n' +
        '  const _maxConsN2=(state.config&&state.config.max_consultas)||3;\n' +
        '  const _curConsN2=state.intentos_consultas||0;\n' +
        '  const _nombreCN2=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpLimN2(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombreCN2,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  if(_curConsN2>=_maxConsN2){\n' +
        '    state.machine_state="NEGOCIACION_2";\n' +
        '    texto=_interpLimN2(cd.frase_limite_consultas)||"Disculpe, ya respondi varias consultas. Es importante que avancemos con el tema del pago. Podemos continuar?";\n' +
        '  }else{\n' +
        '    state.intentos_consultas=_curConsN2+1;\n' +
        '    state.return_state="NEGOCIACION_2";\n' +
        '    state.machine_state="CONSULTAS_DUDA";\n' +
        '    texto=respuestaLLM;\n' +
        '  }\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:10,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else if(senal==="FIN"){\n' +
        '  state.machine_state="MOTIVO_NO_PAGO";\n' +
        '  const _nombre=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpFin(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombre,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  texto=_interpFin(cd.frase_motivo_entrada)||respuestaLLM;\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:15,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}else{\n' +
        '  state.intentos_neg2=(state.intentos_neg2||0)+1;\n' +
        '  const maxN2=(state.config&&state.config.max_intentos_neg2)||1;\n' +
        '  const _nombre2=(cd.Nombre||"usted").split(" ")[0];\n' +
        '  function _interpN2(t){return(t||"").replace(/\\{(\\w+)\\}/g,function(_,k){const v={nombre:_nombre2,bot_name:cd.bot_name||"Sofia",entidad:cd.Entidad||"La Anonima",deuda:cd.Deuda_palabras||cd.Deuda||"",vencimiento:cd.Vencimiento_palabras||cd.Vencimiento||"",cod_cliente:cd.CodCliente||"",monto_acuerdo_2:cd.monto_acuerdo_2_palabras||cd.monto_acuerdo_2||"",fecha_acuerdo_2:cd.fecha_acuerdo_2_palabras||cd.fecha_acuerdo_2||""};return v[k]!=null?v[k]:"";});}\n' +
        '  if(state.intentos_neg2>=maxN2){\n' +
        '    state.machine_state="MOTIVO_NO_PAGO";\n' +
        '    texto=_interpN2(cd.frase_motivo_entrada)||respuestaLLM;\n' +
        '  }else{\n' +
        '    const _numIntento2=state.intentos_neg2+1;\n' +
        '    texto=_interpN2(cd["frase_neg2_intento_"+_numIntento2])||respuestaLLM;\n' +
        '  }\n' +
        '  terminal=false;\n' +
        '  verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:12,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:texto}}];\n' +
        '}\n' +
        'state.history.push({role:"assistant",content:texto,ts:new Date().toISOString(),llm_senal:senal});\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:terminal}}];'
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

const respondTermNEG2 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Terminal (NEG2)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 880]
  },
  output: [{ verbs: [], report: {} }]
});

const redisSetNEG2 = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (NEG2)',
    parameters: { operation: 'set', key: expr('={{ "call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1920, 1020]
  },
  output: [{ verbs: [], report: {} }]
});

const respondContNEG2 = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Continue (NEG2)',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [2160, 1020]
  },
  output: [{ verbs: [], report: {} }]
});

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
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos {{ $json.customerData.bot_name }}, agente de cobranzas de {{ $json.customerData.Entidad }}. Espanol rioplatense, formal.\n\nTu tarea: clasificar el motivo por el que {{ $json.customerData.Nombre }} no puede pagar, y generar una despedida cordial.\n\n=== CATEGORIAS PERMITIDAS (devolve EXACTAMENTE uno de estos ids) ===\n{{ ($json.customerData.motivos_no_acuerdo && $json.customerData.motivos_no_acuerdo.length > 0) ? $json.customerData.motivos_no_acuerdo.map(m => "- " + (m.motivo || m)).join("\\n") + "\\n- otro" : "- desconoce_deuda: dice que no conoce la deuda o no la reconoce\\n- pago_automatico: dice que ya tiene pago automatico configurado\\n- sin_empleo: perdio el trabajo, sin ingresos\\n- enfermedad: problemas de salud, internado, enfermo\\n- viaje: esta de viaje o fuera del pais\\n- niega: simplemente no quiere pagar, no le interesa\\n- otro: no encaja en las anteriores" }}\n\nReglas estrictas:\n- Devolve SOLO uno de los ids listados arriba en motivo_clasificado.\n- Si lo que dijo el cliente no encaja claramente en ninguna categoria, usa "otro".\n- NO inventes categorias nuevas que no esten en la lista.\n\nLa despedida debe ser:\n- Breve (1-2 oraciones)\n- Respetuosa y formal\n- NO debe insistir mas\n- NO debe ofrecer alternativas\n- Debe mostrar que se registro el motivo\n\nDevuelve JSON con motivo_clasificado y despedida (texto a decir).') }
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
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:[{verb:"say",text:despedida},{verb:"hangup"}],terminal:true}}];'
    },
    position: [1440, 1250]
  },
  output: [{ call_sid: 'test123', state: {}, verbs: [], terminal: true, report: {} }]
});

const redisSetMotivo = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (Motivo)',
    parameters: { operation: 'set', key: expr('={{ "call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1680, 1250]
  },
  output: [{ verbs: [], report: {} }]
});

const respondMotivo = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Motivo',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [1920, 1250]
  },
  output: [{ verbs: [], report: {} }]
});

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
          { type: 'SystemMessagePromptTemplate', message: expr('=Sos {{ $json.customerData.bot_name }}, agente de cobranzas de {{ $json.customerData.Entidad }}. Espanol rioplatense, formal, de "usted". Maximo 2 oraciones, profesional y directa.\n\n=== DATOS DISPONIBLES (lo unico que podes usar) ===\n- Cliente: {{ $json.customerData.Nombre }}\n- Deuda total: {{ $json.customerData.Deuda_palabras || $json.customerData.Deuda }}\n- Vencimiento original: {{ $json.customerData.Vencimiento_palabras || $json.customerData.Vencimiento }}\n- Codigo de cliente: {{ $json.customerData.CodCliente }}\n- Entidad: {{ $json.customerData.Entidad }}\n- Formas de pago: {{ JSON.stringify($json.customerData.formas_de_pago) }}\n\n=== DATOS RESERVADOS PARA NEGOCIACION_2 (NO USAR fuera de NEG2) ===\n- Monto parcial alternativo: {{ $json.customerData.monto_acuerdo_2_palabras || $json.customerData.monto_acuerdo_2 }}\n- Fecha alternativa: {{ $json.customerData.fecha_acuerdo_2_palabras || $json.customerData.fecha_acuerdo_2 }}\n\n=== CONTEXTO CRITICO ===\nreturn_state = {{ $json.state.return_state }}\n\n- Si return_state es "VALIDACION_IDENTIDAD" → el cliente AUN NO confirmo su identidad\n- Si return_state es "NEGOCIACION" → el cliente YA ESTA IDENTIFICADO. NO le preguntes la identidad. Estamos negociando el MONTO TOTAL. NUNCA reveles el monto parcial ni la fecha alternativa (esos son cartas para mas adelante).\n- Si return_state es "NEGOCIACION_2" → el cliente YA ESTA IDENTIFICADO y ya se le ofrecio el pago parcial. AHORA SI podes mencionar el monto parcial y la fecha alternativa.\n\n=== TU TAREA ===\nEl cliente dijo algo durante una pausa de consulta. Analiza que tipo de mensaje es y respondele segun el caso:\n\nCASO A - Hace una NUEVA pregunta concreta (cuanto?, como?, cuando?, quien?, etc.):\n- Responde con el dato EXACTO de la seccion DATOS DISPONIBLES, en UNA oracion\n- Si pregunta algo que no esta en los datos disponibles, deci "No dispongo de ese dato"\n- Agrega la redireccion correspondiente (ver REDIRECCION mas abajo)\n\nCASO B - Indica que ya entendio, agradece o cierra la consulta (ok, ya entendi, perfecto, gracias, bueno, dale, ya esta, etc.):\n- NO repitas la informacion anterior\n- Solo confirma brevemente con algo como "Perfecto" o "Bien"\n- Hace solo la redireccion (ver REDIRECCION)\n\nCASO C - Sigue sin entender o pregunta lo mismo de otra forma:\n- Aclara brevemente con otras palabras (siempre usando solo datos de la lista)\n- Agrega la redireccion correspondiente\n\n=== REDIRECCION (al final de tu respuesta) ===\nElegi UNA segun return_state:\n\nSi return_state es "VALIDACION_IDENTIDAD":\n- "Hablo con {{ ($json.customerData.Nombre || "usted").split(" ")[0] }}?"\n\nSi return_state es "NEGOCIACION" o "NEGOCIACION_2" o null:\n- "Le parece bien que continuemos con el tema del pago?"\n- O: "Tiene alguna otra consulta o podemos seguir?"\n- O: "Podemos avanzar con la regularizacion?"\n- (Variarlas para no sonar robotica. NUNCA preguntes la identidad en este caso.)\n\n=== REGLAS ESTRICTAS ===\n- NO inventes datos NUNCA. Si no tenes algun dato en la lista DATOS DISPONIBLES, deci exactamente "No dispongo de ese dato".\n- NO menciones intereses, recargos, plazos legales, consecuencias, ni nada que no este en los datos provistos.\n- NO ofrezcas cuotas, descuentos, refinanciacion ni alternativas que no esten en formas de pago.\n- Si return_state es NEGOCIACION o VALIDACION_IDENTIDAD, NUNCA menciones el monto parcial ni la fecha alternativa (datos reservados para NEG2). El cliente todavia esta negociando el monto total y revelarlos arruina la negociacion.\n- NO repitas literalmente lo que ya dijiste antes.\n- NUNCA preguntes "Hablo con X?" si return_state ya es NEGOCIACION/NEGOCIACION_2.\n- Maximo 2 oraciones en total (respuesta + redireccion).\n\nDevuelve JSON con "respuesta" (texto completo a decir, ya incluyendo la redireccion).') }
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
        'const verbs=[{verb:"config",bargeIn:{enable:false}},{verb:"gather",input:["speech"],timeout:10,bargein:false,dtmfBargein:false,listenDuringPrompt:false,actionHook:actionHook,say:{text:respuesta}}];\n' +
        'return[{json:{call_sid:orig.call_sid,state:state,verbs:verbs,terminal:false}}];'
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
    parameters: { operation: 'set', key: expr('={{ "call:" + $json.call_sid }}'), value: expr('={{ JSON.stringify($json.state) }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1680, 1550]
  },
  output: [{ verbs: [], report: {} }]
});

const respondConsultas = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Consultas',
    parameters: { respondWith: 'json', responseBody: expr('={{ JSON.stringify($json.verbs) }}'), options: {} },
    position: [1920, 1550]
  },
  output: [{ verbs: [], report: {} }]
});

// ============================================================================
// TRIGGER 2: STATUS  (POST /la-anonima-status)
// ============================================================================

const webhookStatus = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook Status',
    parameters: { httpMethod: 'POST', path: 'la-anonima-status', responseMode: 'responseNode', options: {} },
    position: [0, 2000]
  },
  output: [{ body: { call_sid: 'test-call-123', call_status: 'completed', call_termination_by: 'caller', duration: 45, sip_status: 200, customerData: { Nombre: 'Test', campaign_id: 'c1', record_index: '0' } } }]
});

const parseStatus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse Status',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const body=inp.body||{};\n' +
        'const cdRaw=body.customerData||{};\n' +
        'const call_sid=body.call_sid||"";\n' +
        'const call_status=(body.call_status||body.status||"unknown").toLowerCase();\n' +
        'const TERMINAL_STATUSES=["completed","no-answer","busy","failed","canceled","rejected"];\n' +
        'const isTerminal=TERMINAL_STATUSES.indexOf(call_status)>=0;\n' +
        'return[{json:{\n' +
        '  call_sid:call_sid,\n' +
        '  call_status:call_status,\n' +
        '  call_termination_by:body.call_termination_by||null,\n' +
        '  duration:body.duration||body.duration_seconds||0,\n' +
        '  sip_status:body.sip_status||null,\n' +
        '  sip_reason:body.sip_reason||null,\n' +
        '  direction:body.direction||null,\n' +
        '  from:body.from||null,\n' +
        '  to:body.to||null,\n' +
        '  caller_name:body.caller_name||null,\n' +
        '  account_sid:body.account_sid||null,\n' +
        '  application_sid:body.application_sid||null,\n' +
        '  trunk:body.trunk||null,\n' +
        '  customerData:{\n' +
        '    Nombre:cdRaw.Nombre||"",\n' +
        '    CodCliente:cdRaw.CodCliente||"",\n' +
        '    campaign_id:cdRaw.campaign_id||"",\n' +
        '    record_index:cdRaw.record_index||"",\n' +
        '    telefono_norm:cdRaw.telefono_norm||""\n' +
        '  },\n' +
        '  isTerminal:isTerminal,\n' +
        '  rawBody:body\n' +
        '}}];'
    },
    position: [240, 2000]
  },
  output: [{ call_sid: 'test-call-123', call_status: 'completed', call_termination_by: 'caller', duration: 45, sip_status: 200, customerData: {}, isTerminal: true }]
});

const redisGetStateStatus = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Get State (Status)',
    parameters: { operation: 'get', propertyName: 'redisValue', key: expr('={{ "call:" + $json.call_sid }}'), options: {} },
    credentials: { redis: newCredential('Redis account') },
    position: [480, 2000]
  },
  output: [{ call_sid: 'test-call-123', call_status: 'completed', isTerminal: true, redisValue: null }]
});

const buildStatusReport = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build Status Report',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const parsed=$("Parse Status").first().json;\n' +
        'const bodyCdRaw=(parsed.rawBody&&parsed.rawBody.customerData)||{};\n' +
        'let conversationState=null;\n' +
        'if(inp.redisValue){try{conversationState=JSON.parse(inp.redisValue);}catch(e){conversationState=null;}}\n' +
        'function safeParse(s){if(!s)return null;if(typeof s==="object")return s;try{return JSON.parse(s);}catch(e){return null;}}\n' +
        'let stateInitialized=false;\n' +
        'if(!conversationState){\n' +
        '  stateInitialized=true;\n' +
        '  conversationState={\n' +
        '    machine_state:"SALUDO",\n' +
        '    customer:{\n' +
        '      Nombre:bodyCdRaw.Nombre||"",\n' +
        '      CodCliente:bodyCdRaw.CodCliente||"",\n' +
        '      Vencimiento:bodyCdRaw.Vencimiento||"",\n' +
        '      Telefono:bodyCdRaw.telefono_norm||bodyCdRaw.Telefono||"",\n' +
        '      Deuda:bodyCdRaw.Deuda||"",\n' +
        '      Entidad:bodyCdRaw.Entidad||"La Anonima",\n' +
        '      Documento:bodyCdRaw.Documento||"",\n' +
        '      campaign_id:bodyCdRaw.campaign_id||"",\n' +
        '      record_index:bodyCdRaw.record_index||"",\n' +
        '      bot_name:bodyCdRaw.bot_name||"Sofia",\n' +
        '      monto_acuerdo_2:bodyCdRaw.monto_acuerdo_2||"",\n' +
        '      fecha_acuerdo_2:bodyCdRaw.fecha_acuerdo_2||"",\n' +
        '      frase_limite_consultas:bodyCdRaw.frase_limite_consultas||"",\n' +
        '      frase_acuerdo_neg1:bodyCdRaw.frase_acuerdo_neg1||"",\n' +
        '      frase_acuerdo_neg2:bodyCdRaw.frase_acuerdo_neg2||"",\n' +
        '      frase_cobro_titular:bodyCdRaw.frase_cobro_titular||"",\n' +
        '      frase_cobro_tercero:bodyCdRaw.frase_cobro_tercero||"",\n' +
        '      frase_no_titular:bodyCdRaw.frase_no_titular||"",\n' +
        '      frase_sin_respuesta:bodyCdRaw.frase_sin_respuesta||"",\n' +
        '      frase_reintento_silencio:bodyCdRaw.frase_reintento_silencio||"",\n' +
        '      frase_reintento_ambiguo:bodyCdRaw.frase_reintento_ambiguo||"",\n' +
        '      frase_consulta_puente:bodyCdRaw.frase_consulta_puente||"",\n' +
        '      frase_neg2_entrada:bodyCdRaw.frase_neg2_entrada||"",\n' +
        '      frase_motivo_entrada:bodyCdRaw.frase_motivo_entrada||""\n' +
        '    },\n' +
        '    config:{},\n' +
        '    intentos_id:0,intentos_neg1:0,intentos_neg2:0,intentos_consultas:0,\n' +
        '    identity_type:null,return_state:null,\n' +
        '    motivo_no_pago:null,motivo_clasificado:null,resultado:null,\n' +
        '    history:[],\n' +
        '    started_at:Math.floor(Date.now()/1000)\n' +
        '  };\n' +
        '  Object.keys(bodyCdRaw).forEach(function(k){if(/^frase_(neg1|neg2)_intento_\\d+$/.test(k))conversationState.customer[k]=bodyCdRaw[k];});\n' +
        '  function _numToWords(s){if(s==null||s==="")return "";s=String(s);if(/[a-zA-Z]/.test(s))return s;var n=parseInt(s.replace(/[^0-9]/g,""),10);if(isNaN(n))return s;if(n===0)return "cero";var u=["","uno","dos","tres","cuatro","cinco","seis","siete","ocho","nueve"];var e=["diez","once","doce","trece","catorce","quince","dieciseis","diecisiete","dieciocho","diecinueve"];var d=["","","veinte","treinta","cuarenta","cincuenta","sesenta","setenta","ochenta","noventa"];var c=["","ciento","doscientos","trescientos","cuatrocientos","quinientos","seiscientos","setecientos","ochocientos","novecientos"];function g(num){if(num===0)return "";if(num===100)return "cien";var r="",cc=Math.floor(num/100),dd=Math.floor((num%100)/10),uu=num%10,rr=num%100;if(cc>0)r+=c[cc];if(rr>0){if(r)r+=" ";if(rr<10)r+=u[rr];else if(rr<20)r+=e[rr-10];else if(rr===20)r+="veinte";else if(rr<30)r+="veinti"+u[rr-20];else{r+=d[dd];if(uu>0)r+=" y "+u[uu];}}return r;}if(n<1000)return g(n);if(n<1000000){var m=Math.floor(n/1000),r=n%1000,res;if(m===1)res="mil";else res=g(m)+" mil";if(r>0)res+=" "+g(r);return res;}if(n<1000000000){var mm=Math.floor(n/1000000),rrr=n%1000000,res;if(mm===1)res="un millon";else res=g(mm)+" millones";if(rrr>0){if(rrr>=1000){var miles=Math.floor(rrr/1000),rmil=rrr%1000;if(miles===1)res+=" mil";else res+=" "+g(miles)+" mil";if(rmil>0)res+=" "+g(rmil);}else{res+=" "+g(rrr);}}return res;}return String(n);}\n' +
        '  conversationState.customer.Deuda_palabras=_numToWords(conversationState.customer.Deuda);\n' +
        '  conversationState.customer.monto_acuerdo_2_palabras=_numToWords(conversationState.customer.monto_acuerdo_2);\n' +
        '  function _dateToWords(s){if(s==null||s==="")return "";s=String(s);var m=s.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})/);if(!m)return s;var dia=parseInt(m[1],10),mes=parseInt(m[2],10);if(dia<1||dia>31||mes<1||mes>12)return s;var meses=["","enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];return dia+" de "+meses[mes];}\n' +
        '  conversationState.customer.Vencimiento_palabras=_dateToWords(conversationState.customer.Vencimiento);\n' +
        '  conversationState.customer.fecha_acuerdo_2_palabras=_dateToWords(conversationState.customer.fecha_acuerdo_2);\n' +
        '}\n' +
        'const customer=conversationState.customer||{};\n' +
        'const history=conversationState.history||[];\n' +
        'const resultado=conversationState.resultado||null;\n' +
        'const motivoNoPago=conversationState.motivo_no_pago||null;\n' +
        'const motivoClasificado=conversationState.motivo_clasificado||null;\n' +
        'const statusUrl="https://voice1.progeny.com.ar/webhooks/call-status";\n' +
        'const recordUrl="https://voice1.progeny.com.ar/webhooks/record-update";\n' +
        'const backendApiKey="vb_3W8DGWAJ3_uEX4NgWnIOCMOtzhp3ADDC0FH6iIaOWxI";\n' +
        'const rawBodyForStatus=parsed.rawBody||{};\n' +
        'const RESULTADO_MAP={"acuerdo":"acuerdo","acuerdo_neg2":"acuerdo","sin_acuerdo":"fin","numero_equivocado":"no_responsable","sin_respuesta":"sin_respuesta","no_identificado":"identidad_no_confirmada"};\n' +
        'const DESCRIPCIONES={"acuerdo":"El cliente confirmo que va a pagar la deuda","fin":"La conversacion termino sin acuerdo de pago","no_responsable":"La persona contactada no es el titular de la deuda","contestador":"Se detecto contestador automatico o buzon de voz","sin_respuesta":"El cliente no respondio tras varios intentos","identidad_no_confirmada":"No se pudo confirmar la identidad del cliente","desconocido":"Sin clasificacion"};\n' +
        'const resultadoApp=resultado?(RESULTADO_MAP[resultado]||"desconocido"):"desconocido";\n' +
        'const descripcion=DESCRIPCIONES[resultadoApp]||DESCRIPCIONES["desconocido"];\n' +
        'let ultimoAssistant="";\n' +
        'let ultimoUser="";\n' +
        'for(let i=history.length-1;i>=0;i--){\n' +
        '  if(!ultimoAssistant&&history[i].role==="assistant")ultimoAssistant=history[i].content||"";\n' +
        '  if(!ultimoUser&&history[i].role==="user")ultimoUser=history[i].content||"";\n' +
        '  if(ultimoAssistant&&ultimoUser)break;\n' +
        '}\n' +
        'const transcripcion=history.map(function(t){return{role:t.role,content:t.content||t.text||"",timestamp:t.ts||new Date().toISOString()};});\n' +
        'const recordPayload={\n' +
        '  campaign_id:customer.campaign_id||"",\n' +
        '  call_sid:parsed.call_sid,\n' +
        '  gestion:{\n' +
        '    resultado:resultadoApp,\n' +
        '    acuerdo:resultadoApp==="acuerdo",\n' +
        '    descripcion:descripcion,\n' +
        '    mensaje_asistente:ultimoAssistant,\n' +
        '    mensaje_cliente:ultimoUser,\n' +
        '    motivo_no_pago:motivoNoPago,\n' +
        '    motivo_clasificado:motivoClasificado,\n' +
        '    duration:parsed.duration||0,\n' +
        '    call_termination_by:parsed.call_termination_by||null,\n' +
        '    sip_status:parsed.sip_status||null\n' +
        '  },\n' +
        '  transcripcion:transcripcion\n' +
        '};\n' +
        'return[{json:{\n' +
        '  call_sid:parsed.call_sid,\n' +
        '  isTerminal:parsed.isTerminal,\n' +
        '  rawBody:rawBodyForStatus,\n' +
        '  statusUrl:statusUrl,\n' +
        '  recordUrl:recordUrl,\n' +
        '  backendApiKey:backendApiKey,\n' +
        '  recordPayload:recordPayload,\n' +
        '  stateInitialized:stateInitialized,\n' +
        '  conversationStateForRedis:JSON.stringify(conversationState)\n' +
        '}}];'
    },
    position: [720, 2000]
  },
  output: [{ call_sid: 'test-call-123', isTerminal: true, report: {} }]
});

const ifTerminalStatus = ifElse({
  version: 2.2,
  config: {
    name: 'Is Terminal? (Status)',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('={{ $json.isTerminal }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }],
        combinator: 'and'
      },
      options: {}
    },
    position: [960, 2000]
  }
});

const redisDelStatus = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Delete (Status Cleanup)',
    parameters: { operation: 'delete', key: expr('={{ "call:" + $json.call_sid }}') },
    credentials: { redis: newCredential('Redis account') },
    position: [1200, 1900]
  },
  output: [{ call_sid: 'test-call-123', isTerminal: true, report: {} }]
});

const respondStatusTerminal = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Status (Terminal)',
    parameters: { respondWith: 'json', responseBody: '{"status":"received","cleaned":true}', options: {} },
    position: [1440, 1900]
  },
  output: [{ call_sid: 'test-call-123', isTerminal: true, report: {} }]
});

const sendReportStatusTerminal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Send Status Report (Terminal)',
    parameters: { method: 'POST', url: expr('={{ $("Build Status Report").first().json.statusUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($("Build Status Report").first().json.rawBody) }}'), sendHeaders: true, headerParameters: { parameters: [{ name: 'X-API-Key', value: expr('={{ $("Build Status Report").first().json.backendApiKey }}') }] }, options: { timeout: 5000 } },
    onError: 'continueRegularOutput',
    position: [1680, 1900]
  },
  output: [{}]
});

const sendFinalRecordUpdate = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Send Final Record-Update',
    parameters: { method: 'POST', url: expr('={{ $("Build Status Report").first().json.recordUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($("Build Status Report").first().json.recordPayload) }}'), sendHeaders: true, headerParameters: { parameters: [{ name: 'X-API-Key', value: expr('={{ $("Build Status Report").first().json.backendApiKey }}') }] }, options: { timeout: 5000 } },
    onError: 'continueRegularOutput',
    position: [1920, 1900]
  },
  output: [{}]
});

const redisSetStatusInit = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Set State (Status Init)',
    parameters: { operation: 'set', key: expr('={{ "call:" + $("Build Status Report").first().json.call_sid }}'), value: expr('={{ $("Build Status Report").first().json.conversationStateForRedis }}'), expire: true, ttl: 3600 },
    credentials: { redis: newCredential('Redis account') },
    position: [1200, 2100]
  },
  output: [{}]
});

const respondStatusOngoing = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond Status (Ongoing)',
    parameters: { respondWith: 'json', responseBody: '{"status":"received"}', options: {} },
    position: [1440, 2100]
  },
  output: [{ call_sid: 'test-call-123', isTerminal: false, report: {} }]
});

const sendReportStatusOngoing = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Send Status Report (Ongoing)',
    parameters: { method: 'POST', url: expr('={{ $("Build Status Report").first().json.statusUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($("Build Status Report").first().json.rawBody) }}'), sendHeaders: true, headerParameters: { parameters: [{ name: 'X-API-Key', value: expr('={{ $("Build Status Report").first().json.backendApiKey }}') }] }, options: { timeout: 5000 } },
    onError: 'continueRegularOutput',
    position: [1680, 2100]
  },
  output: [{}]
});

// ============================================================================
// TRIGGER 3: AMD  (POST /la-anonima-amd)
// ============================================================================

const webhookAmd = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'Webhook AMD',
    parameters: { httpMethod: 'POST', path: 'la-anonima-amd', responseMode: 'responseNode', options: {} },
    position: [0, 2500]
  },
  output: [{ body: { call_sid: 'test-amd-001', amd_event: 'machine', customerData: { Nombre: 'Test', telefono_norm: '+5491133334444' } } }]
});

const parseAmd = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Parse AMD',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const body=inp.body||{};\n' +
        'const cdRaw=body.customerData||{};\n' +
        'function safeParse(s){if(!s)return null;if(typeof s==="object")return s;try{return JSON.parse(s);}catch(e){return null;}}\n' +
        'const smsConfig=safeParse(cdRaw.sms_config)||{};\n' +
        'const smsEnabled=cdRaw.sms_enabled===true||cdRaw.sms_enabled==="true";\n' +
        'const telefono=cdRaw.telefono_norm||cdRaw.Telefono||body.to||"";\n' +
        'const messageContestador=smsConfig.mensaje_contestador||"";\n' +
        'const hasSmsUrl=!!(smsConfig.url);\n' +
        'const amdEvent=body.amd_event||body.type||body.event||"unknown";\n' +
        'const isMachine=amdEvent==="amd_machine_detected";\n' +
        'const shouldSendSms=isMachine&&smsEnabled&&hasSmsUrl&&!!messageContestador&&!!telefono;\n' +
        'const responseVerbs=isMachine?JSON.stringify([{verb:"hangup"}]):JSON.stringify([]);\n' +
        'return[{json:{\n' +
        '  call_sid:body.call_sid||"",\n' +
        '  amd_event:amdEvent,\n' +
        '  amd_confidence:body.amd_confidence||null,\n' +
        '  duration:body.duration||0,\n' +
        '  direction:body.direction||null,\n' +
        '  from:body.from||null,\n' +
        '  to:body.to||null,\n' +
        '  isMachine:isMachine,\n' +
        '  customer:{\n' +
        '    Nombre:cdRaw.Nombre||"",\n' +
        '    CodCliente:cdRaw.CodCliente||"",\n' +
        '    Telefono:telefono,\n' +
        '    campaign_id:cdRaw.campaign_id||"",\n' +
        '    record_index:cdRaw.record_index||""\n' +
        '  },\n' +
        '  smsEnabled:smsEnabled,\n' +
        '  smsUrl:smsConfig.url||"",\n' +
        '  smsApiKey:smsConfig.api_key||"",\n' +
        '  smsMessage:messageContestador,\n' +
        '  shouldSendSms:shouldSendSms,\n' +
        '  smsBody:JSON.stringify({api_key:smsConfig.api_key||"",envios:[{telefono:telefono,mensaje:messageContestador}]}),\n' +
        '  hangupVerbs:responseVerbs\n' +
        '}}];'
    },
    position: [240, 2500]
  },
  output: [{ call_sid: 'test-amd-001', amd_event: 'machine', customer: {}, smsEnabled: false, shouldSendSms: false, smsBody: '{}', hangupVerbs: '[]' }]
});

const redisGetAmd = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Get State (AMD)',
    parameters: { operation: 'get', propertyName: 'redisValue', key: expr('={{ "call:" + $json.call_sid }}'), options: {} },
    credentials: { redis: newCredential('Redis account') },
    position: [480, 2500]
  },
  output: [{ call_sid: 'test-amd-001', amd_event: 'machine', customer: {}, smsEnabled: false, shouldSendSms: false, smsBody: '{}', hangupVerbs: '[]', redisValue: null }]
});

const buildAmdReport = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build AMD Report',
    parameters: {
      jsCode:
        'const inp=$input.first().json;\n' +
        'const parsed=$("Parse AMD").first().json;\n' +
        'let conversationState=null;\n' +
        'if(inp.redisValue){try{conversationState=JSON.parse(inp.redisValue);}catch(e){conversationState=null;}}\n' +
        'const history=conversationState?conversationState.history||[]:[];\n' +
        'const recordUrl="https://voice1.progeny.com.ar/webhooks/record-update";\n' +
        'const backendApiKey="vb_3W8DGWAJ3_uEX4NgWnIOCMOtzhp3ADDC0FH6iIaOWxI";\n' +
        'const transcripcion=(history||[]).map(function(t){return{role:t.role,content:t.content||t.text||"",timestamp:t.ts||new Date().toISOString()};});\n' +
        'const recordPayload={campaign_id:parsed.customer.campaign_id||"",call_sid:parsed.call_sid,gestion:{resultado:"contestador",acuerdo:false,descripcion:"Se detecto contestador automatico o buzon de voz",mensaje_asistente:"",mensaje_cliente:"",amd_event:parsed.amd_event,amd_confidence:parsed.amd_confidence,sms_sent_attempt:parsed.shouldSendSms},transcripcion:transcripcion};\n' +
        'return[{json:{call_sid:parsed.call_sid,shouldSendSms:parsed.shouldSendSms,smsUrl:parsed.smsUrl,smsApiKey:parsed.smsApiKey,smsBody:parsed.smsBody,hangupVerbs:parsed.hangupVerbs,recordPayload:recordPayload,backendUrl:recordUrl,backendApiKey:backendApiKey}}];'
    },
    position: [720, 2500]
  },
  output: [{ call_sid: 'test-amd-001', shouldSendSms: false, smsUrl: '', smsBody: '{}', hangupVerbs: '[]', report: {} }]
});

const respondAmd = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1,
  config: {
    name: 'Respond AMD (Hangup)',
    parameters: { respondWith: 'json', responseBody: expr('={{ $json.hangupVerbs }}'), options: {} },
    position: [960, 2500]
  },
  output: [{ call_sid: 'test-amd-001', shouldSendSms: false, smsUrl: '', smsBody: '{}', report: {} }]
});

const redisDelAmd = node({
  type: 'n8n-nodes-base.redis',
  version: 1,
  config: {
    name: 'Redis Delete (AMD)',
    parameters: { operation: 'delete', key: expr('={{ "call:" + $json.call_sid }}') },
    credentials: { redis: newCredential('Redis account') },
    position: [1440, 2400]
  },
  output: [{ call_sid: 'test-amd-001', shouldSendSms: false, smsUrl: '', smsBody: '{}', report: {} }]
});

const ifIsMachine = ifElse({
  version: 2.2,
  config: {
    name: 'Is Machine? (AMD)',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('={{ $json.isMachine }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }],
        combinator: 'and'
      },
      options: {}
    },
    position: [1200, 2500]
  }
});

const ifShouldSendSms = ifElse({
  version: 2.2,
  config: {
    name: 'Send SMS?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('={{ $json.shouldSendSms }}'), operator: { type: 'boolean', operation: 'true', singleValue: true }, rightValue: '' }],
        combinator: 'and'
      },
      options: {}
    },
    position: [1680, 2400]
  }
});

const sendSmsAmd = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Send SMS Contestador',
    parameters: { method: 'POST', url: expr('={{ $json.smsUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ $json.smsBody }}'), sendHeaders: true, headerParameters: { parameters: [{ name: 'X-API-Key', value: expr('={{ $json.smsApiKey }}') }, { name: 'Authorization', value: expr('={{ "Bearer " + $json.smsApiKey }}') }] }, options: { timeout: 5000 } },
    onError: 'continueRegularOutput',
    position: [1920, 2300]
  },
  output: [{ call_sid: 'test-amd-001', shouldSendSms: true, report: {} }]
});

const reportAmdSms = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Send AMD Report (SMS sent)',
    parameters: { method: 'POST', url: expr('={{ $("Build AMD Report").first().json.backendUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($("Build AMD Report").first().json.recordPayload) }}'), sendHeaders: true, headerParameters: { parameters: [{ name: 'X-API-Key', value: expr('={{ $("Build AMD Report").first().json.backendApiKey }}') }] }, options: { timeout: 5000 } },
    onError: 'continueRegularOutput',
    position: [2160, 2300]
  },
  output: [{}]
});

const reportAmdNoSms = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.3,
  config: {
    name: 'Send AMD Report (No SMS)',
    parameters: { method: 'POST', url: expr('={{ $("Build AMD Report").first().json.backendUrl }}'), sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('={{ JSON.stringify($("Build AMD Report").first().json.recordPayload) }}'), sendHeaders: true, headerParameters: { parameters: [{ name: 'X-API-Key', value: expr('={{ $("Build AMD Report").first().json.backendApiKey }}') }] }, options: { timeout: 5000 } },
    onError: 'continueRegularOutput',
    position: [1920, 2500]
  },
  output: [{}]
});

// ============================================================================
// COMPOSE WORKFLOW WITH 3 TRIGGERS
// ============================================================================

export default workflow('VdmF9mjoZFiUpH4j', 'La Anonima')
  // Trigger 1: Conversation
  // Cambio importante: TODOS los handlers persisten en Redis (incluso los terminales).
  // El delete del state se hace UNA sola vez al final, en el path del Status terminal,
  // despues de haber armado el record-update final con el state completo.
  .add(webhookApp)
  .to(parseInput)
  .to(redisGetState)
  .to(loadOrInitState)
  .to(switchByState
    .onCase(0, handlerSaludo.to(redisSetSaludo).to(respondSaludo))
    .onCase(1, llmValidacion.to(decideValidacion).to(redisSetVI).to(
      terminalVI
        .onTrue(respondTermVI)
        .onFalse(respondContVI)
    ))
    .onCase(2, llmNeg.to(decideNeg).to(redisSetNEG).to(
      terminalNEG
        .onTrue(respondTermNEG)
        .onFalse(respondContNEG)
    ))
    .onCase(3, llmNeg2.to(decideNeg2).to(redisSetNEG2).to(
      terminalNEG2
        .onTrue(respondTermNEG2)
        .onFalse(respondContNEG2)
    ))
    .onCase(4, llmMotivo.to(decideMotivo).to(redisSetMotivo).to(respondMotivo))
    .onCase(5, llmConsultas.to(decideConsultas).to(redisSetConsultas).to(respondConsultas))
  )
  // Trigger 2: Status
  // Si NO es terminal y Build Status Report inicializo state desde rawBody -> lo persistimos
  // (idempotente: si el state ya existia, sobrescribimos con lo mismo).
  // Si ES terminal -> mandamos call-status + record-update final con el state completo, despues borramos.
  .add(webhookStatus)
  .to(parseStatus)
  .to(redisGetStateStatus)
  .to(buildStatusReport)
  .to(ifTerminalStatus
    .onTrue(respondStatusTerminal.to(sendReportStatusTerminal).to(sendFinalRecordUpdate).to(redisDelStatus))
    .onFalse(redisSetStatusInit.to(respondStatusOngoing).to(sendReportStatusOngoing))
  )
  // Trigger 3: AMD
  .add(webhookAmd)
  .to(parseAmd)
  .to(redisGetAmd)
  .to(buildAmdReport)
  .to(respondAmd)
  .to(ifIsMachine
    .onTrue(redisDelAmd.to(ifShouldSendSms
      .onTrue(sendSmsAmd.to(reportAmdSms))
      .onFalse(reportAmdNoSms)
    ))
  );
