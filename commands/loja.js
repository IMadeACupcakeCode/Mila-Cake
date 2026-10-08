const { criarEmbed, THEME } = require('../utils/theme');
const db = require('../utils/db');

// Catálogo com os titulos que modificam o $perfil (podem ser criados mais depois)
const CATALOGO = [
  { id: 'titulo_mestre', name: 'Título: Mestre dos Doces', price: 10000, desc: 'Muda seu título no perfil' },
  { id: 'titulo_vip', name: 'Título: Confeiteiro VIP', price: 5000, desc: 'Mostre que você é especial' },
  { id: 'ingresso_evento', name: '🎫 Ingresso p/ Festival', price: 1500, desc: 'Para entrar nos eventos exclusivos da Mila' }
];

module.exports = {
  data: {
    name: 'loja',
    description: 'Catálogo oficial da doceria Mila! Compre títulos e itens!',
    options: [
      {
        name: 'comprar',
        description: 'ID do item que deseja comprar (opcional)',
        type: 3, // STRING
        required: false,
        choices: CATALOGO.map(c => ({ name: `${c.name} (${c.price} 🍬)`, value: c.id }))
      }
    ]
  },
  async execute(interaction) {
    const compraId = interaction.options?.getString('comprar');

    if (!compraId) {
      // Exibe catálogo
      const texto = CATALOGO.map(i => `**• ${i.name}**\nPreço: \`${i.price.toLocaleString()} 🍬\`\nID: \`${i.id}\`\n*${i.desc}*`).join('\n\n');
      const embed = criarEmbed({
        titulo: '🏬 Loja da Mila Cake',
        descricao: `Seja muito bem-vindo à lojinha!\nUse \`/loja\` selecionando o ID para comprar.\n\n${THEME.div.pontos}\n\n${texto}`,
        cor: THEME.corBubblegum
      });
      return interaction.reply({ embeds: [embed] });
    }

    const item = CATALOGO.find(i => i.id === compraId);
    if (!item) return interaction.reply({ content: '❌ O item digitado não existe nas prateleiras!', ephemeral: true });

    const usuario = db.getUsuario(interaction.user.id);
    if (usuario.acucares < item.price) {
      return interaction.reply({ content: `❌ Hum... Deu faltando. O item custa **${item.price} 🍬** mas você tem apenas **${usuario.acucares}**!`, ephemeral: true });
    }

    // Desconta o dinheiro
    db.addAcucares(interaction.user.id, -item.price);

    // Efeitos da Compra
    if (compraId.startsWith('titulo_')) {
      // Atualiza o Titulo no profile
      db.atualizarTitulo(interaction.user.id, item.name.replace('Título: ', ''));
      await interaction.reply({ content: `✅ Compra realizada! Descontado **${item.price} 🍬**. Seu novo título foi atualizado no \`/perfil\`.` });
    } else {
      // Cai no Inventario padrao
      db.addInventario(interaction.user.id, item.name, 1);
      await interaction.reply({ content: `✅ Compra realizada! **${item.name}** foi colocado na sua mochila! Descontado **${item.price} 🍬**.` });
    }
  }
};
