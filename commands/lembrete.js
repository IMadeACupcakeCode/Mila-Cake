const crypto = require('crypto');
const { ActionRowBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { parseTempo, formatarDuracao, formatarDataAbsoluta } = require('../utils/tempo');
const { adicionarLembrete, carregarLembretes, removerLembrete, filtrarLembretes } = require('../utils/lembretesStore');
const { agendarLembrete } = require('../utils/agendador');
const { botao } = require('../utils/ui');
const { isStaff } = require('../utils/perms');

const ITENS_POR_PAGINA = 5;

module.exports = {
  data: { name: 'lembrete', description: 'Cria, lista ou cancela lembretes' },

  async execute(interaction, client) {
    const subcomando = interaction.options.getSubcommand();

    if (subcomando === 'criar') {
      return abrirModalCriar(interaction, client);
    }

    if (subcomando === 'listar') {
      return mostrarLista(interaction, client, { userId: interaction.user.id });
    }

    if (subcomando === 'cancelar') {
      const id = interaction.options.getString('id');
      const meus = carregarLembretes();
      const alvo = meus.find((l) => l.id === id && l.userId === interaction.user.id);

      if (!alvo) {
        const embedErro = criarEmbed({
          titulo: 'Lembrete não encontrado',
          descricao: `Não encontrei nenhum lembrete seu com o ID \`${id}\`.`,
          cor: THEME.corErro,
        });
        return interaction.reply({ embeds: [embedErro], ephemeral: true });
      }

      removerLembrete(id);

      const embed = criarEmbed({
        titulo: 'Lembrete cancelado',
        descricao: `O lembrete \`${id}\` foi apagado.`,
        cor: THEME.corLembrete,
      });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

// ── Modal de criação ──────────────────────────────────────────────────
async function abrirModalCriar(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('lembrete_modal')
    .setTitle('🌙 Novo Lembrete');

  const quandoInput = new TextInputBuilder()
    .setCustomId('lembrete_quando')
    .setLabel('📅 Quando? (hora + data ou tempo relativo)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 2pm 21/08/2026 • 13:40 02/12 • 1h30m • 10m • amanhã 14:00')
    .setRequired(true);

  const mensagemInput = new TextInputBuilder()
    .setCustomId('lembrete_mensagem')
    .setLabel('💬 O que lembrar?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Escreva aqui o lembrete...')
    .setMaxLength(500)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(quandoInput),
    new ActionRowBuilder().addComponents(mensagemInput)
  );

  await interaction.showModal(modal);

  const filtro = (i) => i.customId === 'lembrete_modal' && i.user.id === interaction.user.id;
  try {
    const submitted = await interaction.awaitModalSubmit({ filter: filtro, time: 5 * 60 * 1000 });
    const quando = submitted.fields.getTextInputValue('lembrete_quando');
    const mensagem = submitted.fields.getTextInputValue('lembrete_mensagem');

    const ms = parseTempo(quando);

    if (!ms) {
      const embedErro = criarEmbed({
        titulo: '⏰ Tempo inválido',
        descricao:
          'Não entendi esse tempo. Tente:\n' +
          '• `2pm 21/08/2026` — data com AM/PM\n' +
          '• `13:40 02/12` — hora e data curta\n' +
          '• `1h30m` • `10m` • `2d` — tempo relativo\n' +
          '• `amanhã 14:00` • `hoje 18:30`',
        cor: THEME.corErro,
      });
      return submitted.reply({ embeds: [embedErro], ephemeral: true });
    }

    if (ms > 365 * 24 * 60 * 60 * 1000) {
      const embedErro = criarEmbed({
        titulo: '⏰ Tempo muito longo',
        descricao: 'O limite é de **1 ano** por lembrete.',
        cor: THEME.corErro,
      });
      return submitted.reply({ embeds: [embedErro], ephemeral: true });
    }

    const id = crypto.randomBytes(3).toString('hex');
    const disparaEm = Date.now() + ms;

    const lembrete = {
      id,
      userId: submitted.user.id,
      usuarioNome: submitted.user.username,
      channelId: submitted.channelId,
      mensagem,
      disparaEm,
      criadoEm: Date.now(),
    };

    adicionarLembrete(lembrete);
    agendarLembrete(client, lembrete);

    const embed = criarEmbed({
      titulo: '🌙 Lembrete guardado sob a lua',
      descricao:
        `⏰ **Quando:** ${formatarDataAbsoluta(disparaEm)} (em ${formatarDuracao(ms)})\n` +
        `💬 **Mensagem:**\n> ${mensagem}\n\n` +
        `**ID:** \`${id}\``,
      cor: THEME.corLembrete,
      rodape: `${THEME.nome} não vai esquecer, ${submitted.user.username}`,
    });

    return submitted.reply({ embeds: [embed] });
  } catch {
    // Modal expirou ou foi cancelado
  }
}

// ── Lista interativa ──────────────────────────────────────────────────
async function mostrarLista(interaction, client, filtrosIniciais = {}) {
  let filtros = { ...filtrosIniciais, ordenar: 'mais_proximo' };
  let pagina = 0;
  const staff = isStaff(interaction.member);

  function renderizar() {
    const lista = filtrarLembretes(filtros);
    const total = lista.length;
    const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
    pagina = Math.min(pagina, totalPaginas - 1);

    const inicio = pagina * ITENS_POR_PAGINA;
    const paginaItens = lista.slice(inicio, inicio + ITENS_POR_PAGINA);

    const agora = Date.now();
    const linhas = paginaItens.map((l) => {
      const restante = l.disparaEm - agora;
      const status = restante <= 0 ? '🔴 VENCIDO' : `⏳ ${formatarDuracao(restante)}`;
      const data = formatarDataAbsoluta(l.disparaEm);
      const criado = formatarDataAbsoluta(l.criadoEm);
      const autor = l.usuarioNome || l.userId;

      // Privacidade: só o dono ou staff veem o conteúdo
      const isOwner = l.userId === interaction.user.id;
      const podeVerConteudo = isOwner || staff;

      if (podeVerConteudo) {
        return `**\`${l.id}\`** — ${autor}\n📅 **Dispara:** ${data} — ${status}\n📝 **Criado:** ${criado}\n💬 "${l.mensagem}"`;
      } else {
        return `**\`${l.id}\`** — ${autor}\n📅 **Dispara:** ${data} — ${status}\n📝 **Criado:** ${criado}\n🔒 *Lembrete privado*`;
      }
    });

    const descricao = linhas.length
      ? linhas.map((l, i) => `**${inicio + i + 1}.** ${l}`).join('\n\n')
      : 'Nenhum lembrete encontrado com esses filtros.';

    // Info dos filtros ativos
    const infoFiltros = [];
    if (filtros.userId) infoFiltros.push('🔍 Seus lembretes');
    if (filtros.pessoa) infoFiltros.push(`👤 ${filtros.pessoa}`);
    if (filtros.status === 'pendentes') infoFiltros.push('✅ Pendentes');
    if (filtros.status === 'vencidos') infoFiltros.push('🔴 Vencidos');
    if (filtros.ordenar === 'mais_antigo') infoFiltros.push('📅 Expira: mais antigo');
    if (filtros.ordenar === 'mais_recente') infoFiltros.push('📅 Expira: mais recente');
    if (filtros.ordenar === 'criado_antigo') infoFiltros.push('📝 Criado: mais antigo');
    if (filtros.ordenar === 'criado_recente') infoFiltros.push('📝 Criado: mais recente');

    const rodape = `Página ${pagina + 1}/${totalPaginas} • ${total} lembrete(s)${infoFiltros.length ? ' • ' + infoFiltros.join(' • ') : ''}`;

    return {
      embed: criarEmbed({
        titulo: '📋 Lembretes sob a lua',
        descricao,
        cor: THEME.corLembrete,
        rodape,
      }),
      totalPaginas,
    };
  }

  function botoes(totalPaginas) {
    const row = new ActionRowBuilder();
    row.addComponents(
      botao('⏮️', 'lemb_first', ButtonStyle.Secondary).setDisabled(pagina <= 0),
      botao('◀️', 'lemb_prev', ButtonStyle.Primary).setDisabled(pagina <= 0),
      botao('▶️', 'lemb_next', ButtonStyle.Primary).setDisabled(pagina >= totalPaginas - 1),
      botao('⏭️', 'lemb_last', ButtonStyle.Secondary).setDisabled(pagina >= totalPaginas - 1)
    );
    return row;
  }

  function menuFiltros() {
    const menu = new StringSelectMenuBuilder()
      .setCustomId('lemb_filtro')
      .setPlaceholder('🔽 Filtrar / Ordenar')
      .addOptions([
        { label: 'Meus lembretes', value: 'meus', description: 'Mostrar só os seus lembretes', emoji: '👤' },
        { label: 'Todos os lembretes', value: 'todos', description: 'Mostrar lembretes de todos', emoji: '🌍' },
        { label: '✅ Só pendentes', value: 'pendentes', description: 'Apenas lembretes não vencidos', emoji: '✅' },
        { label: '🔴 Só vencidos', value: 'vencidos', description: 'Apenas lembretes vencidos', emoji: '🔴' },
        { label: '📅 Expira: mais próximo', value: 'ord_proximo', description: 'Quem vence primeiro', emoji: '⏳' },
        { label: '📅 Expira: mais distante', value: 'ord_distante', description: 'Quem vence por último', emoji: '⏰' },
        { label: '📝 Criado: mais recente', value: 'ord_criado_recente', description: 'Recém-criados primeiro', emoji: '🆕' },
        { label: '📝 Criado: mais antigo', value: 'ord_criado_antigo', description: 'Mais antigos primeiro', emoji: '📜' },
      ]);
    return new ActionRowBuilder().addComponents(menu);
  }

  const { embed, totalPaginas } = renderizar();
  const resposta = await interaction.reply({
    embeds: [embed],
    components: [botoes(totalPaginas), menuFiltros()],
    fetchReply: true,
    ephemeral: true,
  });

  const coletor = resposta.createMessageComponentCollector({ time: 5 * 60 * 1000, filter: () => true });

  coletor.on('collect', async (i) => {
    if (i.customId === 'lemb_first') pagina = 0;
    else if (i.customId === 'lemb_prev') pagina = Math.max(0, pagina - 1);
    else if (i.customId === 'lemb_next') pagina = Math.min(totalPaginas - 1, pagina + 1);
    else if (i.customId === 'lemb_last') pagina = totalPaginas - 1;
    else if (i.customId === 'lemb_filtro') {
      const valor = i.values[0];
      if (valor === 'meus') filtros.userId = i.user.id;
      else if (valor === 'todos') delete filtros.userId;
      else if (valor === 'pendentes') filtros.status = 'pendentes';
      else if (valor === 'vencidos') filtros.status = 'vencidos';
      else if (valor === 'ord_proximo') filtros.ordenar = 'mais_proximo';
      else if (valor === 'ord_distante') filtros.ordenar = 'mais_recente';
      else if (valor === 'ord_criado_recente') filtros.ordenar = 'criado_recente';
      else if (valor === 'ord_criado_antigo') filtros.ordenar = 'criado_antigo';
      pagina = 0;
    }

    const { embed: novoEmbed, totalPaginas: novasPag } = renderizar();
    await i.update({ embeds: [novoEmbed], components: [botoes(novasPag), menuFiltros()] });
  });

  coletor.on('end', async () => {
    try {
      await resposta.edit({ components: [] });
    } catch {}
  });
}