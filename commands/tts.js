const { PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { IDIOMAS, PERFIS, obterTtsConfig, salvarTtsConfig, normalizarIdioma, normalizarPerfil, falar, formatarConfig } = require('../utils/tts');

const idiomaOpcoes = [...IDIOMAS].map((idioma) => ({ name: idioma, value: idioma }));
const perfilOpcoes = Object.keys(PERFIS).map((perfil) => ({ name: perfil, value: perfil }));

function admin(interaction) {
  return interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
}

module.exports = {
  meta: { guildOnly: true },
  data: {
    name: 'tts',
    description: '🗣️ Fala no canal de voz com voz gratuita do sistema',
    options: [
      { name: 'texto', description: 'Texto para falar', type: 3, required: false },
      { name: 'idioma', description: 'Idioma da voz', type: 3, required: false, choices: idiomaOpcoes },
      { name: 'perfil', description: 'Estilo ou sotaque', type: 3, required: false, choices: perfilOpcoes },
      { name: 'nome', description: 'Dizer o nome de quem digitou', type: 5, required: false },
    ],
  },
  async execute(interaction, client) {
    if (!admin(interaction)) return interaction.reply({ content: '❌ Apenas administradores podem configurar a voz.', ephemeral: true });
    const texto = interaction.options.getString('texto');
    const idioma = interaction.options.getString('idioma');
    const perfil = interaction.options.getString('perfil');
    const nome = interaction.options.getBoolean('nome');
    if (idioma || perfil || nome !== null) {
      if (idioma && !normalizarIdioma(idioma)) return interaction.reply({ content: '❌ Idioma inválido.', ephemeral: true });
      if (perfil && !normalizarPerfil(perfil)) return interaction.reply({ content: '❌ Perfil inválido.', ephemeral: true });
      const config = salvarTtsConfig(interaction.guildId, { ...(idioma ? { idioma } : {}), ...(perfil ? { perfil } : {}), ...(nome !== null ? { dizerNome: nome } : {}) });
      if (!texto) return interaction.reply({ embeds: [criarEmbed({ titulo: '🗣️ Configuração TTS', descricao: formatarConfig(config), cor: THEME.corPrincipal })], ephemeral: true });
    }
    if (!texto) return interaction.reply({ embeds: [criarEmbed({ titulo: '🗣️ Configuração TTS', descricao: formatarConfig(obterTtsConfig(interaction.guildId)), cor: THEME.corPrincipal })], ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    try {
      await falar(interaction.guild, interaction.member, texto);
      await interaction.editReply('✅ Falei no canal de voz.');
    } catch (erro) {
      await interaction.editReply(`❌ ${erro.message}`);
    }
  },
};
