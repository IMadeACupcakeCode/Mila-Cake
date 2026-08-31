const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'seguranca', description: '🛡️ Dicas de segurança para o servidor e a bot' },
  async execute(interaction) {
    // ⋆｡°✩ Typing indicator
    mostrarDigitando(interaction.channel, 600).catch(() => {});
    const embed = criarEmbed({
      titulo: '🛡️ Dicas de Segurança',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        '✦ Ative o **2FA** na sua conta e no servidor (modo desenvolvedor).\n' +
        '✦ Use cargos com permissões mínimas necessárias (princípio do menor privilégio).\n' +
        '✦ Restrinja quem pode convidar bots (só admins).\n' +
        '✦ Ative o sistema de moderação e logs em canais separados.\n' +
        '✦ Nunca compartilhe o token da bot — ele vai no `.env`, fora do repositório.\n' +
        `✦ Use \`$configurar\` para limitar onde a bot fala e evitar spam.\n\n` +
        `${THEME.div.coracao}\n\n` +
        '_A segurança é a base de todo bom espetáculo..._ 🎪\n\n' +
        `${THEME.div.bolinhas}`,
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} vigia as sombras~ ♡`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};