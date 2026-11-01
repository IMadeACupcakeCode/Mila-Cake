const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const criador = require('../utils/criador');

const GABE = [
  'Gabe Newell sorri de longe: "Presentes são o coração do PC."',
  'Obrigado, Gabe, por inventar o sistema de Presentes.',
  'Em nome de Gabe, compartilhar é amar.',
];

module.exports = {
  data: {
    name: 'doar',
    description: '💸 Doe Açúcares para outro membro',
    options: [
      { name: 'usuario', description: 'Quem vai receber', type: 6, required: true },
      { name: 'quantidade', description: 'Quantos Açúcares doar', type: 4, required: true, min_value: 1 },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const alvo = interaction.options?.getUser('usuario');
    const quantia = Number(interaction.options?.getInteger('quantidade'));

    if (!alvo) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação', 'Escolha um usuário válido.')], ephemeral: true });
    if (alvo.bot) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação', 'Bots não precisam de Açúcares.')], ephemeral: true });

    const resultado = service.doar(interaction.user.id, alvo.id, quantia);
    if (!resultado.ok) {
      const motivo = resultado.motivo === 'sem_saldo'
        ? `Você só tem \`${theme.formatarNumero(resultado.saldo)}\` ${theme.MOEDA}.`
        : resultado.motivo === 'mesmo_usuario' ? 'Você não pode doar para si mesmo.' : 'Não foi possível concluir.';
      return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação recusada', motivo)], ephemeral: true });
    }

    const gabe = GABE[Math.floor(Math.random() * GABE.length)];
    const embed = theme.janela({
      tema,
      titulo: '🎁 Presente enviado',
      descricao: `Caixa de presente Steam™\n${gabe}`,
      cor: tema.cor2,
      thumbnail: alvo.displayAvatarURL?.({ size: 128 }),
      autorNome: `${tema.icone} Mila • Presentes`,
      autorIcone: client?.user?.displayAvatarURL?.({ size: 128 }),
      campos: [
        { name: 'De', value: `${interaction.user}`, inline: true },
        { name: 'Para', value: `${alvo}`, inline: true },
        { name: 'Valor', value: `${Number(resultado.quantidade || 0).toLocaleString('pt-BR')} ${theme.MOEDA}`, inline: true },
        { name: 'Seu saldo', value: `\`${UI.saldoTexto(resultado.saldo, resultado.ehCriador)}\``, inline: true },
      ],
      rodape: `${tema.rodape} • Obrigado, Gabe Newell`,
    });

    await interaction.reply(UI.comMascote(embed));
  },
};
