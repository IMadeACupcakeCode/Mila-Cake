const db = require('../utils/db');
const theme = require('../utils/economyTheme');
const servidorStore = require('../utils/servidorStore');
const { configPadrao } = servidorStore;

module.exports = {
  meta: { staff: true, permissions: ['Administrator'] },
  data: {
    name: 'resetareconomia',
    description: '🛠️ (Admin) Reseta a economia de todos os membros deste servidor',
  },
  async execute(interaction) {
    const tema = theme.temaDe(interaction);
    if (!interaction.guildId) {
      return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Admin', 'Use este comando dentro de um servidor.')], ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    let ids = [];
    try {
      const members = await interaction.guild.members.fetch();
      ids = members.map((m) => m.id).filter((id) => !members.get(id)?.user?.bot);
    } catch (e) {
      // fallback: reset all users in db (not ideal, but ensures action)
    }

    // If fetch failed or empty, we cannot safely reset only this server.
    if (!ids.length) {
      return interaction.editReply({ content: 'Não foi possível obter os membros do servidor (verifique a intent de membros). Nada foi resetado.' });
    }

    const count = db.resetarEconomiaUsuarios(ids);
    try { servidorStore.salvarConfig(interaction.guildId, configPadrao()); } catch {}

    await interaction.editReply({ content: `Economia resetada para ${count} membro(s) deste servidor. Configuração do servidor restaurada.` });
  },
};
