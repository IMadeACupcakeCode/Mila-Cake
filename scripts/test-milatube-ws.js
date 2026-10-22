// Validação do WebSocket do MilaTube: assina um ticket com WS_TICKET_SECRET,
// abre a conexão no Worker e confere o handshake e a resposta do "hello".
// Uso: node scripts/test-milatube-ws.js [roomId]

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const WORKER = process.env.ACTIVITY_API_URL || 'https://mila-tube-sync.acupcakecode.workers.dev';
const ROOM = process.argv[2] || '1236738710943305758';
const USER_ID = process.env.ACTIVITY_TEST_USER_ID || '475057239485317150';
const TICKET_TTL_MS = 60 * 60 * 1000;

function readDevVars() {
  const file = path.join(__dirname, '..', 'activity', 'worker', '.dev.vars');
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([^#=\s]+)\s*=\s*(.*)$/.exec(line);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createTicket(secret, roomId, userId) {
  const payload = {
    r: roomId,
    u: userId,
    n: 'Teste MilaTube',
    a: '',
    exp: Date.now() + TICKET_TTL_MS,
  };
  const body = base64Url(Buffer.from(JSON.stringify(payload), 'utf8'));
  const signature = base64Url(crypto.createHmac('sha256', secret).update(body).digest());
  return `${body}.${signature}`;
}

async function main() {
  const secret = process.env.WS_TICKET_SECRET || readDevVars().WS_TICKET_SECRET;
  assert.ok(secret, 'WS_TICKET_SECRET ausente (use .dev.vars ou a variável de ambiente)');

  const ticket = createTicket(secret, ROOM, USER_ID);
  const url = `${WORKER.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws?room=${ROOM}&ticket=${encodeURIComponent(ticket)}`;

  const socket = new WebSocket(url);
  const messages = [];

  const timer = setTimeout(() => {
    console.error('Timeout esperando o WebSocket.');
    socket.close();
    process.exit(1);
  }, 20000);

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('Falha no handshake do WebSocket')), { once: true });
  });

  console.log('Handshake WS: OK (101)');

  socket.addEventListener('message', (event) => {
    let payload = null;
    try { payload = JSON.parse(String(event.data)); } catch { payload = { raw: String(event.data) }; }
    messages.push(payload);
  });

  socket.send(JSON.stringify({ type: 'hello', t: Date.now() }));

  await new Promise((resolve) => setTimeout(resolve, 2500));
  clearTimeout(timer);

  socket.close();

  assert.ok(messages.length > 0, 'O servidor não respondeu ao "hello"');
  const hello = messages.find((m) => m.type === 'hello' || m.type === 'state' || m.type === 'room');
  assert.ok(hello, `Resposta inesperada do servidor: ${JSON.stringify(messages).slice(0, 300)}`);

  console.log('Resposta do servidor:', JSON.stringify(hello).slice(0, 300));
  console.log('MilaTube WebSocket: OK');
}

main().catch((error) => {
  console.error('MilaTube WebSocket: FALHOU -', error.message);
  process.exit(1);
});
