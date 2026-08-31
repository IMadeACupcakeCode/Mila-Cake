const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

// Interpreta notação de dados: NdM+X ou NdM-X (ex: 1d20, 2d6+3, 4d8-1)
function rolarDados(notacao) {
  const regex = /^(\d{1,2})d(\d{1,4})([+-]\d{1,3})?$/i;
  const match = notacao.trim().match(regex);
  if (!match) return null;

  const quantidade = parseInt(match[1], 10);
  const lados = parseInt(match[2], 10);
  const modificador = match[3] ? parseInt(match[3], 10) : 0;

  if (quantidade < 1 || quantidade > 50 || lados < 2 || lados > 1000) return null;

  const rolagens = [];
  let soma = 0;
  for (let i = 0; i < quantidade; i++) {
    const valor = Math.floor(Math.random() * lados) + 1;
    rolagens.push(valor);
    soma += valor;
  }
  const total = soma + modificador;

  return { quantidade, lados, modificador, rolagens, total };
}

module.exports = {
  data: { name: 'dado', description: 'Rola dados no estilo NdM (ex: 1d20, 2d6+3)' },

  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 800);
    const notacao = interaction.options.getString('notacao');
    const resultado = rolarDados(notacao);

    if (!resultado) {
      const embedErro = criarEmbed({
        titulo: 'Notação inválida',
        descricao:
          `Não consegui interpretar **\`${notacao}\`**.\n\n` +
          'Use o formato `NdM` ou `NdM±X`, por exemplo:\n' +
          '`1d20` • `2d6+3` • `4d8-1`',
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    const { quantidade, lados, modificador, rolagens, total } = resultado;

    const linhaDados = rolagens.map((v) => `\`${v}\``).join('  ·  ');
    const linhaModificador =
      modificador !== 0 ? `\n**Modificador:** ${modificador > 0 ? '+' : ''}${modificador}` : '';

    const descricao =
      `${THEME.div.bolinhas}\n\n` +
      `${THEME.iconeFooter} Rolando **${quantidade}d${lados}**...\n\n` +
      `${linhaDados}${linhaModificador}\n\n` +
      `**✦ Resultado: \`${total}\`**\n\n` +
      `${THEME.div.estrelado}`;

    const embed = criarEmbed({
      titulo: '🎲 Rolando os dados...',
      descricao,
      cor: THEME.corDado,
      rodape: rodapeAleatorio(),
    });

    await interaction.reply({ embeds: [embed] });
  },
};
