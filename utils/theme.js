const { EmbedBuilder } = require('discord.js');
const { NOME_BOT } = require('./configuracao');

// Identidade visual da Mila Bot — Fruit Aero / internet de 2012.
// A paleta é intencionalmente saturada: cada embed deve parecer uma pequena
// placa do mesmo guestbook, sem sacrificar a leitura do Discord.
const THEME = {
  nome: NOME_BOT,

  // ── Paleta Fruit Aero: céu, frutas e brilho de widget ────────────────
  corPrincipal: 0x7C5CFC,   // lavanda elétrica — navegação e informação
  corSucesso: 0x72D13D,     // maçã-lima — concluído
  corDado: 0xFF9F43,        // manga — jogos e sorte
  corRoleta: 0xD957D9,      // pitaya — acaso e festa
  corLembrete: 0x21C7D9,    // aqua — tempo e utilidade
  corErro: 0xF04D78,        // cereja — problema e bloqueio
  corSecundario: 0xFFD166,  // banana — atenção
  corBubblegum: 0xFF8FC7,   // chiclete — social
  corMyspace: 0x5F7CFF,     // blueberry — administração

  iconeFooter: '✦',

  // ── Decoradores: leves o bastante para não competir com o conteúdo ──
  div: {
    linha: '━━━━━━━━━━━━ ✦ ━━━━━━━━━━━━',
    coracao: '♡  ·  ♡  ·  ♡',
    web2000s: '✦ ｡ﾟ･ ｡ﾟ･ ✦',
    estrelado: '✧ ･ﾟ: *✧ ･ﾟ:*',
    bolinhas: '· ｡ﾟ✧ ｡ﾟ· ｡ﾟ✧ ｡ﾟ·',
    bling: '✦ ･ﾟ✧ ･ﾟ✦ ･ﾟ✧',
  },

  // ── Frases curtas: o rodapé assina a mensagem, não a repete ─────────
  footers: [
    'Mila Cake  ·  feito com carinho ♡',
    'Mila Cake  ·  seu guestbook digital ✦',
    'Mila Cake  ·  uma coisinha de cada vez',
    'Mila Cake  ·  sempre por perto ♡',
    'Mila Cake  ·  clique, escolha, descubra',
    'Mila Cake  ·  internet de 2012, coração de hoje',
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

/**
 * Cria uma embed DECORADA com divisores temáticos e formatação visual aprimorada.
 * Use esta função para todos os comandos que precisam de mais brilho.
 * @param {object} opcoes - Mesmos parâmetros de criarEmbed
 * @param {boolean} [opcoes.divisores=true] - Adiciona divisores bolinhas antes/depois da descrição
 */
function descricaoDecorada(descricao, estilo = 'bolinhas') {
  if (!descricao) return descricao;
  const divisor = THEME.div[estilo] || THEME.div.bolinhas;
  const jaDecorada = Object.values(THEME.div).some((item) => descricao.includes(item));
  return jaDecorada ? descricao : `${divisor}\n\n${descricao}\n\n${divisor}`;
}

function criarEmbedDecorada({ titulo, descricao, cor, rodape, thumbnail, image, semTimestamp, divisores = true }) {
  const descFormatada = divisores ? descricaoDecorada(descricao) : descricao;

  const embed = new EmbedBuilder()
    .setColor(cor || THEME.corPrincipal)
    .setTitle(titulo ? `${THEME.iconeFooter}  ${titulo}` : null)
    .setDescription(descFormatada)
    .setFooter({ text: rodape || rodapeAleatorio() });
  if (!semTimestamp) embed.setTimestamp();
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  return embed;
}

module.exports = { THEME, criarEmbed, criarEmbedDecorada, descricaoDecorada, rodapeAleatorio };
