const { THEME } = require('../utils/theme');
const { criarEmbed } = require('../utils/theme');

const LISTA = [
  { nome: 'blackjack', uso: '/blackjack <aposta>', desc: 'Blackjack contra a Mila (dealer). Pedir/Parar, dealer até 17. Ganho 2x.' },
  { nome: 'jokenpo', uso: '/jokenpo @oponente <aposta>', desc: 'Pedra/Papel/Tesoura PvP. Ganho 2x; empate devolve.' },
  { nome: 'dadoduelo', uso: '/dadoduelo @oponente <aposta>', desc: 'Duelo de dados (1-6). Maior vence.' },
  { nome: 'maiorcarta', uso: '/maiorcarta @oponente <aposta>', desc: 'Duelo de maior carta (A-K). Maior vence.' },
  { nome: 'coinflipduelo', uso: '/coinflipduelo @oponente <aposta>', desc: 'Cara ou Coroa PvP. Desafiante escolhe o lado.' },
  { nome: 'parouimpar', uso: '/parouimpar @oponente <aposta>', desc: 'Par ou Ímpar. Desafiante escolhe paridade; ambos escolhem 1-5.' },
  { nome: 'roletacor', uso: '/roletacor @oponente <aposta>', desc: 'Roleta vermelho/preto. Cor escolhida pelo desafiante.' },
  { nome: 'moeda', uso: '/moeda', desc: 'Cara ou coroa solo com sequência persistente.' },
  { nome: 'dado', uso: '/dado NdM', desc: 'Rola dados (ex.: 1d20+2).' },
  { nome: 'roleta', uso: '/roleta', desc: 'Roleta solo com animação.' },
];

module.exports = {
  data: {
    name: 'apostas',
    description: '🎰 Lista todas as apostas/jogos disponíveis e como jogar',
  },
  async execute(interaction, client) {
    const linhas = LISTA.map((j) => `**${j.nome}** — ${j.desc}\n> ${j.uso}`).join('\n\n');
    const embed = criarEmbed({
      titulo: '🎰 Apostas da Mila',
      descricao: `Confira os jogos de aposta disponíveis (Açúcares):\n\n${linhas}\n\nUse \`/apostas\` ou \`$apostas\` para ver esta lista.`,
      cor: 0xD4A017,
      rodape: `${THEME.nome} • Cassino`,
    });
    await interaction.reply({ embeds: [embed] });
  },
};
