const { PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'aviso', description: '📢 Atalho de aviso em destaque no canal atual', options: [{ name: 'mensagem', description: 'Texto do aviso', type: 3, required: true, max_length: 2000 }] },
  async execute(interaction) {
    const msg = interaction.options.getString('mensagem');
    // ⋆｡°✩ Typing indicator antes de responder
    mostrarDigitando(interaction.channel, 600).catch(() => {});
    const embed = criarEmbed({
      titulo: '📢 Aviso',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `${msg}\n\n` +
        `${THEME.div.bolinhas}`,
      cor: THEME.corPrincipal,
      rodape: `Aviso por ${interaction.user.username} • ${THEME.nome}`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};