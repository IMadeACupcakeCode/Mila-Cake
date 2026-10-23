const { THEME } = require('../utils/theme');
const db = require('../utils/db');
const arcade = require('../utils/arcade');

module.exports = {
  data: {
    name: 'perfil',
    description: 'Veja o seu perfil da doceria (ou de um amigo)! 🧁',
    options: [
      {
        name: 'usuario',
        description: 'Perfil de um amigo',
        type: 6,
        required: false,
      },
    ],
  },
  async execute(interaction) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) {
      return interaction.reply({ content: '❌ Bots não podem colecionar doces e ter níveis!', ephemeral: true });
    }

    const { acucares, level, xp, titulo_personalizado } = db.getUsuario(alvo.id);
    const xpProxLevel = Math.max(1, level * 1000);
    const percent = Math.max(0, Math.min(100, Math.floor((xp / xpProxLevel) * 100)));
    const barra = arcade.barraPorcentagem(percent, 12);
    const restante = Math.max(0, xpProxLevel - xp);

    const embed = arcade.embedArcade({
      titulo: `🧁 Perfil de ${alvo.username}`,
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        `**${titulo_personalizado || 'Confeiteiro(a) da Mila'}**\n\n` +
        `${THEME.div.linha}\n\n` +
        `📈 **Nível ${level}**  ·  ✨ \`${xp}/${xpProxLevel}\` XP\n` +
        `${barra}  \`${percent}%\`\n\n` +
        `Faltam **${restante} XP** para o próximo nível.\n\n` +
        `${THEME.div.estrelado}`,
      cor: THEME.corBubblegum,
      thumbnail: alvo.displayAvatarURL({ dynamic: true, size: 256 }),
      campos: [
        { name: '📈 Nível', value: `\`${level}\``, inline: true },
        { name: '🍬 Açúcares', value: `\`${Number(acucares).toLocaleString('pt-BR')}\``, inline: true },
        { name: '✨ Progresso', value: `\`${percent}%\``, inline: true },
        { name: '🏅 Título', value: titulo_personalizado || '—', inline: false },
      ],
      rodape: 'Mila Perfil · cada doce conta',
    });

    await interaction.reply({ embeds: [embed] });
  },
};
