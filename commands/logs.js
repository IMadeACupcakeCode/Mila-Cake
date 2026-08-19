const { criarEmbed, THEME } = require('../utils/theme');
const { filtrarPorUsuario, todas } = require('../utils/logger');

module.exports = {
  data: { name: 'logs', description: '📜 Mostra os logs da bot (filtre por uma pessoa específica)' },
  async execute(interaction) {
    const pessoa = interaction.options.getString('pessoa');
    const quantidade = Math.min(Math.max(interaction.options.getInteger('quantidade') || 15, 1), 50);

    const entradas = pessoa ? filtrarPorUsuario(pessoa, quantidade) : todas(quantidade);

    if (!entradas.length) {
      return interaction.reply({
        embeds: [
          criarEmbed({
            titulo: '📜 Sem logs por aqui',
            descricao: pessoa
              ? `Não encontrei registros para **${pessoa}**.`
              : 'Ainda não há registros. Use alguns comandos e tente de novo.',
            cor: THEME.corPrincipal,
          }),
        ],
        ephemeral: true,
      });
    }

    const linhas = entradas
      .map((e) => {
        const hora = new Date(e.ts).toLocaleString('pt-BR');
        const quem = e.usuario ? ` · ${e.usuario}` : '';
        const cmd = e.comando ? ` [/${e.comando}]` : '';
        return `˖ \`${hora}\` **${e.nivel.toUpperCase()}**${cmd}: ${e.mensagem}${quem}`;
      })
      .join('\n');

    const titulo = pessoa ? `📜 Logs de ${pessoa}` : '📜 Logs recentes da Mila Bot';
    await interaction.reply({
      embeds: [
        criarEmbed({
          titulo,
          descricao: linhas,
          cor: THEME.corPrincipal,
          rodape: `${THEME.nome} registra tudo pra você~ ♡`,
        }),
      ],
      ephemeral: true,
    });
  },
};