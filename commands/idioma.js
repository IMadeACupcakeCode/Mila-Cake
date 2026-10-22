const { criarEmbed, THEME } = require('../utils/theme');
const { obterConfig, salvarConfig } = require('../utils/servidorStore');
const { isStaff } = require('../utils/perms');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  meta: { guildOnly: true, staff: true },
  data: {
    name: 'idioma',
    description: '⚙️ Altera o idioma da Mila no servidor (WIP)',
    options: [
      {
        name: 'novo',
        description: 'Qual será o novo idioma?',
        type: 3, // STRING
        required: true,
        choices: [
          { name: '🇧🇷 Português', value: 'pt-BR' },
          { name: '🇺🇸 English', value: 'en-US' }
        ]
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

    const novo = interaction.options.getString('novo');
    if (!['pt-BR', 'en-US'].includes(novo)) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Idioma inválido', descricao: `${THEME.div.bolinhas}\n\nEscolha entre **Português (Brasil)** ou **English (US)**.\n\n${THEME.div.bolinhas}`, cor: THEME.corErro })],
        ephemeral: true,
      });
    }
    const config = obterConfig(interaction.guildId);
    config.idioma = novo;
    salvarConfig(interaction.guildId, config);

    await mostrarDigitando(interaction.channel, 600);

    const textoIdioma = novo === 'pt-BR' ? 'Português (Brasil)' : 'English (US)';
    const embed = criarEmbed({
      titulo: '🌎 Idioma Atualizado',
      descricao: `${THEME.div.bolinhas}\n\nO idioma principal foi definido para **${textoIdioma}**!\n\n_Aviso: Mais traduções e novos idiomas chegarão em breve._\n\n${THEME.div.coracao}`,
      cor: THEME.corSucesso,
    });

    return interaction.reply({ embeds: [embed] });
  }
};
