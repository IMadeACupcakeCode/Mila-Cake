const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const loja = require('../utils/economyLoja');
const criador = require('../utils/criador');

const GABE = [
  'Gabe Newell sorri de longe: "Presentes são o coração do PC."',
  'Obrigado, Gabe, por inventar o sistema de Presentes.',
  'Em nome de Gabe, compartilhar é amar.',
];

module.exports = {
  data: {
    name: 'presentear',
    description: '🎁 Presenteie Açúcares ou itens para outro membro',
    options: [
      { name: 'usuario', description: 'Quem vai receber', type: 6, required: true },
      { name: 'item', description: 'ID do item da loja (opcional)', type: 3, required: false },
      { name: 'quantidade', description: 'Quantidade', type: 4, required: false, min_value: 1 },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const alvo = interaction.options?.getUser('usuario');
    const itemId = interaction.options?.getString('item');
    const qtd = Number(interaction.options?.getInteger('quantidade')) || 1;

    if (!alvo) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Presente', 'Escolha um usuário válido.')], ephemeral: true });
    if (alvo.bot) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Presente', 'Bots não abrem presentes.')], ephemeral: true });
    if (alvo.id === interaction.user.id) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Presente', 'Você não pode se presentear.')], ephemeral: true });

    // Dinheiro
    if (!itemId) {
      const resultado = service.doar(interaction.user.id, alvo.id, Math.max(1, qtd));
      if (!resultado.ok) {
        const motivo = resultado.motivo === 'sem_saldo' ? `Você só tem \`${theme.formatarNumero(resultado.saldo)}\` ${theme.MOEDA}.` : 'Não foi possível concluir.';
        return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Presente recusado', motivo)], ephemeral: true });
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
      return interaction.reply(UI.comMascote(embed));
    }

    // Item
    const item = loja.buscarItem(itemId);
    if (!item) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Presente', 'Item não encontrado na loja.')], ephemeral: true });
    const resultado = service.doarItem(interaction.user.id, alvo.id, item.id, qtd);
    if (!resultado.ok) {
      const motivo = resultado.motivo === 'sem_item' ? `Você não tem ${qtd}x **${item.nome}** na mochila.` : 'Não foi possível concluir.';
      return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Presente recusado', motivo)], ephemeral: true });
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
        { name: 'Item', value: `${resultado.quantidade}x ${item.nome}`, inline: true },
      ],
      rodape: `${tema.rodape} • Obrigado, Gabe Newell`,
    });
    return interaction.reply(UI.comMascote(embed));
  },
};
