/* ==========================================================================
   MilaTube — Activity do Discord
   Frontend sem build: módulos nativos, SDK vendorizado e YouTube IFrame API.

   Importante: este arquivo NÃO tenta bloquear anúncios. O player é o iframe
   oficial do YouTube; anúncios e restrições de incorporação pertencem ao
   YouTube. A sala apenas sincroniza play/pause/seek/fila entre os clientes.
   ========================================================================== */

const DEFAULT_CONFIG = {
  CLIENT_ID: '',
  API_BASE: '',
  DEMO_VIDEO_ID: 'aqz-KE-bpKQ',
  DEMO_TITLE: 'Big Buck Bunny',
  DEMO_QUEUE: [],
  SYNC_TOLERANCE: 1.25,
  MAX_QUEUE: 30,
  ADS_NOTE: 'Os anúncios são controlados pelo YouTube.'
};

const CFG = Object.assign({}, DEFAULT_CONFIG, window.MILA_CONFIG || {});
const params = new URLSearchParams(window.location.search);
const inDiscordFrame = params.has('frame_id') || params.has('instance_id');
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'youtu.be', 'youtube-nocookie.com']);

const state = {
  sdk: null,
  user: null,
  accessToken: null,
  channelId: null,
  guildId: null,
  channelName: null,
  demo: !inDiscordFrame,
  room: null,
  participants: [],
  ws: null,
  wsTicket: null,
  manualClose: false,
  reconnectTimer: null,
  reconnectAttempt: 0,
  heartbeatTimer: null,
  lastPong: 0,
  lastRoomAt: 0,
  lastSeekSent: 0,
  localActionAt: 0,
  clockOffset: 0,
  player: null,
  playerReady: false,
  playerInitPromise: null,
  ytApiPromise: null,
  videoId: null,
  applyingRemote: false,
  applyingTimer: null,
  muted: false,
  volume: 80,
  seeking: false,
  tickTimer: null,
  pendingLoadId: null,
  helpOpen: false,
  destroyed: false
};

let toastTimer = null;
let toastHideTimer = null;

// ── Utilidades ─────────────────────────────────────────────────────────────

const el = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text;
}

function apiBase() {
  // Aceita tanto a origem do Worker quanto uma URL que já termine em /api.
  return String(CFG.API_BASE || '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
}

function apiUrl(path) {
  const base = apiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function authHeaders() {
  return state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {};
}

async function requestJson(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 12000);
  const headers = Object.assign({}, options.headers || {});
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  try {
    const response = await fetch(apiUrl(path), Object.assign({}, options, { headers, signal: controller.signal }));
    const raw = await response.text();
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = { error: raw.slice(0, 300) }; }
    }
    if (!response.ok) {
      const error = new Error(data && (data.error || data.message) ? (data.error || data.message) : `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('A sala demorou demais para responder.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function wsEndpoint() {
  const raw = apiBase();
  const base = new URL(raw || window.location.href, window.location.href);
  const protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  const basePath = raw ? base.pathname.replace(/\/+$/, '') : '';
  return `${protocol}//${base.host}${basePath}/ws`;
}

function isVideoId(value) {
  return typeof value === 'string' && VIDEO_ID_RE.test(value);
}

function parseYouTubeInput(value) {
  let raw = String(value || '').trim();
  if (!raw) return null;
  if (raw.startsWith('<') && raw.endsWith('>')) raw = raw.slice(1, -1).trim();
  if (isVideoId(raw)) return raw;

  let url;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  if (!/^https?:$/.test(url.protocol)) return null;
  let host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  host = host.replace(/^m\./, '').replace(/^music\./, '');
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return isVideoId(id) ? id : null;
  }

  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/watch') {
    const id = url.searchParams.get('v');
    return isVideoId(id) ? id : null;
  }

  const match = path.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:\/|$)/);
  return match ? match[1] : null;
}

function thumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/mqdefault.jpg`;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function displayName(user) {
  if (!user) return 'Mila';
  return String(user.global_name || user.display_name || user.username || user.name || 'Mila').slice(0, 32);
}

function avatarUrl(user) {
  if (!user || !user.id || !user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=64`;
}

function safeAvatarUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
    if (!['cdn.discordapp.com', 'media.discordapp.net'].includes(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function initials(name) {
  const chars = Array.from(String(name || '?').trim());
  return chars.slice(0, 2).join('').toUpperCase() || '?';
}

function showToast(message, kind = 'info') {
  const toast = el('toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  clearTimeout(toastHideTimer);
  toast.hidden = false;
  toast.dataset.kind = kind;
  toast.textContent = message;
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  toastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
    toastHideTimer = setTimeout(() => { toast.hidden = true; }, 200);
  }, 3800);
}

function announce(message) {
  const node = el('sr-status');
  if (node) node.textContent = message;
}

function setBoot(progress, status, detail) {
  const bar = el('boot-progress');
  if (bar) bar.style.width = `${clampNumber(progress, 0, 100)}%`;
  if (status) setText('boot-status', status);
  if (detail) setText('boot-detail', detail);
}

function showBootError(error) {
  const boot = el('boot');
  if (!boot) return;
  boot.hidden = false;
  boot.classList.remove('boot--done');
  boot.classList.add('boot--error');
  const box = el('boot-error');
  if (box) box.hidden = false;
  setText('boot-error-text', String(error && error.message ? error.message : error || 'Erro desconhecido').slice(0, 240));
  setBoot(100, 'Falha ao ler o cartucho', 'VERIFIQUE A CONFIGURAÇÃO DA ACTIVITY');
  setText('boot-fine', 'O console continua ligado. Você pode tentar de novo ou entrar no modo local.');
  const app = el('app');
  if (app) app.setAttribute('aria-hidden', 'true');
  console.error('[MilaTube] Falha no boot:', error);
}

function hideBootError() {
  const boot = el('boot');
  if (boot) boot.classList.remove('boot--error');
  const box = el('boot-error');
  if (box) box.hidden = true;
}

function finishBoot() {
  const boot = el('boot');
  const app = el('app');
  if (app) {
    app.setAttribute('aria-hidden', 'false');
    app.classList.add('is-ready');
  }
  if (boot) {
    boot.classList.add('boot--done');
    setTimeout(() => { boot.hidden = true; }, 700);
  }
  state.booted = true;
}

function showHint(message) {
  const hint = el('player-hint');
  if (!hint) return;
  if (message) setText('player-hint-text', message);
  hint.hidden = false;
}

function hideHint() {
  const hint = el('player-hint');
  if (hint) hint.hidden = true;
}

function isConfigValid() {
  return /^\d{17,20}$/.test(String(CFG.CLIENT_ID || ''));
}

// ── Boot e backend ─────────────────────────────────────────────────────────

async function init() {
  wireUI();
  try {
    await bootSequence();
    finishBoot();
    if (state.room && state.room.videoId) {
      ensurePlayer(state.room.videoId).catch(handlePlayerInitError);
    }
    startTick();
  } catch (error) {
    showBootError(error);
  }
}

async function bootSequence() {
  const fast = prefersReducedMotion();
  const wait = (ms) => sleep(fast ? Math.min(ms, 38) : ms);

  setBoot(6, 'Acordando a Mila…', 'INSERINDO CARTRIDGE');
  await wait(260);
  setBoot(20, 'Lendo setores do cartucho…', 'NÃO DESLIGUE O CONSOLE');
  await wait(380);
  setBoot(42, 'Montando o CRT…', 'CALIBRANDO CORES DE 2008');
  await wait(420);
  setBoot(58, 'Procurando uma sala…', 'CONECTANDO AO MILA PLAY SYSTEM');
  await initBackend();
  setBoot(82, 'Sincronizando relógios…', 'TOLERÂNCIA: 1,25s');
  await wait(300);
  setBoot(96, 'Quase lá…', 'A MILA ESTÁ AJUSTANDO A FITA');
  await wait(280);
  setBoot(100, 'Pronto.', 'BEM-VINDA DE VOLTA');
  await wait(fast ? 40 : 460);
}

async function initBackend() {
  if (!inDiscordFrame) {
    initDemo();
    return;
  }

  if (!isConfigValid()) {
    throw new Error('CLIENT_ID não configurado. Abra activity/public/config.js e use o ID da aplicação do Discord.');
  }

  await initDiscord();
}

async function initDiscord() {
  state.demo = false;
  setBoot(64, 'Autenticando com o Discord…', 'ABRINDO A PORTINHA DA ACTIVITY');

  const sdkModule = await import('./vendor/discord-sdk.js');
  state.sdk = new sdkModule.DiscordSDK(CFG.CLIENT_ID);
  await state.sdk.ready();

  const { code } = await state.sdk.commands.authorize({
    client_id: CFG.CLIENT_ID,
    response_type: 'code',
    state: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    prompt: 'none',
    // identify: perfil do usuário; guilds: nome do canal da call via getChannel.
    scope: ['identify', 'guilds']
  });

  setBoot(70, 'Trocando o token com segurança…', 'O SEGREDO FICA NO WORKER');
  const tokenData = await requestJson('/api/token', {
    method: 'POST',
    body: JSON.stringify({ code }),
    timeout: 16000
  });
  if (!tokenData || !tokenData.access_token) throw new Error('O Worker não devolveu um access_token.');

  const auth = await state.sdk.commands.authenticate({ access_token: tokenData.access_token });
  if (!auth) throw new Error('O Discord recusou a autenticação da Activity.');

  // O authenticate devolve o token que o SDK considera válido para os RPCs.
  // Use-o nas chamadas ao Worker; o token do /token é o mesmo na prática, mas
  // isso mantém o fluxo igual ao exemplo oficial da Discord.
  state.accessToken = auth.access_token || tokenData.access_token;
  state.user = auth.user;
  state.channelId = state.sdk.channelId || params.get('channel_id');
  state.guildId = state.sdk.guildId || params.get('guild_id');

  if (!state.channelId) {
    throw new Error('A Activity não recebeu o canal de voz. Abra pelo botão de Activity dentro de uma call.');
  }

  if (state.guildId) {
    try {
      const channel = await state.sdk.commands.getChannel({ channel_id: state.channelId });
      state.channelName = channel && channel.name ? String(channel.name).slice(0, 80) : null;
    } catch {
      state.channelName = null;
    }
  }

  setBoot(76, 'Lendo a sala da call…', state.channelName ? `SALA: ${state.channelName}` : 'CANAL DE VOZ ENCONTRADO');
  await loadRoom();
  connectSocket();
}

function initDemo() {
  state.demo = true;
  state.sdk = null;
  state.accessToken = null;
  state.wsTicket = null;
  state.user = {
    id: 'demo-self',
    username: 'Mila',
    global_name: 'Mila',
    avatar: null
  };
  state.channelId = 'demo';
  state.guildId = 'demo';
  state.channelName = 'Sala de demonstração';

  const queue = (Array.isArray(CFG.DEMO_QUEUE) ? CFG.DEMO_QUEUE : [])
    .filter((item) => item && isVideoId(item.videoId) && item.videoId !== CFG.DEMO_VIDEO_ID)
    .slice(0, Math.max(0, Number(CFG.MAX_QUEUE) || 30))
    .map((item) => ({
      videoId: item.videoId,
      title: String(item.title || 'Vídeo do YouTube').slice(0, 120),
      duration: clampNumber(item.duration, 0, 86400)
    }));

  state.room = {
    channelId: 'demo',
    guildId: 'demo',
    videoId: isVideoId(CFG.DEMO_VIDEO_ID) ? CFG.DEMO_VIDEO_ID : null,
    title: String(CFG.DEMO_TITLE || 'Big Buck Bunny').slice(0, 120),
    duration: 634,
    position: 0,
    playing: false,
    playbackRate: 1,
    updatedAt: Date.now(),
    updatedBy: 'demo-self',
    hostId: 'demo-self',
    hostMode: 'self',
    queue
  };
  state.participants = [
    { id: 'demo-self', name: 'Mila', avatar: null },
    { id: 'demo-friend', name: 'Você', avatar: null }
  ];
  state.clockOffset = 0;
  state.lastRoomAt = Date.now();
  renderAll();
  announce('Modo local do MilaTube ativo. Nenhuma sala real está conectada.');
}

async function loadRoom() {
  try {
    const data = await requestJson(`/api/rooms/${encodeURIComponent(state.channelId)}`, {
      headers: authHeaders()
    });
    applyRoomPayload(data);
  } catch (error) {
    if (error.status !== 404) throw error;
    const data = await requestJson('/api/rooms/ensure', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        channelId: state.channelId,
        guildId: state.guildId || null
      })
    });
    applyRoomPayload(data);
  }
}

function applyRoomPayload(data) {
  if (!data) return;
  state.room = data.room || null;
  state.wsTicket = data.wsTicket || null;
  state.participants = Array.isArray(data.participants) ? data.participants : state.participants;
  syncClock(data.serverTime);
  state.lastRoomAt = Date.now();
  renderAll();

  // Reconexão/reabertura: o payload já pode ter um vídeo diferente do player
  // atual. O estado do WebSocket também aplica isso, mas se o socket demorar
  // (ou falhar), o player não deve ficar preso no cartucho antigo.
  if (state.booted && !state.demo && state.room && state.room.videoId) {
    if (!state.player) {
      ensurePlayer(state.room.videoId).catch(handlePlayerInitError);
    } else if (state.playerReady) {
      applyRoomState();
    }
  }
}

// ── WebSocket ──────────────────────────────────────────────────────────────

function connectSocket() {
  if (state.demo || !state.wsTicket || !state.channelId) return;
  if (state.ws && (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING)) return;

  state.manualClose = false;
  let socket;
  try {
    const url = new URL(wsEndpoint());
    url.searchParams.set('room', state.channelId);
    url.searchParams.set('ticket', state.wsTicket);
    socket = new WebSocket(url.toString());
  } catch (error) {
    console.warn('[MilaTube] WebSocket inválido:', error);
    scheduleReconnect();
    return;
  }

  state.ws = socket;
  state.lastPong = Date.now();
  renderStatus();

  socket.addEventListener('open', () => {
    state.reconnectAttempt = 0;
    state.lastPong = Date.now();
    try {
      socket.send(JSON.stringify({
        type: 'hello',
        name: displayName(state.user),
        avatar: avatarUrl(state.user)
      }));
    } catch {
      // O primeiro estado ainda chega pelo servidor.
    }
    startHeartbeat();
    renderAll();
    if (state.room && state.room.videoId) ensurePlayer(state.room.videoId).catch(handlePlayerInitError);
  });

  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    handleSocketMessage(message);
  });

  socket.addEventListener('close', () => {
    stopHeartbeat();
    if (state.ws === socket) state.ws = null;
    if (state.manualClose || state.destroyed) return;
    renderStatus();
    scheduleReconnect();
  });

  socket.addEventListener('error', () => {
    renderStatus();
  });
}

function scheduleReconnect() {
  if (state.demo || state.manualClose || state.destroyed) return;
  clearTimeout(state.reconnectTimer);
  const attempt = state.reconnectAttempt++;
  const delay = Math.min(15000, 1200 * (2 ** Math.min(attempt, 4)));
  state.reconnectTimer = setTimeout(async () => {
    if (state.demo || state.manualClose || state.destroyed) return;
    try {
      await loadRoom();
      connectSocket();
    } catch {
      scheduleReconnect();
    }
  }, delay);
  renderStatus();
}

function closeSocket() {
  state.manualClose = true;
  clearTimeout(state.reconnectTimer);
  stopHeartbeat();
  if (state.ws) {
    try { state.ws.close(); } catch { /* já fechado */ }
    state.ws = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  state.heartbeatTimer = setInterval(() => {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
    if (Date.now() - state.lastPong > 45000) {
      try { state.ws.close(); } catch { /* noop */ }
      return;
    }
    try { state.ws.send(JSON.stringify({ type: 'ping', t: Date.now() })); } catch { /* noop */ }
  }, 20000);
}

function stopHeartbeat() {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

function handleSocketMessage(message) {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'state') {
    state.room = message.room || null;
    state.participants = Array.isArray(message.participants) ? message.participants : [];
    syncClock(message.serverTime);
    state.lastRoomAt = Date.now();
    if (state.room && state.room.videoId && !state.player) {
      ensurePlayer(state.room.videoId).catch(handlePlayerInitError);
    } else {
      applyRoomState();
    }
    maybePublishTitle();
    renderAll();
    return;
  }
  if (message.type === 'error') {
    showToast(String(message.message || 'A sala recusou a ação.').slice(0, 220), 'error');
    return;
  }
  if (message.type === 'pong') {
    state.lastPong = Date.now();
  }
}

// ── Controle da sala ───────────────────────────────────────────────────────

function isHost() {
  return Boolean(state.user && state.room && state.user.id === state.room.hostId);
}

function canControl() {
  if (state.demo) return true;
  return Boolean(isHost() || (state.room && state.room.hostMode === 'shared'));
}

const CONTROL_TYPES = new Set(['play', 'pause', 'seek', 'load', 'queueAdd', 'queueRemove', 'next', 'eject', 'ended', 'hostMode', 'transferHost', 'title']);

function sendControl(type, data = {}) {
  if (!state.room) {
    showToast('Nenhuma sala ativa. Use /assistir para abrir um cartucho.', 'error');
    return false;
  }

  if (!state.demo && CONTROL_TYPES.has(type)) {
    if ((type === 'hostMode' || type === 'transferHost') && !isHost()) {
      showToast('Só o host pode mudar essa configuração.', 'error');
      return false;
    }
    if (type !== 'hostMode' && type !== 'transferHost' && !canControl()) {
      showToast('Só o host controla esta sala. Peça a ele para ativar o modo livre.', 'error');
      return false;
    }
  }

  if (state.demo) {
    applyLocalControl(type, data);
    return true;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    showToast('Sem conexão com a sala. Tentando reconectar…', 'error');
    scheduleReconnect();
    return false;
  }

  try {
    state.ws.send(JSON.stringify(Object.assign({ type }, data)));
    return true;
  } catch {
    showToast('Não consegui falar com a sala.', 'error');
    return false;
  }
}

function applyLocalControl(type, data) {
  const room = state.room;
  if (!room) return;
  const now = Date.now();

  switch (type) {
    case 'load': {
      if (!isVideoId(data.videoId)) return;
      room.videoId = data.videoId;
      room.title = String(data.title || 'Vídeo do YouTube').slice(0, 120);
      room.duration = clampNumber(data.duration, 0, 86400);
      room.position = 0;
      room.playing = true;
      room.updatedAt = now;
      room.updatedBy = state.user.id;
      room.queue = (room.queue || []).filter((item) => item.videoId !== data.videoId);
      if (state.player && state.playerReady) {
        applyRoomState(true);
      } else {
        ensurePlayer(room.videoId).catch(handlePlayerInitError);
      }
      break;
    }
    case 'play':
      room.position = clampNumber(data.position, 0, room.duration || 86400);
      room.playing = true;
      room.updatedAt = now;
      break;
    case 'pause':
      room.position = clampNumber(data.position, 0, room.duration || 86400);
      room.playing = false;
      room.updatedAt = now;
      break;
    case 'seek':
      room.position = clampNumber(data.position, 0, room.duration || 86400);
      room.updatedAt = now;
      break;
    case 'queueAdd':
      if (isVideoId(data.videoId) && room.queue.length < CFG.MAX_QUEUE &&
          data.videoId !== room.videoId && !room.queue.some((item) => item.videoId === data.videoId)) {
        room.queue.push({
          videoId: data.videoId,
          title: String(data.title || 'Vídeo do YouTube').slice(0, 120),
          duration: clampNumber(data.duration, 0, 86400)
        });
      }
      break;
    case 'queueRemove':
      room.queue = room.queue.filter((item) => item.videoId !== data.videoId);
      break;
    case 'next':
      if (room.queue.length) {
        const next = room.queue.shift();
        applyLocalControl('load', next);
      }
      break;
    case 'ended':
      if (room.queue.length) {
        applyLocalControl('next', {});
      } else {
        room.playing = false;
        room.position = 0;
        room.updatedAt = now;
      }
      break;
    case 'eject':
      room.videoId = null;
      room.title = '';
      room.position = 0;
      room.playing = false;
      room.updatedAt = now;
      if (state.player && state.player.stopVideo) {
        try { state.player.stopVideo(); } catch { /* noop */ }
      }
      state.videoId = null;
      break;
    case 'title':
      if (data.title && room.videoId) room.title = String(data.title).slice(0, 120);
      break;
    case 'hostMode':
      if (isHost() && (data.mode === 'self' || data.mode === 'shared')) room.hostMode = data.mode;
      break;
    case 'transferHost':
      if (isHost() && data.userId && state.participants.some((p) => p.id === data.userId)) {
        room.hostId = data.userId;
      }
      break;
    default:
      break;
  }

  renderAll();
  if (type === 'load' || type === 'next' || type === 'eject' || type === 'ended') {
    applyRoomState(true);
  }
}

function loadVideo(videoId, title, duration) {
  if (!isVideoId(videoId)) {
    showToast('Esse link não parece um vídeo do YouTube.', 'error');
    return;
  }
  if (!canControl()) {
    showToast('Só o host escolhe o cartucho. Peça a ele para ativar o modo livre.', 'error');
    return;
  }
  state.localActionAt = Date.now();
  state.pendingLoadId = videoId;

  const send = (meta) => {
    // Se outro cartucho foi escolhido enquanto o oEmbed respondia, não
    // sobrescreva a escolha mais recente com a resposta antiga.
    if (state.pendingLoadId !== videoId) return;
    state.pendingLoadId = null;
    const ok = sendControl('load', {
      videoId,
      title: String((meta && meta.title) || title || 'Vídeo do YouTube').slice(0, 120),
      duration: clampNumber((meta && meta.duration) || duration, 0, 86400)
    });
    if (ok) showToast('Cartucho enviado para a sala.', 'success');
  };

  if (title) {
    send({ title, duration });
    return;
  }

  fetchOembed(videoId)
    .then((meta) => send(meta))
    .catch(() => send({ title: 'Vídeo do YouTube', duration: 0 }));
}

function addToQueue(videoId, title, duration) {
  if (!isVideoId(videoId)) {
    showToast('Esse link não parece um vídeo do YouTube.', 'error');
    return;
  }
  if (!canControl()) {
    showToast('Só o host mexe na fila. Peça a ele para ativar o modo livre.', 'error');
    return;
  }
  const room = state.room;
  if (!room) {
    showToast('Nenhuma sala ativa.', 'error');
    return;
  }
  if (room.videoId === videoId || (room.queue || []).some((item) => item.videoId === videoId)) {
    showToast('Esse vídeo já está no console ou na fila.', 'error');
    return;
  }
  if ((room.queue || []).length >= Number(CFG.MAX_QUEUE || 30)) {
    showToast('A fila está cheia. Ejete algo antes.', 'error');
    return;
  }

  if (!room.videoId) {
    loadVideo(videoId, title, duration);
    return;
  }

  const push = (meta) => {
    const ok = sendControl('queueAdd', {
      videoId,
      title: String((meta && meta.title) || title || 'Vídeo do YouTube').slice(0, 120),
      duration: clampNumber((meta && meta.duration) || duration, 0, 86400)
    });
    if (ok) showToast('Adicionado à fila.', 'success');
  };

  if (title) {
    push({ title, duration });
  } else {
    fetchOembed(videoId).then(push).catch(() => push({ title: 'Vídeo do YouTube', duration: 0 }));
  }
}

function removeFromQueue(videoId) {
  if (!canControl()) {
    showToast('Só o host mexe na fila.', 'error');
    return;
  }
  sendControl('queueRemove', { videoId });
}

function nextVideo() {
  if (!canControl()) {
    showToast('Só o host decide o próximo cartucho.', 'error');
    return;
  }
  sendControl('next');
}

function ejectVideo() {
  if (!canControl()) {
    showToast('Só o host pode ejetar o cartucho.', 'error');
    return;
  }
  if (sendControl('eject')) showToast('Cartucho ejetado. A fila continua ali.', 'info');
}

function toggleHostMode() {
  if (!isHost()) {
    showToast('Só o host pode alternar o modo livre.', 'error');
    return;
  }
  const mode = state.room && state.room.hostMode === 'shared' ? 'self' : 'shared';
  sendControl('hostMode', { mode });
}

function transferHost(userId) {
  if (!isHost()) return;
  if (!userId || userId === state.user.id) return;
  sendControl('transferHost', { userId });
}

async function fetchOembed(videoId) {
  if (!isVideoId(videoId)) return null;
  if (state.demo) {
    const known = (CFG.DEMO_QUEUE || []).find((item) => item.videoId === videoId);
    return known ? { title: known.title, duration: known.duration || 0 } : null;
  }
  try {
    const data = await requestJson(`/api/oembed?videoId=${encodeURIComponent(videoId)}`, {
      headers: authHeaders(),
      timeout: 8000
    });
    return data && data.title ? data : null;
  } catch {
    return null;
  }
}

// ── Sincronização / player ─────────────────────────────────────────────────

function syncClock(serverTime) {
  const value = Number(serverTime);
  if (Number.isFinite(value) && value > 0) state.clockOffset = value - Date.now();
}

function expectedPosition(room = state.room) {
  if (!room) return 0;
  const base = Math.max(0, Number(room.position) || 0);
  if (!room.playing) return base;
  const now = Date.now() + state.clockOffset;
  const elapsed = Math.max(0, (now - (Number(room.updatedAt) || now)) / 1000);
  const rate = Number(room.playbackRate) || 1;
  const value = base + elapsed * rate;
  const duration = Number(room.duration) || 0;
  return duration > 0 ? Math.min(value, duration) : value;
}

function applyRoomState(force = false) {
  const room = state.room;
  if (!room || !state.player || !state.playerReady) {
    updateProgress();
    return;
  }

  if (!room.videoId) {
    try { state.player.stopVideo(); } catch { /* noop */ }
    state.videoId = null;
    clearPlayerError();
    updateProgress();
    return;
  }

  if (room.videoId !== state.videoId) {
    state.videoId = room.videoId;
    clearPlayerError();
    markRemote(1600);
    try {
      state.player.loadVideoById({
        videoId: room.videoId,
        startSeconds: clampNumber(room.position, 0, room.duration || 86400)
      });
    } catch (error) {
      showPlayerError('O player não aceitou este cartucho.', String(error && error.message ? error.message : ''));
    }
    setTimeout(() => {
      if (!state.room || state.room.videoId !== room.videoId || !state.player) return;
      try {
        if (state.room.playing) state.player.playVideo();
        else state.player.pauseVideo();
      } catch { /* noop */ }
    }, 450);
    updateProgress();
    return;
  }

  const current = state.player.getCurrentTime ? (state.player.getCurrentTime() || 0) : 0;
  const target = expectedPosition(room);
  const tolerance = Math.max(0.5, Number(CFG.SYNC_TOLERANCE) || 1.25);
  const drift = Math.abs(current - target);

  if (force || drift > tolerance) {
    markRemote(1000);
    try { state.player.seekTo(clampNumber(target, 0, room.duration || 86400), true); } catch { /* noop */ }
  }

  try {
    const yt = window.YT;
    const pState = state.player.getPlayerState();
    if (room.playing) {
      if (pState !== yt.PlayerState.PLAYING && pState !== yt.PlayerState.BUFFERING) {
        state.player.playVideo();
      }
    } else if (pState === yt.PlayerState.PLAYING) {
      state.player.pauseVideo();
    }
  } catch {
    // O player ainda está se montando.
  }

  updateProgress();
}

function markRemote(duration = 1200) {
  state.applyingRemote = true;
  clearTimeout(state.applyingTimer);
  state.applyingTimer = setTimeout(() => { state.applyingRemote = false; }, duration);
}

function maybePublishTitle() {
  if (state.demo || !state.playerReady || !state.player || !state.room || !state.room.videoId) return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN || !canControl()) return;
  const fallback = !state.room.title || state.room.title === 'Vídeo do YouTube';
  if (!fallback) return;
  let data = null;
  try { data = state.player.getVideoData ? state.player.getVideoData() : null; } catch { data = null; }
  if (data && data.video_id && data.video_id !== state.room.videoId) return;
  const title = data && typeof data.title === 'string' ? data.title.trim().slice(0, 120) : '';
  if (title && title !== state.room.title) sendControl('title', { title });
}

function ensurePlayerMount() {
  const current = el('yt-player');
  if (current && current.tagName === 'DIV') return current;
  const frame = document.querySelector('.player-frame');
  if (!frame) return null;
  const mount = document.createElement('div');
  mount.id = 'yt-player';
  mount.className = 'yt-player';
  mount.setAttribute('aria-label', 'Player do YouTube');
  frame.prepend(mount);
  return mount;
}

function ensurePlayer(videoId) {
  if (state.player) return Promise.resolve(state.player);
  if (state.playerInitPromise) return state.playerInitPromise;
  if (!isVideoId(videoId)) return Promise.resolve(null);

  state.playerInitPromise = loadYouTubeApi()
    .then(() => new Promise((resolve, reject) => {
      const mount = ensurePlayerMount();
      if (!mount) {
        reject(new Error('O buraco do player não existe na tela.'));
        return;
      }

      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      const timeout = setTimeout(() => {
        try { if (state.player && state.player.destroy) state.player.destroy(); } catch { /* noop */ }
        state.player = null;
        state.playerReady = false;
        state.videoId = null;
        settle(reject, new Error('O YouTube demorou demais para montar o player. Verifique a rede/CSP.'));
      }, 16000);

      try {
        state.player = new window.YT.Player('yt-player', {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            disablekb: 0,
            enablejsapi: 1,
            fs: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin.startsWith('http') ? window.location.origin : undefined
          },
          events: {
            onReady: (event) => {
              if (settled) return;
              clearTimeout(timeout);
              state.playerReady = true;
              state.videoId = videoId;
              try {
                event.target.setVolume(state.volume);
                if (state.muted) event.target.mute();
              } catch { /* noop */ }
              hideHint();
              clearPlayerError();
              applyRoomState(true);
              maybePublishTitle();
              renderAll();
              settle(resolve, event.target);
            },
            onStateChange: handlePlayerStateChange,
            onError: handlePlayerError
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        state.player = null;
        state.playerReady = false;
        state.videoId = null;
        settle(reject, error);
      }
    }))
    .catch((error) => {
      state.playerInitPromise = null;
      throw error;
    });

  return state.playerInitPromise;
}

function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (state.ytApiPromise) return state.ytApiPromise;

  state.ytApiPromise = new Promise((resolve, reject) => {
    let done = false;
    let poll = null;
    let timeout = null;

    const cleanup = () => {
      if (poll) {
        clearInterval(poll);
        poll = null;
      }
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const finish = (fn, value) => {
      if (done) return;
      done = true;
      cleanup();
      fn(value);
    };

    const ready = () => {
      if (window.YT && window.YT.Player) finish(resolve);
    };

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function onReady() {
      if (typeof previous === 'function') {
        try { previous(); } catch { /* noop */ }
      }
      ready();
    };

    const existing = document.querySelector('script[data-milatube-youtube-api]');
    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.dataset.milatubeYoutubeApi = '1';
      script.addEventListener('error', () => finish(reject, new Error('O script do YouTube foi bloqueado. Verifique a CSP/rede.')));
      document.head.appendChild(script);
    }

    poll = setInterval(() => {
      if (window.YT && window.YT.Player) ready();
    }, 250);

    timeout = setTimeout(() => {
      if (!(window.YT && window.YT.Player)) {
        finish(reject, new Error('A API do YouTube não carregou. Pode ser bloqueio de rede ou CSP.'));
      }
    }, 16000);
  }).catch((error) => {
    state.ytApiPromise = null;
    throw error;
  });

  return state.ytApiPromise;
}

function handlePlayerStateChange(event) {
  if (!state.playerReady) return;
  const yt = window.YT;
  if (!yt) return;

  if (event.data === yt.PlayerState.PLAYING) {
    hideHint();
    maybePublishTitle();
    if (state.applyingRemote) return;
    if (Date.now() - state.localActionAt < 700) return;
    if (state.room && !state.room.playing && canControl()) {
      sendControl('play', { position: getPlayerTime() });
    }
    return;
  }

  if (event.data === yt.PlayerState.PAUSED) {
    if (state.applyingRemote) return;
    if (Date.now() - state.localActionAt < 700) return;
    if (state.room && state.room.playing && canControl()) {
      sendControl('pause', { position: getPlayerTime() });
    }
    return;
  }

  if (event.data === yt.PlayerState.ENDED) {
    if (state.applyingRemote) return;
    if (canControl()) sendControl('ended');
    else showHint('O vídeo terminou. O host escolhe o próximo cartucho.');
  }
}

function handlePlayerError(event) {
  const code = event && event.data;
  const messages = {
    2: 'O ID do vídeo é inválido. Confira o link.',
    5: 'O navegador não conseguiu reproduzir este vídeo em HTML5.',
    100: 'O vídeo não existe ou foi removido.',
    101: 'O criador não permite incorporar este vídeo.',
    150: 'O criador não permite incorporar este vídeo.'
  };
  const text = messages[code] || 'O YouTube recusou este cartucho.';
  showPlayerError('Esta fita não roda aqui', text);
  showToast(text, 'error');
}

function showPlayerError(title, message) {
  const box = el('player-error');
  if (!box) return;
  box.hidden = false;
  setText('player-error-title', title);
  setText('player-error-text', message || 'Tente outro vídeo ou abra no YouTube.');
  const button = el('btn-open-youtube');
  if (button) button.dataset.videoId = state.room && state.room.videoId ? state.room.videoId : '';
  hideHint();
}

function clearPlayerError() {
  const box = el('player-error');
  if (box) box.hidden = true;
}

function handlePlayerInitError(error) {
  showPlayerError('O player não carregou', String(error && error.message ? error.message : error || ''));
  showToast('O player do YouTube não carregou.', 'error');
}

function getPlayerTime() {
  if (state.player && state.player.getCurrentTime) {
    const value = state.player.getCurrentTime();
    if (Number.isFinite(value)) return Math.max(0, value);
  }
  return expectedPosition();
}

function getPlayerDuration() {
  if (state.player && state.player.getDuration) {
    const value = state.player.getDuration();
    if (Number.isFinite(value) && value > 0) return value;
  }
  return Math.max(0, Number(state.room && state.room.duration) || 0);
}

function startTick() {
  if (state.tickTimer) return;
  state.tickTimer = setInterval(tick, 1000);
  tick();
}

function tick() {
  if (!state.room) {
    updateProgress();
    return;
  }

  if (state.playerReady && state.player) {
    // O iframe oficial permite clicar no título/recomendações e navegar para
    // outro vídeo. Isso quebraria a sala; se o player sair do cartucho atual,
    // puxa de volta para o vídeo da sala.
    let playerData = null;
    try { playerData = state.player.getVideoData ? state.player.getVideoData() : null; } catch { playerData = null; }
    if (playerData && playerData.video_id && state.room.videoId &&
        playerData.video_id !== state.room.videoId && !state.applyingRemote) {
      state.videoId = playerData.video_id;
      applyRoomState(true);
      return;
    }

    const current = getPlayerTime();
    const duration = getPlayerDuration();
    if (!state.seeking) updateProgress(current, duration);

    if (!state.applyingRemote && !state.demo && Date.now() - state.lastRoomAt > 1200) {
      const target = expectedPosition(state.room);
      const drift = Math.abs(current - target);
      const tolerance = Math.max(0.5, Number(CFG.SYNC_TOLERANCE) || 1.25);
      const yt = window.YT;
      const pState = state.player.getPlayerState();

      if (!isHost()) {
        // Quem não é host nunca manda comandos automáticos: corrige o próprio
        // player para acompanhar a sala sem gerar avisos de "só o host controla".
        // No modo livre, o host continua sendo a fonte da posição; os demais
        // podem mandar comandos explícitos, mas não ficam puxando a sala.
        if (drift > tolerance ||
            (state.room.playing && pState === yt.PlayerState.PAUSED) ||
            (!state.room.playing && pState === yt.PlayerState.PLAYING)) {
          applyRoomState(false);
        }
        if (state.room.playing && pState === yt.PlayerState.PAUSED) {
          showHint('O navegador pausou o player. Clique no play do YouTube para voltar ao ritmo.');
        }
      } else if (state.room.playing && pState === yt.PlayerState.PLAYING && drift > Math.max(2.5, tolerance * 2)) {
        // O host é a fonte da posição: se ele arrastou o player nativo do
        // YouTube, a sala acompanha o tempo local em vez de puxá-lo de volta.
        if (Date.now() - state.lastSeekSent > 2500) {
          state.lastSeekSent = Date.now();
          sendControl('seek', { position: current });
        }
      } else if (state.room.playing && pState === yt.PlayerState.PAUSED) {
        showHint('O navegador pausou o player. Clique no play do YouTube para voltar ao ritmo.');
      } else if (!state.room.playing && drift > 2 && pState !== yt.PlayerState.BUFFERING) {
        if (Date.now() - state.lastSeekSent > 2500) {
          state.lastSeekSent = Date.now();
          sendControl('seek', { position: current });
        }
      }
    }
    return;
  }

  updateProgress();
}

function updateProgress(current, duration) {
  const room = state.room;
  const position = Number.isFinite(current) ? current : (room ? expectedPosition(room) : 0);
  const total = Number.isFinite(duration) ? duration : (room ? Number(room.duration) || 0 : 0);
  const currentLabel = el('time-current');
  const totalLabel = el('time-total');
  const seek = el('seek');
  if (currentLabel) currentLabel.textContent = formatTime(position);
  if (totalLabel) totalLabel.textContent = formatTime(total);
  if (seek) {
    seek.max = String(Math.max(1, Math.floor(total || 1)));
    if (!state.seeking) seek.value = String(Math.min(Math.max(0, Math.floor(position)), Number(seek.max)));
    const pct = total > 0 ? (position / total) * 100 : 0;
    seek.style.setProperty('--progress', `${clampNumber(pct, 0, 100)}%`);
  }
}

// ── Renderização ───────────────────────────────────────────────────────────

function renderAll() {
  const room = state.room;
  const hasVideo = Boolean(room && room.videoId);
  const participants = Array.isArray(state.participants) ? state.participants : [];
  const count = participants.length;

  const empty = el('player-empty');
  if (empty) empty.classList.toggle('is-hidden', hasVideo);

  setText('video-title', hasVideo ? (room.title || 'Vídeo do YouTube') : 'Nenhum cartucho inserido');
  setText('video-author', hasVideo ? hostName() : 'Mila');
  setText('video-meta', hasVideo ? `Sessão sincronizada • ${count} ${count === 1 ? 'pessoa' : 'pessoas'} na sala` : 'Aguardando um cartucho');
  setText('video-description', hasVideo
    ? `“${room.title || 'Vídeo do YouTube'}” está no cartucho. A Mila mantém play, pausa e posição alinhados entre os clientes; o áudio e o vídeo continuam no player oficial do YouTube.`
    : 'A Mila preparou este cantinho para assistir com calma, comentar no chat e não perder o momento. O player é o YouTube oficial; a moldura é nossa.');
  setText('viewer-count', `${count} ${count === 1 ? 'pessoa assistindo' : 'pessoas assistindo'}`);
  setText('queue-count', String(room && Array.isArray(room.queue) ? room.queue.length : 0));
  setText('participant-count', String(count));
  setText('now-playing-label', 'AGORA NO CARTUCHO');
  setText('sync-state', state.demo ? 'modo local' : (state.ws && state.ws.readyState === WebSocket.OPEN ? 'sincronizado' : 'aguardando sala'));

  const adNote = el('ad-note');
  if (adNote && CFG.ADS_NOTE) adNote.title = CFG.ADS_NOTE;

  const modeButton = el('btn-mode');
  if (modeButton) {
    const shared = room && room.hostMode === 'shared';
    modeButton.textContent = isHost() ? (shared ? 'MODO LIVRE' : 'SÓ O HOST') : (shared ? 'MODO LIVRE' : 'HOST CONTROLA');
    modeButton.disabled = !isHost();
    modeButton.title = isHost() ? 'Alternar o controle da sala' : 'Apenas o host alterna o modo';
  }

  const controlDisabled = !canControl();
  const playerBusy = hasVideo && !state.demo && !state.playerReady;
  ['btn-play', 'btn-pause'].forEach((id) => {
    const button = el(id);
    if (button) button.disabled = controlDisabled || playerBusy;
  });
  const eject = el('btn-eject');
  if (eject) eject.disabled = controlDisabled;
  const seek = el('seek');
  if (seek) seek.disabled = controlDisabled || !hasVideo || playerBusy;

  const hostNote = el('host-note');
  if (hostNote) {
    if (!room) hostNote.textContent = 'Use /assistir no Discord para abrir um cartucho nesta call.';
    else if (state.demo) hostNote.textContent = 'Modo local: você é o host. Nada aqui está conectado a uma sala real.';
    else if (isHost()) hostNote.textContent = 'Você é o host. Pode passar o controle clicando em outra pessoa.';
    else if (room.hostMode === 'shared') hostNote.textContent = 'Modo livre: todo mundo pode dar play, pausar e escolher cartuchos.';
    else hostNote.textContent = `Host: ${hostName()}. Peça a ele para ativar o modo livre se quiser ajudar.`;
  }

  renderQueue();
  renderParticipants();
  renderStatus();
  updateProgress();
}

function renderQueue() {
  const list = el('queue-list');
  if (!list) return;
  list.replaceChildren();
  const room = state.room;
  const queue = room && Array.isArray(room.queue) ? room.queue : [];

  if (!queue.length) {
    const empty = document.createElement('p');
    empty.className = 'queue-empty';
    empty.textContent = 'A fila está vazia. O primeiro link vira o cartucho principal.';
    list.appendChild(empty);
    return;
  }

  queue.forEach((item, index) => {
    if (!item || !isVideoId(item.videoId)) return;
    const row = document.createElement('div');
    row.className = 'queue-row';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'queue-item';
    button.title = canControl() ? `Assistir: ${item.title || item.videoId}` : 'Apenas o host escolhe o cartucho';
    button.addEventListener('click', () => {
      if (!canControl()) {
        showToast('Só o host escolhe o cartucho.', 'error');
        return;
      }
      loadVideo(item.videoId, item.title, item.duration);
    });

    const thumb = document.createElement('span');
    thumb.className = 'queue-item__thumb';
    const image = document.createElement('img');
    image.src = thumbnailUrl(item.videoId);
    image.alt = '';
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove());
    thumb.appendChild(image);

    const body = document.createElement('span');
    body.className = 'queue-item__body';
    const title = document.createElement('span');
    title.className = 'queue-item__title';
    title.textContent = item.title || 'Vídeo do YouTube';
    const meta = document.createElement('span');
    meta.className = 'queue-item__meta';
    meta.textContent = item.duration ? formatTime(item.duration) : 'YouTube';
    body.append(title, meta);

    const number = document.createElement('span');
    number.className = 'queue-item__index';
    number.textContent = String(index + 1).padStart(2, '0');

    button.append(thumb, body, number);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'queue-remove';
    remove.textContent = '×';
    remove.title = 'Remover da fila';
    remove.setAttribute('aria-label', `Remover ${item.title || 'vídeo'} da fila`);
    remove.disabled = !canControl();
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      removeFromQueue(item.videoId);
    });

    row.append(button, remove);
    list.appendChild(row);
  });
}

function renderParticipants() {
  const list = el('participants');
  if (!list) return;
  list.replaceChildren();
  const participants = Array.isArray(state.participants) ? state.participants : [];
  const hostId = state.room && state.room.hostId;

  if (!participants.length) {
    const empty = document.createElement('p');
    empty.className = 'host-note';
    empty.textContent = state.demo ? 'Modo local: a Mila está aqui.' : 'Ninguém conectado ainda.';
    list.appendChild(empty);
    return;
  }

  participants.forEach((participant) => {
    if (!participant || !participant.id) return;
    const isCurrent = state.user && participant.id === state.user.id;
    const isTheHost = participant.id === hostId;
    const canPromote = isHost() && !isTheHost && !isCurrent;
    const node = document.createElement(canPromote ? 'button' : 'span');
    node.className = 'participant' + (isTheHost ? ' participant--host' : '') + (isCurrent ? ' participant--self' : '');
    if (canPromote) {
      node.type = 'button';
      node.title = `Passar o controle para ${participant.name || 'esta pessoa'}`;
      node.addEventListener('click', () => transferHost(participant.id));
    }

    const avatar = document.createElement('span');
    avatar.className = 'participant__avatar';
    const safeAvatar = safeAvatarUrl(participant.avatar);
    if (safeAvatar) {
      const image = document.createElement('img');
      image.src = safeAvatar;
      image.alt = '';
      image.referrerPolicy = 'no-referrer';
      image.addEventListener('error', () => { image.remove(); avatar.textContent = initials(participant.name); });
      avatar.appendChild(image);
    } else {
      avatar.textContent = initials(participant.name);
    }

    const name = document.createElement('span');
    name.className = 'participant__name';
    name.textContent = String(participant.name || 'Mila').slice(0, 32);

    node.appendChild(avatar);
    node.appendChild(name);
    if (isTheHost) {
      const crown = document.createElement('span');
      crown.className = 'participant__crown';
      crown.textContent = '♛';
      crown.setAttribute('aria-label', 'Host da sala');
      node.appendChild(crown);
    }
    list.appendChild(node);
  });
}

function renderStatus() {
  const connection = el('connection-pill');
  const status = el('status-pill');
  const led = el('console-led');
  const online = state.demo || Boolean(state.ws && state.ws.readyState === WebSocket.OPEN);
  const room = state.room;
  const kind = state.demo ? 'warn' : online ? 'ok' : state.ws ? 'connecting' : 'error';

  if (connection) {
    connection.dataset.state = kind;
    connection.textContent = state.demo ? 'MODO LOCAL' : online ? 'SALA ONLINE' : state.ws ? 'CONECTANDO' : 'SEM SINAL';
  }
  if (status) {
    status.dataset.state = kind;
    status.textContent = !room ? 'SEM CARTUCHO'
      : state.demo ? 'MODO LOCAL'
        : !online ? 'RECONECTANDO'
          : room.hostMode === 'shared' ? 'MODO LIVRE' : 'HOST CONTROL';
  }
  if (led) {
    led.classList.toggle('is-on', Boolean(online && room));
    led.classList.toggle('is-busy', kind === 'connecting');
  }
}

function hostName() {
  const room = state.room;
  if (!room) return 'Mila';
  const host = (state.participants || []).find((item) => item.id === room.hostId);
  return host && host.name ? String(host.name).slice(0, 32) : 'Mila';
}

// ── UI estática ────────────────────────────────────────────────────────────

function wireUI() {
  const searchForm = el('search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = el('search-input');
      const value = input ? input.value.trim() : '';
      if (!value) return;
      const id = parseYouTubeInput(value);
      if (id) {
        loadVideo(id);
        input.value = '';
      } else {
        openExternal(`https://www.youtube.com/results?search_query=${encodeURIComponent(value)}`);
      }
    });
  }

  const queueForm = el('queue-form');
  if (queueForm) {
    queueForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = el('queue-input');
      const value = input ? input.value.trim() : '';
      if (!value) return;
      const id = parseYouTubeInput(value);
      if (!id) {
        showToast('Cole um link ou ID de vídeo do YouTube.', 'error');
        return;
      }
      addToQueue(id);
      if (input) input.value = '';
    });
  }

  const emptyCta = el('empty-cta');
  if (emptyCta) emptyCta.addEventListener('click', () => {
    const input = el('search-input');
    if (input) input.focus();
    showToast('Cole o link do vídeo no campo de busca.');
  });

  const play = el('btn-play');
  if (play) play.addEventListener('click', () => {
    if (!canControl()) { showToast('Só o host controla o play.', 'error'); return; }
    state.localActionAt = Date.now();
    if (state.player && state.player.playVideo) {
      try { state.player.playVideo(); } catch { /* noop */ }
    }
    sendControl('play', { position: getPlayerTime() });
  });

  const pause = el('btn-pause');
  if (pause) pause.addEventListener('click', () => {
    if (!canControl()) { showToast('Só o host controla o pause.', 'error'); return; }
    state.localActionAt = Date.now();
    if (state.player && state.player.pauseVideo) {
      try { state.player.pauseVideo(); } catch { /* noop */ }
    }
    sendControl('pause', { position: getPlayerTime() });
  });

  const sync = el('btn-sync');
  if (sync) sync.addEventListener('click', () => {
    applyRoomState(true);
    showToast('Relógio sincronizado com a sala.', 'success');
  });

  const seek = el('seek');
  if (seek) {
    seek.addEventListener('pointerdown', () => { state.seeking = true; });
    seek.addEventListener('pointerup', () => { state.seeking = false; applySeekFromInput(); });
    seek.addEventListener('pointercancel', () => { state.seeking = false; });
    seek.addEventListener('keyup', () => { if (!state.seeking) applySeekFromInput(); });
    seek.addEventListener('input', () => {
      const total = getPlayerDuration();
      const value = Number(seek.value) || 0;
      setText('time-current', formatTime(value));
      seek.style.setProperty('--progress', `${total > 0 ? clampNumber((value / total) * 100, 0, 100) : 0}%`);
    });
  }

  const volume = el('volume');
  if (volume) {
    try {
      const raw = window.localStorage.getItem('milatube-volume');
      if (raw !== null && raw !== '') {
        const stored = Number(raw);
        if (Number.isFinite(stored)) state.volume = clampNumber(stored, 0, 100);
      }
    } catch { /* noop */ }
    volume.value = String(state.volume);
    volume.addEventListener('input', () => {
      state.volume = clampNumber(volume.value, 0, 100);
      if (state.player && state.player.setVolume) {
        try { state.player.setVolume(state.volume); } catch { /* noop */ }
      }
      if (state.volume > 0 && state.muted) toggleMute();
      try { window.localStorage.setItem('milatube-volume', String(state.volume)); } catch { /* noop */ }
    });
  }

  const mute = el('btn-mute');
  if (mute) mute.addEventListener('click', toggleMute);

  const mode = el('btn-mode');
  if (mode) mode.addEventListener('click', toggleHostMode);

  const eject = el('btn-eject');
  if (eject) eject.addEventListener('click', ejectVideo);

  const share = el('btn-share');
  if (share) share.addEventListener('click', async () => {
    if (state.sdk && state.sdk.commands && state.sdk.commands.openInviteDialog) {
      try {
        await state.sdk.commands.openInviteDialog();
        return;
      } catch { /* cai no aviso abaixo */ }
    }
    if (state.demo) {
      const ok = await copyText(window.location.href);
      showToast(ok ? 'Link local copiado.' : 'Não consegui copiar o link.', ok ? 'success' : 'error');
      return;
    }
    showToast('Use o botão Convidar no topo para chamar alguém.', 'info');
  });

  const invite = el('btn-invite');
  if (invite) invite.addEventListener('click', async () => {
    try {
      if (state.sdk && state.sdk.commands && state.sdk.commands.openInviteDialog) {
        await state.sdk.commands.openInviteDialog();
        return;
      }
    } catch { /* cai no copiar */ }
    const ok = await copyText(window.location.href);
    showToast(ok ? 'Link copiado. Cole no chat da call.' : 'Abra o convite da Activity pelo Discord.', ok ? 'success' : 'error');
  });

  ['btn-fullscreen', 'btn-fullscreen-top'].forEach((id) => {
    const button = el(id);
    if (button) button.addEventListener('click', toggleFullscreen);
  });

  ['btn-help', 'btn-help-top', 'btn-ads-help'].forEach((id) => {
    const button = el(id);
    if (button) button.addEventListener('click', () => {
      openHelp();
      if (id === 'btn-ads-help') {
        setTimeout(() => {
          const section = el('help-ads');
          if (section && section.scrollIntoView) section.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
        }, 80);
      }
    });
  });

  const helpClose = el('help-close');
  if (helpClose) helpClose.addEventListener('click', closeHelp);
  const helpOk = el('help-ok');
  if (helpOk) helpOk.addEventListener('click', closeHelp);
  const helpDialog = el('help-dialog');
  if (helpDialog) {
    helpDialog.addEventListener('click', (event) => {
      if (event.target === helpDialog) closeHelp();
    });
    helpDialog.addEventListener('close', () => {
      state.helpOpen = false;
    });
  }
  const helpYoutube = el('help-youtube');
  if (helpYoutube) helpYoutube.addEventListener('click', (event) => {
    event.preventDefault();
    openExternal('https://www.youtube.com/');
  });

  const openYoutube = el('btn-open-youtube');
  if (openYoutube) openYoutube.addEventListener('click', () => {
    const id = openYoutube.dataset.videoId || (state.room && state.room.videoId);
    if (id && isVideoId(id)) openExternal(`https://www.youtube.com/watch?v=${id}`);
  });

  document.querySelectorAll('[data-toast]').forEach((button) => {
    button.addEventListener('click', () => showToast(button.dataset.toast || 'Em breve ♡'));
  });

  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('beforeunload', () => {
    state.destroyed = true;
    closeSocket();
  });

  const retry = el('boot-retry');
  if (retry) retry.addEventListener('click', () => window.location.reload());
  const demo = el('boot-demo');
  if (demo) demo.addEventListener('click', () => startLocalMode());
}

function applySeekFromInput() {
  state.seeking = false;
  const seek = el('seek');
  if (!seek || !canControl()) return;
  const position = clampNumber(seek.value, 0, getPlayerDuration() || 86400);
  state.localActionAt = Date.now();
  if (state.player && state.player.seekTo) {
    try { state.player.seekTo(position, true); } catch { /* noop */ }
  }
  sendControl('seek', { position });
}

function toggleMute() {
  state.muted = !state.muted;
  if (state.player) {
    try {
      if (state.muted) state.player.mute();
      else state.player.unMute();
      state.player.setVolume(state.volume);
    } catch { /* noop */ }
  }
  const button = el('btn-mute');
  if (button) {
    button.textContent = state.muted ? '🔇' : '🔊';
    button.setAttribute('aria-pressed', state.muted ? 'true' : 'false');
    button.setAttribute('aria-label', state.muted ? 'Ativar som' : 'Silenciar');
  }
}

function toggleFullscreen() {
  const target = el('console') || document.documentElement;
  if (!document.fullscreenElement) {
    if (target.requestFullscreen) target.requestFullscreen().catch(() => showToast('O Discord não liberou a tela cheia.', 'error'));
  } else if (document.exitFullscreen) {
    document.exitFullscreen().catch(() => { /* noop */ });
  }
}

async function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') throw new Error('URL inválida');
    if (state.sdk && state.sdk.commands && state.sdk.commands.openExternalLink) {
      await state.sdk.commands.openExternalLink({ url: parsed.toString() });
      return;
    }
  } catch {
    // Segue para window.open.
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* segue para fallback */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function openHelp() {
  const dialog = el('help-dialog');
  if (!dialog) return;
  state.helpOpen = true;
  if (typeof dialog.showModal === 'function') {
    if (!dialog.open) dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

function closeHelp() {
  const dialog = el('help-dialog');
  if (!dialog) return;
  state.helpOpen = false;
  if (typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}

function handleKeydown(event) {
  const target = event.target;
  const tag = target && target.tagName ? target.tagName.toLowerCase() : '';

  if (event.key === 'Escape') {
    if (state.helpOpen) closeHelp();
    return;
  }
  if (state.helpOpen) return;
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button' || tag === 'a' ||
      (target && target.isContentEditable)) return;
  if (event.defaultPrevented) return;

  if (event.key === '?') {
    event.preventDefault();
    openHelp();
    return;
  }
  if (event.key === 'f' || event.key === 'F') {
    event.preventDefault();
    toggleFullscreen();
    return;
  }
  if (event.key === 'm' || event.key === 'M') {
    event.preventDefault();
    toggleMute();
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (!canControl()) return;
    const playing = state.room && state.room.playing;
    state.localActionAt = Date.now();
    if (state.player) {
      try {
        if (playing) state.player.pauseVideo();
        else state.player.playVideo();
      } catch { /* noop */ }
    }
    sendControl(playing ? 'pause' : 'play', { position: getPlayerTime() });
    return;
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    if (!canControl()) return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 5 : -5;
    const position = clampNumber(getPlayerTime() + delta, 0, getPlayerDuration() || 86400);
    state.localActionAt = Date.now();
    if (state.player && state.player.seekTo) {
      try { state.player.seekTo(position, true); } catch { /* noop */ }
    }
    sendControl('seek', { position });
  }
}

async function startLocalMode() {
  hideBootError();
  closeSocket();
  state.demo = true;
  state.accessToken = null;
  state.wsTicket = null;
  state.videoId = null;
  state.applyingRemote = false;
  initDemo();
  finishBoot();
  if (state.room && state.room.videoId) {
    ensurePlayer(state.room.videoId).then(() => applyRoomState(true)).catch(handlePlayerInitError);
  }
  startTick();
}

// ── Início ─────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
