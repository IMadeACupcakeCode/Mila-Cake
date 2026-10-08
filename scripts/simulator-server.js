const http = require('http');
const { URL } = require('url');
const slash = require('../utils/slash');

const PORT = Number(process.env.MILA_SIMULATOR_PORT || 4173);
const HOST = '127.0.0.1';
const clients = new Set();
const events = [];

const HTML = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mila Simulator</title>
<style>body{font:15px system-ui;margin:0;background:#171321;color:#f8edf8}main{max-width:1100px;margin:auto;padding:24px}h1{color:#ff9edb}section{background:#241c31;border:1px solid #60446f;border-radius:14px;padding:16px;margin:12px 0}label{display:block;margin:8px 0 4px}select,input,button{font:inherit;padding:9px;border-radius:8px;border:1px solid #80638f;background:#171321;color:#fff}select,input{width:100%;box-sizing:border-box}button{background:#d65da4;border:0;cursor:pointer;margin-top:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.event{border-bottom:1px solid #493854;padding:10px 0;white-space:pre-wrap}.ok{color:#a9f5bd}.warn{color:#ffd58a}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head>
<body><main><h1>⋆｡°✩ Mila — simulador local</h1><p class="warn">SIMULAÇÃO: nada aqui envia mensagens ao Discord ou registra comandos.</p>
<div class="grid"><section><h2>Executar comando</h2><label>Comando</label><select id="command"></select><label>Opções JSON</label><input id="options" value="{}" placeholder='{"termo":"ping"}'><label><input id="dm" type="checkbox" style="width:auto"> Simular DM</label><label><input id="allowed" type="checkbox" style="width:auto" checked> Simular permissão autorizada</label><button onclick="runCommand()">Executar simulação</button><pre id="result"></pre></section><section><h2>Eventos em tempo real</h2><div id="events">Conectando…</div></section></div>
<section><h2>Como usar</h2><p>Escolha um comando e passe as opções como JSON. Use DM/permissão para testar as barreiras de segurança. Fluxos que dependem do Discord real aparecem como operações simuladas, nunca como sucesso real.</p></section></main>
<script>
const select=document.querySelector('#command'); fetch('/api/commands').then(r=>r.json()).then(xs=>xs.forEach(x=>{const o=document.createElement('option');o.value=x.name;o.textContent='/'+x.name;select.append(o)}));
const feed=new EventSource('/events'); feed.onmessage=e=>{const x=JSON.parse(e.data);const d=document.createElement('div');d.className='event';d.textContent='['+new Date(x.time).toLocaleTimeString()+'] '+x.type+'\\n'+JSON.stringify(x.data,null,2);document.querySelector('#events').prepend(d)};
async function runCommand(){let options={};try{options=JSON.parse(document.querySelector('#options').value||'{}')}catch(e){document.querySelector('#result').textContent='JSON inválido';return}const body={command:select.value,options,dm:document.querySelector('#dm').checked,allowed:document.querySelector('#allowed').checked};const r=await fetch('/api/simulate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});document.querySelector('#result').textContent=JSON.stringify(await r.json(),null,2)}
</script></body></html>`;

function emit(type, data) {
  const event = { time: new Date().toISOString(), type, data };
  events.push(event);
  if (events.length > 100) events.shift();
  for (const response of clients) response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function safe(value) {
  if (value === undefined) return null;
  try { JSON.stringify(value); return value; } catch { return '[não serializável]'; }
}

function fixture(body) {
  const options = body.options || {};
  const permission = body.allowed !== false;
  const channel = {
    id: 'sim-channel', name: 'simulacao', topic: '',
    send: async (payload) => { emit('channel.send', safe(payload)); return { id: 'sim-message', ...payload, edit: async (next) => emit('message.edit', safe(next)), createMessageComponentCollector: () => ({ on: () => {}, stop: () => {} }) }; },
    permissionsFor: () => ({ has: () => permission }),
  };
  const member = { permissions: { has: () => permission }, roles: { cache: new Map(), highest: { name: 'Simulação' } } };
  const guild = body.dm ? null : { id: 'sim-guild', name: 'Guilda de simulação', members: { cache: new Map() }, channels: { cache: new Map() } };
  return { guild, guildId: guild?.id || null, channel, member, user: { id: 'sim-user', username: 'Visitante', tag: 'Visitante#0001' }, client: { ws: { ping: 42 }, user: { id: 'sim-bot', username: 'Mila' }, channels: { fetch: async () => channel } } };
}

function interactionFor(body) {
  const base = fixture(body);
  let response;
  const interaction = { ...base, commandName: body.command, createdTimestamp: Date.now(), replied: false, deferred: false,
    isChatInputCommand: () => true, isAutocomplete: () => false,
    options: { getString: (name) => body.options?.[name] ?? null, getInteger: (name) => body.options?.[name] ?? null, getBoolean: (name) => body.options?.[name] ?? null, getUser: (name) => body.options?.[name] ? { id: body.options[name], username: 'Usuário simulado', tag: 'usuario#0001', displayAvatarURL: () => 'https://example.invalid/avatar.png' } : null, getChannel: () => base.channel, getSubcommand: () => body.options?.subcommand || body.options?.acao || null },
    reply: async (payload) => { interaction.replied = true; response = payload; emit('interaction.reply', safe(payload)); return { id: 'sim-reply', ...payload, edit: async (next) => emit('message.edit', safe(next)), createMessageComponentCollector: () => ({ on: () => {}, stop: () => {} }) }; },
    followUp: async (payload) => { response = payload; emit('interaction.followUp', safe(payload)); return response; },
    editReply: async (payload) => { response = payload; emit('interaction.editReply', safe(payload)); return response; },
    respond: async (payload) => { response = payload; emit('autocomplete.respond', safe(payload)); },
  };
  return { interaction, getResponse: () => response };
}

async function simulate(body) {
  if (!body || typeof body.command !== 'string' || !slash.comandos.has(body.command)) return { ok: false, error: 'Comando inválido' };
  if (body.options && (typeof body.options !== 'object' || Array.isArray(body.options))) return { ok: false, error: 'options precisa ser objeto JSON' };
  const { interaction, getResponse } = interactionFor(body);
  emit('simulation.start', { command: body.command, guild: interaction.guildId || 'DM' });
  await slash.tratar(interaction, interaction.client);
  return { ok: true, simulated: true, command: body.command, response: safe(getResponse()) };
}

function json(response, status, value) { response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' }); response.end(JSON.stringify(value)); }
function serverHandler(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  if (request.method === 'GET' && url.pathname === '/') { response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return response.end(HTML); }
  if (request.method === 'GET' && url.pathname === '/api/commands') { slash.carregar(); return json(response, 200, slash.listarJson().map(({ name, description, options = [] }) => ({ name, description, options }))); }
  if (request.method === 'GET' && url.pathname === '/events') { response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' }); response.write(': connected\n\n'); clients.add(response); for (const event of events) response.write(`data: ${JSON.stringify(event)}\n\n`); request.on('close', () => clients.delete(response)); return; }
  if (request.method === 'POST' && url.pathname === '/api/simulate') { let raw = ''; request.on('data', (chunk) => { raw += chunk; if (raw.length > 100000) request.destroy(); }); request.on('end', async () => { try { json(response, 200, await simulate(JSON.parse(raw || '{}'))); } catch (error) { emit('simulation.error', { message: error.message }); json(response, 500, { ok: false, error: 'Falha na simulação' }); } }); return; }
  json(response, 404, { ok: false, error: 'Não encontrado' });
}

function createSimulatorServer(port = PORT) { return http.createServer(serverHandler).listen(port, HOST, () => console.log(`Simulador Mila: http://${HOST}:${port}`)); }
if (require.main === module) createSimulatorServer();
module.exports = { createSimulatorServer, simulate, serverHandler };
