const { criarEmbed, THEME } = require('../utils/theme');
const { filtrarPorUsuario, todas } = require('../utils/logger');
const { isStaff } = require('../utils/perms');
const { mostrarDigitando } = require('../utils/milaDecoracao');

module.exports = {
  data: { name: 'logs', description: '📜 Mostra os logs da bot (filtre por uma pessoa específica)' },
  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 600);
    // Risco original: qualquer usuário podia ler logs contendo IDs de usuário
    // e histórico de comandos. Exige staff.
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [
          criarEmbed({ titulo: 'Sem permissão', descricao: 'Este comando é restrito a staff.', cor: THEME.corErro }),
        ],
        ephemeral: true,
      });
    }
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
          descricao: `${THEME.div.bolinhas}\n\n${linhas}\n\n${THEME.div.estrelado}`,
          cor: THEME.corPrincipal,
          rodape: `${THEME.nome} registra tudo pra você~ ♡`,
        }),
      ],
      ephemeral: true,
    });
  },
};