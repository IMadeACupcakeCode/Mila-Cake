const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

module.exports = {
  data: {
    name: 'colecao',
    description: 'Vê as cartas e itens colecionáveis na sua mochila',
    options: [
      {
        name: 'usuario',
        description: 'Qual mochila?',
        type: 6, // USER
        required: false
      }
    ]
  },
  async execute(interaction) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) return interaction.reply({ content: '❌ Máquinas não brincam com coleções...', ephemeral: true });

    // Consulta os itens a partir do join no banco
    const items = db.getInventario(alvo.id);

    if (items.length === 0) {
      return interaction.reply({ content: `🎒 A mochila de **${alvo.username}** está tão vazia que tem até teia de aranha por lá...\nRecomendo usar o \`/coletar\` para começar a jornada!`, ephemeral: true });
    }

    const textoFormatado = items.map(inv => `**${inv.quantidade}x** — ${inv.item_id}`).join('\n');

    const embed = criarEmbed({
      titulo: `🎒 Coleção de ${alvo.username}`,
      descricao: `Olha quanta coisa temos guardada por aqui!\n\n${THEME.div.bolinhas}\n\n${textoFormatado}`,
      cor: THEME.corBubblegum
    });

    await interaction.reply({ embeds: [embed] });
  }
};
