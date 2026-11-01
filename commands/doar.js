const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const criador = require('../utils/criador');
const loja = require('../utils/economyLoja');
const db = require('../utils/db');

const GABE = [
  'Gabe Newell sorri de longe: "Presentes são o coração do PC."',
  'Obrigado, Gabe, por inventar o sistema de Presentes.',
  'Em nome de Gabe, compartilhar é amar.',
];

module.exports = {
  data: {
    name: 'doar',
    description: '💸 Doe Açúcares ou itens para outro membro',
    options: [
      { name: 'usuario', description: 'Quem vai receber (opcional no uso isolado)', type: 6, required: false },
      { name: 'item', description: 'ID do item da sua mochila (opcional)', type: 3, required: false, choices: loja.listarItens().map((i) => ({ name: `${i.emoji} ${i.nome}`.slice(0, 100), value: i.id })) },
      { name: 'quantidade', description: 'Quantidade', type: 4, required: false, min_value: 1 },
    ],
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const alvo = interaction.options?.getUser('usuario');
    let itemId = interaction.options?.getString('item');
    let qtd = Number(interaction.options?.getInteger('quantidade')) || 1;

    if (itemId && !loja.buscarItem(itemId) && /^\d+$/.test(itemId) && interaction.options?.getInteger('quantidade') == null) {
      qtd = Math.max(1, Number(itemId));
      itemId = null;
    }

    if (!alvo) {
      const embed = theme.janela({
        tema,
        titulo: '🎁 Doar',
        descricao: 'Use `$doar @amigo [item] [quantidade]` ou `/doar`.\n\nReaja com 💰 para doar Açúcares ou 🎒 para doar um item da sua mochila.',
        cor: tema.cor2,
        autorNome: `${tema.icone} Mila • Presentes`,
        autorIcone: client?.user?.displayAvatarURL?.({ size: 128 }),
        rodape: `${tema.rodape} • Obrigado, Gabe Newell`,
      });
      const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
      try { await msg.react('💰'); await msg.react('🎒'); } catch {}
      return;
    }
    if (alvo.bot) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação', 'Bots não precisam de Açúcares.')], ephemeral: true });
    if (alvo.id === interaction.user.id) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação', 'Você não pode doar para si mesmo.')], ephemeral: true });

    let item = itemId ? loja.buscarItem(itemId) : null;
    if (itemId && !item) {
      const inv = db.getInventario(interaction.user.id).find((i) => String(i.item_id) === String(itemId));
      if (!inv) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação', 'Item não encontrado na sua mochila.')], ephemeral: true });
      item = { id: itemId, nome: itemId, emoji: '🎁' };
    }
    if (itemId && !item) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Doação', 'Item não encontrado na loja.')], ephemeral: true });

    const quantidade = Math.max(1, Number(qtd) || 1);
    const resumo = item
      ? `${quantidade}x ${item.emoji} **${item.nome}**`
      : `${Number(quantidade).toLocaleString('pt-BR')} ${theme.MOEDA}`;

    const embed = theme.janela({
      tema,
      titulo: '🎁 Confirmar presente',
      descricao: `De ${interaction.user} para ${alvo}\nValor: **${resumo}**\n\nReaja com ✅ para enviar ou ❌ para cancelar. (Somente o doador pode confirmar.)`,
      cor: tema.cor2,
      thumbnail: alvo.displayAvatarURL?.({ size: 128 }),
      autorNome: `${tema.icone} Mila • Presentes`,
      autorIcone: client?.user?.displayAvatarURL?.({ size: 128 }),
      rodape: `${tema.rodape} • Obrigado, Gabe Newell`,
    });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    try { await msg.react('✅'); await msg.react('❌'); } catch {}

    let processado = false;
    const collector = msg.createReactionCollector({ time: 60000 });
    collector.on('collect', async (reaction, user) => {
      if (user.id !== interaction.user.id || user.bot || processado) return;
      const emoji = reaction.emoji.name;
      if (emoji === '❌') {
        processado = true;
        collector.stop('cancelado');
        try { await msg.edit({ content: 'Presente cancelado.', embeds: [], components: [] }); } catch {}
        return;
      }
      if (emoji !== '✅') return;
      processado = true;
      collector.stop('confirmado');

      let resultado;
      if (item) resultado = service.doarItem(interaction.user.id, alvo.id, item.id, quantidade);
      else resultado = service.doar(interaction.user.id, alvo.id, quantidade);

      if (!resultado.ok) {
        const motivo = item
          ? (resultado.motivo === 'sem_item' ? `Você não tem ${quantidade}x **${item.nome}** na mochila.` : 'Não foi possível concluir.')
          : (resultado.motivo === 'sem_saldo'
              ? `Você só tem \`${theme.formatarNumero(resultado.saldo)}\` ${theme.MOEDA}.`
              : resultado.motivo === 'saldo_invalido'
                ? 'Uma das contas tem saldo fora do limite seguro. Nenhum Açúcar foi transferido; peça uma revisão ao administrador.'
                : resultado.motivo === 'mesmo_usuario' ? 'Você não pode doar para si mesmo.' : 'Não foi possível concluir.');
        try { await msg.edit({ content: motivo, embeds: [], components: [] }); } catch {}
        return;
      }

      const gabe = GABE[Math.floor(Math.random() * GABE.length)];
      const sucesso = theme.janela({
        tema,
        titulo: '🎁 Presente enviado',
        descricao: `Caixa de presente Steam™\n${gabe}`,
        cor: tema.cor2,
        thumbnail: alvo.displayAvatarURL?.({ size: 128 }),
        autorNome: `${tema.icone} Mila • Presentes`,
        autorIcone: client?.user?.displayAvatarURL?.({ size: 128 }),
        campos: item
          ? [
              { name: 'De', value: `${interaction.user}`, inline: true },
              { name: 'Para', value: `${alvo}`, inline: true },
              { name: 'Item', value: `${resultado.quantidade}x ${item.nome}`, inline: true },
            ]
          : [
              { name: 'De', value: `${interaction.user}`, inline: true },
              { name: 'Para', value: `${alvo}`, inline: true },
              { name: 'Valor', value: `${Number(resultado.quantidade || 0).toLocaleString('pt-BR')} ${theme.MOEDA}`, inline: true },
              { name: 'Seu saldo', value: `\`${UI.saldoTexto(resultado.saldo, resultado.ehCriador)}\``, inline: true },
            ],
        rodape: `${tema.rodape} • Obrigado, Gabe Newell`,
      });

      try { await msg.edit({ ...UI.comMascote(sucesso), components: [] }); } catch (erro) {
        console.error('[doar] Falha ao editar mensagem:', erro);
      }
    });
  },
};
