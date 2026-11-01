const db = require('../utils/db');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');

module.exports = {
  data: {
    name: 'colecao',
    description: '🎒 Veja as cartas e itens guardados na sua mochila',
    options: [
      {
        name: 'usuario',
        description: 'Ver a mochila de outra pessoa',
        type: 6,
        required: false,
      },
    ],
  },
  async execute(interaction, client) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) {
      return interaction.reply({ content: '❌ Máquinas não brincam com coleções...', ephemeral: true });
    }

    const tema = theme.temaDe(interaction);
    const itens = db.getInventario(alvo.id);
    const total = db.contarInventario(alvo.id);
    const distintos = db.contarItensDistintos(alvo.id);

    const embed = UI.embedColecao({
      tema,
      client,
      membro: alvo,
      itens,
      total,
      distintos,
    });

    await interaction.reply(UI.comMascote(embed));
  },
};
