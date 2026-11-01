// web/server.js
// ── Site da Mila (Economia + Pokémon + Temas) ─────────────────────────
// Servidor HTTP sem dependências além do Node: entrega os arquivos de
// web/public e uma API JSON que usa as MESMAS regras do bot.
//
// Ativação no index.js quando clientReady dispara:
//   WEB_ATIVO=true  (padrão: false)
//   WEB_PORT=3000
//   WEB_HOST=0.0.0.0
//   WEB_PUBLIC_URL=https://seu-dominio (opcional, usado em links)

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PUBLIC_DIR = path.join(__dirname, 'public');
const { listarTemas, normalizarTema } = require('../utils/economyThemeData');
const { obterConfig } = require('../utils/servidorStore');
const service = require('../utils/economyService');
const loja = require('../utils/economyLoja');
const pokemon = require('../utils/pokemon');
const criador = require('../utils/criador');
const { CATEGORIAS, COMANDOS } = require('../utils/codexData');
const slash = require('../utils/slash');

const CATEGORIA_POR_COMANDO = new Map([
  ...['agora', 'assistir', 'clearqueue', 'embaralhar', 'fila', 'join', 'entrar', 'leave', 'letra', 'nowplaying', 'parar', 'pausar', 'pause', 'play', 'playlist', 'pular', 'queue', 'repeat', 'repetir', 'retomar', 'sair', 'shuffle', 'skip', 'stop', 'tocar', 'tts', 'volume'].map((nome) => [nome, 'musica']),
  ...['apostas', 'blackjack', 'coinflipduelo', 'dadoduelo', 'jokenpo', 'maiorcarta', 'parouimpar', 'roletacor', 'roleta_russa'].map((nome) => [nome, 'diversao']),
  ...['carteira', 'carrinho', 'colecao', 'coletar', 'comprar', 'conquistas', 'diario', 'doar', 'economia', 'extrato', 'loja', 'presentear', 'ranking', 'resetareconomia', 'retiraracucares', 'trabalhar'].map((nome) => [nome, 'economia']),
  ...['anuncio', 'aviso', 'configurar', 'limpar', 'limparfila', 'logs', 'securitybreach', 'seguranca', 'ticket'].map((nome) => [nome, 'admin']),
  ...['abraco', 'antiship', 'avatar', 'buscar', 'cartasecreta', 'falar', 'say', 'ship', 'social'].map((nome) => [nome, 'social']),
  ['pokemon', 'pokemon'],
]);

let comandosSlashCache = null;
let avisosComandosSlash = [];

function listarComandosSite() {
  if (!comandosSlashCache) {
    if (!slash.comandos.size) {
      const resultado = slash.carregar();
      avisosComandosSlash = resultado.invalidos;
    }

    comandosSlashCache = slash.listarJson();
  }

  const catalogo = new Map(COMANDOS.map((comando) => [comando.nome, comando]));
  for (const comando of comandosSlashCache) {
    if (catalogo.has(comando.name)) continue;
    const categoria = CATEGORIA_POR_COMANDO.get(comando.name) || 'util';
    const opcoes = comando.options || [];
    const argumentos = opcoes.map((opcao) => {
      if (opcao.type === 1 || opcao.type === 2) return ` ${opcao.name}`;
      return opcao.required ? ` <${opcao.name}>` : ` [${opcao.name}]`;
    }).join('');
    catalogo.set(comando.name, {
      nome: comando.name,
      categoria,
      emoji: CATEGORIAS[categoria].emoji,
      descricao: comando.description,
      uso: `/${comando.name}${argumentos}`,
      exemplo: `Abra /${comando.name} no Discord e complete as opções exibidas.`,
    });
  }

  return Array.from(catalogo.values());
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function json(res, status, dados) {
  const corpo = JSON.stringify(dados);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(corpo),
  });
  res.end(corpo);
}

function texto(res, status, mensagem) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(mensagem);
}

function servirArquivo(res, caminho) {
  fs.readFile(caminho, (erro, conteudo) => {
    if (erro) return texto(res, 404, 'Arquivo não encontrado');
    const ext = path.extname(caminho).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': ['.html', '.css', '.js'].includes(ext) ? 'no-store' : 'public, max-age=3600',
      'Content-Length': conteudo.length,
    });
    res.end(conteudo);
  });
}

function resolverPublico(urlPath) {
  const limpo = decodeURIComponent(urlPath.split('?')[0]).replace(/\\/g, '/');
  const relativo = limpo === '/' ? 'index.html' : limpo.replace(/^\/+/, '');
  const alvo = path.resolve(PUBLIC_DIR, relativo);
  // Nunca servir fora de web/public.
  if (!alvo.startsWith(path.resolve(PUBLIC_DIR))) return null;
  return alvo;
}

async function dadosPerfil(client, id, usuarioConhecido = null) {
  if (!/^\d{5,}$/.test(String(id || ''))) return null;
  const dados = service.carteira(id);
  const conquistas = service.listarConquistas(id);
  let usuario = usuarioConhecido;
  if (client) {
    if (!usuario) {
      try {
        usuario = await client.users.fetch(id);
      } catch {
        usuario = null;
      }
    }
  }
  const usuarioSerializado = usuario
    ? {
      id: usuario.id,
      username: usuario.username,
      globalName: usuario.globalName || usuario.username,
      avatar: usuario.displayAvatarURL?.({ size: 256, extension: 'png' }) || null,
    }
    : null;
  return {
    usuario: usuarioSerializado || { id, username: `Usuário ${String(id).slice(-4)}`, avatar: null },
    dados: {
      ...dados,
      titulo: dados.ehCriador ? criador.TITULO : (dados.tituloPersonalizado || 'Confeiteiro(a) da Mila'),
    },
    conquistas: conquistas.map((c) => ({
      id: c.id,
      nome: c.nome,
      emoji: c.emoji,
      descricao: c.descricao,
      desbloqueada: c.desbloqueada,
      desbloqueadaEm: c.desbloqueadaEm,
    })),
    extrato: service.extrato(id, 10),
  };
}

function listarUsuariosConhecidos(client) {
  const usuarios = new Map();
  for (const usuario of client?.users?.cache?.values?.() || []) {
    usuarios.set(usuario.id, usuario);
  }
  for (const servidor of client?.guilds?.cache?.values?.() || []) {
    for (const membro of servidor.members?.cache?.values?.() || []) {
      if (membro.user) usuarios.set(membro.user.id, membro.user);
    }
  }
  return Array.from(usuarios.values());
}

function buscarUsuariosPorUsername(client, username) {
  const consulta = String(username || '').trim().replace(/^@/, '').toLocaleLowerCase('en-US');
  if (!/^[a-z0-9._]{2,32}$/.test(consulta)) return null;
  return listarUsuariosConhecidos(client)
    .filter((usuario) => String(usuario.username || '').toLocaleLowerCase('en-US') === consulta);
}

function listarServidores(client) {
  return Array.from(client?.guilds?.cache?.values?.() || [])
    .map((servidor) => ({ id: servidor.id, nome: servidor.name || 'Servidor sem nome' }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

function serializarUsuarioPokemon(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    globalName: usuario.globalName || usuario.username,
    avatar: usuario.displayAvatarURL?.({ size: 128, extension: 'png' }) || null,
  };
}

function dadosPerfilPokemon(userId, guildId) {
  const perfil = pokemon.obterPerfil(userId, guildId || null);
  const colecao = pokemon.listarColecao(userId, 50);
  const inventario = pokemon.obterInventario(userId);
  return {
    perfil,
    colecao: colecao.pokemon,
    colecaoTotal: colecao.total,
    especies: colecao.species,
    inventario: inventario.itens,
    preferencias: inventario.preferencias,
    missoes: pokemon.listarMissoes(userId),
  };
}

async function api(req, res, url, client) {
  const rota = url.pathname;

  if (rota === '/api/perfil') {
    const username = url.searchParams.get('username');
    const encontrados = buscarUsuariosPorUsername(client, username);
    if (!encontrados) return json(res, 400, { erro: 'Digite um username válido do Discord, sem espaços.' });
    if (!encontrados.length) {
      return json(res, 404, { erro: 'Username não encontrado entre as contas que a Mila conhece. Talvez o bot ainda não tenha visto essa pessoa.' });
    }
    if (encontrados.length > 1) {
      return json(res, 409, {
        erro: 'Mais de uma conta conhecida corresponde a esse username. Refine a busca ou consulte pelo comando /perfil no Discord.',
      });
    }
    return json(res, 200, await dadosPerfil(client, encontrados[0].id, encontrados[0]));
  }

  if (rota === '/api/pokemon/servidores') {
    return json(res, 200, { servidores: listarServidores(client) });
  }

  if (rota === '/api/pokemon/loja') {
    return json(res, 200, { categorias: pokemon.listarCategorias() });
  }

  if (rota === '/api/pokemon/info') {
    const consulta = String(url.searchParams.get('pokemon') || '').trim();
    if (!consulta || consulta.length > 50 || !/^[a-z0-9 -]+$/i.test(consulta)) {
      return json(res, 400, { erro: 'Informe um nome ou número de Pokémon válido.' });
    }
    const especie = await pokemon.obterPokemon(consulta);
    if (!especie) return json(res, 404, { erro: 'Não encontrei esse Pokémon na Pokédex.' });
    return json(res, 200, { pokemon: especie });
  }

  if (rota === '/api/pokemon/ranking') {
    const escopo = url.searchParams.get('escopo') === 'servidor' ? 'servidor' : 'global';
    const servidorId = url.searchParams.get('servidor');
    if (escopo === 'servidor' && !listarServidores(client).some((servidor) => servidor.id === servidorId)) {
      return json(res, 400, { erro: 'Escolha um servidor em que a Mila esteja.' });
    }
    const entradas = escopo === 'servidor'
      ? pokemon.rankingServidor(servidorId, 10)
      : pokemon.ranking(10);
    const usuarios = new Map(listarUsuariosConhecidos(client).map((usuario) => [usuario.id, usuario]));
    const classificacao = await Promise.all(entradas.map(async (entrada, indice) => {
      let usuario = usuarios.get(entrada.user_id) || null;
      if (!usuario && client) {
        try {
          usuario = await client.users.fetch(entrada.user_id);
          usuarios.set(entrada.user_id, usuario);
        } catch {
          usuario = null;
        }
      }
      return {
        ...entrada,
        posicao: indice + 1,
        usuario: usuario ? serializarUsuarioPokemon(usuario) : null,
      };
    }));
    return json(res, 200, {
      escopo,
      servidor: escopo === 'servidor' ? listarServidores(client).find((item) => item.id === servidorId) : null,
      entradas: classificacao,
    });
  }

  if (rota === '/api/pokemon/perfil') {
    const username = url.searchParams.get('username');
    const encontrados = buscarUsuariosPorUsername(client, username);
    if (!encontrados) return json(res, 400, { erro: 'Digite um username global válido do Discord, sem espaços.' });
    if (!encontrados.length) {
      return json(res, 404, { erro: 'Username não encontrado entre as contas que a Mila conhece. Talvez o bot ainda não tenha visto essa pessoa.' });
    }
    if (encontrados.length > 1) {
      return json(res, 409, {
        erro: 'Mais de uma conta conhecida corresponde a esse username.',
      });
    }
    const usuario = encontrados[0];
    const servidores = listarServidores(client);
    const servidorId = url.searchParams.get('servidor');
    if (servidorId && !servidores.some((servidor) => servidor.id === servidorId)) {
      return json(res, 400, { erro: 'Escolha um servidor em que a Mila esteja.' });
    }
    const dados = dadosPerfilPokemon(usuario.id, servidorId);
    return json(res, 200, {
      usuario: serializarUsuarioPokemon(usuario),
      servidor: servidorId ? servidores.find((servidor) => servidor.id === servidorId) : null,
      ...dados,
    });
  }

  if (rota === '/api/temas') {
    return json(res, 200, { temas: listarTemas(), padrao: normalizarTema(null) });
  }

  if (rota === '/api/status') {
    const uptime = Math.floor(process.uptime());
    return json(res, 200, {
      online: Boolean(client?.isReady?.()),
      nome: client?.user?.username || 'Mila',
      avatar: client?.user?.displayAvatarURL?.({ size: 256 }) || null,
      guilds: client?.guilds?.cache?.size || 0,
      ping: Math.max(0, Math.round(client?.ws?.ping || 0)),
      uptime,
      memoriaMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      temas: listarTemas().map((t) => ({ id: t.id, nome: t.nome, emoji: t.emoji })),
      hora: new Date().toISOString(),
    });
  }

  if (rota === '/api/loja') {
    return json(res, 200, { categorias: loja.listarPorCategoria() });
  }

  if (rota === '/api/comandos') {
    const comandos = listarComandosSite();
    return json(res, 200, {
      comandos,
      categorias: CATEGORIAS,
      total: comandos.length,
      prefixoPadrao: '$',
      observacao: 'Os exemplos usam o prefixo padrão; cada servidor pode personalizá-lo. Os comandos slash disponíveis aparecem no Discord.',
      avisos: avisosComandosSlash,
    });
  }

  if (rota === '/api/ranking') {
    const categoria = url.searchParams.get('categoria') === 'xp' ? 'xp' : 'money';
    const limite = Math.max(1, Math.min(50, Number(url.searchParams.get('limite')) || 10));
    const entradas = service.ranking(categoria, limite);
    const comNomes = await Promise.all(
      entradas.map(async (e) => {
        let usuario = null;
        if (client) {
          try {
            const u = await client.users.fetch(e.id);
            usuario = { username: u.username, globalName: u.globalName || u.username, avatar: u.displayAvatarURL?.({ size: 64 }) || null };
          } catch {
            usuario = null;
          }
        }
        return { ...e, usuario };
      })
    );
    return json(res, 200, { categoria, entradas: comNomes });
  }

  if (rota.startsWith('/api/perfil/')) {
    const id = rota.split('/').pop();
    const dados = await dadosPerfil(client, id);
    if (!dados) return json(res, 404, { erro: 'Perfil não encontrado.' });
    return json(res, 200, dados);
  }

  if (rota.startsWith('/api/servidor/')) {
    const id = rota.split('/').pop();
    const cfg = obterConfig(id);
    return json(res, 200, {
      servidor: id,
      temaEconomia: cfg.temaEconomia,
      prefixo: cfg.prefixo,
      idioma: cfg.idioma,
    });
  }

  if (rota === '/api/conquistas') {
    return json(res, 200, {
      conquistas: service.CONQUISTAS.map((c) => ({
        id: c.id,
        nome: c.nome,
        emoji: c.emoji,
        descricao: c.descricao,
      })),
    });
  }

  return json(res, 404, { erro: 'Rota de API não encontrada.' });
}

function criarServidor(client) {
  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        return texto(res, 405, 'Método não permitido');
      }

      if (url.pathname.startsWith('/api/')) {
        return await api(req, res, url, client);
      }

      if (url.pathname === '/health') return json(res, 200, { ok: true });

      const caminho = resolverPublico(url.pathname);
      if (!caminho) return texto(res, 403, 'Acesso negado');
      if (!fs.existsSync(caminho) || !fs.statSync(caminho).isFile()) {
        // SPA-ish: rotas desconhecidas voltam para index.html
        return servirArquivo(res, path.join(PUBLIC_DIR, 'index.html'));
      }
      return servirArquivo(res, caminho);
    } catch (erro) {
      console.error('Erro no site da Mila:', erro?.message || erro);
      return texto(res, 500, 'Erro interno');
    }
  });

  return servidor;
}

/**
 * Sobe o site. Retorna o servidor HTTP ou null se WEB_ATIVO não estiver ligado.
 */
function iniciarServidorWeb(client) {
  // Liga junto com o bot por padrão. Só desliga com WEB_ATIVO=false.
  const ativo = String(process.env.WEB_ATIVO ?? 'true').toLowerCase() !== 'false';
  if (!ativo) return null;

  const porta = Math.max(1, Number(process.env.WEB_PORT) || 3000);
  const host = process.env.WEB_HOST || '0.0.0.0';
  const servidor = criarServidor(client);

  servidor.on('error', (erro) => {
    if (erro?.code === 'EADDRINUSE') {
      console.warn(`⚠️ A porta ${porta} já está em uso — o site deve estar rodando em outro processo.`);
      return;
    }
    console.error(`❌ Site da Mila não subiu na porta ${porta}:`, erro?.message || erro);
  });

  servidor.listen(porta, host, () => {
    const publico = process.env.WEB_PUBLIC_URL || `http://localhost:${porta}`;
    console.log(`🌐 Site da Mila no ar em ${publico} (host ${host}:${porta})`);
  });

  return servidor;
}

module.exports = { iniciarServidorWeb, criarServidor };
