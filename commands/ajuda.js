const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: {
    name: 'ajuda',
    description: '📚 Mostra o painel de ajuda e comandos da Mila!'
  },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);

    const embed = criarEmbed({
      titulo: '📚 Central de Ajuda Mila',
      descricao: `${THEME.div.bolinhas}\n\nOlá, eu sou a Mila! Preparei o espaço abaixo para você navegar entre minhas funcionalidades.\n\nUse o menu selecionando uma categoria para ver meus comandos.\n\n${THEME.div.coracao}`,
      cor: THEME.corPrincipal,
    });

    const menu = new StringSelectMenuBuilder()
      .setCustomId('ajuda_menu')
      .setPlaceholder('Escolha uma categoria...')
      .addOptions([
        { label: '⚙️ Utilidade', value: 'utilidade', description: 'Comandos úteis (ping, idioma, prefixo)' },
        { label: '🎲 Diversão', value: 'diversao', description: 'Jogos (roleta, 8ball, forca)' },
        { label: '🛡️ Administração', value: 'admin', description: 'Moderação (limpar, configurar)' }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    const resposta = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const coletor = resposta.createMessageComponentCollector({ time: 60000, filter: i => i.user.id === interaction.user.id });

    coletor.on('collect', async i => {
      let desc = '';
      let tituloCat = '';

      switch (i.values[0]) {
        case 'utilidade':
          tituloCat = '⚙️ Utilidade';
          desc = `\`/ping\` - Ver latência da bot\n\`/prefixo\` - Alterar prefixo (para msgs)\n\`/idioma\` - Alterar idioma (WIP)\n\`/convite\` - Link para me convidar\n\`/lembrete\` - Criar lembretes úteis`;
          break;
        case 'diversao':
          tituloCat = '🎲 Diversão';
          desc = `\`/roleta\` - Sorte diária\n\`/forca\` - Jogo da forca clássico\n\`/8ball\` - Bola Mágica Responde\n\`/ship\` - Avalie o amor de duas pessoas`;
          break;
        case 'admin':
          tituloCat = '🛡️ Administração';
          desc = `\`/limpar\` - Apagar mensagens em massa\n\`/configurar\` - Ajustar configurações gerais da guia\n\`/organizar\` - Gerenciamento de tickets\n\`/anuncio\` - Criar anúncios interativos`;
          break;
      }

      const newEmbed = criarEmbed({
        titulo: tituloCat,
        descricao: `${THEME.div.bolinhas}\n\n${desc}\n\n${THEME.div.coracao}`,
        cor: THEME.corPrincipal
      });

      await i.update({ embeds: [newEmbed], components: [row] });
    });

    coletor.on('end', () => {
      resposta.edit({ components: [] }).catch(() => {});
    });
  }
};
