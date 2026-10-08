const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const PRECO_ROLETA = 100;
// Lista de Cards com chances ponderadas de sair (1 = Raro, 10 = Especial, 50 = Incomum, 100 = Comum)
const CARDS = [
  { id: 'card_cupcake', name: '🧁 Cupcake Comum', rarity: 'Comum', weight: 100, visual: 'https://i.imgur.com/uR1QzQn.png' },
  { id: 'card_donut', name: '🍩 Donut Glaceado', rarity: 'Comum', weight: 100, visual: 'https://i.imgur.com/C7WlOQJ.png' },
  { id: 'card_trufado', name: '🍫 Bolo Trufado', rarity: 'Incomum', weight: 50, visual: 'https://i.imgur.com/Y3v1L75.png' },
  { id: 'card_macaron', name: '🍡 Macaron Mágico', rarity: 'Especial', weight: 10, visual: 'https://i.imgur.com/uA3xNqX.png' },
  { id: 'card_mila', name: '✨ Mila Supremo', rarity: 'Raro', weight: 1, visual: 'https://i.imgur.com/M6L2yH9.png' }
];

function pickRandomCard() {
  const totalWeight = CARDS.reduce((sum, c) => sum + c.weight, 0);
  let r = Math.random() * totalWeight;
  for (let card of CARDS) {
    if (r < card.weight) return card;
    r -= card.weight;
  }
  return CARDS[0]; // Fallback
}

module.exports = {
  data: {
    name: 'coletar',
    description: `Gira a roleta de doces puxando uma carta aleatória (custa ${PRECO_ROLETA} 🍬)`,
  },
  async execute(interaction) {
    const usuario = db.getUsuario(interaction.user.id);

    if (usuario.acucares < PRECO_ROLETA) {
      return interaction.reply({ content: `❌ Você não tem a ficha da máquina! Custa **${PRECO_ROLETA} 🍬**, mas você só tem **${usuario.acucares} 🍬**. Tente voltar amanhã pra usar o /diario!`, ephemeral: true });
    }

    // Processa a grana do giro
    db.addAcucares(interaction.user.id, -PRECO_ROLETA);
    const drop = pickRandomCard();
    db.addInventario(interaction.user.id, drop.name, 1); // Salva no SQLite o drop pelo Nome

    let colorInfo = THEME.corDado;
    if (drop.rarity === 'Incomum') colorInfo = THEME.corInfo;
    if (drop.rarity === 'Especial') colorInfo = THEME.corSucesso;
    if (drop.rarity === 'Raro') colorInfo = THEME.corPrincipal;

    const embed = criarEmbed({
      titulo: '🎰 Roleta de Colecionáveis girou...',
      descricao: `**O que será que veio?**\nVocê gastou ${PRECO_ROLETA} 🍬 na máquina e ouviu um *plim*!\n\n${THEME.div.estrelado}\n\n🎉 Parabéns! Você tirou o personagem: **${drop.name}**\n**Raridade:** \`${drop.rarity}\``,
      cor: colorInfo,
      // Se tivéssemos imagens hosteds, dropariamos no .image ou URL original
    });

    // Option pra abrir/ver a mochila imediatamente
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
          .setCustomId('btn_dummy_rolou')
          .setLabel('Guardado na Mochila!')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
