const loja = require('../utils/economyLoja');
const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const db = require('../utils/db');
const criador = require('../utils/criador');

module.exports = {
  data: {
    name: 'comprar',
    description: '🛍️ Compra um item da loja com confirmação',
    options: [
      { name: 'item', description: 'Item desejado', type: 3, required: true, choices: loja.listarItens().map((i) => ({ name: `${i.nome} — ${i.preco} 🍬`, value: i.id })) },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const itemId = interaction.options.getString('item');
    const item = loja.buscarItem(itemId);
    if (!item) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Compra', 'Item não encontrado.')], ephemeral: true });

    const ehCriador = criador.ehCriador(interaction.user.id);
    const saldo = ehCriador ? criador.PONTOS_INFINITOS : db.getUsuario(interaction.user.id).acucares;
    if (!ehCriador && saldo < item.preco) {
      return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Compra recusada', `Saldo insuficiente: precisa de ${item.preco} 🍬, você tem ${saldo} 🍬.`)], ephemeral: true });
    }

    const embed = theme.janela({
      tema,
      titulo: 'Tem Certeza?',
      descricao: `Item: **${item.nome}**\nPreço: **${item.preco} 🍬**\n\nReaja com ✅ (Me Dá Logo. Aaa) ou ❌ (Negar).`,
      cor: tema.cor2,
      rodape: `${tema.rodape} • Mila Loja`,
    });
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    try { await msg.react('✅'); await msg.react('❌'); } catch {}

    const collector = msg.createReactionCollector({ time: 60000 });
    collector.on('collect', async (reaction, user) => {
      if (user.id !== interaction.user.id || user.bot) return;
      const emoji = reaction.emoji.name;
      if (emoji === '❌') {
        collector.stop('cancelado');
        try { await msg.edit({ content: 'Compra cancelada.', embeds: [], components: [] }); } catch {}
        return;
      }
      if (emoji === '✅') {
        collector.stop('confirmado');
        const resultado = loja.comprar(interaction.user.id, item.id);
        if (!resultado.ok) {
          try { await msg.edit({ content: 'Não foi possível concluir a compra.', embeds: [], components: [] }); } catch {}
          return;
        }
        const saldoFinal = resultado.saldo;
        const embed2 = UI.embedCompra({ tema, client, membro: interaction.user, resultado, saldo: saldoFinal });
        try { await msg.edit({ embeds: [embed2], components: [] }); } catch {}
      }
    });
  },
};
