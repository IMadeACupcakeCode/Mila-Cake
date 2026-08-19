const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { isStaff } = require('../utils/perms');
const { isGuildStaff, presenceStatus, isOnline, STATUS_EMOJI, buildMembroEmbed } = require('../utils/membroEmbed');
const { salvarSnapshot, obterMarcacoes, obterHistorico, avaliarRisco } = require('../utils/segurancaStore');
const { clientCache, presenceMap } = require('../utils/cache');
const { formatarDataAbsoluta } = require('../utils/tempo');

const TIPO_LABEL = { bot: '🤖', humano: '👤' };

function cacheArray(guildId) {
  const entry = clientCache.get(guildId);
  if (!entry || !entry.members) return [];
  return Array.from(entry.members.values());
}

function filtrar(view, membros) {
  switch (view) {
    case 'online':
      return membros.filter(isOnline);
    case 'offline':
      return membros.filter((m) => !isOnline(m));
    case 'bots':
      return membros.filter((m) => m.user.bot);
    case 'staff':
      return membros.filter(isGuildStaff);
    case 'members':
      return membros.filter((m) => !m.user.bot && !isGuildStaff(m));
    case 'suspeitos':
      return membros.filter((m) => {
        if (m.user.bot) return false; // bots nunca são "suspeitos"
        const hist = obterHistorico(m.user.id);
        if (hist.suspenso > 0 || (hist.suspeitas && hist.suspeitas.length)) return true;
        return avaliarRisco(m).length > 0;
      });
    default:
      return membros;
  }
}

// Busca textual por nome/tag/id (case-insensitive)
function buscar(termo, membros) {
  const t = (termo || '').trim().toLowerCase();
  if (!t) return membros;
  return membros.filter((m) => {
    const u = m.user;
    return (
      (u.username && u.username.toLowerCase().includes(t)) ||
      (u.tag && u.tag.toLowerCase().includes(t)) ||
      (u.globalName && u.globalName.toLowerCase().includes(t)) ||
      (u.id && u.id.includes(t))
    );
  });
}

const VIEW_LABELS = {
  all: 'Todos os membros',
  online: 'Apenas online',
  offline: 'Offline / Invisíveis',
  bots: '🤖 Bots',
  staff: '👑 Staff',
  members: '👤 Membros normais',
  suspeitos: '🚨 Suspeitos / com histórico',
};

// ── Estatísticas ──────────────────────────────────────────────────────────
function buildStats(membros) {
  const bots = membros.filter((m) => m.user.bot);
  const humans = membros.filter((m) => !m.user.bot);
  const staff = membros.filter(isGuildStaff);
  const online = membros.filter(isOnline);
  const offline = membros.filter((m) => !isOnline(m));
  const suspeitos = membros.filter((m) => {
    if (m.user.bot) return false; // bots não contam como suspeitos
    const h = obterHistorico(m.user.id);
    if (h.suspenso > 0 || (h.suspeitas && h.suspeitas.length)) return true;
    return avaliarRisco(m).length > 0;
  });
  return {
    total: membros.length,
    bots: bots.length,
    humans: humans.length,
    staff: staff.length,
    online: online.length,
    offline: offline.length,
    suspeitos: suspeitos.length,
  };
}

const POR_PAGINA = 12;

function formatPage(lista, pagina, termo) {
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  pagina = Math.min(Math.max(0, pagina), paginas - 1);
  const fatia = lista.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);

  const linhas = fatia.length
    ? fatia.map((m) => {
        const st = presenceStatus(m);
        const tipo = m.user.bot ? TIPO_LABEL.bot : TIPO_LABEL.humano;
        const tagStaff = isGuildStaff(m) ? ' 👑' : '';
        const hist = obterHistorico(m.user.id);
        const alerta = hist.suspenso > 0 || (hist.suspeitas && hist.suspeitas.length) ? ' 🚨' : '';
        return `${STATUS_EMOJI[st] || '⚪'} ${tipo} \`${m.user.id}\` — ${m.user.tag}${tagStaff}${alerta}`;
      })
    : ['Nenhum membro encontrado.'];

  const filtroInfo = termo ? `\n🔎 Busca: \`${termo}\`` : '';
  return { texto: linhas.join('\n') + filtroInfo, pagina, paginas, total, fatia };
}

// ── Botões / menus ────────────────────────────────────────────────────────
function navRow(pagina, paginas) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sec_first').setLabel('⏮️').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 0),
    new ButtonBuilder().setCustomId('sec_prev').setLabel('◀️').setStyle(ButtonStyle.Primary).setDisabled(pagina <= 0),
    new ButtonBuilder().setCustomId('sec_next').setLabel('▶️').setStyle(ButtonStyle.Primary).setDisabled(pagina >= paginas - 1),
    new ButtonBuilder().setCustomId('sec_last').setLabel('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(pagina >= paginas - 1)
  );
}

function buildButtons(view) {
  const mk = (id, label, emoji, style) =>
    new ButtonBuilder().setCustomId(id).setLabel(label).setEmoji(emoji).setStyle(style);
  const ativo = (v) => v === view;
  const wrap = (b) => b.setDisabled(ativo(b.data.custom_id.replace('sec_view_', '')));

  const row1 = new ActionRowBuilder().addComponents(
    wrap(mk('sec_view_all', 'Todos', '📋', ButtonStyle.Primary)),
    wrap(mk('sec_view_online', 'Online', '🟢', ButtonStyle.Success)),
    wrap(mk('sec_view_offline', 'Offline', '⚪', ButtonStyle.Secondary)),
    wrap(mk('sec_view_bots', 'Bots', '🤖', ButtonStyle.Secondary)),
    wrap(mk('sec_view_staff', 'Staff', '👑', ButtonStyle.Secondary))
  );
  const row2 = new ActionRowBuilder().addComponents(
    wrap(mk('sec_view_members', 'Membros', '👤', ButtonStyle.Secondary)),
    wrap(mk('sec_view_suspeitos', 'Suspeitos', '🚨', ButtonStyle.Danger)),
    mk('sec_search', 'Buscar', '🔍', ButtonStyle.Primary),
    mk('sec_refresh', 'Recarregar', '🔄', ButtonStyle.Secondary)
  );
  return [row1, row2];
}

// Menu de seleção sincronizado com a lista atualmente exibida na página.
// Recebe a fatia de membros visível (máx. 25, limite do Discord).
function membroSelectRow(listaMembros) {
  const membros = (listaMembros || []).slice(0, 25);
  if (!membros.length) return null;
  const menu = new StringSelectMenuBuilder()
    .setCustomId('sec_membro')
    .setPlaceholder('👤 Selecionar membro da lista para ver detalhe')
    .addOptions(
      membros.map((m) => ({
        label: m.user.username.slice(0, 100),
        value: m.user.id,
        description: `${m.user.bot ? 'Bot' : 'Humano'}${isGuildStaff(m) ? ' • Staff' : ''}`,
        emoji: m.user.bot ? '🤖' : '👤',
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

function buildSearchModal() {
  return new ModalBuilder()
    .setCustomId('sec_search_modal')
    .setTitle('🔍 Buscar membro')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('sec_termo')
          .setLabel('Nome, tag ou ID')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Nikki, nome#1234, ou ID numérico')
          .setRequired(true)
          .setMaxLength(64)
      )
    );
}

// ── Embeds de painel ──────────────────────────────────────────────────────
function buildPainelEmbed(stats, view, paginaInfo, termo, warning) {
  const embed = criarEmbed({
    titulo: '🛡️ SecurityBreach — Painel de Segurança',
    descricao:
      `**Total no cache:** ${stats.total}\n` +
      `**Humanos:** ${stats.humans}  •  **Bots:** ${stats.bots}\n` +
      `**Staff:** ${stats.staff}\n` +
      `**🟢 Online:** ${stats.online}  •  **⚪ Offline/Inv:** ${stats.offline}\n` +
      `**🚨 Suspeitos/histórico:** ${stats.suspeitos}`,
    cor: THEME.corPrincipal,
  });

  embed.addFields({ name: '🔎 Visão atual', value: VIEW_LABELS[view] || VIEW_LABELS.all, inline: false });
  embed.addFields({
    name: `📜 Lista (página ${paginaInfo.pagina + 1}/${paginaInfo.paginas} • ${paginaInfo.total})`,
    value: paginaInfo.texto,
    inline: false,
  });
  embed.addFields({
    name: '🧭 Como usar',
    value:
      'Toque nos emojes para filtrar. 🔍 abre busca (nome/tag/id). 👤 seleciona um membro para ver o detalhe. ' +
      'Use ◀️▶️ para paginar e 🔄 para recarregar o cache.',
    inline: false,
  });
  if (warning) embed.addFields({ name: '⚠️ Aviso', value: warning, inline: false });
  return embed;
}

// ── Comando principal ──────────────────────────────────────────────────────
module.exports = {
  data: { name: 'securitybreach', description: '🛡️ Painel de segurança staff: visão geral completa do servidor' },

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Acesso negado', descricao: 'Somente staff pode usar este comando.', cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    const guild = interaction.guild;

    // 1️⃣ Carrega do cache em memória (instantâneo)
    let membros = cacheArray(guild.id);
    let warning = null;

    if (!membros.length) {
      try {
        const fetched = await guild.members.fetch({ withPresences: true });
        clientCache.set(guild.id, { members: fetched, timestamp: Date.now() });
        for (const [, m] of fetched) if (m.presence) presenceMap.set(m.id, m.presence.status || 'offline');
        membros = Array.from(fetched.values());
      } catch {
        membros = Array.from(guild.members.cache.values());
        warning = 'Cache vazio e não foi possível buscar. Ative ENABLE_PRIVILEGED_INTENTS para dados em tempo real.';
      }
    }

    salvarSnapshot(guild.id, membros);

    let view = 'all';
    let termo = '';
    let pagina = 0;

    function renderPainel() {
      const base = view === 'search' ? buscar(termo, membros) : filtrar(view, membros);
      const stats = buildStats(membros);
      const info = formatPage(base, pagina, view === 'search' ? termo : '');
      const embed = buildPainelEmbed(stats, view === 'search' ? 'all' : view, info, termo, warning);
      const comps = [navRow(info.pagina, info.paginas), ...buildButtons(view)];
      const selectRow = membroSelectRow(info.fatia);
      if (selectRow) comps.push(selectRow);
      return { embed, comps, info };
    }

    const inicial = renderPainel();
    const reply = await interaction.reply({ embeds: [inicial.embed], components: inicial.comps, ephemeral: true });

    const collector = reply.createMessageComponentCollector({
      time: 10 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    // Abre o modal de busca e AGUARDA o envio (modais não passam pelo collector)
    async function abrirBusca(i) {
      await i.showModal(buildSearchModal());
      try {
        const submitted = await i.awaitModalSubmit({
          filter: (m) => m.user.id === interaction.user.id,
          time: 5 * 60 * 1000,
        });
        termo = submitted.fields.getTextInputValue('sec_termo');
        view = 'search';
        pagina = 0;
        const r = renderPainel();
        await submitted.editReply({ embeds: [r.embed], components: r.comps });
      } catch {
        // modal expirou/ cancelado
      }
    }

    collector.on('collect', async (i) => {
      try {
        // Select de membro -> detalhe
        if (i.customId === 'sec_membro') {
          const id = i.values[0];
          let m = clientCache.get(guild.id)?.members?.get(id) || guild.members.cache.get(id) || null;
          if (!m) {
            try {
              m = await guild.members.fetch(id);
            } catch {
              m = null;
            }
          }
          if (!m) {
            return i.reply({ embeds: [criarEmbed({ titulo: 'Membro não encontrado', descricao: 'Não achei esse ID.', cor: THEME.corErro })], ephemeral: true });
          }
          return i.reply({ embeds: [buildMembroEmbed(m)], ephemeral: true });
        }

        // Botão buscar -> modal
        if (i.customId === 'sec_search') {
          await abrirBusca(i);
          return;
        }

        await i.deferUpdate();

        if (i.customId === 'sec_refresh') {
          try {
            const fetched = await guild.members.fetch({ withPresences: true });
            clientCache.set(guild.id, { members: fetched, timestamp: Date.now() });
            for (const [, m] of fetched) if (m.presence) presenceMap.set(m.id, m.presence.status || 'offline');
            membros = Array.from(fetched.values());
            warning = null;
            salvarSnapshot(guild.id, membros);
          } catch {
            warning = 'Falha ao recarregar. Continuando com o cache atual.';
          }
          pagina = 0;
        } else if (i.customId.startsWith('sec_view_')) {
          view = i.customId.replace('sec_view_', '');
          pagina = 0;
        } else if (i.customId === 'sec_first') {
          pagina = 0;
        } else if (i.customId === 'sec_prev') {
          pagina = Math.max(0, pagina - 1);
        } else if (i.customId === 'sec_next') {
          pagina = pagina + 1;
        } else if (i.customId === 'sec_last') {
          const r = renderPainel();
          pagina = r.info.paginas - 1;
        }

        const r = renderPainel();
        await i.editReply({ embeds: [r.embed], components: r.comps });
      } catch (err) {
        console.error('Erro no collector securitybreach:', err);
      }
    });

    collector.on('end', async () => {
      try {
        await reply.edit({ components: [] });
      } catch {}
    });
  },
};