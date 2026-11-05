const { criarEmbed, THEME } = require('../utils/theme');
const { obterConfig, TIPOS_ANUNCIO } = require('../utils/servidorStore');
const { linhaNavegacao } = require('../utils/ui');

function montarPaginas(guild, cfg) {
  const poke = require('../utils/pokemon').obterConfig(guild.id);
  const roteamento = TIPOS_ANUNCIO.map((t) => {
    const id = cfg.anuncios[t];
    return `˖ **${t}** → ${id ? `<#${id}>` : '`sem canal`'}`;
  }).join('\n');

  const paginas = [
    criarEmbed({
      titulo: '📋 Painel de Organização — visão geral',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        'Todos os meus comandos usam `$` por prefixo (também `/` no slash). ' +
        'Use `$ajuda <comando>` para a explicação completa e `$codex` para o livro inteiro.\n\n' +
        `${THEME.div.bolinhas}`,
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} organiza por aqui...`,
    }).addFields(
      { name: '📚 Ajuda e listas', value: '`$ajuda` · `$codex` · `$ajuda <comando>`', inline: true },
      { name: '⚙️ Configuração', value: '`$configurar` · `$configurar ver`', inline: true },
      { name: '🔎 Pesquisa', value: '`$configurar pesquisar <termo>`', inline: true },
      { name: '🎲 Diversão', value: '`$dado` (abrev: `d`) · `$roleta` · `$8ball`', inline: true },
      { name: '⏰ Lembretes', value: '`$lembrete` (abrev: `lem`)', inline: true },
      { name: '📜 Logs', value: '`$logs` (abrev: `log`)', inline: true },
      { name: '🔴 Pokémon', value: '`$pokemon` (abrev: `p`) · `$pokemon configurar`', inline: true },
      { name: '🎫 Tickets', value: '`$ticket` · `$fechar`', inline: true }
    ),

    criarEmbed({
      titulo: '📋 Painel de Organização — roteamento',
      descricao: `${THEME.div.bolinhas}\n\n**📍 Roteamento de anúncios**\n${roteamento}\n\n${THEME.div.bolinhas}`,
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} organiza por aqui...`,
    }).addFields(
      { name: '🗣️ Onde a bot fala', value: cfg.canaisPermitidos.length > 0 ? `Somente em: ${cfg.canaisPermitidos.map((id) => `<#${id}>`).join('  ·  ')}` : 'Em qualquer canal (exceto os bloqueados)', inline: false },
      { name: '🚫 Canais bloqueados', value: cfg.canaisBloqueados.length > 0 ? cfg.canaisBloqueados.map((id) => `<#${id}>`).join('  ·  ') : '`nenhum`', inline: false },
      { name: '💡 Como ajustar', value: '`$configurar permitir #canal` · `$configurar proibir #canal` · `$configurar anuncio geral #canal`', inline: false }
    ),

    criarEmbed({
      titulo: '📋 Painel de Organização — canais',
      descricao: `${THEME.div.bolinhas}\n\nCanais especiais configurados neste servidor.\n\n${THEME.div.bolinhas}`,
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} organiza por aqui...`,
    }).addFields(
      { name: '🔔 Aviso de desligamento', value: cfg.canalShutdown ? `<#${cfg.canalShutdown}>` : '`nenhum definido`', inline: true },
      { name: '🔛 Canal on/off', value: cfg.canalOnOff ? `<#${cfg.canalOnOff}>` : '`nenhum definido`', inline: true },
      { name: '📜 Canal de logs', value: cfg.canalLogs ? `<#${cfg.canalLogs}>` : '`nenhum definido`', inline: true },
      { name: '🎮 Canal Pokémon', value: poke.channels.length ? `${poke.channels.map((id) => `<#${id}>`).join('  ·  ')} · ${poke.enabled ? '✅ ativos' : '⛔ pausados'}` : '`nenhum — desativado`', inline: true },
      { name: '🎪 Categoria de tickets', value: cfg.categoriaTicket ? `<#${cfg.categoriaTicket}>` : '`nenhum definido`', inline: true },
      { name: '📌 Ticket fixo', value: cfg.canalTicketFixo ? `<#${cfg.canalTicketFixo}>` : '`nenhum definido`', inline: true }
    ),

    criarEmbed({
      titulo: '📋 Painel de Organização — como configurar',
      descricao:
        `${THEME.div.bolinhas}\n\n` +
        'Use `$configurar <subcomando>` (ou `cfg`, `conf`).\n\n' +
        '**Lista de subcomandos**\n' +
        '˖ `ver` — painel atual\n' +
        '˖ `permitir` / `liberar` / `proibir` / `desproibir #canal`\n' +
        '˖ `anuncio <tipo> #canal` / `limparanuncio <tipo>`\n' +
        '˖ `shutdown #canal` / `off-on #canal`\n' +
        '˖ `ticketcategoria #categoria` / `ticketfixo #canal`\n' +
        '˖ `logs #canal` / `limparlogs`\n' +
        '˖ `pokemon #canal` / `pokemon on` / `pokemon off`\n' +
        '˖ `pesquisar <termo>` — busca nas configurações\n\n' +
        '`$ajuda configurar` mostra tudo com exemplos.\n\n' +
        `${THEME.div.bolinhas}`,
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} organiza por aqui...`,
    }),
  ];

  return paginas.map((embed, indice) => {
    embed.setFooter({ text: `${THEME.nome} organiza por aqui... · página ${indice + 1}/${paginas.length}` });
    return embed;
  });
}

module.exports = {
  meta: { guildOnly: true },
  data: { name: 'organizar', description: 'Mostra um painel de organização do servidor e como a bot está distribuída' },

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ Este comando só funciona dentro de um servidor.', ephemeral: true });
    }
    const paginas = montarPaginas(guild, obterConfig(guild.id));
    let indice = 0;
    const row = linhaNavegacao('org', {
      first: true,
      prev: true,
      next: paginas.length <= 1,
      last: paginas.length <= 1,
    });

    await interaction.reply({ embeds: [paginas[0]], components: [row] });
    const mensagem = await interaction.fetchReply().catch(() => null);
    if (!mensagem || paginas.length <= 1) return;

    const coletor = mensagem.createMessageComponentCollector({
      time: 5 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    coletor.on('collect', async (i) => {
      if (i.customId === 'org_first') indice = 0;
      else if (i.customId === 'org_prev') indice = Math.max(0, indice - 1);
      else if (i.customId === 'org_next') indice = Math.min(paginas.length - 1, indice + 1);
      else if (i.customId === 'org_last') indice = paginas.length - 1;
      const novaRow = linhaNavegacao('org', {
        first: indice === 0,
        prev: indice === 0,
        next: indice >= paginas.length - 1,
        last: indice >= paginas.length - 1,
      });
      await i.update({ embeds: [paginas[indice]], components: [novaRow] }).catch(() => {});
    });

    coletor.on('end', async () => {
      try {
        await mensagem.edit({ components: [] });
      } catch {}
    });
  },
  montarPaginas,
};
