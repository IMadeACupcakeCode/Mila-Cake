const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

let clientId = process.env.CLIENT_ID;
if (!clientId) {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    if (fs.existsSync(envPath)) {
      const match = fs.readFileSync(envPath, 'utf8').match(/^CLIENT_ID=([\w\d]+)/m);
      if (match) clientId = match[1];
    }
  } catch {}
}
if (!clientId) clientId = 'SEU_CLIENT_ID';

module.exports = {
  data: {
    name: 'convite',
    description: '💌 Me convide para o seu servidor!'
  },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);
    const link = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

    const btn = new ButtonBuilder().setLabel('💌 Adicionar Mila').setURL(link).setStyle(ButtonStyle.Link);
    const row = new ActionRowBuilder().addComponents(btn);

    const embed = criarEmbed({
      titulo: '💌 Me convide!',
      descricao: `${THEME.div.bolinhas}\n\nEstou pronta para ajudar seu servidor! Clique no botão abaixo para autorizar minha entrada.\n\n${THEME.div.coracao}`,
      cor: THEME.corPrincipal,
    });

    return interaction.reply({ embeds: [embed], components: [row] });
  }
};
