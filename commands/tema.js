const { obterConfig, salvarConfig } = require('../utils/servidorStore');
const { obterTema, listarTemas, escolhasTemas } = require('../utils/economyThemeData');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const { isStaff } = require('../utils/perms');

module.exports = {
  meta: { staff: true },
  data: {
    name: 'tema',
    description: '🪟 Escolha o tema visual da Economia neste servidor',
    options: [
      {
        name: 'escolher',
        description: 'Tema que será aplicado no servidor',
        type: 3,
        required: false,
        choices: escolhasTemas(),
      },
    ],
  },
  async execute(interaction, client) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: '❌ Apenas a equipe pode trocar o tema.', ephemeral: true });
    }

    const escolha = interaction.options?.getString('escolher');
    const cfg = obterConfig(interaction.guildId);

    if (escolha) {
      const novo = obterTema(escolha);
      cfg.temaEconomia = novo.id;
      salvarConfig(interaction.guildId, cfg);

      const embed = theme.janela({
        tema: novo,
        titulo: 'Tema aplicado',
        descricao:
          `${novo.emoji} **${novo.nome}** agora é o visual da Economia.\n\n` +
          `*${novo.descricao}*\n\n` +
          `${novo.divBase}`,
        cor: novo.cor,
        rodape: `${novo.rodape} · tema do servidor`,
      });

      return interaction.reply({ embeds: [embed] });
    }

    const atual = obterTema(cfg.temaEconomia);
    const embed = UI.embedTemas({ tema: atual, client, atual, temas: listarTemas() });
    await interaction.reply({
      embeds: [embed],
      components: [UI.botoesTema(listarTemas(), atual)],
    });
  },
};
