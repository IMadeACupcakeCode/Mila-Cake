const { THEME } = require('../utils/theme');
const { msg, raras } = require('../utils/shipMensagens');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');

function barraCoracoes(pct) {
  const cheio = Math.max(0, Math.min(10, Math.round(pct / 10)));
  return '💗'.repeat(cheio) + '🤍'.repeat(10 - cheio);
}

function veredito(pct) {
  if (pct >= 90) return '💍 Alma gêmea';
  if (pct >= 75) return '💞 Química absurda';
  if (pct >= 50) return '💗 Tem potencial';
  if (pct >= 25) return '💔 Precisa conversar';
  return '🧊 Amizade difícil';
}

function calcular(u1, u2) {
  const seed = (BigInt(u1.id) ^ BigInt(u2.id)).toString();
  let n = 0;
  for (const c of seed) n = (n * 31 + c.charCodeAt(0)) % 100;
  const pct = n === 0 ? 1 : n;
  const idxFrase = parseInt(seed.slice(0, 8), 16) % 100;
  const rarasPct = pct > 100 ? raras['>100'] : raras['<0'];
  const mensagem = msg[pct]?.[idxFrase] || (rarasPct ? rarasPct[idxFrase % rarasPct.length].replace(/{pct}/g, pct) : 'O destino está indeciso.');
  return { pct, mensagem };
}

function embedCalculando(u1, u2, frame) {
  const cargas = [
    { pct: 28, texto: 'Lendo os perfis...' },
    { pct: 57, texto: 'Cruzando os horóscopos...' },
    { pct: 83, texto: 'Consultando o cupido...' },
  ];
  const atual = cargas[frame % cargas.length];
  return arcade.embedArcade({
    titulo: '💞 Calculando o ship...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**${u1.username}** × **${u2.username}**\n\n` +
      `${barraCoracoes(atual.pct)}\n\n` +
      `${atual.texto}\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corBubblegum,
    thumbnail: u1.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Cupido · cálculo 100% científico, 0% garantido',
  });
}

function embedResultado(u1, u2, pct, mensagem) {
  return arcade.embedArcade({
    titulo: `💞 Ship: ${arcade.truncar(u1.username, 24)} × ${arcade.truncar(u2.username, 24)}`,
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `# ${pct}%\n\n` +
      `${barraCoracoes(pct)}\n` +
      `${arcade.barraPorcentagem(pct, 12)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `${mensagem}\n\n` +
      `${THEME.div.coracao}`,
    cor: arcade.corPorPercentual(pct),
    thumbnail: u1.displayAvatarURL?.({ size: 128 }),
    campos: [
      { name: '💘 Veredito', value: veredito(pct), inline: true },
      { name: '💗 Compatibilidade', value: `\`${pct}%\``, inline: true },
      { name: '🎯 Casal', value: `**${u1.username}** × **${u2.username}**`, inline: false },
    ],
    rodape: 'Mila Cupido · ship recalculável com o mesmo resultado (é ciência)',
  });
}

module.exports = {
  data: {
    name: 'ship',
    description: 'Calcula a compatibilidade amorosa entre dois membros com animação',
    options: [
      { name: 'usuario1', description: 'Primeiro usuário', type: 6, required: true },
      { name: 'usuario2', description: 'Segundo usuário', type: 6, required: true },
    ],
  },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 500).catch(() => {});
    const u1 = interaction.options?.getUser('usuario1');
    const u2 = interaction.options?.getUser('usuario2');
    if (!u1 || !u2) {
      return interaction.reply({ content: '❌ Marque dois usuários válidos para calcular a compatibilidade.', ephemeral: true });
    }

    const { pct, mensagem } = calcular(u1, u2);
    const msg = await interaction.reply({
      embeds: [embedCalculando(u1, u2, 0)],
      components: [],
      fetchReply: true,
    });
    if (!msg || !msg.edit) return;

    await arcade.sleep(600);
    try { await msg.edit({ embeds: [embedCalculando(u1, u2, 1)], components: [] }); } catch {}
    await arcade.sleep(600);
    try { await msg.edit({ embeds: [embedCalculando(u1, u2, 2)], components: [] }); } catch {}
    await arcade.sleep(700);
    try {
      await msg.edit({ embeds: [embedResultado(u1, u2, pct, mensagem)], components: [] });
    } catch {}
  },
};
