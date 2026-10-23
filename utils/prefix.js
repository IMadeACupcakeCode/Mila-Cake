const fs = require('fs');
const path = require('path');
const { criarEmbed, THEME } = require('./theme');
const { botao } = require('./ui');
const { ActionRowBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const { verificarCanal, obterConfig, salvarConfig, TIPOS_ANUNCIO } = require('./servidorStore');
const { adicionarLembrete, carregarLembretes, removerLembrete, filtrarLembretes } = require('./lembretesStore');
const { agendarLembrete } = require('./agendador');
const { parseTempo, formatarDuracao, formatarDataAbsoluta } = require('./tempo');
const crypto = require('crypto');
const { isStaff } = require('./perms');
const codex = require('../commands/codex');
const { mostrarDigitando } = require('./milaDecoracao');
const arcade = require('./arcade');
const { avaliar: avaliarDados, formatar: formatarDados } = require('./dice');
const logger = require('./logger');
const { reivindicarComando } = require('./db');

const ITENS_POR_PAGINA = 5;

// Evita processar a mesma mensagem mais de uma vez caso o evento seja
// encaminhado novamente pelo cliente durante uma reconexão.
const mensagensPrefixoProcessadas = new Map();
const TEMPO_DEDUPLICACAO = 60_000;


// ── Duplicação rápida de comando (proteção contra reenvio do cliente) ──────────
// Se o mesmo comando + args chegar várias vezes em poucos segundos (ex.: cliente
// que reenvia 5x), ignoramos todos, exceto o primeiro, evitando respostas 5x.
const comandosRepeticao = new Map();
const WINDOW_REPETICAO_MS = 5000;

function temRepeticaoRecente(conteudo) {
  const agora = Date.now();
  const ultima = comandosRepeticao.get(conteudo);
  if (ultima !== undefined && agora - ultima < WINDOW_REPETICAO_MS) {
    return true;
  }
  comandosRepeticao.set(conteudo, agora);
  if (comandosRepeticao.size > 500) {
    for (const [chave, timestamp] of comandosRepeticao) {
      if (agora - timestamp >= WINDOW_REPETICAO_MS) {
        comandosRepeticao.delete(chave);
      }
    }
  }
  return false;
}
// ── Carga dos comandos (modo prefixo `$`, sem slash) ──────────────────
// Comandos que já têm tratamento inline abaixo (não precisam do bridge).
const INLINE = new Set(['ping', 'dado', 'roleta', 'lembrete', 'anuncio', 'configurar', 'organizar', 'codex', 'ticket', 'fechar', 'say', 'falar', 'forca', 'ajuda', 'help']);

// Assinaturas para converter os argumentos do `$mensagem` nas opções que
// cada comando slash espera. Tipos: user, int, rest (resto da linha), token.
const SIGNATURES = {
  tocar: [{ name: 'musica', rest: true }],
  play: [{ name: 'musica', rest: true }],
  tts: [{ name: 'texto', rest: true }],
  limparfila: [],
  clearqueue: [],
  playlist: [{ name: 'url', rest: true }],
  volume: [{ name: 'nivel', int: true }],
  repetir: [{ name: 'modo', token: true }],
  repeat: [{ name: 'modo', token: true }],
  abraco: [{ name: 'usuario', user: true, optional: true }],
  avatar: [{ name: 'usuario', user: true, optional: true }],
  aviso: [{ name: 'mensagem', rest: true }],
  cartasecreta: [{ name: 'usuario', user: true, required: true }, { name: 'mensagem', rest: true }],
  '8ball': [{ name: 'pergunta', rest: true }],
  assistir: [{ name: 'url', rest: true }],
  guerra: [{ name: 'usuario', user: true, optional: true }, { name: 'sub', rest: true, optional: true }],
  lentidao: [{ name: 'segundos', int: true }],
  limpar: [{ name: 'quantidade', int: true }],
  membros: [],
  mila: [],
  moeda: [],
  omnitrix: [{ name: 'usuario', user: true, optional: true }],
  roleta_russa: [],
  seguranca: [],
  securitybreach: [],
  ship: [{ name: 'usuario1', user: true }, { name: 'usuario2', user: true }],
  antiship: [{ name: 'usuario1', user: true }, { name: 'usuario2', user: true }],
  social: [{ name: 'usuario', user: true, optional: true }],
  status: [],
  votar: 'especial',
  letra: [{ name: 'busca', rest: true }],
};

const MUSIC_ALIASES = {
  tocar: 'tocar', play: 'play', playlist: 'playlist', fila: 'fila', queue: 'queue',
  pausar: 'pausar', pause: 'pause', retomar: 'retomar', resume: 'resume',
  pular: 'pular', skip: 'skip', parar: 'parar', stop: 'stop', volume: 'volume',
  embaralhar: 'embaralhar', shuffle: 'shuffle', repetir: 'repetir', repeat: 'repeat',
  agora: 'agora', nowplaying: 'nowplaying', limparfila: 'limparfila', clearqueue: 'clearqueue', sair: 'sair', leave: 'leave',
};

const USO_PADRAO = {
  abraco: 'Use: `$abraco [@usuário]`',
  avatar: 'Use: `$avatar [@usuário]`',
  aviso: 'Use: `$aviso sua mensagem aqui`',
  cartasecreta: 'Use: `$cartasecreta @usuário sua mensagem`',
  '8ball': 'Use: `$8ball sua pergunta?`',
  assistir: 'Use: `$assistir https://youtu.be/ID` (ou `/assistir`)',
  lentidao: 'Use: `$lentidao 5` (segundos, 0-21600)',
  limpar: 'Use: `$limpar 10` (2–100 mensagens)',
  ship: 'Use: `$ship @usuario1 @usuario2`',
  antiship: 'Use: `$antiship @usuario1 @usuario2`',
  votar: 'Use: `$votar pergunta | opção 1, opção 2, opção 3 | 10m`',
};

// Carrega os módulos de comando que não são tratados inline.
const EXTRA = {};
const pastaCmds = path.join(__dirname, '..', 'commands');
for (const arquivo of fs.readdirSync(pastaCmds)) {
  if (!arquivo.endsWith('.js')) continue;
  const mod = require(path.join(pastaCmds, arquivo));
  if (mod && mod.data && typeof mod.execute === 'function' && mod.data.name) {
    if (!INLINE.has(mod.data.name)) EXTRA[mod.data.name] = mod;
  }
}

// ── Helpers de parsing ────────────────────────────────────────────────

// Usa o mesmo avaliador seguro do comando slash, mantendo os dois modos alinhados.
function rolarDados(notacao) {
  return avaliarDados(notacao);
}

function extrairCanal(mensagem) {
  const match = mensagem.content.match(/<#(\d+)>/);
  return match ? match[1] : null;
}

function responder(mensagem, embed, ephemeral) {
  // ⋆｡°✩ Mostra "digitando..." antes de responder (só para respostas públicas)
  if (!ephemeral && mensagem.channel) {
    mostrarDigitando(mensagem.channel, 800).catch(() => {});
  }
  // Mensagens de prefixo não suportam resposta efêmera: o parâmetro só controla
  // o indicador de digitação. Enviar `ephemeral` aqui gera aviso de depreciação.
  return mensagem.reply({ embeds: [embed] });
}

/**
 * Aplica o mesmo contrato de `meta` usado no caminho slash (utils/slash.js)
 * também para os comandos disparados por prefixo. Sem isso, `meta.staff` e
 * `meta.permissions` eram ignorados por `$comando` — uma escalada de privilégio.
 * @returns {string|null} mensagem de erro, ou null quando autorizado.
 */
function autorizarComando(mod, message) {
  const meta = mod?.meta || {};
  if (meta.guildOnly && !message.guildId) return '❌ Este comando só pode ser usado dentro de um servidor.';
  if (meta.staff && !isStaff(message.member)) return '❌ Você não tem permissão para usar este comando.';
  if (meta.permissions?.length) {
    const membro = message.member;
    const permitido = meta.permissions.some((permissao) => {
      const flag = PermissionFlagsBits[permissao] || permissao;
      return membro?.permissions?.has?.(flag);
    });
    if (!permitido) return '❌ Você não tem permissão para usar este comando.';
  }
  return null;
}

/** Lê o tópico (JSON) de um canal de ticket sem confiar no conteúdo. */
function lerTopicoTicket(canal) {
  if (!canal?.topic) return null;
  try {
    const dados = JSON.parse(canal.topic);
    return dados && typeof dados === 'object' ? dados : null;
  } catch {
    return null;
  }
}

async function resolveUser(token, message, client) {
  if (!token) return null;
  const men = token.match(/^<@!?(\d+)>$/);
  const id = men ? men[1] : /^\d+$/.test(token) ? token : null;
  if (id) {
    try {
      return await client.users.fetch(id);
    } catch {
      return message.mentions.users.get(id) || null;
    }
  }
  return message.mentions.users.first() || null;
}

async function parseArgs(comando, args, message, client) {
  if (comando === 'votar') {
    if (args.length === 0) return {};
    const raw = args.join(' ').trim();
    const partes = raw.split('|').map((p) => p.trim()).filter((p) => p.length);
    const pergunta = partes[0] || 'Sem pergunta';
    const opcoes = partes[1] || null;
    const duracao = partes[2] || null;
    return { pergunta, opcoes, duracao };
  }
  const sig = SIGNATURES[comando] || [];
  const v = {};
  let idx = 0;
  for (const s of sig) {
    if (s.rest) {
      v[s.name] = args.slice(idx).join(' ').trim() || null;
      idx = args.length;
    } else if (s.user) {
      const tok = args[idx];
      if (tok === undefined) {
        v[s.name] = null;
      } else {
        const u = await resolveUser(tok, message, client);
        if (u) {
          v[s.name] = u;
          idx++;
        } else if (s.required) {
          return null;
        } else {
          // opcional e não é usuário: não consome o token (deixa para o rest pegar)
          v[s.name] = null;
        }
      }
    } else if (s.int) {
      const tok = args[idx];
      idx++;
      v[s.name] = tok != null ? parseInt(tok, 10) : null;
    } else {
      const tok = args[idx];
      idx++;
      v[s.name] = tok || null;
    }
  }
  return v;
}

// Cria uma "interação" sintética a partir de uma mensagem `$comando`,
// suficiente para os comandos existentes (que usam a API de interação).
function criarInteracao(message, client, valores) {
  const opt = {
    getString: (n) => (valores[n] != null ? String(valores[n]) : null),
    getBoolean: (n) => (valores[n] != null ? Boolean(valores[n]) : null),
    getInteger: (n) => (valores[n] != null ? Number(valores[n]) : null),
    getUser: (n) => valores[n] || null,
    getChannel: (n) => valores[n] || null,
    getSubcommand: () => null,
  };

  let replyMessage = null;

  function stripEphemeral(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const cleaned = { ...payload };
    delete cleaned.ephemeral;
    return cleaned;
  }

  return {
    user: message.author,
    guild: message.guild,
    guildId: message.guildId,
    channelId: message.channelId,
    channel: message.channel,
    member: message.member,
    memberPermissions: message.memberPermissions,
    client: client,
    options: opt,
    message: message,
    _guerraMention: valores.usuario || null,
    _guerraArgs: valores.sub ? [valores.sub] : [],
    replied: false,
    deferred: false,
    async reply(o) {
      const payload = stripEphemeral(o);
      replyMessage = await message.reply(payload);
      this.replied = true;
      return replyMessage;
    },
    async followUp(o) {
      const payload = stripEphemeral(o);
      if (replyMessage) return replyMessage.channel.send(payload);
      return message.channel.send(payload);
    },
    async editReply(o) {
      const payload = stripEphemeral(o);
      if (replyMessage) return replyMessage.edit(payload);
      return message.edit(payload);
    },
    async deferReply(payload = {}) {
      this.deferred = true;
      if (!replyMessage) {
        replyMessage = await message.reply(stripEphemeral(payload.content ? payload : { content: '⏳ Processando...' }));
        this.replied = true;
      }
      return replyMessage;
    },
    // Shim de createMessageComponentCollector: delega para a reply real.
    // Necessário para comandos interativos por prefixo que usam collector
    // dentro do execute — igual fazem os comandos slash.
    createMessageComponentCollector(opts) {
      if (!replyMessage) throw new Error('createMessageComponentCollector sem reply');
      return replyMessage.createMessageComponentCollector(opts);
    },
  };
}

async function responderCodex(mensagem, termo) {
  termo = (termo || '').trim();
  let pagina = 0;
  if (termo) {
    const achado = codex.buscar(termo);
    if (achado) {
      const COMANDOS = require('../utils/codexData').COMANDOS;
      pagina = COMANDOS.indexOf(achado) + 1;
    } else {
      return responder(
        mensagem,
        criarEmbed({ titulo: 'Comando não encontrado', descricao: `Nada parecido com \`${termo}\`. Tente \`$codex\` e use o menu.`, cor: THEME.corErro }),
        true
      );
    }
  }
  const resposta = await mensagem.reply({
    embeds: [codex.renderizarPagina(pagina)],
    components: codex.componentes(pagina),
    fetchReply: true,
  });
  const coletor = resposta.createMessageComponentCollector({ time: 5 * 60 * 1000, filter: () => true });
  coletor.on('collect', async (i) => {
    const id = i.customId;
    if (id === 'codex_first') pagina = 0;
    else if (id === 'codex_prev') pagina = Math.max(0, pagina - 1);
    else if (id === 'codex_next') pagina = Math.min(codex.TOTAL, pagina + 1);
    else if (id === 'codex_last') pagina = codex.TOTAL;
    else if (id === 'codex_jump') pagina = parseInt(i.values[0], 10);
    await i.update({ embeds: [codex.renderizarPagina(pagina)], components: codex.componentes(pagina) });
  });
  coletor.on('end', async () => {
    try {
      await resposta.edit({ components: [] });
    } catch {}
  });
}

async function enviarConfiguracao(mensagem, guildId) {
  const cfg = obterConfig(guildId);
  const mencionar = (ids) =>
    ids && ids.length ? ids.map((id) => `<#${id}>`).join('  ·  ') : '`nenhum definido`';

  const anuncios = TIPOS_ANUNCIO.map((t) => {
    const id = cfg.anuncios[t];
    return `˖ **${t}**: ${id ? `<#${id}>` : '`não definido`'}`;
  }).join('\n');

  const ticketCategoria = cfg.categoriaTicket
    ? `<#${cfg.categoriaTicket}>`
    : '`não definido`';

  const embed = criarEmbed({
    titulo: 'Configuração atual da lua',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**Canais permitidos:** ${mencionar(cfg.canaisPermitidos)}\n` +
      `**Canais proibidos:** ${mencionar(cfg.canaisBloqueados)}\n\n` +
      `${THEME.div.coracao}\n\n` +
      `**Anúncios por tipo:**\n${anuncios}\n\n` +
      `${THEME.div.estrelado}\n\n` +
      `**🎪 Categoria de Tickets:** ${ticketCategoria}\n` +
      `**🔌 Canal de shutdown:** ${cfg.canalShutdown ? `<#${cfg.canalShutdown}>` : '`não definido`'}\n` +
      `**🔛 Canal on/off:** ${cfg.canalOnOff ? `<#${cfg.canalOnOff}>` : '`não definido`'}`,
    cor: THEME.corPrincipal,
  });
  return responder(mensagem, embed, true);
}

// ── Tratador principal ────────────────────────────────────────────────

async function handlePrefix(message, client) {
  if (message.author.bot) return;
  // Ignore messages from ourselves to prevent loops
  if (message.author.id === client.user?.id) return;

  const agora = Date.now();
  const ultimaExecucao = mensagensPrefixoProcessadas.get(message.id);
  if (ultimaExecucao && agora - ultimaExecucao < TEMPO_DEDUPLICACAO) return;
  mensagensPrefixoProcessadas.set(message.id, agora);
  if (mensagensPrefixoProcessadas.size > 1000) {
    for (const [id, timestamp] of mensagensPrefixoProcessadas) {
      if (agora - timestamp >= TEMPO_DEDUPLICACAO) mensagensPrefixoProcessadas.delete(id);
    }
  }

  const guildId = message.guild?.id;
  const cfg = guildId ? obterConfig(guildId) : { prefixo: '$' };
  const prefixos = [...new Set(['$', '/', cfg.prefixo || '$'])];
  const prefixo = prefixos.find((item) => message.content.startsWith(item));

  if (!prefixo) return;

  const args = message.content.slice(prefixo.length).trim().split(/\s+/);
  const comandoDigitado = (args.shift() || '').toLowerCase();
  const comando = MUSIC_ALIASES[comandoDigitado] || comandoDigitado;
  if (!comando) return;

  // ⋆｡°✩ Log decorado do comando no terminal
  logger.logComando(comandoDigitado, message.author.username, message.channel?.name, message.guild?.name);
  logger.debug?.(`PID ${process.pid} processando mensagem ${message.id} (${prefixo}${comando})`);

  const fingerprint = `${message.guild?.id || 'dm'}:${message.author.id}:${message.channelId}:${message.id}`;
  if (!reivindicarComando(fingerprint)) return;

  // Configurar é livre em qualquer canal (para reconfigurar)
  if (comando !== 'configurar') {
    if (guildId) {
      const checagem = verificarCanal(guildId, message.channelId, cfg);
      if (!checagem.ok) {
        const motivos = {
          bloqueado: 'Este canal está na lista de **proibidos**. Use outro ou ajuste com `$configurar`.',
          foraDaLista: 'Só falo nos canais permitidos. Veja com `$configurar ver`.',
        };
        const embed = criarEmbed({
          titulo: 'Silêncio sob a lua',
          descricao: `${THEME.div.bolinhas}\n\n${motivos[checagem.motivo] || 'Não falo aqui.'}\n\n${THEME.div.bolinhas}`,
          cor: THEME.corErro,
        });
        return responder(message, embed, true);
      }
    }
  }

  // ── $ping ──
  if (comando === 'ping') {
    // ⋆｡°✩ Animação: typing → resposta
    mostrarDigitando(message.channel, 600).catch(() => {});
    // Latência real: tempo entre a criação da mensagem no Discord e o
    // processamento aqui (API) + round-trip do gateway (WebSocket).
    const latencia = Math.max(0, Date.now() - message.createdTimestamp);
    const ws = Math.max(0, Math.round(message.client.ws.ping));
    return responder(message, criarEmbed({
      titulo: 'Pong!',
      descricao: `${THEME.div.bolinhas}\n\n${THEME.iconeFooter} **Pong!** ✧\n\n${THEME.div.estrelado}\n\n📡 API — **${latencia}ms**\n💫 WebSocket — **${ws}ms**`,
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} respondeu em ${latencia}ms`,
    }));
  }

  // ── $codex / $livro ── (livro de comandos com busca aproximada)
  if (comando === 'codex' || comando === 'livro' || comando === 'comandos') {
    return responderCodex(message, args.join(' '));
  }

  // ── $dado NdM ──
  if (comando === 'dado') {
    const detalhar = args.some((arg) => ['detalhar', '--detalhar'].includes(arg.toLowerCase()));
    const notacao = args.filter((arg) => !['detalhar', '--detalhar'].includes(arg.toLowerCase())).join(' ');
    const resultado = rolarDados(notacao);
    if (!resultado) {
      return responder(
        message,
        criarEmbed({
          titulo: '🎲 Notação inválida',
          descricao:
            'Use dados com `+`, `-`, `x` ou `*`, ex: `$dado 1d20+2` ou `$dado 1d20-5+4x6 detalhar`.',
          cor: THEME.corErro,
        }),
        true
      );
    }

    const embedRolando = (frame) => {
      const faces = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
      return criarEmbed({
        titulo: '🎲 Rolando os dados...',
        descricao:
          `${THEME.div.bolinhas}\n\n` +
          `**${faces[(frame * 2) % 6]}  ${faces[(frame * 2 + 3) % 6]}  ${faces[(frame * 2) % 6]}**\n\n` +
          `> \`${notacao}\`\n\n` +
          `${['Os dados estão no ar...', 'Quicando na mesa...', 'A lua está decidindo...'][frame % 3]}\n\n` +
          `${THEME.div.estrelado}`,
        cor: THEME.corDado,
        rodape: 'Mila Dice · resultados honestos, prometo',
      });
    };

    const embedResultado = (r, completo) => criarEmbed({
      titulo: '🎲 Resultado dos dados',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `# ${r.total}\n\n` +
        `${formatarDados(r, completo)}\n\n` +
        `${THEME.div.estrelado}`,
      cor: THEME.corDado,
      rodape: completo ? 'Mila Dice · cálculo completo' : 'Mila Dice · use o botão para ver o cálculo',
    });

    let completo = detalhar;
    let atual = resultado;
    const criarRow = (mostrarCalculo) => new ActionRowBuilder().addComponents(
      botao('Rolar de novo', 'dado_prefix_reroll', ButtonStyle.Primary, '🎲'),
      botao(mostrarCalculo ? 'Esconder cálculo' : 'Ver cálculo', 'dado_prefix_detalhar', ButtonStyle.Secondary, '🧮')
    );

    const msg = await responder(message, embedRolando(0));
    if (!msg || !msg.edit) return;
    await arcade.sleep(450);
    try { await msg.edit({ embeds: [embedRolando(1)], components: [] }); } catch {}
    await arcade.sleep(450);
    try { await msg.edit({ embeds: [embedRolando(2)], components: [] }); } catch {}
    await arcade.sleep(400);
    try { await msg.edit({ embeds: [embedResultado(atual, completo)], components: [criarRow(completo)] }); } catch { return; }

    while (true) {
      const i = await msg.awaitMessageComponent({ time: 60_000 }).catch(() => null);
      if (!i) {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }
      if (i.user.id !== message.author.id) {
        await i.reply({ content: `🎲 Esses dados são do **${message.author.username}**. Use \`$dado\` para rolar os seus.`, ephemeral: true }).catch(() => {});
        continue;
      }
      if (i.customId === 'dado_prefix_detalhar') {
        completo = !completo;
        await i.update({ embeds: [embedResultado(atual, completo)], components: [criarRow(completo)] }).catch(() => {});
        continue;
      }
      if (i.customId === 'dado_prefix_reroll') {
        await i.update({ embeds: [embedRolando(0)], components: [] }).catch(() => {});
        await arcade.sleep(400);
        try { await msg.edit({ embeds: [embedRolando(1)], components: [] }); } catch {}
        await arcade.sleep(400);
        try { await msg.edit({ embeds: [embedRolando(2)], components: [] }); } catch {}
        await arcade.sleep(350);
        atual = rolarDados(notacao) || atual;
        try { await msg.edit({ embeds: [embedResultado(atual, completo)], components: [criarRow(completo)] }); } catch {}
      }
    }
  }

  // ── $roleta / $sortear ──
  if (comando === 'roleta' || comando === 'sortear') {
    const opcoes = args.join(' ').split(',').map((o) => o.trim()).filter((o) => o.length > 0);
    if (opcoes.length < 2) {
      return responder(
        message,
        criarEmbed({
          titulo: '🎡 Opções insuficientes',
          descricao: 'Preciso de **pelo menos duas opções** separadas por vírgula. Ex: `$roleta pizza, sushi, hambúrguer`',
          cor: THEME.corErro,
        }),
        true
      );
    }

    const escolhida = opcoes[Math.floor(Math.random() * opcoes.length)];
    const indiceFinal = opcoes.indexOf(escolhida);
    const embedGirando = (indice) => criarEmbed({
      titulo: '🎡 A roleta está girando...',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `${arcade.setaRoleta(opcoes, indice)}\n\n` +
        `${THEME.div.linha}\n\n` +
        `> O destino está escolhendo...\n\n` +
        `${THEME.div.estrelado}`,
      cor: THEME.corRoleta,
      rodape: 'Mila Roleta · sem viés, só caos organizado',
    });
    const embedFinal = () => criarEmbed({
      titulo: '🎡 A roleta parou!',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `${arcade.setaRoleta(opcoes, indiceFinal)}\n\n` +
        `${THEME.div.linha}\n\n` +
        `**✦ Escolhida: \`${escolhida}\`**\n\n` +
        `${THEME.div.estrelado}`,
      cor: THEME.corRoleta,
      rodape: `Mila Roleta · ${opcoes.length} opções giraram`,
    });
    const row = new ActionRowBuilder().addComponents(
      botao('Girar de novo', 'roleta_prefix_reroll', ButtonStyle.Primary, '🔄')
    );

    const msg = await responder(message, embedGirando(0));
    if (!msg || !msg.edit) return;
    await arcade.sleep(350);
    try { await msg.edit({ embeds: [embedGirando(1 % opcoes.length)], components: [] }); } catch {}
    await arcade.sleep(350);
    try { await msg.edit({ embeds: [embedGirando(2 % opcoes.length)], components: [] }); } catch {}
    await arcade.sleep(350);
    try { await msg.edit({ embeds: [embedGirando(indiceFinal)], components: [] }); } catch {}
    await arcade.sleep(400);
    try { await msg.edit({ embeds: [embedFinal()], components: [row] }); } catch { return; }

    while (true) {
      const i = await msg.awaitMessageComponent({ time: 60_000 }).catch(() => null);
      if (!i) {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }
      if (i.user.id !== message.author.id) {
        await i.reply({ content: `🎡 Essa roleta é do **${message.author.username}**. Use \`$roleta\` para girar a sua.`, ephemeral: true }).catch(() => {});
        continue;
      }
      if (i.customId === 'roleta_prefix_reroll') {
        const novoIndice = Math.floor(Math.random() * opcoes.length);
        await i.update({ embeds: [embedGirando(0)], components: [] }).catch(() => {});
        await arcade.sleep(350);
        try { await msg.edit({ embeds: [embedGirando(1 % opcoes.length)], components: [] }); } catch {}
        await arcade.sleep(350);
        try { await msg.edit({ embeds: [embedGirando(2 % opcoes.length)], components: [] }); } catch {}
        await arcade.sleep(350);
        try { await msg.edit({ embeds: [embedGirando(novoIndice)], components: [] }); } catch {}
        await arcade.sleep(400);
        const novaEscolhida = opcoes[novoIndice];
        const novaFinal = criarEmbed({
          titulo: '🎡 A roleta parou!',
          descricao:
            `${THEME.div.bolinhas}\n\n` +
            `${arcade.setaRoleta(opcoes, novoIndice)}\n\n` +
            `${THEME.div.linha}\n\n` +
            `**✦ Escolhida: \`${novaEscolhida}\`**\n\n` +
            `${THEME.div.estrelado}`,
          cor: THEME.corRoleta,
          rodape: `Mila Roleta · ${opcoes.length} opções giraram`,
        });
        try { await msg.edit({ embeds: [novaFinal], components: [row] }); } catch {}
      }
    }
  }

  // ── $lembrete ──
  if (comando === 'lembrete') {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'listar') {
      return mostrarListaLembretes(message, client, { userId: message.author.id });
    }
    if (sub === 'cancelar') {
      const id = args[1];
      const alvo = carregarLembretes().find((l) => l.id === id && l.userId === message.author.id);
      if (!alvo) {
        return responder(
          message,
          criarEmbed({ titulo: 'Lembrete não encontrado', descricao: `Não encontrei \`${id}\` seu.`, cor: THEME.corErro }),
          true
        );
      }
      removerLembrete(id);
      return responder(
        message,
        criarEmbed({ titulo: 'Lembrete cancelado', descricao: `O lembrete \`${id}\` foi apagado.`, cor: THEME.corLembrete }),
        true
      );
    }

    // $lembrete sozinho: mostra opções de criação via modal interativo
    const embedCriar = criarEmbed({
      titulo: '🌙 Criar Lembrete',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        'Escolha como deseja criar:\n\n' +
        '📝 **Modal interativo** (recomendado)\n' +
        'Clique no botão para abrir um formulário com campos separados:\n' +
        '• Campo 1: Data/hora (`2pm 21/08/2026`, `10m`, `amanhã 14:00`)\n' +
        '• Campo 2: Mensagem do lembrete\n\n' +
        `${THEME.div.coracao}\n\n` +
        '💬 **Texto direto:** `$lembrete <quando> <mensagem>`\n' +
        'Ex: `$lembrete 10m beber água`\n' +
        'Ex: `$lembrete 2pm 21/08/2026 reunião`\n\n' +
        `${THEME.div.bolinhas}`,
      cor: THEME.corLembrete,
    });

    const row = new ActionRowBuilder().addComponents(
      botao('📝 Abrir formulário', 'lembrete_modal', ButtonStyle.Primary, '📝')
    );

    const resposta = await message.reply({ embeds: [embedCriar], components: [row] });

    const coletor = resposta.createMessageComponentCollector({ time: 60 * 1000, filter: (i) => i.user.id === message.author.id });

    coletor.on('collect', async (i) => {
      if (i.customId === 'lembrete_modal') {
        const modal = new ModalBuilder()
          .setCustomId('lembrete_modal_prefix')
          .setTitle('🌙 Novo Lembrete');

        const quandoInput = new TextInputBuilder()
          .setCustomId('lembrete_quando')
          .setLabel('📅 Quando? (hora + data ou tempo relativo)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 2pm 21/08/2026 • 13:40 02/12 • 1h30m • 10m • amanhã 14:00')
          .setRequired(true);

        const mensagemInput = new TextInputBuilder()
          .setCustomId('lembrete_mensagem')
          .setLabel('💬 O que lembrar?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escreva aqui o lembrete...')
          .setMaxLength(500)
          .setRequired(true);

        modal.addComponents(
          new ActionRowBuilder().addComponents(quandoInput),
          new ActionRowBuilder().addComponents(mensagemInput)
        );

        await i.showModal(modal);

        try {
          const submitted = await i.awaitModalSubmit({ filter: (m) => m.user.id === message.author.id, time: 5 * 60 * 1000 });
          const quando = submitted.fields.getTextInputValue('lembrete_quando');
          const mensagem = submitted.fields.getTextInputValue('lembrete_mensagem');
          const ms = parseTempo(quando);

          if (!ms) {
            return submitted.reply({ embeds: [criarEmbed({ titulo: 'Tempo inválido', descricao: 'Use formatos como `10m`, `1h30m`, `2d`, `13:40 02/12`, `2pm 21/08/2026`, `amanhã 14:00`.', cor: THEME.corErro })], ephemeral: true });
          }

          const id = crypto.randomBytes(3).toString('hex');
          const disparaEm = Date.now() + ms;
          const lembrete = { id, userId: message.author.id, usuarioNome: message.author.username, channelId: message.channelId, mensagem, disparaEm, criadoEm: Date.now() };
          adicionarLembrete(lembrete);
          agendarLembrete(client, lembrete);

          return submitted.reply({ embeds: [criarEmbed({ titulo: '🌙 Lembrete guardado', descricao: `${THEME.div.bolinhas}\n\n⏰ **Quando:** ${formatarDataAbsoluta(disparaEm)} (em ${formatarDuracao(ms)})\n💬 **Mensagem:**\n> ${mensagem}\n\n${THEME.div.estrelado}\n\n**ID:** \`${id}\`\n\n${THEME.div.coracao}`, cor: THEME.corLembrete, rodape: `${THEME.nome} não vai esquecer, ${message.author.username}` })], ephemeral: true });
        } catch {
          // Modal expirou
        }
      }
    });

    coletor.on('end', async () => {
      try {
        await resposta.edit({ components: [] });
      } catch {}
    });
  }

  // ── $anuncio <tipo> <mensagem> ──
  if (comando === 'anuncio') {
    // Risco original: $anuncio bridge não checava isStaff, permitindo qualquer
    // usuário enviar anúncios. O prefixo `$` ignora as default_member_permissions
    // do Discord, então a checagem deve ser explícita aqui.
    if (!isStaff(message.member)) {
      return responder(
        message,
        criarEmbed({ titulo: 'Sem permissão', descricao: 'Você precisa de **Gerir Servidor** ou cargo de staff para usar `$anuncio`.', cor: THEME.corErro }),
        true
      );
    }
    const tipo = (args[0] || '').toLowerCase();
    const mensagemTxt = args.slice(1).join(' ');
    if (!TIPOS_ANUNCIO.includes(tipo) || !mensagemTxt) {
      return responder(
        message,
        criarEmbed({
          titulo: 'Uso incorreto',
          descricao: `Use: \`$anuncio <tipo> <mensagem>\`. Tipos: ${TIPOS_ANUNCIO.join(', ')}.`,
          cor: THEME.corErro,
        }),
        true
      );
    }
    const cfg = obterConfig(guildId);
    const canalId = cfg.anuncios[tipo];
    if (!canalId) {
      return responder(
        message,
        criarEmbed({
          titulo: 'Nenhum canal configurado',
          descricao: `Não há canal para anúncios do tipo **${tipo}**. Use \`$configurar anuncio ${tipo} #canal\`.`,
          cor: THEME.corErro,
        }),
        true
      );
    }
    let canal;
    try {
      canal = await client.channels.fetch(canalId);
    } catch {
      canal = null;
    }
    if (!canal) {
      return responder(
        message,
        criarEmbed({ titulo: 'Canal não encontrado', descricao: 'O canal salvo sumiu ou não tenho acesso.', cor: THEME.corErro }),
        true
      );
    }
    const rotulos = {
      geral: { titulo: 'Aviso Geral', emoji: '📣', cor: THEME.corPrincipal },
      evento: { titulo: 'Evento Lunar', emoji: '🎉', cor: 0xC9B8F2 },
      regra: { titulo: 'Regra do Servidor', emoji: '📜', cor: 0xA895E0 },
      atualizacao: { titulo: 'Atualização', emoji: '✨', cor: THEME.corRoleta },
      aviso: { titulo: 'Aviso Importante', emoji: '⚠️', cor: THEME.corErro },
    };
    const rotulo = rotulos[tipo] || { titulo: 'Anúncio', emoji: '📢', cor: THEME.corPrincipal };
    // ⋆｡°✩ Animação: typing → enviando → sucesso
    mostrarDigitando(message.channel, 700).catch(() => {});
    const embed = criarEmbed({
      titulo: `${rotulo.emoji} ${rotulo.titulo}`,
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `${mensagemTxt}\n\n` +
        `${THEME.div.bolinhas}`,
      cor: rotulo.cor,
      rodape: `Anunciado por ${message.author.username} • ${THEME.nome}`,
    });
    try {
      await canal.send({
        embeds: [embed],
        // Risco original: sem allowedMentions, menções @everyone/@here e @role
        // no texto do anúncio ou em embeds de terceiros poderiam ser reenviadas.
        allowedMentions: { parse: [], repliedUser: false },
      });
    } catch (erro) {
      // Risco original: expunha erro.message (pode conter paths internos).
      console.error('Erro ao enviar $anuncio:', erro);
      return responder(
        message,
        criarEmbed({ titulo: 'Não consegui enviar', descricao: 'Falhou ao enviar o anúncio. Verifique permissões do canal.', cor: THEME.corErro }),
        true
      );
    }
    return responder(
      message,
      criarEmbed({
        titulo: 'Anúncio enviado',
        descricao: `${THEME.div.coracao}\n\nSeu anúncio do tipo **${rotulo.emoji} ${tipo}** foi para ${canal}.\n\n${THEME.div.coracao}`,
        cor: THEME.corSucesso,
        rodape: `${THEME.nome} entregou o aviso com sucesso~ ♡`,
      }),
      true
    );
  }

  // ── $configurar ... ──
  if (comando === 'configurar') {
    const sub = (args[0] || '').toLowerCase();
    if (!isStaff(message.member)) {
      return responder(
        message,
        criarEmbed({ titulo: 'Sem permissão', descricao: 'Você precisa de **Gerir Servidor** ou de um cargo de staff para usar isso.', cor: THEME.corErro }),
        true
      );
    }
    const cfg = obterConfig(guildId);
    if (sub === 'ver') return enviarConfiguracao(message, guildId);

    if (sub === 'permitir' || sub === 'liberar') {
      const canalId = extrairCanal(message);
      if (!canalId) return responder(message, criarEmbed({ titulo: 'Canal?', descricao: 'Marque um canal: `$configurar permitir #canal`.', cor: THEME.corErro }), true);
      if (sub === 'permitir') {
        if (!cfg.canaisPermitidos.includes(canalId)) cfg.canaisPermitidos.push(canalId);
      } else {
        cfg.canaisPermitidos = cfg.canaisPermitidos.filter((id) => id !== canalId);
      }
      salvarConfig(guildId, cfg);
      const txt = sub === 'permitir' ? 'Agora falo em' : 'Removi dos permitidos';
      return responder(message, criarEmbed({ titulo: 'Pronto', descricao: `${txt} <#${canalId}>.`, cor: THEME.corSucesso }), true);
    }

    if (sub === 'proibir' || sub === 'desproibir') {
      const canalId = extrairCanal(message);
      if (!canalId) return responder(message, criarEmbed({ titulo: 'Canal?', descricao: 'Marque um canal: `$configurar proibir #canal`.', cor: THEME.corErro }), true);
      if (sub === 'proibir') {
        if (!cfg.canaisBloqueados.includes(canalId)) cfg.canaisBloqueados.push(canalId);
      } else {
        cfg.canaisBloqueados = cfg.canaisBloqueados.filter((id) => id !== canalId);
      }
      salvarConfig(guildId, cfg);
      const txt = sub === 'proibir' ? 'Parei de falar em' : 'Liberei para falar em';
      return responder(message, criarEmbed({ titulo: 'Pronto', descricao: `${txt} <#${canalId}>.`, cor: THEME.corSucesso }), true);
    }

    if (sub === 'anuncio') {
      const tipo = (args[1] || '').toLowerCase();
      const canalId = extrairCanal(message);
      if (!TIPOS_ANUNCIO.includes(tipo) || !canalId) {
        return responder(
          message,
          criarEmbed({ titulo: 'Uso incorreto', descricao: 'Use: `$configurar anuncio <tipo> #canal`.', cor: THEME.corErro }),
          true
        );
      }
      cfg.anuncios[tipo] = canalId;
      salvarConfig(guildId, cfg);
      return responder(
        message,
        criarEmbed({ titulo: 'Canal de anúncio definido', descricao: `Anúncios do tipo **${tipo}** vão para <#${canalId}>.`, cor: THEME.corSucesso }),
        true
      );
    }

    if (sub === 'limparanuncio') {
      const tipo = (args[1] || '').toLowerCase();
      if (!TIPOS_ANUNCIO.includes(tipo)) {
        return responder(message, criarEmbed({ titulo: 'Tipo?', descricao: `Tipos: ${TIPOS_ANUNCIO.join(', ')}.`, cor: THEME.corErro }), true);
      }
      cfg.anuncios[tipo] = null;
      salvarConfig(guildId, cfg);
      return responder(message, criarEmbed({ titulo: 'Limpo', descricao: `Canal de **${tipo}** removido.`, cor: THEME.corSucesso }), true);
    }

    if (sub === 'shutdown') {
      const canalId = extrairCanal(message);
      if (!canalId) {
        return responder(message, criarEmbed({ titulo: 'Canal?', descricao: 'Marque um canal para eu avisar quando for desligada: `$configurar shutdown #canal`.', cor: THEME.corErro }), true);
      }
      cfg.canalShutdown = canalId;
      salvarConfig(guildId, cfg);
      return responder(message, criarEmbed({ titulo: 'Pronto', descricao: `Agora aviso o desligamento em <#${canalId}>.`, cor: THEME.corSucesso }), true);
    }

    if (sub === 'ticketcategoria') {
      const canalId = extrairCanal(message);
      if (!canalId) {
        return responder(message, criarEmbed({ titulo: 'Categoria?', descricao: 'Marque uma categoria: `$configurar ticketcategoria #categoria`.', cor: THEME.corErro }), true);
      }
      // Verifica se é uma categoria de fato
      const canal = message.guild.channels.cache.get(canalId);
      if (canal && canal.type !== 'GUILD_CATEGORY' && canal.type !== 4) {
        return responder(message, criarEmbed({ titulo: 'Não é uma categoria', descricao: 'Isso **não é uma categoria**! Selecione uma categoria (pasta de canais), não um canal de texto.', cor: THEME.corErro }), true);
      }
      cfg.categoriaTicket = canalId;
      salvarConfig(guildId, cfg);
      return responder(message, criarEmbed({ titulo: '🎪 Categoria de Tickets definida', descricao: `<#${canalId}> agora é a categoria dos tickets.`, cor: THEME.corSucesso }), true);
    }

    if (sub === 'off-on') {
      const canalId = extrairCanal(message);
      if (!canalId) {
        return responder(message, criarEmbed({ titulo: 'Canal?', descricao: 'Marque um canal para eu avisar quando ficar online/offline: `$configurar off-on #canal`.', cor: THEME.corErro }), true);
      }
      cfg.canalOnOff = canalId;
      salvarConfig(guildId, cfg);
      return responder(message, criarEmbed({ titulo: 'Pronto', descricao: `Agora aviso online/offline em <#${canalId}>.`, cor: THEME.corSucesso }), true);
    }

      return responder(
        message,
        criarEmbed({
          titulo: 'Subcomandos de $configurar',
          descricao:
            '`ver` · `permitir #canal` · `liberar #canal` · `proibir #canal` · `desproibir #canal` · `anuncio <tipo> #canal` · `limparanuncio <tipo>` · `shutdown #canal` · `ticketcategoria #categoria` · `off-on #canal`',
          cor: THEME.corPrincipal,
        }),
        true
      );
  }

  // ── $organizar ──
  if (comando === 'organizar') {
    const cfg = obterConfig(guildId);
    const roteamento = TIPOS_ANUNCIO.map((t) => {
      const id = cfg.anuncios[t];
      return `˖ **${t}** → ${id ? `<#${id}>` : '`sem canal`'}`;
    }).join('\n');
    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(THEME.corPrincipal)
      .setTitle(`${THEME.iconeFooter} Painel de Organização`)
      .setDescription(
        `${THEME.div.bolinhas}\n\n` +
        'Todos os meus comandos usam o prefixo `$`. Use `$codex` ou `$ajuda` para abrir o livro de comandos. Use `$configurar` para ajustar canais.\n\n' +
        `${THEME.div.bolinhas}`
      )
      .addFields(
        { name: '🎲 Diversão', value: '`$dado`, `$roleta`', inline: true },
        { name: '⏰ Lembretes', value: '`$lembrete`', inline: true },
        { name: '📣 Comunicação', value: '`$anuncio`, `$configurar`', inline: true },
        { name: '📍 Roteamento de anúncios', value: roteamento, inline: false },
        {
          name: '🗣️ Onde a bot fala',
          value:
            cfg.canaisPermitidos.length > 0
              ? `Somente em: ${cfg.canaisPermitidos.map((id) => `<#${id}>`).join('  ·  ')}`
              : 'Em qualquer canal (exceto os bloqueados)',
          inline: false,
        },
        {
          name: '🔔 Aviso de desligamento',
          value: cfg.canalShutdown ? `<#${cfg.canalShutdown}>` : '`nenhum definido`',
          inline: false,
        }
      )
      .setFooter({ text: `${THEME.nome} organiza por aqui...` })
      .setTimestamp();
    return message.reply({ embeds: [embed] });
  }

  // ── $ticket ──
  if (comando === 'ticket') {
    const { enviarPainel, configurarTicket, enviarPainelConvidar, convidarUsuario } = require('./ticketManager');
    const sub = (args[0] || '').toLowerCase();
    const staff = isStaff(message.member);
    const topico = lerTopicoTicket(message.channel);
    // O dono do ticket pode convidar/remover pessoas do próprio ticket;
    // qualquer outra ação (painel, configuração) exige staff.
    const donoDoTicket = Boolean(topico?.userId && topico.userId === message.author.id);
    const semPermissao = () => responder(
      message,
      criarEmbed({
        titulo: 'Sem permissão',
        descricao: `${THEME.div.bolinhas}\n\nVocê precisa ser **staff** para gerenciar tickets.\n\n${THEME.div.bolinhas}`,
        cor: THEME.corErro,
      }),
      true
    );

    if (sub === '') {
      if (!staff) return semPermissao();
      return enviarPainel(message, client);
    }

    if (sub === 'remove' || sub === 'invite') {
      if (!staff && !donoDoTicket) return semPermissao();
      if (sub === 'remove') {
        const { enviarPainelRemover, removerUsuario } = require('./ticketManager');
        const userId = args[1]?.replace(/[<@!]/g, '') || '';
        if (!userId) {
          // Sem usuário → abre painel interativo
          return enviarPainelRemover(message, client);
        }
        return removerUsuario(message, userId);
      }
      const userId = args[1]?.replace(/[<@!]/g, '') || '';
      if (!userId) {
        // Sem argumento → abre painel interativo
        return enviarPainelConvidar(message, client);
      }
      return convidarUsuario(message, userId);
    }

    if (!staff) return semPermissao();

    return configurarTicket(message, args, client);
  }

  // ── $fechar ── (fecha o ticket do canal atual)
  if (comando === 'fechar') {
    if (message.channel.name && message.channel.name.startsWith('ticket-')) {
      const { criarEmbedConfirmarFechamento, criarBotoesConfirmarFechamento } = require('./ticketManager');
      const channel = message.channel;
      try {
        const topic = channel.topic;
        let ticketInfo;
        try {
          ticketInfo = JSON.parse(topic);
        } catch {
          ticketInfo = { contador: 0, categoriaEmoji: '❓', categoriaNome: 'Desconhecido', usuarioTag: 'Desconhecido', staffTag: null };
        }

        const embedConfirma = criarEmbedConfirmarFechamento(ticketInfo);
        const reply = await message.reply({
          embeds: [embedConfirma],
          components: [criarBotoesConfirmarFechamento()],
          fetchReply: true,
        });

        // Apenas limpa os botões quando o coletor expirar.
        // O tratamento dos cliques é feito pelo handler global em index.js
        // para evitar conflito de deferUpdate() com dois handlers no mesmo botão.
        const coletor = reply.createMessageComponentCollector({
          time: 60_000,
          filter: () => true,
        });
        coletor.on('end', async () => {
          try { await reply.edit({ components: [] }); } catch {}
        });
      } catch (erro) {
        console.error('Erro ao fechar ticket via $fechar:', erro);
        await message.reply('❌ Erro ao fechar o ticket.').catch(() => {});
      }
    } else {
      return responder(
        message,
        criarEmbed({ titulo: 'Não é um ticket', descricao: 'Este comando só funciona em **canais de ticket**.', cor: THEME.corErro }),
        true
      );
    }
    return;
  }

  // ── $forca ──
  if (comando === 'forca') {
    const sub = (args[0] || '').toLowerCase();
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

    // ── $forca ranking ──
    if (sub === 'ranking' || sub === 'rank') {
      const { criarEmbedRanking, criarBotoesRanking } = require('./forcaManager');
      const embed = criarEmbedRanking('total');
      return message.reply({ embeds: [embed], components: [criarBotoesRanking()] });
    }

    // ── $forca vs @jogador ──
    if (sub === 'vs' || sub === 'cop') {
      const convidados = message.mentions.members.filter(m => !m.user.bot);
      if (convidados.size === 0) {
        return message.reply('❌ Marque quem deseja convidar: `$forca vs @usuario1 @usuario2`');
      }

      const { JOGOS, DIFICULDADES } = require('./forcaManager');
      const config = JOGOS.get(message.author.id);
      const dificuldade = config?.dificuldade || 'normal';
      const modo = config?.modo || 'competitivo';
      const nomes = convidados.map(m => m.user.tag).join(', ');
      const difNome = DIFICULDADES.find(d => d.id === dificuldade)?.nome || 'Normal';

      const embedConvite = criarEmbed({
        titulo: '🎪 Convite para Jogo da Forca!',
        descricao: [
          '```╔══════════════════════════════╗',
          '║        🎪 CONVITE            ║',
          '╚══════════════════════════════╝```',
          '',
          `👤 **Anfitrião:** ${message.author.tag}`,
          `👥 **Convidados:** ${nomes}`,
          `🎮 **Modo:** ${modo === 'competitivo' ? '⚔️ Competitivo' : '🤝 Cooperativo'}`,
          `📊 **Dificuldade:** ${difNome}`,
          '',
          '─ ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ──── ⋅ ⋅ ⋅ ─',
          '',
          'Deseja aceitar o convite?',
          'Ambos precisam aceitar para começar!',
        ].join('\n'),
        cor: 0x3498DB,
        rodape: '🎪 Jogo da Forca • Convite • Mila Bot',
      });

      const conviteMsg = await message.reply({
        content: convidados.map(m => `${m}`).join(' '),
        embeds: [embedConvite],
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('forca_convite_aceitar')
              .setLabel('✅ Aceitar')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('forca_convite_recusar')
              .setLabel('❌ Recusar')
              .setStyle(ButtonStyle.Danger),
          ),
        ],
        fetchReply: true,
      });

      // Salva dados do convite (index.js vai processar os cliques)
      JOGOS.set(conviteMsg.id, {
        dono: { id: message.author.id, tag: message.author.tag },
        convidados: convidados.map(m => ({ id: m.id, tag: m.user.tag })),
        dificuldade,
        modo,
        aceitos: [],
      });

      setTimeout(() => {
        const s = JOGOS.get(conviteMsg.id);
        if (s && (!s.aceitos || s.aceitos.length < (s.convidados.length + 1))) {
          JOGOS.delete(conviteMsg.id);
          conviteMsg.edit({ content: '⏰ **Tempo esgotado.** Convite cancelado.', components: [] }).catch(() => {});
        }
      }, 120_000);

      return;
    }

    // ── $forca (sem subcomando) — painel normal ──
    const { criarSelectModo, criarSelectDificuldade } = require('./forcaManager');
    const embed = criarEmbed({
      titulo: '🎪 Jogo da Forca',
      descricao: [
        '```╔══════════════════════════════╗',
        '║    🎪 JOGO DA FORCA         ║',
        '╚══════════════════════════════╝```',
        '',
        'Bem-vindo ao espetáculo de palavras! 🎭',
        '',
        'Escolha o **modo de jogo** e a **dificuldade**.',
        '',
        '💡 **Subcomandos:**',
        '`$forca ranking` — Ver rankings',
        '`$forca vs @user` — Convidar para partida',
      ].join('\n'),
      cor: 0xD4A017,
      rodape: '🎪 Jogo da Forca • Mila Bot',
    });

    const reply = await message.reply({
      embeds: [embed],
      components: [
        new ActionRowBuilder().addComponents(criarSelectModo()),
        new ActionRowBuilder().addComponents(criarSelectDificuldade()),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('forca_comecar')
            .setLabel('✅ Começar')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId('forca_ver_regras')
            .setLabel('📖 Regras')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId('forca_cancelar')
            .setLabel('✖️ Cancelar')
            .setStyle(ButtonStyle.Danger),
        ),
      ],
      fetchReply: true,
    });

    const { JOGOS } = require('./forcaManager');
    JOGOS.set(reply.id, { userId: message.author.id });
    return;
  }

  // ── $say / $falar ──
  if (comando === 'sair' || comando === 'desconectar') {
    const sair = require('../commands/sair');
    const interaction = criarInteracao(message, client, {});
    return sair.execute(interaction, client);
  }

  if (comando === 'letra') {
    const comandoLetra = require('../commands/letra');
    const valores = await parseArgs(comando, args, message, client);
    return comandoLetra.execute(criarInteracao(message, client, valores), client);
  }

  if (comando === 'say' || comando === 'falar') {
    const { falarDireto } = require('./sayManager');
    return falarDireto(message, args);
  }

  if (comando === 'tts') {
    const { falar, formatarConfig, obterTtsConfig, salvarTtsConfig, normalizarIdioma, normalizarPerfil } = require('./tts');
    if (!message.member?.permissions?.has('Administrator')) return message.reply('❌ Apenas administradores podem configurar a voz.');
    if (!args.length) return message.reply(`🗣️ ${formatarConfig(obterTtsConfig(message.guildId))}`);
    const subcomando = args[0].toLowerCase();
    if (subcomando === 'idioma' && args[1]) {
      if (!normalizarIdioma(args[1])) return message.reply('❌ Idioma inválido. Use códigos como pt-BR, en-US, es-ES, fr-FR, de-DE, it-IT, ja-JP, ko-KR, zh-CN ou ru-RU.');
      const config = salvarTtsConfig(message.guildId, { idioma: args[1] });
      return message.reply(`✅ Idioma alterado.\n${formatarConfig(config)}`);
    }
    if (subcomando === 'perfil' && args[1]) {
      if (!normalizarPerfil(args[1])) return message.reply('❌ Perfil inválido. Use padrao, paulista, carioca, chines, americana ou japonesa.');
      const config = salvarTtsConfig(message.guildId, { perfil: args[1].toLowerCase() });
      return message.reply(`✅ Perfil alterado.\n${formatarConfig(config)}`);
    }
    if (subcomando === 'nome' && args[1]) {
      const valor = ['on', 'sim', 'true', '1'].includes(args[1].toLowerCase());
      const config = salvarTtsConfig(message.guildId, { dizerNome: valor });
      return message.reply(`✅ Falar o nome: **${valor ? 'sim' : 'não'}**.`);
    }
    try {
      await falar(message.guild, message.member, args.join(' '));
      return message.reply('✅ Falei no canal de voz.');
    } catch (erro) {
      return message.reply(`❌ ${erro.message}`);
    }
  }

  // ── $ajuda / $help ── (mesmo resultado do $codex)
  if (comando === 'ajuda' || comando === 'help') {
    return responderCodex(message, args.join(' '));
  }

  // ── Demais comandos (bridge a partir dos módulos de comando) ──
  if (EXTRA[comando]) {
    const valores = await parseArgs(comando, args, message, client);
    if (valores === null) {
      return responder(
        message,
        criarEmbed({
          titulo: 'Faltam argumentos',
          descricao: USO_PADRAO[comando] || 'Verifique os argumentos deste comando.',
          cor: THEME.corErro,
        }),
        true
      );
    }
    const interaction = criarInteracao(message, client, valores);
    // O caminho de prefixo precisa respeitar o mesmo `meta` do slash
    // (staff/permissões/guildOnly), que antes era ignorado aqui.
    const bloqueio = autorizarComando(EXTRA[comando], message);
    if (bloqueio) {
      return responder(
        message,
        criarEmbed({ titulo: 'Acesso restrito', descricao: `${THEME.div.bolinhas}\n\n${bloqueio}\n\n${THEME.div.bolinhas}`, cor: THEME.corErro }),
        true
      );
    }
    try {
      await EXTRA[comando].execute(interaction, client);
    } catch (erro) {
      logger.erro(`Erro ao executar ${prefixo}${comando}: ${erro?.message || erro}`, { usuario: message.author.username, comando: `${prefixo}${comando}` });
      await responder(
        message,
        criarEmbed({ titulo: 'Algo se perdeu no caminho', descricao: 'Tive um problema ao executar esse comando. Tente novamente.', cor: THEME.corErro }),
        true
      ).catch(() => {});
    }
    return;
  }
}

// ── Lista interativa de lembretes (privacidade + filtros) ─────────────
async function mostrarListaLembretes(message, client, filtrosIniciais = {}) {
  let filtros = { ...filtrosIniciais, ordenar: 'mais_proximo' };
  let pagina = 0;
  const staff = isStaff(message.member);

  function renderizar() {
    const lista = filtrarLembretes(filtros);
    const total = lista.length;
    const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
    pagina = Math.min(pagina, totalPaginas - 1);

    const inicio = pagina * ITENS_POR_PAGINA;
    const paginaItens = lista.slice(inicio, inicio + ITENS_POR_PAGINA);

    const agora = Date.now();
    const linhas = paginaItens.map((l) => {
      const restante = l.disparaEm - agora;
      const status = restante <= 0 ? '🔴 VENCIDO' : `⏳ ${formatarDuracao(restante)}`;
      const data = formatarDataAbsoluta(l.disparaEm);
      const criado = formatarDataAbsoluta(l.criadoEm);
      const autor = l.usuarioNome || l.userId;

      const isOwner = l.userId === message.author.id;
      const podeVerConteudo = isOwner || staff;

      if (podeVerConteudo) {
        return `**\`${l.id}\`** — ${autor}\n📅 **Dispara:** ${data} — ${status}\n📝 **Criado:** ${criado}\n💬 "${l.mensagem}"`;
      } else {
        return `**\`${l.id}\`** — ${autor}\n📅 **Dispara:** ${data} — ${status}\n📝 **Criado:** ${criado}\n🔒 *Lembrete privado*`;
      }
    });

    const descricao = linhas.length
      ? linhas.map((l, i) => `**${inicio + i + 1}.** ${l}`).join('\n\n')
      : 'Nenhum lembrete encontrado com esses filtros.';

    const infoFiltros = [];
    if (filtros.userId) infoFiltros.push('🔍 Seus lembretes');
    if (filtros.pessoa) infoFiltros.push(`👤 ${filtros.pessoa}`);
    if (filtros.status === 'pendentes') infoFiltros.push('✅ Pendentes');
    if (filtros.status === 'vencidos') infoFiltros.push('🔴 Vencidos');
    if (filtros.ordenar === 'mais_antigo') infoFiltros.push('📅 Expira: mais antigo');
    if (filtros.ordenar === 'mais_recente') infoFiltros.push('📅 Expira: mais recente');
    if (filtros.ordenar === 'criado_antigo') infoFiltros.push('📝 Criado: mais antigo');
    if (filtros.ordenar === 'criado_recente') infoFiltros.push('📝 Criado: mais recente');

    const rodape = `Página ${pagina + 1}/${totalPaginas} • ${total} lembrete(s)${infoFiltros.length ? ' • ' + infoFiltros.join(' • ') : ''}`;

    return {
      embed: criarEmbed({
        titulo: '📋 Lembretes sob a lua',
        descricao,
        cor: THEME.corLembrete,
        rodape,
      }),
      totalPaginas,
    };
  }

  function botoes(totalPaginas) {
    const row = new ActionRowBuilder();
    row.addComponents(
      botao('⏮️', 'lemb_first', ButtonStyle.Secondary).setDisabled(pagina <= 0),
      botao('◀️', 'lemb_prev', ButtonStyle.Primary).setDisabled(pagina <= 0),
      botao('▶️', 'lemb_next', ButtonStyle.Primary).setDisabled(pagina >= totalPaginas - 1),
      botao('⏭️', 'lemb_last', ButtonStyle.Secondary).setDisabled(pagina >= totalPaginas - 1)
    );
    return row;
  }

  function menuFiltros() {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('lemb_filtro')
      .setPlaceholder('🔽 Filtrar / Ordenar')
      .addOptions([
        { label: 'Meus lembretes', value: 'meus', description: 'Mostrar só os seus', emoji: '👤' },
        { label: 'Todos os lembretes', value: 'todos', description: 'Mostrar todos', emoji: '🌍' },
        { label: '✅ Só pendentes', value: 'pendentes', description: 'Apenas não vencidos', emoji: '✅' },
        { label: '🔴 Só vencidos', value: 'vencidos', description: 'Apenas vencidos', emoji: '🔴' },
        { label: '📅 Expira: mais próximo', value: 'ord_proximo', description: 'Quem vence primeiro', emoji: '⏳' },
        { label: '📅 Expira: mais distante', value: 'ord_distante', description: 'Quem vence por último', emoji: '⏰' },
        { label: '📝 Criado: mais recente', value: 'ord_criado_recente', description: 'Recém-criados primeiro', emoji: '🆕' },
        { label: '📝 Criado: mais antigo', value: 'ord_criado_antigo', description: 'Mais antigos primeiro', emoji: '📜' },
      ]);
    return new ActionRowBuilder().addComponents(menu);
  }

  const { embed, totalPaginas } = renderizar();
  const resposta = await message.reply({
    embeds: [embed],
    components: [botoes(totalPaginas), menuFiltros()],
  });

  const coletor = resposta.createMessageComponentCollector({ time: 5 * 60 * 1000, filter: (i) => i.user.id === message.author.id });

  coletor.on('collect', async (i) => {
    if (i.customId === 'lemb_first') pagina = 0;
    else if (i.customId === 'lemb_prev') pagina = Math.max(0, pagina - 1);
    else if (i.customId === 'lemb_next') pagina = Math.min(totalPaginas - 1, pagina + 1);
    else if (i.customId === 'lemb_last') pagina = totalPaginas - 1;
    else if (i.customId === 'lemb_filtro') {
      const valor = i.values[0];
      if (valor === 'meus') filtros.userId = i.user.id;
      else if (valor === 'todos') delete filtros.userId;
      else if (valor === 'pendentes') filtros.status = 'pendentes';
      else if (valor === 'vencidos') filtros.status = 'vencidos';
      else if (valor === 'ord_proximo') filtros.ordenar = 'mais_proximo';
      else if (valor === 'ord_distante') filtros.ordenar = 'mais_recente';
      else if (valor === 'ord_criado_recente') filtros.ordenar = 'criado_recente';
      else if (valor === 'ord_criado_antigo') filtros.ordenar = 'criado_antigo';
      pagina = 0;
    }

    const { embed: novoEmbed, totalPaginas: novasPag } = renderizar();
    await i.update({ embeds: [novoEmbed], components: [botoes(novasPag), menuFiltros()] });
  });

  coletor.on('end', async () => {
    try {
      await resposta.edit({ components: [] });
    } catch {}
  });
}

module.exports = { handlePrefix, temRepeticaoRecente };
