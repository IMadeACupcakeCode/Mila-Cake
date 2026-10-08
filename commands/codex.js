const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { CATEGORIAS, COMANDOS, TOTAL } = require('../utils/codexData');
const { linhaNavegacao, menuPular, aproximar, EmbedBuilder } = require('../utils/ui');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const { SlashCommandBuilder } = require('discord.js');

const AUTOR_COVER =
  `${THEME.iconeFooter} ⋆｡°✩ Arquivos Mila\n` +
  `Um arquivo de comandos da **${THEME.nome}**.\n` +
  `Feitos com carinho e obsessão pra você~ ♡\n\n` +
  `↻ Use os botões para folhear as páginas.\n` +
  `⤵️ Use o menu para pular direto a um comando.\n` +
  `🔎 Ou busque: \`$codex nome\` para ir direto a um comando.\n\n` +
  `Total de comandos: **${TOTAL}** no total.`;

function renderizarPagina(indice) {
  if (indice === 0) {
    const categorias = Object.values(CATEGORIAS)
      .map((c) => `${c.emoji} **${c.nome}**`)
      .join('   ');
    const embed = criarEmbed({
      titulo: '📖 ⋆｡°✩ Arquivos Mila',
      descricao: AUTOR_COVER,
      cor: THEME.corPrincipal,
      rodape: `Página 1/${TOTAL + 1} • Mila Bot`,
    })
    .addFields(
      { name: '✦ Seções', value: categorias, inline: false },
      {
        name: '✦ Como folhear',
        value:
          '`⏮️` primeira · `◀️` anterior · `▶️` próxima · `⏭️` última\n' +
          '`⤵️ menu` — escolha um comando e vá até ele\n' +
          '`🔎 busca` — ache o comando mais parecido com o nome digitado',
        inline: false,
      }
    );
    return embed;
  }

  const cmd = COMANDOS[indice - 1];
  const cat = CATEGORIAS[cmd.categoria];
  const embed = criarEmbed({
    titulo: `${cmd.emoji} ${cmd.nome}`,
    descricao: cmd.descricao,
    cor: cat.cor,
    rodape: `Página ${indice + 1}/${TOTAL + 1} • Mila Bot`,
  })
  .addFields(
    { name: '📚 Seção', value: `${cat.emoji} ${cat.nome}`, inline: true },
    { name: '⌨️ Como usar', value: cmd.uso, inline: false },
    { name: '✨ Exemplo', value: cmd.exemplo, inline: false }
  );
  return embed;
}

function paginaDaInteracao(interaction) {
  const rodape = interaction.message?.embeds?.[0]?.footer?.text || '';
  const match = rodape.match(/Página\s+(\d+)\/(\d+)/i);
  return match ? Math.max(0, Math.min(TOTAL, Number(match[1]) - 1)) : 0;
}

async function tratarComponente(interaction) {
  if (!interaction.customId.startsWith('codex_')) return false;

  let pagina = paginaDaInteracao(interaction);
  if (interaction.customId === 'codex_first') pagina = 0;
  else if (interaction.customId === 'codex_prev') pagina = Math.max(0, pagina - 1);
  else if (interaction.customId === 'codex_next') pagina = Math.min(TOTAL, pagina + 1);
  else if (interaction.customId === 'codex_last') pagina = TOTAL;
  else if (interaction.customId === 'codex_jump') pagina = Number(interaction.values?.[0]) || 0;
  else return false;

  await interaction.update({ embeds: [renderizarPagina(pagina)], components: componentes(pagina) });
  return true;
}

function componentes(indice) {
  const ultimo = TOTAL;
  const nav = linhaNavegacao('codex', {
    first: indice === 0,
    prev: indice === 0,
    next: indice === ultimo,
    last: indice === ultimo,
  });

  const opcoes = COMANDOS.map((c) => ({
    label: `${c.emoji} ${c.nome}`,
    value: String(COMANDOS.indexOf(c) + 1),
    description: c.descricao.slice(0, 80),
    emoji: c.emoji,
  }));

  const inicio = Math.floor(Math.max(0, indice - 1) / 24) * 24;
  const janela = opcoes.slice(inicio, inicio + 24);
  const menu = menuPular(
    'codex',
    `⤵️ Comandos ${inicio + 1}–${Math.min(inicio + 24, opcoes.length)}...`,
    janela.map((opcao) => ({ ...opcao, value: String(Number(opcao.value)) })),
  );
  return [nav, menu];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('codex')
    .setDescription('📖 Abre o arquivo de comandos da Mila')
    .addStringOption((option) => option
      .setName('termo')
      .setDescription('Comando ou termo para buscar')
      .setRequired(false)
      .setMaxLength(100)),
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);
    const termo = interaction.options.getString('termo');
    const encontrado = termo ? aproximar(termo, COMANDOS) : null;
    const indice = encontrado ? COMANDOS.indexOf(encontrado) + 1 : 0;
    return interaction.reply({ embeds: [renderizarPagina(indice)], components: componentes(indice) });
  },
  buscar: (termo) => aproximar(termo, COMANDOS),
  renderizarPagina,
  componentes,
  tratarComponente,
  paginaDaInteracao,
  TOTAL,
};
