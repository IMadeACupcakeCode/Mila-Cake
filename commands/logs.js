const { criarEmbed, THEME } = require('../utils/theme');
const { filtrarPorUsuario, todas } = require('../utils/logger');
const { isStaff } = require('../utils/perms');

function formatarEntrada(e) {
  const hora = new Date(e.ts).toLocaleString('pt-BR');
  const quem = e.usuario ? ` · ${e.usuario}` : '';
  const cmd = e.comando ? ` [/${e.comando}]` : '';
  return `˖ \`${hora}\` **${String(e.nivel || 'info').toUpperCase()}**${cmd}: ${e.mensagem}${quem}`;
}

function montarEmbedLogs(entradas, titulo, pagina, totalPaginas) {
  const linhas = entradas.map(formatarEntrada).join('\n');
  return criarEmbed({
    titulo,
    descricao: `${THEME.div.bolinhas}\n\n${linhas || 'Nenhum registro encontrado.'}\n\n${THEME.div.estrelado}`,
    cor: THEME.corPrincipal,
    rodape: totalPaginas > 1 ? `Página ${pagina + 1}/${totalPaginas} · ${THEME.nome} registra tudo pra você~ ♡` : `${THEME.nome} registra tudo pra você~ ♡`,
  });
}

function filtrarEntradas({ pessoa, nivel, termo, quantidade }) {
  let entradas = pessoa ? filtrarPorUsuario(pessoa, quantidade) : todas(quantidade);
  if (nivel) {
    const n = String(nivel).toLowerCase();
    entradas = entradas.filter((e) => String(e.nivel || '').toLowerCase() === n);
  }
  if (termo) {
    const t = String(termo).toLowerCase();
    entradas = entradas.filter((e) => {
      const texto = `${e.mensagem || ''} ${e.comando || ''} ${e.usuario || ''} ${e.canal || ''}`.toLowerCase();
      return texto.includes(t);
    });
  }
  return entradas;
}

// Se a mensagem do comando foi apagada antes da resposta, o Discord devolve
// "Unknown Message". Nesse caso respondemos no canal, sem quebrar o fluxo.
async function responderSeguro(mensagem, payload) {
  try {
    return await mensagem.reply(payload);
  } catch {
    try {
      return await mensagem.channel?.send(payload);
    } catch {
      return null;
    }
  }
}

module.exports = {
  data: { name: 'logs', description: '📜 Mostra os logs da bot (filtre por pessoa, nível ou termo)', options: [
    { name: 'pessoa', description: 'Nome ou ID para filtrar', type: 3, required: false, max_length: 100 },
    { name: 'quantidade', description: 'Quantidade de logs (1 a 100)', type: 4, required: false, min_value: 1, max_value: 100 },
    { name: 'nivel', description: 'Nível (info, cmd, debug, sucesso, aviso, erro)', type: 3, required: false },
    { name: 'termo', description: 'Termo de pesquisa', type: 3, required: false, max_length: 100 },
  ] },
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [criarEmbed({ titulo: 'Sem permissão', descricao: 'Este comando é restrito a staff.', cor: THEME.corErro })], ephemeral: true });
    }
    const pessoa = interaction.options.getString('pessoa');
    const quantidade = Math.min(Math.max(interaction.options.getInteger('quantidade') || 30, 1), 100);
    const nivel = interaction.options.getString('nivel');
    const termo = interaction.options.getString('termo');

    const entradas = filtrarEntradas({ pessoa, nivel, termo, quantidade });
    if (!entradas.length) {
      return interaction.reply({ embeds: [criarEmbed({ titulo: '📜 Sem logs por aqui', descricao: pessoa ? `Não encontrei registros para **${pessoa}**.` : 'Ainda não há registros. Use alguns comandos e tente de novo.', cor: THEME.corPrincipal })], ephemeral: true });
    }

    const porPagina = 12;
    const paginas = [];
    for (let i = 0; i < entradas.length; i += porPagina) {
      paginas.push(montarEmbedLogs(entradas.slice(i, i + porPagina), pessoa ? `📜 Logs de ${pessoa}` : '📜 Logs recentes da Mila Bot', Math.floor(i / porPagina), Math.ceil(entradas.length / porPagina)));
    }

    // slash: envia primeira página com botões de paginação
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    let paginaAtual = 0;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('logs_anterior').setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('logs_proximo').setLabel('Próximo').setStyle(ButtonStyle.Secondary).setDisabled(paginas.length <= 1)
    );
    const msg = await interaction.reply({ embeds: [paginas[0]], components: paginas.length > 1 ? [row] : [], ephemeral: true }).then(() => interaction.fetchReply().catch(() => null)).catch(() => null);
    if (!msg || paginas.length <= 1) return msg;

    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async (componente) => {
      if (componente.user.id !== interaction.user.id) {
        await componente.reply({ content: 'Apenas quem abriu os logs pode navegar.', ephemeral: true }).catch(() => {});
        return;
      }
      if (componente.customId === 'logs_anterior') paginaAtual = Math.max(0, paginaAtual - 1);
      else if (componente.customId === 'logs_proximo') paginaAtual = Math.min(paginas.length - 1, paginaAtual + 1);
      const novoRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('logs_anterior').setLabel('Anterior').setStyle(ButtonStyle.Secondary).setDisabled(paginaAtual === 0),
        new ButtonBuilder().setCustomId('logs_proximo').setLabel('Próximo').setStyle(ButtonStyle.Secondary).setDisabled(paginaAtual >= paginas.length - 1)
      );
      await componente.update({ embeds: [paginas[paginaAtual]], components: [novoRow] }).catch(() => {});
    });
    collector.on('end', async () => {
      try { await msg.edit({ components: [] }); } catch {}
    });
    return msg;
  },
  async executePrefix(message, args, client) {
    if (!isStaff(message.member)) {
      return responderSeguro(message, { embeds: [criarEmbed({ titulo: 'Sem permissão', descricao: 'Este comando é restrito a staff.', cor: THEME.corErro })] });
    }
    // parse simples: $logs [pessoa] [quantidade]
    const pessoa = args.find((a) => !/^\d+$/.test(a)) || null;
    const quantidade = Math.min(Math.max(Number(args.find((a) => /^\d+$/.test(a))) || 30, 1), 100);
    const entradas = filtrarEntradas({ pessoa, quantidade });
    if (!entradas.length) {
      return responderSeguro(message, { embeds: [criarEmbed({ titulo: '📜 Sem logs por aqui', descricao: pessoa ? `Não encontrei registros para **${pessoa}**.` : 'Ainda não há registros.', cor: THEME.corPrincipal })] });
    }
    const porPagina = 12;
    const paginas = [];
    for (let i = 0; i < entradas.length; i += porPagina) {
      paginas.push(montarEmbedLogs(entradas.slice(i, i + porPagina), pessoa ? `📜 Logs de ${pessoa}` : '📜 Logs recentes da Mila Bot', Math.floor(i / porPagina), Math.ceil(entradas.length / porPagina)));
    }
    if (paginas.length === 1) return responderSeguro(message, { embeds: [paginas[0]] });
    let indice = 0;
    const msg = await responderSeguro(message, { embeds: [paginas[0]] });
    if (!msg) return null;
    try { await msg.react('⬅️'); } catch {}
    try { await msg.react('➡️'); } catch {}
    const coletor = msg.createReactionCollector({ filter: (r, u) => ['⬅️', '➡️'].includes(r.emoji.name) && u.id === message.author.id, time: 180000 });
    coletor.on('collect', async (reaction) => {
      if (reaction.emoji.name === '➡️') indice = Math.min(paginas.length - 1, indice + 1);
      else indice = Math.max(0, indice - 1);
      try { await msg.edit({ embeds: [paginas[indice]] }); } catch {}
      try { await reaction.users.remove(message.author.id); } catch {}
    });
    coletor.on('end', async () => { try { await msg.reactions.removeAll(); } catch {} });
    return msg;
  },
};