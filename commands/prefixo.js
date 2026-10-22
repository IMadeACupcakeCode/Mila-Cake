const { criarEmbed, THEME } = require('../utils/theme');
const { obterConfig, salvarConfig } = require('../utils/servidorStore');
const { isStaff } = require('../utils/perms');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  meta: { guildOnly: true, staff: true },
  data: {
    name: 'prefixo',
    description: '⚙️ Altera o prefixo de comandos de texto da Mila',
    options: [
      {
        name: 'novo',
        description: 'Qual será o novo prefixo? (máx 5 caracteres)',
        type: 3, // STRING
        required: true
      }
    ]
  },
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Sem permissão', descricao: `${THEME.div.bolinhas}\n\nEste comando é restrito a staff.\n\n${THEME.div.coracao}`, cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    const novo = String(interaction.options.getString('novo') ?? '').trim();
    if (!novo) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Prefixo vazio', descricao: `${THEME.div.bolinhas}\n\nEscolha um prefixo com pelo menos 1 caractere (ex.: \`!\`, \`$\`, \`mila.\`).\n\n${THEME.div.coracao}`, cor: THEME.corErro })],
        ephemeral: true,
      });
    }
    if (novo.length > 5) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Prefixo muito longo', descricao: `${THEME.div.bolinhas}\n\nO prefixo deve ter no máximo 5 caracteres.\n\n${THEME.div.coracao}`, cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    const config = obterConfig(interaction.guildId);
    config.prefixo = novo;
    salvarConfig(interaction.guildId, config);

    await mostrarDigitando(interaction.channel, 600);

    const embed = criarEmbed({
      titulo: '⚙️ Prefixo Atualizado',
      descricao: `${THEME.div.bolinhas}\n\nO prefixo do servidor foi alterado com sucesso! Agora você pode usar os comandos com:\n\`${novo}comando\`\n\n${THEME.div.coracao}`,
      cor: THEME.corSucesso,
    });

    return interaction.reply({ embeds: [embed] });
  }
};
