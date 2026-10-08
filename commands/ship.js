const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { msg, raras } = require('../utils/shipMensagens');
const { mostrarDigitando } = require('../utils/milaDecoracao');

function barra(pct) {
  const cheio = Math.round(pct / 10);
  return '💗'.repeat(cheio) + '🤍'.repeat(10 - cheio);
}

module.exports = {
  data: { name: 'ship', description: 'Calcula a compatibilidade amorosa entre dois membros', options: [{ name: 'usuario1', description: 'Primeiro usuário', type: 6, required: true }, { name: 'usuario2', description: 'Segundo usuário', type: 6, required: true }] },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 900);
    const u1 = interaction.options.getUser('usuario1');
    const u2 = interaction.options.getUser('usuario2');
    const seed = (BigInt(u1.id) ^ BigInt(u2.id)).toString();
    let n = 0;
    for (const c of seed) n = (n * 31 + c.charCodeAt(0)) % 100;
    const pct = n === 0 ? 1 : n;

    // Seleção determinística dentro das 100 frases da porcentagem
    const idxFrase = parseInt(seed.slice(0, 8), 16) % 100;
    const rarasPct = pct > 100 ? raras['>100'] : raras['<0'];
    let mensagem = msg[pct]?.[idxFrase] || rarasPct[idxFrase % rarasPct.length].replace(/{pct}/g, pct);

    const embed = criarEmbed({
      titulo: `💞 Ship: ${u1.username} × ${u2.username}`,
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**${pct}%** de compatibilidade\n\n` +
        `${barra(pct)}\n\n` +
        mensagem +
        `\n\n${THEME.div.coracao}`,
      cor: THEME.corPrincipal,
      rodape: rodapeAleatorio(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};
