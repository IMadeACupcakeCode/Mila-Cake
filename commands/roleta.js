const { criarEmbed, THEME } = require('../utils/theme');

module.exports = {
  data: { name: 'roleta', description: 'Sorteia uma opção entre várias, separadas por vírgula' },

  async execute(interaction) {
    const bruto = interaction.options.getString('opcoes');
    const opcoes = bruto
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (opcoes.length < 2) {
      const embedErro = criarEmbed({
        titulo: 'Opções insuficientes',
        descricao:
          'Preciso de **pelo menos duas opções**, separadas por vírgula.\n\n' +
          'Exemplo: `/roleta opcoes: pizza, sushi, hambúrguer`',
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    const escolhida = opcoes[Math.floor(Math.random() * opcoes.length)];
    const listaFormatada = opcoes
      .map((item) => (item === escolhida ? `**✧ ${item} ✧**` : `˖ ${item}`))
      .join('\n');

    const embed = criarEmbed({
      titulo: 'A roleta girou sob a lua',
      descricao:
        `${listaFormatada}\n\n` +
        `**✦ Escolhida: \`${escolhida}\`**`,
      cor: THEME.corRoleta,
      rodape: `${THEME.nome} girou para ${interaction.user.username}`,
    });

    await interaction.reply({ embeds: [embed] });
  },
};
