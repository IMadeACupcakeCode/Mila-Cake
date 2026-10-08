const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

module.exports = {
  data: {
    name: 'doar',
    description: 'Doe os seus preciosos açúcares a outro membro da Mila.',
    options: [
      {
        name: 'usuario',
        description: 'Usuário para quem quer doar',
        type: 6, // USER
        required: true
      },
      {
        name: 'quantidade',
        description: 'Quantos açúcares deseja dar?',
        type: 4, // INTEGER
        required: true
      }
    ]
  },
  async execute(interaction) {
    const alvo = interaction.options?.getUser('usuario');
    const quantia = interaction.options?.getInteger('quantidade');

    if (alvo.bot) return interaction.reply({ content: '❌ Os bots não precisam de dinheiro (nem sabem comer doces)!', ephemeral: true });
    if (alvo.id === interaction.user.id) return interaction.reply({ content: '❌ Você não pode doar dinheiro para o seu espelho!', ephemeral: true });
    if (quantia <= 0) return interaction.reply({ content: '❌ Só podemos doar quantidades positivas que existem!', ephemeral: true });

    const sucesso = db.transferirAcucares(interaction.user.id, alvo.id, quantia);

    if (!sucesso) {
      return interaction.reply({ content: '❌ Você não tem moedas suficientes para essa doação ou tenteou burlar a matrix.', ephemeral: true });
    }

    const embed = criarEmbed({
      titulo: '🤝 Doação Concluída',
      descricao: `**Você transferiu:** ${quantia} 🍬 Açúcares!\n\n**De:** ${interaction.user.toString()}\n**Para:** ${alvo.toString()}`,
      cor: THEME.corPrincipal,
    });

    await interaction.reply({ embeds: [embed] });
  }
};
