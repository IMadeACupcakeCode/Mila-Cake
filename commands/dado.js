const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const { avaliar, formatar } = require('../utils/dice');

function rolarDados(notacao, rng = Math.random) {
  return avaliar(notacao, rng);
}

module.exports = {
  data: {
    name: 'dado',
    description: 'Rola dados e calcula expressões (ex: 1d20+2 ou 1d20-5+4x6)',
    options: [
      { name: 'notacao', description: 'Expressão de dados, como 1d20-5+4x6', type: 3, required: true, max_length: 100 },
      { name: 'detalhar', description: 'Mostrar o cálculo completo e a precedência', type: 5, required: false },
    ],
  },

  rolarDados,
  avaliar,
  formatar,

  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 800);
    const notacao = interaction.options.getString('notacao');
    const detalhar = interaction.options.getBoolean('detalhar') || false;
    const resultado = rolarDados(notacao);

    if (!resultado) {
      const embedErro = criarEmbed({
        titulo: 'Notação inválida',
        descricao:
          `Não consegui interpretar **\`${notacao}\`**.\n\n` +
          'Use dados, números e `+`, `-`, `x` ou `*`. Exemplos:\n' +
          '`1d20` · `1d20+2` · `1d20-5+4x6`',
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    const embed = criarEmbed({
      titulo: '🎲 Resultado dos dados',
      descricao: `${THEME.div.bolinhas}\n\n${formatar(resultado, detalhar)}\n\n${THEME.div.estrelado}`,
      cor: THEME.corDado,
      rodape: rodapeAleatorio(),
    });

    return interaction.reply({ embeds: [embed] });
  },
};
