const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { msg, raras } = require('../utils/antishipMensagens');
const { mostrarDigitando } = require('../utils/milaDecoracao');

function barraAnti(pct) {
  const vazio = Math.round(pct / 10);
  return '🖤'.repeat(10 - vazio) + '🩶'.repeat(vazio);
}

module.exports = {
  data: { name: 'antiship', description: 'Calcula a incompatibilidade entre dois membros — o oposto de $ship', options: [{ name: 'usuario1', description: 'Primeiro usuário', type: 6, required: true }, { name: 'usuario2', description: 'Segundo usuário', type: 6, required: true }] },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 900);
    const u1 = interaction.options.getUser('usuario1');
    const u2 = interaction.options.getUser('usuario2');
    const seed = (BigInt(u1.id) ^ BigInt(u2.id)).toString();
    let n = 0;
    for (const c of seed) n = (n * 31 + c.charCodeAt(0)) % 100;
    const pct = n === 0 ? 1 : n;
    const antiPct = 100 - pct;

    // Seleção determinística dentro das 100 frases da porcentagem
    const idxFrase = parseInt(seed.slice(0, 8), 16) % 100;
    const lista = msg[antiPct] || [];
    let mensagem = lista[idxFrase] || raras['>100'][idxFrase % raras['>100'].length].replace(/{pct}/g, antiPct);
    if (antiPct > 100) mensagem = raras['>100'][idxFrase % raras['>100'].length].replace(/{pct}/g, antiPct);

    const embed = criarEmbed({
      titulo: `💀 Anti-Ship: ${u1.username} × ${u2.username}`,
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**${antiPct}%** de incompatibilidade\n\n` +
        `${barraAnti(antiPct)}\n\n` +
        mensagem +
        `\n\n${THEME.div.estrelado}`,
      cor: THEME.corErro,
      rodape: rodapeAleatorio(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};