const { ActionRowBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { botao } = require('../utils/ui');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'avatar', description: '🖼️ Mostra o avatar de um usuário em tamanho grande' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 700);
    const user = interaction.options.getUser('usuario') || interaction.user;
    const url = user.displayAvatarURL({ size: 512 });
    const embed = criarEmbed({
      titulo: `🖼️ Avatar de ${user.username}`,
      descricao: `${THEME.div.bolinhas}\n\n[🔗 Abrir em tela cheia](${url})\n\n${THEME.div.estrelado}`,
      cor: THEME.corPrincipal,
      rodape: rodapeAleatorio(),
    }).setImage(url);

    const row = new ActionRowBuilder().addComponents(
      botao('🔗 Link', 'avatar_link', ButtonStyle.Link, '🔗').setURL(url)
    );
    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
