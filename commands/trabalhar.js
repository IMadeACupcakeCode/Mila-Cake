const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

const PALAVRAS = [
  'chocolate', 'baunilha', 'morango', 'brigadeiro', 'macaron',
  'ganache', 'caramelo', 'cupcake', 'chantilly', 'açúcar',
  'confeiteiro', 'marzipã', 'croissant', 'sorvete'
];

// Dicionário de games rolando no canal
const sessoesTrabalho = new Set();

module.exports = {
  data: {
    name: 'trabalhar',
    description: 'Bote a mão na massa na confeitaria da Mila! Jogo rápido de digitar para ganhar uns doces.',
  },
  async execute(interaction) {
    if (sessoesTrabalho.has(interaction.user.id)) {
      return interaction.reply({ content: '❌ Você já tem um turno de confeiteiro em andamento! Termine primeiro...', ephemeral: true });
    }

    const palavraSorteada = PALAVRAS[Math.floor(Math.random() * PALAVRAS.length)];
    sessoesTrabalho.add(interaction.user.id);

    const embedDesafio = criarEmbed({
      titulo: '🧁 Hora de amassar a farinha!',
      descricao: `O cliente pediu um doce correndo...\nDigite esta palavra exatamente como ela está o mais rápido possível no chat para prepará-la e ser pago:\n\n# **${palavraSorteada}**\n\nTempo limite: 15 segundos!`,
      cor: THEME.corAviso
    });

    await interaction.reply({ embeds: [embedDesafio] });

    const filter = m => m.author.id === interaction.user.id && m.content.toLowerCase() === palavraSorteada;
    try {
      // Abre collector pra ver quem digita primeiro. Só aceita a input do usuário q chamou e certo.
      const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });

      const msg = collected.first();
      const acucaresGanhos = Math.floor(Math.random() * 200) + 50;

      db.addAcucares(interaction.user.id, acucaresGanhos);

      const winEmbed = criarEmbed({
        titulo: '✅ Cliente Satisfeito!',
        descricao: `Ótimo trabalho! A receita foi impecável.\nO cliente deixou uma gorjeta para você de:\n\n**+${acucaresGanhos} 🍬 Açúcares!**`,
        cor: THEME.corSucesso
      });

      await interaction.followUp({ embeds: [winEmbed] });

    } catch (e) {
      // Deu timeout, não digitou
      const loseEmbed = criarEmbed({
        titulo: '🔥 A Receita Queimou!',
        descricao: `O tempo acabou e a fornada de \`${palavraSorteada}\` foi perdida.\nChefe Mila disse que você não ganhará nada dessa vez. 😔`,
        cor: THEME.corErro
      });
      await interaction.followUp({ embeds: [loseEmbed] });
    } finally {
      // Limpa a trava do jogo
      sessoesTrabalho.delete(interaction.user.id);
    }
  }
};
