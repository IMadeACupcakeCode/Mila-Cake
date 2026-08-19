const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');

const FRASES = [
  'te dá um abraço bem apertado e quentinho 🤗',
  'te envolve num abraço cheio de carinho ♡',
  'te puxa pra um abraço bem demorado 💕',
  'te abraça forte e sussurra "meu favorito" ✨',
  'te enche de abraços e amor virtual~ 🌸',
];

module.exports = {
  data: { name: 'abraco', description: '🤗 Envia um abraço carinhoso para alguém' },
  async execute(interaction) {
    const alvo = interaction.options.getUser('usuario') || interaction.user;
    const frase = FRASES[Math.floor(Math.random() * FRASES.length)];
    const embed = criarEmbed({
      titulo: '🤗 Abraço carinhoso~ ♡',
      descricao: `**${interaction.user}** ${frase}\n\n> ${alvo}, você recebeu um abraço da Mila!`,
      cor: THEME.corBubblegum,
      rodape: rodapeAleatorio(),
    });
    await interaction.reply({ embeds: [embed] });
  },
};
