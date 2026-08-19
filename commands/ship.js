const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');

function barra(pct) {
  const cheio = Math.round(pct / 10);
  return '💗'.repeat(cheio) + '🤍'.repeat(10 - cheio);
}

function mensagemTematica(pct) {
  if (pct >= 80) return '🌟 Um amor escrito nas estrelas!';
  if (pct >= 50) return '💫 Tem química no ar, cuidem dela.';
  if (pct >= 25) return '🌙 Talvez amizade seja o caminho.';
  return '💔 Não foi dessa vez, meu favorito...';
}

module.exports = {
  data: { name: 'ship', description: 'Calcula a compatibilidade amorosa entre dois membros' },
  async execute(interaction) {
    const u1 = interaction.options.getUser('usuario1');
    const u2 = interaction.options.getUser('usuario2');
    const seed = (BigInt(u1.id) ^ BigInt(u2.id)).toString();
    let n = 0;
    for (const c of seed) n = (n * 31 + c.charCodeAt(0)) % 100;
    const pct = n === 0 ? 1 : n;

    const embed = criarEmbed({
      titulo: `💞 Ship: ${u1.username} × ${u2.username}`,
      descricao:
        `**${pct}%** de compatibilidade\n\n` +
        `${barra(pct)}\n\n` +
        `${mensagemTematica(pct)}`,
      cor: THEME.corPrincipal,
      rodape: rodapeAleatorio(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};
