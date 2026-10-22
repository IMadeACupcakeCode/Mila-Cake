/*
 * MilaTube — Worker de autenticação e sincronização.
 *
 * Rotas públicas (atrás do proxy de URL Mappings do Discord):
 *   POST /api/token          troca o code OAuth por access_token
 *   POST /api/rooms          bot cria/atualiza a sala (BOT_API_SECRET)
 *   POST /api/rooms/ensure   participante cria a sala se ela ainda não existir
 *   GET  /api/rooms/:id      estado + ticket WebSocket (Bearer do usuário)
 *   GET  /api/oembed         metadados do YouTube (cache de 1h)
 *   GET  /ws                 upgrade WebSocket (ticket assinado)
 *   GET  /health             diagnóstico sem segredos
 *
 * O Worker não baixa, proxya ou altera o vídeo. O player continua sendo o
 * iframe oficial do YouTube, e anúncios continuam sob controle do YouTube.
 */

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const ID_RE = /^\d{17,20}$/;
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;
const TICKET_TTL_MS = 60 * 60 * 1000;
const MAX_QUEUE = 30;
const MAX_BODY_BYTES = 8192;
const MAX_WS_MESSAGE_BYTES = 4096;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname);
    const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    try {
      if (upgrade === 'websocket' && (path === '/' || path === '/ws')) {
        return await handleWebSocket(request, env);
      }

      if (request.method === 'GET' && path === '/health') {
        return json({
          ok: true,
          service: 'mila-tube-sync',
          version: 1,
          time: Date.now(),
          roomsBound: Boolean(env.MILA_ROOMS),
          oauthConfigured: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
          botSecretConfigured: Boolean(env.BOT_API_SECRET),
          botTokenConfigured: Boolean(env.DISCORD_BOT_TOKEN),
          ticketSecretConfigured: Boolean(env.WS_TICKET_SECRET)
        }, 200, request, env);
      }

      if (request.method === 'POST' && path === '/token') {
        return await handleToken(request, env);
      }

      if (request.method === 'POST' && path === '/rooms') {
        return await handleBotRoom(request, env);
      }

      if (request.method === 'POST' && path === '/rooms/ensure') {
        return await handleEnsureRoom(request, env);
      }

      const roomMatch = path.match(/^\/rooms\/(\d{17,20})$/);
      if (request.method === 'GET' && roomMatch) {
        return await handleGetRoom(request, env, roomMatch[1]);
      }

      if (request.method === 'GET' && path === '/oembed') {
        return await handleOembed(request, env, url);
      }

      if (request.method === 'GET' && path === '/') {
        return json({ ok: true, service: 'mila-tube-sync', message: 'Use /health, /api/token, /api/rooms e /ws.' }, 200, request, env);
      }

      return json({ error: 'not_found' }, 404, request, env);
    } catch (error) {
      console.error('[MilaTube Worker]', error && error.stack ? error.stack : error);
      return json({ error: 'internal_error' }, 500, request, env);
    }
  }
};

// ── Rotas ──────────────────────────────────────────────────────────────────

async function handleToken(request, env) {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return json({ error: 'OAuth não configurado no Worker.' }, 500, request, env);
  }

  const body = await readJson(request);
  const code = body && typeof body.code === 'string' ? body.code.trim() : '';
  if (!code || code.length > 1024) {
    return json({ error: 'Código OAuth ausente ou inválido.' }, 400, request, env);
  }

  // O SDK da Activity cuida do redirect. O exemplo oficial da Discord também
  // omite redirect_uri nesta troca; o placeholder https://127.0.0.1 é só do
  // Developer Portal.
  const form = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code
  });

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString()
  });

  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }

  if (!response.ok || !data || !data.access_token) {
    const description = data && (data.error_description || data.error) ? String(data.error_description || data.error) : `HTTP ${response.status}`;
    return json({ error: `O Discord recusou o código: ${description.slice(0, 180)}` }, 401, request, env);
  }

  return json({
    access_token: data.access_token,
    token_type: data.token_type || 'Bearer',
    expires_in: data.expires_in || null,
    scope: data.scope || null
  }, 200, request, env);
}

async function handleBotRoom(request, env) {
  if (!verifyBot(request, env)) {
    return json({ error: 'Não autorizado.' }, 401, request, env);
  }
  if (!env.MILA_ROOMS || !env.BOT_API_SECRET) {
    return json({ error: 'Durable Object ou BOT_API_SECRET não configurado.' }, 500, request, env);
  }

  const body = await readJson(request);
  if (!body) return json({ error: 'JSON inválido.' }, 400, request, env);

  const channelId = sanitizeId(body.channelId);
  if (!channelId) return json({ error: 'channelId inválido.' }, 400, request, env);

  const guildId = body.guildId == null ? null : sanitizeId(body.guildId);
  if (body.guildId != null && !guildId) return json({ error: 'guildId inválido.' }, 400, request, env);

  const hostId = body.hostId == null ? null : sanitizeId(body.hostId);
  if (body.hostId != null && !hostId) return json({ error: 'hostId inválido.' }, 400, request, env);

  let videoId = null;
  if (body.videoId != null) {
    videoId = sanitizeVideoId(body.videoId);
    if (!videoId) return json({ error: 'videoId inválido.' }, 400, request, env);
  }

  const payload = {
    channelId,
    guildId,
    hostId,
    title: sanitizeTitle(body.title) || (videoId ? 'Vídeo do YouTube' : ''),
    duration: clampNumber(body.duration, 0, 86400, 0)
  };
  if (body.hostMode === 'shared' || body.hostMode === 'self') payload.hostMode = body.hostMode;
  // Uma atualização de metadados (título/host) não precisa reenviar o vídeo.
  // Sem esta checagem, `videoId: null` limparia o cartucho por acidente.
  if (Object.prototype.hasOwnProperty.call(body, 'videoId')) payload.videoId = videoId;

  const result = await callRoom(env, channelId, '/update', payload);
  if (!result.response.ok || !result.data) {
    return json({ error: 'A sala não aceitou a atualização.' }, 502, request, env);
  }

  return json({
    ok: true,
    room: result.data.room,
    serverTime: result.data.serverTime || Date.now()
  }, 200, request, env);
}

async function handleEnsureRoom(request, env) {
  const user = await verifyUser(request, env);
  if (!user) return json({ error: 'Entre na Activity para abrir a sala.' }, 401, request, env);
  if (!env.MILA_ROOMS || !env.BOT_API_SECRET || !env.WS_TICKET_SECRET) {
    return json({ error: 'Sala ou ticket não configurado no Worker.' }, 500, request, env);
  }

  const body = await readJson(request);
  if (!body) return json({ error: 'JSON inválido.' }, 400, request, env);

  const channelId = sanitizeId(body.channelId);
  if (!channelId) return json({ error: 'channelId inválido.' }, 400, request, env);

  const guildId = body.guildId == null ? null : sanitizeId(body.guildId);
  if (body.guildId != null && !guildId) return json({ error: 'guildId inválido.' }, 400, request, env);

  if (!(await isGuildMember(env, guildId, user.id))) {
    return json({ error: 'Você não é membro deste servidor.' }, 403, request, env);
  }

  const result = await callRoom(env, channelId, '/ensure', {
    channelId,
    guildId,
    hostId: user.id,
    hostName: displayName(user),
    hostAvatar: discordAvatar(user)
  });
  if (!result.response.ok || !result.data || !result.data.room) {
    return json({ error: 'Não consegui abrir a sala.' }, 502, request, env);
  }

  const ticket = await createTicket(env, channelId, user);
  return json({
    room: result.data.room,
    participants: result.data.participants || [],
    serverTime: result.data.serverTime || Date.now(),
    wsTicket: ticket
  }, 200, request, env);
}

async function handleGetRoom(request, env, channelId) {
  const user = await verifyUser(request, env);
  if (!user) return json({ error: 'Entre na Activity para acessar a sala.' }, 401, request, env);
  if (!env.MILA_ROOMS || !env.BOT_API_SECRET || !env.WS_TICKET_SECRET) {
    return json({ error: 'Sala ou ticket não configurado no Worker.' }, 500, request, env);
  }

  const result = await callRoom(env, channelId, '/state');
  if (result.response.status === 404) {
    return json({ error: 'room_not_found' }, 404, request, env);
  }
  if (!result.response.ok || !result.data || !result.data.room) {
    return json({ error: 'Não consegui ler a sala.' }, 502, request, env);
  }

  if (!(await isGuildMember(env, result.data.room.guildId, user.id))) {
    return json({ error: 'Você não é membro deste servidor.' }, 403, request, env);
  }

  const ticket = await createTicket(env, channelId, user);
  return json({
    room: result.data.room,
    participants: result.data.participants || [],
    serverTime: result.data.serverTime || Date.now(),
    wsTicket: ticket
  }, 200, request, env);
}

async function handleOembed(request, env, url) {
  const bot = verifyBot(request, env);
  const user = bot ? null : await verifyUser(request, env);
  if (!bot && !user) return json({ error: 'Não autorizado.' }, 401, request, env);

  const videoId = sanitizeVideoId(url.searchParams.get('videoId'));
  if (!videoId) return json({ error: 'videoId inválido.' }, 400, request, env);

  const cache = typeof caches !== 'undefined' && caches.default ? caches.default : null;
  const cacheKey = new Request(`https://mila-oembed.internal/${videoId}`);
  if (cache) {
    try {
      const hit = await cache.match(cacheKey);
      if (hit) {
        const data = await hit.json();
        return json(data, 200, request, env, { 'Cache-Control': 'public, max-age=3600' });
      }
    } catch { /* cache indisponível */ }
  }

  const target = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  let response;
  try {
    response = await fetch(target, {
      headers: {
        'User-Agent': 'MilaTube/1.0 (Discord Activity; oEmbed metadata only)',
        'Accept': 'application/json'
      }
    });
  } catch {
    return json({ error: 'O YouTube não respondeu.' }, 502, request, env);
  }

  if (!response.ok) {
    return json({ error: 'Vídeo indisponível no oEmbed.' }, response.status === 404 ? 404 : 502, request, env);
  }

  let data;
  try { data = await response.json(); } catch { data = null; }
  if (!data || !data.title) return json({ error: 'Metadados inválidos.' }, 502, request, env);

  const payload = {
    videoId,
    title: sanitizeTitle(data.title) || 'Vídeo do YouTube',
    author_name: typeof data.author_name === 'string' ? data.author_name.slice(0, 120) : '',
    thumbnail_url: typeof data.thumbnail_url === 'string' && data.thumbnail_url.startsWith('https://') ? data.thumbnail_url : '',
    width: clampNumber(data.width, 0, 10000, 0),
    height: clampNumber(data.height, 0, 10000, 0)
  };

  if (cache) {
    try {
      await cache.put(cacheKey, new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' }
      }));
    } catch { /* cache cheio/indisponível */ }
  }

  return json(payload, 200, request, env, { 'Cache-Control': 'public, max-age=3600' });
}

async function handleWebSocket(request, env) {
  if (!request.headers.get('Upgrade')) {
    return json({ error: 'upgrade_required' }, 426, request, env);
  }
  if (!env.MILA_ROOMS || !env.BOT_API_SECRET || !env.WS_TICKET_SECRET) {
    return json({ error: 'Sala ou ticket não configurado no Worker.' }, 500, request, env);
  }

  const url = new URL(request.url);
  const roomId = sanitizeId(url.searchParams.get('room'));
  const ticket = url.searchParams.get('ticket') || '';
  if (!roomId) return json({ error: 'Sala inválida.' }, 400, request, env);

  const payload = await verifyTicket(env, ticket, roomId);
  if (!payload) return json({ error: 'Ticket inválido ou expirado.' }, 401, request, env);

  // Encaminha a requisição original para o DO. Reconstruir a Request pode
  // remover os headers Upgrade/Connection e quebrar o handshake WebSocket.
  // O DO valida o mesmo ticket novamente e lê o usuário do payload assinado.
  return roomStub(env, roomId).fetch(request);
}

// ── Durable Object: a sala ─────────────────────────────────────────────────

export class MilaRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = null;
    this.loaded = false;
    this.loadPromise = null;
    this.rate = new Map();
  }

  async load() {
    if (this.loaded) return;
    if (!this.loadPromise) {
      this.loadPromise = this.state.storage.get('room').then((room) => {
        this.room = room || null;
        this.loaded = true;
      }).catch((error) => {
        this.loadPromise = null;
        throw error;
      });
    }
    await this.loadPromise;
  }

  async fetch(request) {
    await this.load();

    const url = new URL(request.url);
    const path = url.pathname;
    const upgrade = (request.headers.get('Upgrade') || '').toLowerCase();

    // WebSocket: a autenticação é o ticket assinado presente na query. A
    // requisição original é preservada para manter Upgrade/Connection. O
    // caminho pode variar (/ws, /api/ws ou /) conforme a URL Mapping.
    if (upgrade === 'websocket') {
      return this.handleWebSocket(request);
    }

    const internal = request.headers.get('X-Mila-Internal') || '';
    if (!this.env.BOT_API_SECRET || !secureEqual(internal, this.env.BOT_API_SECRET)) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }

    if (path === '/update' && request.method === 'POST') {
      return this.handleUpdate(request);
    }
    if (path === '/ensure' && request.method === 'POST') {
      return this.handleEnsure(request);
    }
    if (path === '/state' && request.method === 'GET') {
      return this.handleState();
    }
    return jsonResponse({ error: 'not_found' }, 404);
  }

  async handleState() {
    if (!this.room) return jsonResponse({ error: 'room_not_found' }, 404);
    return jsonResponse({
      room: this.room,
      participants: this.participants(),
      serverTime: Date.now()
    });
  }

  async handleUpdate(request) {
    const body = await readJson(request, MAX_BODY_BYTES);
    if (!body) return jsonResponse({ error: 'invalid_json' }, 400);

    const channelId = sanitizeId(body.channelId);
    if (!channelId) return jsonResponse({ error: 'invalid_channel' }, 400);

    const guildId = body.guildId == null ? null : sanitizeId(body.guildId);
    if (body.guildId != null && !guildId) return jsonResponse({ error: 'invalid_guild' }, 400);

    const hostId = body.hostId == null ? null : sanitizeId(body.hostId);
    if (body.hostId != null && !hostId) return jsonResponse({ error: 'invalid_host' }, 400);

    const now = Date.now();
    const hasVideoField = Object.prototype.hasOwnProperty.call(body, 'videoId');
    const videoId = hasVideoField ? sanitizeVideoId(body.videoId) : null;
    if (hasVideoField && body.videoId != null && !videoId) {
      return jsonResponse({ error: 'invalid_video' }, 400);
    }

    if (!this.room) {
      this.room = {
        channelId,
        guildId,
        videoId: videoId || null,
        title: videoId ? (sanitizeTitle(body.title) || 'Vídeo do YouTube') : '',
        duration: clampNumber(body.duration, 0, 86400, 0),
        position: 0,
        playing: Boolean(videoId),
        playbackRate: 1,
        queue: [],
        hostId,
        hostMode: body.hostMode === 'shared' ? 'shared' : 'self',
        createdAt: now,
        updatedAt: now,
        updatedBy: hostId
      };
    } else {
      this.room.channelId = channelId;
      if (guildId) this.room.guildId = guildId;
      if (hostId) this.room.hostId = hostId;
      if (body.hostMode === 'shared' || body.hostMode === 'self') this.room.hostMode = body.hostMode;

      if (hasVideoField) {
        if (videoId) {
          const sameVideo = this.room.videoId === videoId;
          const nextTitle = sanitizeTitle(body.title);
          const nextDuration = clampNumber(body.duration, 0, 86400, 0);
          this.room.videoId = videoId;
          if (!sameVideo || (nextTitle && nextTitle !== 'Vídeo do YouTube')) {
            this.room.title = nextTitle || 'Vídeo do YouTube';
          }
          if (!sameVideo || nextDuration > 0) {
            this.room.duration = nextDuration;
          }
          this.room.updatedBy = hostId || this.room.hostId || null;
          this.room.queue = (Array.isArray(this.room.queue) ? this.room.queue : [])
            .filter((item) => item.videoId !== videoId);
          if (sameVideo) {
            // Reabrir a Activity para o mesmo vídeo não reinicia a sessão.
            this.touch(now);
          } else {
            this.room.position = 0;
            this.room.playing = true;
            this.room.updatedAt = now;
          }
        } else {
          this.room.videoId = null;
          this.room.title = '';
          this.room.position = 0;
          this.room.playing = false;
          this.room.updatedAt = now;
        }
      }

      if (!hasVideoField) {
        const nextTitle = sanitizeTitle(body.title);
        if (nextTitle && this.room.videoId && nextTitle !== this.room.title) {
          this.room.title = nextTitle;
          this.touch(now);
        }
      }
    }

    if (!this.room.hostId) this.room.hostId = hostId;
    await this.save();
    await this.ensureAlarm();
    this.broadcastState();
    return jsonResponse({
      room: this.room,
      participants: this.participants(),
      serverTime: Date.now()
    });
  }

  async handleEnsure(request) {
    const body = await readJson(request, MAX_BODY_BYTES);
    if (!body) return jsonResponse({ error: 'invalid_json' }, 400);

    const channelId = sanitizeId(body.channelId);
    if (!channelId) return jsonResponse({ error: 'invalid_channel' }, 400);

    const guildId = body.guildId == null ? null : sanitizeId(body.guildId);
    if (body.guildId != null && !guildId) return jsonResponse({ error: 'invalid_guild' }, 400);

    const hostId = sanitizeId(body.hostId);
    if (!hostId) return jsonResponse({ error: 'invalid_host' }, 400);

    const now = Date.now();
    if (!this.room) {
      this.room = {
        channelId,
        guildId,
        videoId: null,
        title: '',
        duration: 0,
        position: 0,
        playing: false,
        playbackRate: 1,
        queue: [],
        hostId,
        hostMode: 'self',
        createdAt: now,
        updatedAt: now,
        updatedBy: hostId
      };
      await this.save();
    } else {
      let changed = false;
      if (!this.room.guildId && guildId) {
        this.room.guildId = guildId;
        changed = true;
      }
      if (!this.room.hostId) {
        this.room.hostId = hostId;
        changed = true;
      }
      if (changed) {
        this.touch(now);
        await this.save();
      }
    }

    await this.ensureAlarm();

    return jsonResponse({
      room: this.room,
      participants: this.participants(),
      serverTime: Date.now()
    });
  }

  async handleWebSocket(request) {
    if (!this.room) return jsonResponse({ error: 'room_not_found' }, 404);

    const url = new URL(request.url);
    const roomId = sanitizeId(url.searchParams.get('room'));
    const ticket = url.searchParams.get('ticket') || '';
    if (!roomId || roomId !== this.room.channelId) {
      return jsonResponse({ error: 'room_mismatch' }, 403);
    }

    const payload = await verifyTicket(this.env, ticket, roomId);
    if (!payload) return jsonResponse({ error: 'invalid_ticket' }, 401);

    const userId = payload.u;
    const name = sanitizeName(payload.n) || 'Mila';
    const avatar = safeAvatarUrl(payload.a) || null;

    const live = this.state.getWebSockets().filter((socket) => socket.readyState === 1);
    if (live.length >= 100) {
      return jsonResponse({ error: 'room_full' }, 503);
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    // O attachment precisa existir antes de aceitar: o primeiro broadcast já
    // pode acontecer antes do próximo evento do Durable Object.
    server.serializeAttachment({ userId, name, avatar, joinedAt: Date.now() });
    this.state.acceptWebSocket(server);

    // Uma sala sem host (criada pelo fallback ou depois que o último viewer
    // saiu) recebe o primeiro cliente como host. Salas criadas pelo bot já
    // chegam com hostId e nunca são sequestradas por quem conecta primeiro.
    if (!this.room.hostId) {
      this.room.hostId = userId;
      this.touch();
      await this.save();
    }
    await this.ensureAlarm();

    // O estado inicial chega pelo REST (/state) e o primeiro `hello` do cliente
    // dispara o broadcast. Não envie antes de devolver o 101: o handshake ainda
    // não terminou.
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    await this.load();
    if (!this.room) {
      this.safeClose(ws, 1011, 'room_missing');
      return;
    }
    if (typeof raw !== 'string') {
      this.safeClose(ws, 1003, 'text_only');
      return;
    }
    if (raw.length > MAX_WS_MESSAGE_BYTES) {
      this.sendError(ws, 'MESSAGE_TOO_LARGE', 'Mensagem grande demais.');
      this.safeClose(ws, 1009, 'message_too_large');
      return;
    }

    let message;
    try { message = JSON.parse(raw); } catch { this.sendError(ws, 'INVALID_JSON', 'Mensagem inválida.'); return; }
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;

    const attachment = this.attachment(ws);
    if (!attachment || !attachment.userId) {
      this.safeClose(ws, 1011, 'no_identity');
      return;
    }

    if (!this.allowRate(attachment.userId)) {
      this.sendError(ws, 'RATE_LIMIT', 'Calma, Mila… tente de novo em alguns segundos.');
      this.safeClose(ws, 1008, 'rate_limit');
      return;
    }

    if (message.type === 'ping') {
      this.send(ws, { type: 'pong', t: message.t || Date.now() });
      return;
    }

    if (message.type === 'hello') {
      const next = {
        userId: attachment.userId,
        name: sanitizeName(message.name) || attachment.name || 'Mila',
        avatar: safeAvatarUrl(message.avatar) || attachment.avatar || null,
        joinedAt: attachment.joinedAt || Date.now()
      };
      ws.serializeAttachment(next);
      this.broadcastState();
      return;
    }

    const type = message.type;
    const isHostOnly = type === 'hostMode' || type === 'transferHost';
    const allowed = isHostOnly ? this.isHost(attachment.userId) : this.canControl(attachment.userId);
    if (!allowed) {
      this.sendError(ws, 'NOT_HOST', isHostOnly
        ? 'Só o host pode mudar essa configuração.'
        : 'Só o host controla esta sala. Peça a ele para ativar o modo livre.');
      return;
    }

    const now = Date.now();
    const max = this.room.duration > 0 ? this.room.duration : 86400;

    switch (type) {
      case 'play':
        this.room.position = clampNumber(message.position, 0, max, this.room.position || 0);
        this.room.playing = true;
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        break;

      case 'pause':
        this.room.position = clampNumber(message.position, 0, max, this.room.position || 0);
        this.room.playing = false;
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        break;

      case 'seek':
        this.room.position = clampNumber(message.position, 0, max, this.room.position || 0);
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        break;

      case 'load': {
        const videoId = sanitizeVideoId(message.videoId);
        if (!videoId) { this.sendError(ws, 'INVALID_VIDEO', 'Vídeo inválido.'); return; }
        this.room.videoId = videoId;
        this.room.title = sanitizeTitle(message.title) || 'Vídeo do YouTube';
        this.room.duration = clampNumber(message.duration, 0, 86400, 0);
        this.room.position = 0;
        this.room.playing = true;
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        this.room.queue = (Array.isArray(this.room.queue) ? this.room.queue : [])
          .filter((item) => item.videoId !== videoId);
        break;
      }

      case 'queueAdd': {
        const videoId = sanitizeVideoId(message.videoId);
        if (!videoId) { this.sendError(ws, 'INVALID_VIDEO', 'Vídeo inválido.'); return; }
        const queue = Array.isArray(this.room.queue) ? this.room.queue : [];
        if (queue.length >= MAX_QUEUE) { this.sendError(ws, 'QUEUE_FULL', 'A fila está cheia.'); return; }
        if (videoId === this.room.videoId || queue.some((item) => item.videoId === videoId)) {
          this.sendError(ws, 'DUPLICATE_VIDEO', 'Esse vídeo já está na sala.');
          return;
        }
        queue.push({
          videoId,
          title: sanitizeTitle(message.title) || 'Vídeo do YouTube',
          duration: clampNumber(message.duration, 0, 86400, 0)
        });
        this.room.queue = queue;
        this.touch(now);
        this.room.updatedBy = attachment.userId;
        break;
      }

      case 'queueRemove': {
        const videoId = sanitizeVideoId(message.videoId);
        if (!videoId) { this.sendError(ws, 'INVALID_VIDEO', 'Vídeo inválido.'); return; }
        this.room.queue = (Array.isArray(this.room.queue) ? this.room.queue : [])
          .filter((item) => item.videoId !== videoId);
        this.touch(now);
        this.room.updatedBy = attachment.userId;
        break;
      }

      case 'next': {
        const queue = Array.isArray(this.room.queue) ? this.room.queue : [];
        if (!queue.length) { this.sendError(ws, 'QUEUE_EMPTY', 'A fila está vazia.'); return; }
        const next = queue.shift();
        this.room.videoId = next.videoId;
        this.room.title = next.title || 'Vídeo do YouTube';
        this.room.duration = Number(next.duration) || 0;
        this.room.position = 0;
        this.room.playing = true;
        this.room.queue = queue;
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        break;
      }

      case 'ended': {
        const queue = Array.isArray(this.room.queue) ? this.room.queue : [];
        if (queue.length) {
          const next = queue.shift();
          this.room.videoId = next.videoId;
          this.room.title = next.title || 'Vídeo do YouTube';
          this.room.duration = Number(next.duration) || 0;
          this.room.position = 0;
          this.room.playing = true;
          this.room.queue = queue;
        } else {
          this.room.playing = false;
          this.room.position = 0;
        }
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        break;
      }

      case 'eject':
        this.room.videoId = null;
        this.room.title = '';
        this.room.position = 0;
        this.room.playing = false;
        this.room.updatedAt = now;
        this.room.updatedBy = attachment.userId;
        break;

      case 'title': {
        if (!this.room.videoId) return;
        const title = sanitizeTitle(message.title);
        if (!title || title === this.room.title) return;
        this.room.title = title;
        this.touch(now);
        this.room.updatedBy = attachment.userId;
        break;
      }

      case 'hostMode':
        if (message.mode !== 'self' && message.mode !== 'shared') {
          this.sendError(ws, 'INVALID_MODE', 'Modo inválido.');
          return;
        }
        this.room.hostMode = message.mode;
        this.touch(now);
        this.room.updatedBy = attachment.userId;
        break;

      case 'transferHost': {
        const target = sanitizeId(message.userId);
        if (!target || target === attachment.userId) {
          this.sendError(ws, 'INVALID_HOST', 'Escolha outra pessoa conectada.');
          return;
        }
        if (!this.participants().some((participant) => participant.id === target)) {
          this.sendError(ws, 'HOST_NOT_CONNECTED', 'Essa pessoa não está mais na sala.');
          return;
        }
        this.room.hostId = target;
        this.touch(now);
        this.room.updatedBy = attachment.userId;
        break;
      }

      default:
        this.sendError(ws, 'UNKNOWN_TYPE', 'Ação desconhecida.');
        return;
    }

    await this.save();
    this.broadcastState();
  }

  async webSocketClose(ws) {
    await this.load();
    const closing = this.attachment(ws);
    const remaining = this.state.getWebSockets()
      .filter((socket) => socket !== ws && socket.readyState === 1);

    let changed = false;
    if (this.room && closing && closing.userId && closing.userId === this.room.hostId) {
      // O host pode ter outra aba conectada; nesse caso ele continua host.
      const hostStillConnected = remaining.some((socket) => {
        const attachment = this.attachment(socket);
        return attachment && attachment.userId === this.room.hostId;
      });
      if (!hostStillConnected) {
        const next = remaining
          .map((socket) => this.attachment(socket))
          .find((attachment) => attachment && attachment.userId);
        this.touch();
        this.room.hostId = next ? next.userId : null;
        changed = true;
      }
    }

    if (changed) await this.save();
    if (this.room) this.broadcastState();
    // compatibility_date anterior a 2026-04-07: o runtime não responde ao
    // Close frame sozinho, então fechamos o lado do servidor explicitamente.
    this.safeClose(ws, 1000, 'bye');
  }

  async webSocketError(ws) {
    this.safeClose(ws, 1011, 'socket_error');
  }

  async alarm() {
    await this.load();
    if (!this.room) return;

    const sockets = this.state.getWebSockets();
    if (sockets.length) {
      await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      return;
    }

    const updatedAt = Number(this.room.updatedAt) || 0;
    if (Date.now() - updatedAt < ROOM_TTL_MS) {
      await this.state.storage.setAlarm(updatedAt + ROOM_TTL_MS + 1000);
      return;
    }

    this.room = null;
    this.rate.clear();
    await this.state.storage.deleteAll();
  }

  touch(now = Date.now()) {
    if (!this.room) return;
    // `position` é a posição no instante `updatedAt`. Atualizações de metadados
    // (fila, host, título) não podem reiniciar o relógio sem antes avançar a
    // posição; caso contrário todos voltariam alguns segundos no vídeo.
    if (this.room.playing) {
      const base = Math.max(0, Number(this.room.position) || 0);
      const updatedAt = Number(this.room.updatedAt) || now;
      const elapsed = Math.max(0, (now - updatedAt) / 1000);
      const rate = Number(this.room.playbackRate) || 1;
      const duration = Number(this.room.duration) || 0;
      let position = base + elapsed * rate;
      if (duration > 0) position = Math.min(position, duration);
      this.room.position = position;
    }
    this.room.updatedAt = now;
  }

  async save() {
    if (!this.room) return;
    await this.state.storage.put('room', this.room);
    await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
  }

  async ensureAlarm() {
    try {
      if (!(await this.state.storage.getAlarm())) {
        await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
      }
    } catch {
      // Armazenamento indisponível: a sala ainda funciona nesta sessão.
    }
  }

  canControl(userId) {
    if (!this.room) return false;
    if (this.room.hostMode === 'shared') return true;
    return Boolean(this.room.hostId && this.room.hostId === userId);
  }

  isHost(userId) {
    return Boolean(this.room && this.room.hostId && this.room.hostId === userId);
  }

  participants() {
    const found = new Map();
    for (const socket of this.state.getWebSockets()) {
      if (socket.readyState !== 1) continue;
      const attachment = this.attachment(socket);
      if (!attachment || !attachment.userId) continue;
      found.set(attachment.userId, {
        id: attachment.userId,
        name: sanitizeName(attachment.name) || 'Mila',
        avatar: safeAvatarUrl(attachment.avatar)
      });
    }
    return Array.from(found.values()).slice(0, 50);
  }

  attachment(ws) {
    try { return ws.deserializeAttachment() || null; } catch { return null; }
  }

  allowRate(userId) {
    const now = Date.now();
    const recent = (this.rate.get(userId) || []).filter((time) => now - time < 5000);
    if (recent.length >= 40) {
      this.rate.set(userId, recent);
      return false;
    }
    recent.push(now);
    this.rate.set(userId, recent);
    return true;
  }

  send(ws, payload) {
    try { ws.send(JSON.stringify(payload)); } catch { /* socket fechando */ }
  }

  sendError(ws, code, message) {
    this.send(ws, { type: 'error', code, message });
  }

  safeClose(ws, code, reason) {
    try { ws.close(code, reason); } catch { /* já fechado */ }
  }

  broadcastState() {
    if (!this.room) return;
    const payload = JSON.stringify({
      type: 'state',
      room: this.room,
      participants: this.participants(),
      serverTime: Date.now()
    });
    for (const socket of this.state.getWebSockets()) {
      try { socket.send(payload); } catch { /* socket fechando */ }
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function normalizePath(pathname) {
  if (pathname === '/api') return '/';
  if (pathname.startsWith('/api/')) return pathname.slice(4);
  return pathname;
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = String(env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  let allow = '*';
  if (!configured.includes('*')) {
    allow = configured.includes(origin) ? origin : (configured[0] || 'null');
  }

  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(data, status, request, env, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({}, JSON_HEADERS, corsHeaders(request, env), extra)
  });
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function readJson(request, limit = MAX_BODY_BYTES) {
  try {
    const text = await request.text();
    if (!text || text.length > limit) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function verifyBot(request, env) {
  const secret = env.BOT_API_SECRET;
  if (!secret) return false;
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  return secureEqual(token, secret);
}

async function verifyUser(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || token.length > 500) return null;

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user && user.id && ID_RE.test(String(user.id)) ? user : null;
  } catch {
    return null;
  }
}

async function isGuildMember(env, guildId, userId) {
  if (!guildId || !env.DISCORD_BOT_TOKEN) return true;
  try {
    const response = await fetch(`https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, Accept: 'application/json' }
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) return false;
    return true;
  } catch {
    // Falha de rede: não transforme indisponibilidade em banimento.
    return true;
  }
}

function roomStub(env, channelId) {
  const id = env.MILA_ROOMS.idFromName(`mila:${channelId}`);
  return env.MILA_ROOMS.get(id);
}

async function callRoom(env, channelId, path, body) {
  const stub = roomStub(env, channelId);
  const headers = {
    'X-Mila-Internal': env.BOT_API_SECRET || '',
    'Content-Type': 'application/json'
  };
  const request = new Request(`https://mila-room${path}`, {
    method: body ? 'POST' : 'GET',
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const response = await stub.fetch(request);
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { response, data };
}

async function createTicket(env, roomId, user) {
  const payload = {
    r: roomId,
    u: user.id,
    n: displayName(user),
    a: discordAvatar(user) || '',
    exp: Date.now() + TICKET_TTL_MS
  };
  const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = await hmac(env.WS_TICKET_SECRET, body);
  return `${body}.${signature}`;
}

async function verifyTicket(env, ticket, roomId) {
  if (!env.WS_TICKET_SECRET || typeof ticket !== 'string' || ticket.length > 2048) return null;
  const parts = ticket.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expected = await hmac(env.WS_TICKET_SECRET, body);
  if (!secureEqual(signature, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body)));
  } catch {
    return null;
  }
  if (!payload || payload.r !== roomId || !ID_RE.test(String(payload.u || ''))) return null;
  const exp = Number(payload.exp);
  if (!Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + TICKET_TTL_MS + 60_000) return null;
  return payload;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));
  return base64UrlEncode(new Uint8Array(signature));
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function secureEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] || 0) ^ (b[index] || 0);
  }
  return diff === 0;
}

function sanitizeId(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return ID_RE.test(text) ? text : null;
}

function sanitizeVideoId(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return VIDEO_ID_RE.test(text) ? text : null;
}

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    })
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // `&amp;` por último para não decodificar duas vezes (`&amp;lt;` -> `&lt;`).
    .replace(/&amp;/g, '&');
}

function sanitizeTitle(value) {
  return decodeHtmlEntities(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function sanitizeName(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 32);
}

function safeAvatarUrl(value) {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (!['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function displayName(user) {
  if (!user) return 'Mila';
  return sanitizeName(user.global_name || user.username || 'Mila') || 'Mila';
}

function discordAvatar(user) {
  if (!user || !user.id || !user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=64`;
}

function clampNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
