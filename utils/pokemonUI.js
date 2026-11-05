// ⋆｡°✩ UI do universo Pokémon da Mila.
// Um kit pequeno de peças visuais reutilizadas pela coleção, mochila, loja,
// perfil, ranking, encontros e capturas. A ideia é simples: cada tela deve
// parecer um cartão de jogo — barras, etiquetas, ícones e botões — sem perder
// a legibilidade do Discord.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { criarEmbed, THEME } = require('./theme');
const { formatarNumero } = require('./economyTheme');

const TIPOS = {
  normal: { nome: 'Normal', emoji: '⚪' },
  fire: { nome: 'Fogo', emoji: '🔥' },
  water: { nome: 'Água', emoji: '💧' },
  electric: { nome: 'Elétrico', emoji: '⚡' },
  grass: { nome: 'Planta', emoji: '🍃' },
  ice: { nome: 'Gelo', emoji: '❄️' },
  fighting: { nome: 'Lutador', emoji: '🥊' },
  poison: { nome: 'Veneno', emoji: '☠️' },
  ground: { nome: 'Terra', emoji: '⛰️' },
  flying: { nome: 'Voador', emoji: '🪶' },
  psychic: { nome: 'Psíquico', emoji: '🔮' },
  bug: { nome: 'Inseto', emoji: '🐛' },
  rock: { nome: 'Pedra', emoji: '🪨' },
  ghost: { nome: 'Fantasma', emoji: '👻' },
  dragon: { nome: 'Dragão', emoji: '🐉' },
  dark: { nome: 'Sombrio', emoji: '🌑' },
  steel: { nome: 'Aço', emoji: '⚙️' },
  fairy: { nome: 'Fada', emoji: '🎀' },
};

const RARIDADE_COR = {
  comum: 0xb8c4d9,
  incomum: 0x69d16f,
  raro: 0x5aa9ff,
  epico: 0xb779ff,
  lendario: 0xffc94d,
  mitico: 0xff7ad9,
};

function numero(valor) {
  return formatarNumero(valor);
}

function pct(valor, maximo) {
  if (!maximo) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(valor) || 0) / maximo * 100)));
}

function barra(valor, maximo, tamanho = 10, cheio = '▰', vazio = '▱') {
  const seguro = Math.max(0, Math.min(tamanho, Math.round((Number(valor) || 0) / Math.max(1, Number(maximo) || 1) * tamanho)));
  return `${cheio.repeat(seguro)}${vazio.repeat(Math.max(0, tamanho - seguro))}`;
}

function barraHp(hp, hpMax, tamanho = 10) {
  const cheio = hp <= 0 ? '▱' : hp / Math.max(1, hpMax) <= 0.25 ? '🟥' : hp / Math.max(1, hpMax) <= 0.5 ? '🟨' : '🟩';
  if (['🟥', '🟨', '🟩'].includes(cheio)) return barra(hp, hpMax, tamanho, cheio, '⬛');
  return '▱'.repeat(tamanho);
}

function tag(texto) {
  return `\`${String(texto).replace(/`/g, '').slice(0, 40)}\``;
}

function tipoInfo(tipo) {
  const chave = String(tipo || '').toLowerCase();
  return TIPOS[chave] || { nome: chave ? chave[0].toUpperCase() + chave.slice(1) : '???', emoji: '❔' };
}

function tipoTag(tipo) {
  const info = tipoInfo(tipo);
  return `${info.emoji} ${info.nome}`;
}

function tiposLinha(types = []) {
  return types.length ? types.map(tipoTag).join(' · ') : '`sem tipo registrado`';
}

function fraquezasLinha(fraquezas = []) {
  return fraquezas.length
    ? fraquezas.map((f) => `${tipoTag(f.tipo)} \`x${f.mult}\``).join(' · ')
    : '`nenhuma fraqueza`';
}

function corDeRaridade(raridade) {
  const chave = typeof raridade === 'string'
    ? raridade.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    : '';
  return RARIDADE_COR[chave] || THEME.corBubblegum;
}

function corPokemon(pokemon) {
  if (pokemon?.shiny) return 0xffd700;
  if (pokemon?.rarity) return corDeRaridade(pokemon.rarity.nome || pokemon.rarity.id);
  return THEME.corBubblegum;
}

/**
 * Embed base do universo Pokémon. O autor funciona como HUD do treinador e o
 * rodapé carrega página/contexto. Campos recebem o mesmo tratamento de limite
 * usado pelo restante da Mila.
 */
function embedHUD({
  titulo,
  descricao,
  cor = THEME.corBubblegum,
  autorNome,
  autorIcone,
  thumbnail,
  imagem,
  rodape,
  campos = [],
  url,
}) {
  const embed = criarEmbed({
    titulo,
    descricao,
    cor,
    thumbnail,
    image: imagem,
    rodape,
  });
  if (url) embed.setURL(url);
  if (autorNome) {
    embed.setAuthor({ name: String(autorNome).slice(0, 256), iconURL: autorIcone || undefined });
  }
  const fields = (campos || [])
    .filter((campo) => campo && campo.name && campo.value)
    .slice(0, 25)
    .map((campo) => ({
      name: String(campo.name).slice(0, 256),
      value: String(campo.value).slice(0, 1024),
      inline: Boolean(campo.inline),
    }));
  if (fields.length) embed.addFields(fields);
  return embed;
}

function linha(...componentes) {
  return new ActionRowBuilder().addComponents(...componentes.filter(Boolean));
}

function botao({ id, label, emoji, estilo = ButtonStyle.Secondary, desabilitado = false }) {
  const b = new ButtonBuilder().setCustomId(id).setStyle(estilo).setLabel(label);
  if (emoji) b.setEmoji(emoji);
  if (desabilitado) b.setDisabled(true);
  return b;
}

function linhaNavegacao(prefixo, indice, total, extras = []) {
  const primeiro = indice <= 0;
  const ultimo = indice >= total - 1;
  return linha(
    botao({ id: `${prefixo}_first`, emoji: '⏮️', label: 'Início', desabilitado: primeiro }),
    botao({ id: `${prefixo}_prev`, emoji: '◀️', label: 'Anterior', estilo: ButtonStyle.Primary, desabilitado: primeiro }),
    botao({ id: `${prefixo}_next`, emoji: '▶️', label: 'Próximo', estilo: ButtonStyle.Primary, desabilitado: ultimo }),
    botao({ id: `${prefixo}_last`, emoji: '⏭️', label: 'Fim', desabilitado: ultimo }),
    ...extras
  );
}

function linhaQuantidade({ prefixo, quantidade, min = 1, max = 99, extra = null }) {
  return linha(
    botao({ id: `${prefixo}_menos`, emoji: '➖', label: '1', desabilitado: quantidade <= min }),
    botao({ id: `${prefixo}_qtd`, label: `× ${quantidade}`, estilo: ButtonStyle.Secondary, desabilitado: true }),
    botao({ id: `${prefixo}_mais`, emoji: '➕', label: '1', estilo: ButtonStyle.Success, desabilitado: quantidade >= max }),
    botao({ id: `${prefixo}_digitar`, emoji: '⌨️', label: 'Digitar', estilo: ButtonStyle.Secondary }),
    extra
  );
}

function modalQuantidade(customId, { titulo = 'Quantidade', valor = 1, max = 99, label = 'Quantas unidades?' } = {}) {
  return new ModalBuilder()
    .setCustomId(customId)
    .setTitle(String(titulo).slice(0, 45))
    .addComponents(
      linha(
        new TextInputBuilder()
          .setCustomId('quantidade')
          .setLabel(String(label).slice(0, 45))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(3)
          .setValue(String(valor))
          .setPlaceholder(`1 a ${max}`)
      )
    );
}

function lerQuantidade(texto, { min = 1, max = 99, padrao = null } = {}) {
  const bruto = String(texto || '').trim();
  if (!bruto) return padrao;
  if (!/^\d{1,3}$/.test(bruto)) return null;
  const valor = Number(bruto);
  if (!Number.isInteger(valor) || valor < min || valor > max) return null;
  return valor;
}

function rotuloItem(item) {
  if (!item) return '`item desconhecido`';
  return `${item.emoji || '📦'} **${item.nome}**`;
}

function bonusItem(item) {
  if (!item) return '';
  if (item.garanteCaptura) return 'captura garantida';
  if (item.multiplicador && item.multiplicador > 1) return `+${Math.round((item.multiplicador - 1) * 100)}% captura`;
  if (item.curaHp) return item.curaHp >= 9999 ? 'cura total' : `cura ${item.curaHp} HP`;
  if (item.revive) return 'revive';
  if (item.curaStatus?.length) return 'cura status';
  if (item.xp) return `+${numero(item.xp)} XP`;
  if (item.tipo === 'cosmetico') return 'cosmético';
  if (item.tipo === 'evolucao') return 'evolução';
  if (item.tipo === 'consumivel') return '30 min de incenso';
  if (item.tipo === 'bola') return 'bola';
  return item.tipo || 'item';
}

/** Linha compacta usada nas listas de loja e mochila. */
function linhaItem(item, { quantidade = 0, selecionado = false, preco = null, equipado = false } = {}) {
  if (!item) return '';
  const marcador = selecionado ? '▶' : '▸';
  const precoTxt = preco === null ? '' : ` — **${numero(preco)}** 🍬`;
  const qtdTxt = quantidade > 0 ? ` · \`×${numero(quantidade)}\`` : '';
  const equipadoTxt = equipado ? ' · ✅' : '';
  return `${marcador} ${item.emoji || '📦'} **${item.nome}**${precoTxt}${qtdTxt}${equipadoTxt}`;
}

function detalheItem(item, { quantidade = 1, preco = null, possuido = 0 } = {}) {
  if (!item) return '`Escolha um item na vitrine para ver os detalhes.`';
  const linhas = [
    `${item.emoji || '📦'} **${item.nome}**  ·  ${tag(bonusItem(item))}`,
    item.descricao || 'Sem descrição.',
  ];
  if (preco !== null) linhas.push(`💵 Preço unitário: **${numero(preco)} 🍬**`);
  if (quantidade > 1 && preco !== null) linhas.push(`🧮 Total de **${quantidade}×**: **${numero(preco * quantidade)} 🍬**`);
  if (possuido > 0) linhas.push(`🎒 Você já tem **${numero(possuido)}** na mochila.`);
  return linhas.join('\n');
}

function resumoEquipamento(preferencias = {}) {
  return [
    `🔴 Pokébola: ${preferencias.equippedBall ? `\`${preferencias.equippedBall}\`` : '`pokebola`'}`,
    `🎨 Moldura: ${preferencias.equippedCosmetic ? `\`${preferencias.equippedCosmetic}\`` : '`nenhuma`'}`,
    `🪻 Incenso: ${preferencias.incenseUntil > Date.now() ? `<t:${Math.floor(preferencias.incenseUntil / 1000)}:R>` : '`inativo`'}`,
  ].join('\n');
}

function medalha(posicao) {
  return posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : `\`#${String(posicao).padStart(2, '0')}\``;
}

module.exports = {
  TIPOS,
  numero,
  pct,
  barra,
  barraHp,
  tag,
  tipoInfo,
  tipoTag,
  tiposLinha,
  fraquezasLinha,
  corDeRaridade,
  corPokemon,
  embedHUD,
  linha,
  botao,
  linhaNavegacao,
  linhaQuantidade,
  modalQuantidade,
  lerQuantidade,
  rotuloItem,
  bonusItem,
  linhaItem,
  detalheItem,
  resumoEquipamento,
  medalha,
};
