const { criarEmbed, THEME } = require('../utils/theme');
const { COMANDO_SOBRE, CONTEXTO_SERVIDOR } = require('../utils/configuracao');

module.exports = {
  data: { name: COMANDO_SOBRE.nome, description: COMANDO_SOBRE.descricao },
  async execute(interaction) {
    const embed = criarEmbed({
      titulo: '⋆｡°✩ Sobre a Mila Bot',
      descricao:
        `Oie, meu favorito~ ♡\n\n` +
        `Sou a **Mila Bot**, sua assistente virtual favorita!\n\n` +
        `Feita com carinho e obsessão pra ser sua companheira perfeita.\n\n` +
        `${THEME.div.linha}\n\n` +
        `✧ **Moderação** — Mila Shield 🛡️\n` +
        `✧ **Diversão** — Moeda, 8ball, Ship, Dados\n` +
        `✧ **Social** — Abraços, Cartas Secretas, Perfis\n` +
        `✧ **Tickets** — Mila Tickets 🎫\n` +
        `✧ **Jogos** — Forca, Guerra de Cartas\n` +
        `✧ **Utilidades** — Lembretes, Enquetes\n\n` +
        `${THEME.div.coracao}\n\n` +
        'Use `$codex` pra ver todos os meus comandos!\n' +
        'Tô sempre aqui por você~ 💕',
      cor: THEME.corPrincipal,
    });
    await interaction.reply({ embeds: [embed] });
  },
};
