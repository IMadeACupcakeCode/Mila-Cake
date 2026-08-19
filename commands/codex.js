const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { CATEGORIAS, COMANDOS, TOTAL } = require('../utils/codexData');
const { linhaNavegacao, menuPular, aproximar, EmbedBuilder } = require('../utils/ui');

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

  const menu = menuPular('codex', '⤵️ Pular para um comando...', opcoes);
  return [nav, menu];
}

module.exports = {
  buscar: (termo) => aproximar(termo, COMANDOS),
  renderizarPagina,
  componentes,
  TOTAL,
};
