const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const arcade = require('../utils/arcade');

const RESPOSTAS = [
  { texto: 'Sim, meu favorito~ ♡', tipo: 'sim' },
  { texto: 'Claro que sim! ✨', tipo: 'sim' },
  { texto: 'Com certeza, pode contar com isso.', tipo: 'sim' },
  { texto: 'A Mila disse sim! 💕', tipo: 'sim' },
  { texto: 'Tudo indica que sim~', tipo: 'sim' },
  { texto: 'Provavelmente. ⋆｡°✩', tipo: 'sim' },
  { texto: 'As estrelas tão a seu favor~', tipo: 'sim' },
  { texto: 'Não posso prever agora... pergunta depois~', tipo: 'talvez' },
  { texto: 'Melhor não te dizer agora. 🌫️', tipo: 'talvez' },
  { texto: 'O universo está indeciso. Tenta de novo.', tipo: 'talvez' },
  { texto: 'Não, meu favorito... 💔', tipo: 'nao' },
  { texto: 'A Mila disse não. 😿', tipo: 'nao' },
  { texto: 'Absolutamente não! 🚫', tipo: 'nao' },
  { texto: 'Nem pensar, bb~', tipo: 'nao' },
  { texto: 'As chances são mínimas... 🌑', tipo: 'nao' },
  { texto: 'Não conte com isso. 💫', tipo: 'nao' },
];

const CORES = {
  sim: 0x22C55E,
  talvez: 0xFACC15,
  nao: 0xEF4444,
};

function embedConsultando(pergunta, frame) {
  const simbolos = ['🔮', '✨', '🌙', '🪄', '💫'];
  return arcade.embedArcade({
    titulo: '🔮 Consultando a bolinha mágica...',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `> ${arcade.truncar(pergunta, 280)}\n\n` +
      `${simbolos[frame % simbolos.length]}  **${['Misturando as estrelas', 'Lendo o destino', 'Concentrando a magia', 'Quase lá'][frame % 4]}...**\n\n` +
      `${THEME.div.estrelado}`,
    cor: THEME.corPrincipal,
    rodape: 'Mila Oráculo · não faça perguntas difíceis demais',
  });
}

function embedResposta(pergunta, autor, resposta) {
  return arcade.embedArcade({
    titulo: '🔮 A bolinha mágica respondeu',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `> ${arcade.truncar(pergunta, 280)}\n\n` +
      `${THEME.div.linha}\n\n` +
      `**${resposta.texto}**\n\n` +
      `${THEME.div.estrelado}`,
    cor: CORES[resposta.tipo],
    thumbnail: autor.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Oráculo · a resposta é só um empurrãozinho',
  });
}

function botoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('8ball_reroll').setLabel('Perguntar de novo').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

module.exports = {
  data: {
    name: '8ball',
    description: 'A bola mágica responde sua pergunta com animação',
    options: [{ name: 'pergunta', description: 'Pergunta para a bola mágica', type: 3, required: true, max_length: 500 }],
  },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 700).catch(() => {});
    const pergunta = interaction.options?.getString('pergunta') || 'Será que vai dar certo?';
    const autor = interaction.user;

    const msg = await interaction.reply({
      embeds: [embedConsultando(pergunta, 0)],
      components: [],
      fetchReply: true,
    });
    if (!msg || !msg.edit) return;

    await arcade.sleep(650);
    try { await msg.edit({ embeds: [embedConsultando(pergunta, 1)], components: [] }); } catch {}
    await arcade.sleep(650);
    try { await msg.edit({ embeds: [embedConsultando(pergunta, 2)], components: [] }); } catch {}
    await arcade.sleep(650);

    const resposta = RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)];
    try {
      await msg.edit({ embeds: [embedResposta(pergunta, autor, resposta)], components: [botoes()] });
    } catch {
      return;
    }

    while (true) {
      let i;
      try {
        i = await msg.awaitMessageComponent({ time: 60_000 });
      } catch {
        try { await msg.edit({ components: [] }); } catch {}
        return;
      }

      if (i.user.id !== autor.id) {
        await i.reply({ content: '🔮 Essa consulta é do **' + autor.username + '**. Use `$8ball` para abrir a sua.', ephemeral: true }).catch(() => {});
        continue;
      }

      if (i.customId !== '8ball_reroll') continue;

      await i.update({ embeds: [embedConsultando(pergunta, 0)], components: [] }).catch(() => {});
      await arcade.sleep(600);
      try { await msg.edit({ embeds: [embedConsultando(pergunta, 1)], components: [] }); } catch {}
      await arcade.sleep(600);
      try { await msg.edit({ embeds: [embedConsultando(pergunta, 2)], components: [] }); } catch {}
      await arcade.sleep(600);
      const nova = RESPOSTAS[Math.floor(Math.random() * RESPOSTAS.length)];
      try {
        await msg.edit({ embeds: [embedResposta(pergunta, autor, nova)], components: [botoes()] });
      } catch {}
    }
  },
};
