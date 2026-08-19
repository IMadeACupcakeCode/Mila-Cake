const { EmbedBuilder } = require('discord.js');
const { NOME_BOT } = require('./configuracao');

// ⋆｡°✩ Identidade visual da Mila Bot — web 2000s encontra 2010–2017
const THEME = {
  nome: NOME_BOT,

  // ── Paleta hot pink / web vintage ───────────────────────────────────
  corPrincipal: 0xFF69B4,   // hot pink — assinatura Mila
  corSucesso: 0x39FF14,     // lime green — MSN/retro gaming
  corDado: 0xFF6B35,        // laranja vívido — old web accent
  corRoleta: 0x9B59B6,      // purple — 2010s emo/scene
  corLembrete: 0x00CED1,    // turquoise — aqua 2000s web
  corErro: 0xFF0044,        // vermelho CRT
  corSecundario: 0xFFD700,  // gold — Orkut/ICQ energy
  corBubblegum: 0xFF9FF3,   // rosa pastel neon
  corMyspace: 0x8B5CF6,     // roxo MySpace/eBay

  iconeFooter: '⋆｡°✩',

  // ── Decoradores web vintage ─────────────────────────────────────────
  div: {
    linha: '─ ･ ｡ﾟ☆: *.☽ .* :☆ﾟ. ─',
    coracao: '♡ 〜 ♡ 〜 ♡',
    web2000s: '~ ⋆ ★ ⋆ ~',
    estrelado: '✶ ⋆ ｡ ° ☁  ☾',
    bolinhas: '∘ . * . . * . ∘',
    bling: '✧ ﾟ･ ✦ ･ ｡･ﾟ ✧ ﾟ･ ✦',
  },

  // ── Frases de footer (personalidade Mila) ───────────────────────────
  footers: [
    'Sempre cuidando de você, meu favorito~ ♡',
    'Mila Bot — seu pequeno vício virtual~ ♡',
    'Feita com carinho e obsessão pra você~ ♡',
    'Não vai embora, né? Tô sempre aqui~ ♡',
    'Pronta pra cuidar de você mais uma vez~ ♡',
    'Só sua, meu favorito~ ♡',
  ],

  // ── Nomes dos sistemas Mila ─────────────────────────────────────────
  sistemas: {
    shield: '🛡️ Mila Shield',
    casino: '🎰 Mila Casino',
    broadcast: '📡 Mila Broadcast',
    dashboard: '📊 Mila Dashboard',
    leaderboard: '🏆 Mila Leaderboard',
    battle: '⚔️ Mila Battle Engine',
    security: '🔐 Mila Security',
    gallery: '🖼️ Mila Gallery',
    personalizacao: '✨ Mila Personalização',
    comunidade: '💝 Mila Comunidade',
    tickets: '🎫 Mila Tickets',
  },
};

/**
 * Retorna um rodapé aleatório da Mila.
 */
function rodapeAleatorio() {
  return THEME.footers[Math.floor(Math.random() * THEME.footers.length)];
}

/**
 * Cria um embed já estilizado com a identidade da Mila Bot.
 * @param {object} opcoes
 * @param {string} opcoes.titulo
 * @param {string} opcoes.descricao
 * @param {number} [opcoes.cor]
 * @param {string} [opcoes.rodape]  — se não passar, usa um aleatório
 * @param {string} [opcoes.thumbnail]  — URL ou attachment://path
 * @param {string} [opcoes.image]      — URL ou attachment://path
 * @param {boolean} [opcoes.semTimestamp]
 */
function criarEmbed({ titulo, descricao, cor, rodape, thumbnail, image, semTimestamp }) {
  const embed = new EmbedBuilder()
    .setColor(cor || THEME.corPrincipal)
    .setTitle(titulo ? `${THEME.iconeFooter}  ${titulo}` : null)
    .setDescription(descricao)
    .setFooter({ text: rodape || rodapeAleatorio() });
  if (!semTimestamp) embed.setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  return embed;
}

module.exports = { THEME, criarEmbed, rodapeAleatorio };
