const loja = require('../utils/economyLoja');
const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const db = require('../utils/db');
const criador = require('../utils/criador');

module.exports = {
  data: {
    name: 'vender',
    description: '💰 Vende itens da sua mochila por metade do preço',
    options: [
      { name: 'item', description: 'Item a vender', type: 3, required: true, choices: loja.listarItens().map((i) => ({ name: `${i.emoji} ${i.nome} — ${Math.floor(i.preco / 2)} 🍬`, value: i.id })) },
      { name: 'quantidade', description: 'Quantidade', type: 4, required: false, min_value: 1 },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const itemId = interaction.options.getString('item');
    const qtd = Number(interaction.options.getInteger('quantidade')) || 1;
    const item = loja.buscarItem(itemId);
    if (!item) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Venda', 'Item não encontrado.')], ephemeral: true });

    const inv = db.getInventario(interaction.user.id).find((i) => String(i.item_id) === String(itemId));
    if (!inv || Number(inv.quantidade) < qtd) {
      return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Venda recusada', `Você não tem ${qtd}x **${item.nome}** na mochila.`)], ephemeral: true });
    }

    const precoUnitario = Math.max(1, Math.floor(item.preco / 2));
    const valor = precoUnitario * qtd;
    const embed = theme.janela({
      tema,
      titulo: '💰 Confirmar venda',
      descricao: `Item: **${item.emoji} ${item.nome}**\nQuantidade: **${qtd}**\nVocê receberá: **${valor.toLocaleString('pt-BR')} 🍬** (metade do preço)\n\nReaja com ✅ para vender ou ❌ para cancelar.`,
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
        try { await msg.edit({ content: 'Venda cancelada.', embeds: [], components: [] }); } catch {}
        return;
      }
      if (emoji !== '✅') return;
      collector.stop('confirmado');
      const resultado = service.venderItem(interaction.user.id, item.id, qtd);
      if (!resultado.ok) {
        try { await msg.edit({ content: 'Não foi possível concluir a venda.', embeds: [], components: [] }); } catch {}
        return;
      }
      const sucesso = theme.janela({
        tema,
        titulo: '💰 Venda concluída',
        descricao: `Você vendeu **${resultado.quantidade}x ${item.emoji} ${item.nome}** por **${resultado.valor.toLocaleString('pt-BR')} 🍬**.`,
        cor: tema.cor2,
        rodape: `${tema.rodape} • Mila Loja`,
        campos: [
          { name: 'Item', value: `${item.emoji} ${item.nome}`, inline: true },
          { name: 'Quantidade', value: `${resultado.quantidade}`, inline: true },
          { name: 'Recebido', value: `${resultado.valor.toLocaleString('pt-BR')} 🍬`, inline: true },
          { name: 'Seu saldo', value: `\`${resultado.saldo}\` 🍬`, inline: true },
        ],
      });
      try { await msg.edit({ embeds: [UI.comMascote ? UI.comMascote(sucesso) : sucesso], components: [] }); } catch {}
    });
  },
};
