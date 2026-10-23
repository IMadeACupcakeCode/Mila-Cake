const { THEME } = require('../utils/theme');
const db = require('../utils/db');
const arcade = require('../utils/arcade');

module.exports = {
  data: {
    name: 'ranking',
    description: 'Acompanhe os top líderes confeiteiros do servidor! 🏆',
    options: [
      {
        name: 'categoria',
        description: 'Ranking de XP (Nível) ou Economia (Açúcares)',
        type: 3,
        required: false,
        choices: [
          { name: '🏆 Nível (XP)', value: 'xp' },
          { name: '🍬 Dinheiro (Açúcares)', value: 'money' },
        ],
      },
    ],
  },
  async execute(interaction) {
    const modo = interaction.options?.getString('categoria') || 'xp';
    const isMoney = modo === 'money';
    const top = isMoney ? db.getTopAcucares(10) : db.getTopLevel(10);

    if (!top.length) {
      return interaction.reply({
        embeds: [
          arcade.embedArcade({
            titulo: '🏆 Ranking vazio',
            descricao:
              `${THEME.div.bolinhas}\n\n` +
              'Ninguém pontuou ainda. Converse, jogue e resgate o diário para inaugurar o placar.\n\n' +
              `${THEME.div.coracao}`,
            cor: THEME.corSecundario,
          }),
        ],
      });
    }

    const medalhas = ['🥇', '🥈', '🥉'];
    const maxValor = isMoney
      ? Math.max(...top.map((e) => Number(e.acucares) || 0), 1)
      : Math.max(...top.map((e) => Number(e.xp) || 0), 1);

    const linhas = top.map((entry, index) => {
      const tag = medalhas[index] || `**#${index + 1}**`;
      if (isMoney) {
        const valor = Number(entry.acucares) || 0;
        const barra = arcade.barra(valor, maxValor, 10, '🟨', '⬛');
        return `${tag} <@${entry.id}> — **${valor.toLocaleString('pt-BR')}** 🍬\n${barra}`;
      }
      const valor = Number(entry.xp) || 0;
      const barra = arcade.barra(valor, maxValor, 10, '🟩', '⬛');
      return `${tag} <@${entry.id}> — **Nível ${entry.level}** · \`${valor}\` XP\n${barra}`;
    });

    const lider = top[0];
    const embed = arcade.embedArcade({
      titulo: isMoney ? '🏆 Os Mais Ricos em Açúcares' : '🏆 Maiores Níveis da Mila',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `${linhas.join('\n')}\n\n` +
        `${THEME.div.linha}\n\n` +
        `👑 **Líder:** <@${lider.id}> · ` +
        (isMoney
          ? `\`${(Number(lider.acucares) || 0).toLocaleString('pt-BR')}\` 🍬`
          : `Nível \`${lider.level}\` · \`${lider.xp}\` XP`) +
        `\n\n${THEME.div.estrelado}`,
      cor: isMoney ? 0xF59E0B : THEME.corRoleta,
      campos: [
        {
          name: '📊 Categoria',
          value: isMoney ? '🍬 Açúcares' : '🏆 Nível / XP',
          inline: true,
        },
        {
          name: '👥 Participantes',
          value: `\`${top.length}\``,
          inline: true,
        },
        {
          name: '📈 Base do ranking',
          value: isMoney ? `\`${maxValor.toLocaleString('pt-BR')}\` 🍬` : `\`${maxValor}\` XP`,
          inline: true,
        },
      ],
      rodape: 'Mila Leaderboard · top 10 do servidor',
    });

    await interaction.reply({ embeds: [embed] });
  },
};
