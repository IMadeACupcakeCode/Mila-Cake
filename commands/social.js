const { ActionRowBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { botao } = require('../utils/ui');

module.exports = {
  data: { name: 'social', description: '👤 Cartão de perfil do usuário' },
  async execute(interaction) {
    const user = interaction.options.getUser('usuario') || interaction.user;
    const member = interaction.guild?.members.cache.get(user.id);
    const cargo = member?.roles.highest?.name || '—';

    const embed = criarEmbed({
      titulo: `👤 ${user.username}`,
      descricao:
        `**Tag:** \`${user.tag}\`\n` +
        `**ID:** \`${user.id}\`\n` +
        `**Entrou em:** ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '—'}\n` +
        `**Cargo topo:** ${cargo}\n` +
        `**Criado em:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
      cor: THEME.corPrincipal,
      rodape: rodapeAleatorio(),
    }).setThumbnail(user.displayAvatarURL({ size: 256 }));

    const row = new ActionRowBuilder().addComponents(
      botao('🖼️ Ver avatar', 'social_avatar', ButtonStyle.Primary, '🖼️'),
      botao('🤗 Abraçar', 'social_abraco', ButtonStyle.Secondary, '🤗')
    );

    const resposta = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
    const coletor = resposta.createMessageComponentCollector({ time: 60000, filter: () => true });
    coletor.on('collect', async (i) => {
      if (i.customId === 'social_avatar') {
        await i.reply({ content: user.displayAvatarURL({ size: 512 }), ephemeral: true });
      } else if (i.customId === 'social_abraco') {
        await i.reply({ content: `🤗 ${interaction.user} te abraça, ${user}!`, ephemeral: false });
      }
    });
    coletor.on('end', async () => {
      try {
        await resposta.edit({ components: [] });
      } catch {}
    });
  },
};
