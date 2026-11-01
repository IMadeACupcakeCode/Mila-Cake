const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const loja = require('../utils/economyLoja');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const { THEME } = require('../utils/theme');
const db = require('../utils/db');
const criador = require('../utils/criador');

const TEMPO_SESSAO_MS = 5 * 60 * 1000;
const OPCOES_CATEGORIA = [
  { label: 'Todas as categorias', value: 'todas', emoji: '🛍️' },
  ...loja.CATEGORIAS.map((categoria) => ({
    label: categoria.nome,
    value: categoria.id,
    emoji: categoria.emoji,
    description: categoria.descricao.slice(0, 100),
  })),
];

const data = {
  name: 'loja',
  description: '🛍️ Explore categorias, confira itens e compre com segurança',
  options: [
    {
      name: 'comprar',
      description: 'Comprar um item diretamente pelo nome',
      type: 3,
      required: false,
      choices: loja.listarItens().map((item) => ({
        name: `${item.emoji} ${item.nome} — ${item.preco} 🍬`.slice(0, 100),
        value: item.id,
      })),
    },
    {
      name: 'categoria',
      description: 'Abrir a loja já filtrada por uma categoria',
      type: 3,
      required: false,
      choices: loja.CATEGORIAS.map((categoria) => ({
        name: `${categoria.emoji} ${categoria.nome}`,
        value: categoria.id,
      })),
    },
  ],
};

function saldoDo(usuarioId) {
  return criador.ehCriador(usuarioId)
    ? criador.PONTOS_INFINITOS
    : Number(db.getUsuario(usuarioId).acucares) || 0;
}

function montarEmbed({ tema, membro, categoria, saldo, selecionado, aviso, carrinho = new Map() }) {
  const categorias = loja.listarPorCategoria()
    .filter((item) => !categoria || categoria === 'todas' || item.id === categoria);
  const campos = categorias.map((grupo) => ({
    name: `${grupo.emoji} ${grupo.nome}`,
    value: grupo.itens.map((item) =>
      `${item.emoji} **${item.nome}** · \`${theme.formatarNumero(item.preco)}\` ${theme.MOEDA}\n${item.descricao}`
    ).join('\n\n'),
  }));
  const itemSelecionado = selecionado ? loja.buscarItem(selecionado) : null;
  const itensCarrinho = [...carrinho.entries()]
    .map(([id, quantidade]) => ({ item: loja.buscarItem(id), quantidade }))
    .filter((linha) => linha.item);
  const totalCarrinho = itensCarrinho.reduce((total, linha) => total + linha.item.preco * linha.quantidade, 0);
  const resumoCarrinho = itensCarrinho.length
    ? itensCarrinho.map(({ item, quantidade }) =>
      `${item.emoji} **${item.nome}** × ${quantidade} · ${theme.formatarNumero(item.preco * quantidade)} ${theme.MOEDA}`
    ).join('\n')
    : 'Seu carrinho está vazio. Selecione um item e adicione para começar.';
  const descricao = [
    `Saldo disponível: **${theme.formatarNumero(saldo)} ${theme.MOEDA}**`,
    itemSelecionado
      ? `Selecionado: ${itemSelecionado.emoji} **${itemSelecionado.nome}** · \`${theme.formatarNumero(itemSelecionado.preco)}\` ${theme.MOEDA}`
      : 'Escolha uma categoria e um item. Adicione ao carrinho e finalize quando estiver tudo certo.',
    `**Total do carrinho:** ${theme.formatarNumero(totalCarrinho)} ${theme.MOEDA}`,
    aviso || '',
  ].filter(Boolean).join('\n\n');

  return theme.janela({
    tema,
    titulo: 'Loja da Mila',
    descricao,
    cor: aviso ? THEME.corErro : tema.cor2,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: `${tema.rodape} · escolha com carinho`,
    campos: [...campos, { name: '🧺 Seu carrinho', value: resumoCarrinho }],
  });
}

function montarComponentes({ categoria, selecionado, carrinho = new Map() }) {
  const grupos = loja.listarPorCategoria()
    .filter((item) => !categoria || categoria === 'todas' || item.id === categoria);
  const itens = grupos.flatMap((grupo) => grupo.itens);
  const categoriaMenu = new StringSelectMenuBuilder()
    .setCustomId('loja_categoria')
    .setPlaceholder('1 · Escolha uma categoria')
    .addOptions(OPCOES_CATEGORIA.map((item) => ({
      ...item,
      default: item.value === (categoria || 'todas'),
    })));
  const linhas = [new ActionRowBuilder().addComponents(categoriaMenu)];

  if (itens.length) {
    const itemMenu = new StringSelectMenuBuilder()
      .setCustomId('loja_item')
      .setPlaceholder('2 · Escolha um item para ver o preço')
      .addOptions(itens.slice(0, 25).map((item) => ({
        label: item.nome.slice(0, 100),
        value: item.id,
        description: `${theme.formatarNumero(item.preco)} Açúcares · ${item.descricao}`.slice(0, 100),
        emoji: item.emoji,
        default: item.id === selecionado,
      })));
    linhas.push(new ActionRowBuilder().addComponents(itemMenu));
  }

  linhas.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('loja_adicionar')
      .setLabel('Adicionar ao carrinho')
      .setEmoji('➕')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!selecionado),
    new ButtonBuilder()
      .setCustomId('loja_limpar')
      .setLabel('Limpar carrinho')
      .setEmoji('🗑️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(carrinho.size === 0)
  ));
  linhas.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('loja_finalizar')
      .setLabel('Finalizar compra')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(carrinho.size === 0),
    new ButtonBuilder()
      .setCustomId('loja_fechar')
      .setLabel('Fechar loja')
      .setEmoji('✖️')
      .setStyle(ButtonStyle.Secondary)
  ));
  return linhas;
}

function montarEmbedCompraLote({ tema, membro, itens, total, saldo }) {
  const linhas = itens.map(({ item, quantidade }) =>
    `${item.emoji} **${item.nome}** × ${quantidade} · ${theme.formatarNumero(item.preco * quantidade)} ${theme.MOEDA}`
  ).join('\n');
  return theme.janela({
    tema,
    titulo: 'Pedido confirmado!',
    descricao: `Sua compra foi concluída. Obrigada por escolher a lojinha da Mila!`,
    cor: THEME.corSucesso,
    thumbnail: membro.displayAvatarURL?.({ size: 128 }),
    rodape: 'Mila Loja · compra concluída',
    campos: [
      { name: '🧺 Itens', value: linhas },
      { name: '💸 Total', value: `${theme.formatarNumero(total)} ${theme.MOEDA}`, inline: true },
      { name: '💰 Saldo restante', value: `${theme.formatarNumero(saldo)} ${theme.MOEDA}`, inline: true },
    ],
  });
}

function mensagemCompraRecusada(resultado) {
  if (resultado.motivo === 'sem_saldo') {
    return `Saldo insuficiente: faltam **${theme.formatarNumero(Math.max(0, resultado.item.preco - resultado.saldo))} ${theme.MOEDA}**. Você tem **${theme.formatarNumero(resultado.saldo)} ${theme.MOEDA}**.`;
  }
  return 'Esse item não está disponível. Feche a loja e tente novamente.';
}

async function executar(interaction, client) {
  const tema = theme.temaDe(interaction);
  const membro = interaction.user;
  const comprarId = interaction.options?.getString('comprar');
  const categoriaInicial = interaction.options?.getString('categoria') || 'todas';

  if (comprarId) {
    const resultado = loja.comprar(membro.id, comprarId);
    if (!resultado.ok) {
      return interaction.reply({
        embeds: [theme.janelaAviso(tema, 'Compra não concluída', mensagemCompraRecusada(resultado), { rodape: 'Loja da Mila' })],
        ephemeral: true,
      });
    }
    return interaction.reply({
      ...UI.comMascote(UI.embedCompra({
        tema,
        client,
        membro,
        resultado,
        saldo: resultado.saldo,
      })),
      ephemeral: true,
    });
  }

  const estado = { categoria: categoriaInicial, selecionado: null, carrinho: new Map() };
  const render = (aviso = '') => ({
    embeds: [montarEmbed({ tema, membro, saldo: saldoDo(membro.id), ...estado, aviso })],
    components: montarComponentes(estado),
  });
  const mensagem = await interaction.reply({ ...render(), ephemeral: true, fetchReply: true });
  const collector = mensagem.createMessageComponentCollector({
    time: TEMPO_SESSAO_MS,
    filter: (componente) => componente.user.id === membro.id,
  });

  collector.on('collect', async (componente) => {
    try {
      if (componente.customId === 'loja_categoria') {
        estado.categoria = componente.values[0];
        estado.selecionado = null;
        await componente.update(render());
        return;
      }

      if (componente.customId === 'loja_item') {
        const itemSelecionado = loja.buscarItem(componente.values[0]);
        if (!itemSelecionado || (estado.categoria !== 'todas' && itemSelecionado.categoria !== estado.categoria)) {
          await componente.update(render('Esse item não pertence à categoria selecionada. Escolha um item do catálogo.'));
          return;
        }
        estado.selecionado = itemSelecionado.id;
        await componente.update(render());
        return;
      }

      if (componente.customId === 'loja_fechar') {
        collector.stop('fechada');
        await componente.update({
          embeds: [theme.janela({
            tema,
            titulo: 'Loja fechada',
            descricao: 'Tudo certo — nenhuma compra é feita sem confirmação.',
            cor: tema.cor2,
            thumbnail: membro.displayAvatarURL?.({ size: 128 }),
            rodape: 'Mila Loja · volte quando quiser',
          })],
          components: [],
        });
        return;
      }

      if (componente.customId === 'loja_limpar') {
        estado.carrinho.clear();
        await componente.update(render('Carrinho limpo. Suas escolhas foram removidas.'));
        return;
      }

      if (componente.customId === 'loja_adicionar') {
        if (!estado.selecionado) {
          await componente.update(render('Selecione um item antes de adicioná-lo ao carrinho.'));
          return;
        }
        const quantidade = estado.carrinho.get(estado.selecionado) || 0;
        if (quantidade >= 99) {
          await componente.update(render('Limite de 99 unidades por item atingido nesta compra.'));
          return;
        }
        estado.carrinho.set(estado.selecionado, quantidade + 1);
        const item = loja.buscarItem(estado.selecionado);
        await componente.update(render(`${item.emoji} **${item.nome}** foi adicionado ao carrinho.`));
        return;
      }

      if (componente.customId === 'loja_finalizar') {
        const itens = [...estado.carrinho.entries()]
          .map(([id, quantidade]) => ({ item: loja.buscarItem(id), quantidade }))
          .filter((linha) => linha.item);
        if (!itens.length) {
          await componente.update(render('Adicione ao menos um item antes de finalizar a compra.'));
          return;
        }
        const total = itens.reduce((valor, linha) => valor + linha.item.preco * linha.quantidade, 0);
        const saldoAtual = saldoDo(membro.id);
        if (saldoAtual < total && !criador.ehCriador(membro.id)) {
          await componente.update(render(`Saldo insuficiente: faltam **${theme.formatarNumero(total - saldoAtual)} ${theme.MOEDA}**. Ajuste o carrinho ou ganhe mais Açúcares.`));
          return;
        }

        for (const { item, quantidade } of itens) {
          for (let unidade = 0; unidade < quantidade; unidade += 1) {
            const resultado = loja.comprar(membro.id, item.id);
            if (!resultado.ok) {
              await componente.update(render(mensagemCompraRecusada(resultado)));
              return;
            }
          }
        }
        const saldoFinal = saldoDo(membro.id);
        collector.stop('comprada');
        await componente.update({
          embeds: [montarEmbedCompraLote({
            tema,
            membro,
            itens,
            total,
            saldo: saldoFinal,
          })],
          components: [],
        });
      }
    } catch (erro) {
      console.error('[Loja] Falha ao processar interação:', erro?.message || erro);
      if (!componente.replied && !componente.deferred) {
        await componente.reply({
          embeds: [theme.janelaAviso(tema, 'A loja teve um imprevisto', 'Não consegui concluir essa ação. Tente novamente ou use `/loja comprar` para uma compra direta.', { rodape: 'Loja da Mila' })],
          ephemeral: true,
        });
      }
    }
  });

  collector.on('end', async (_coletadas, motivo) => {
    if (motivo === 'comprada' || motivo === 'fechada') return;
    try {
      await mensagem.edit({
        content: '⏳ A sessão da loja expirou. Abra `/loja` para escolher novamente.',
        components: [],
      });
    } catch (erro) {
      console.error('[Loja] Não consegui encerrar os componentes da sessão:', erro?.message || erro);
    }
  });
}

module.exports = {
  data,
  execute: executar,
  internals: { montarEmbed, montarComponentes, montarEmbedCompraLote, mensagemCompraRecusada },
};
