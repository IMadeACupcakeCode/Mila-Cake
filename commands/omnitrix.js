const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
} = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { isStaff } = require('../utils/perms');
const { mostrarDigitando } = require('../utils/milaDecoracao');
const { obterHistorico, avaliarRisco, marcarSuspeito, registrarSuspensao, obterMarcacoes } = require('../utils/segurancaStore');
const { clientCache } = require('../utils/cache');
const { formatarDataAbsoluta } = require('../utils/tempo');
const { isGuildStaff, presenceStatus, STATUS_EMOJI, buildMembroEmbed } = require('../utils/membroEmbed');

// ── Conteúdo do manual (seções pesquisáveis) ───────────────────────────────
const SECOES = [
  {
    titulo: '🛡️ $securitybreach — Painel principal',
    palavras: ['securitybreach', 'painel', 'principal', 'visao', 'geral', 'servidor'],
    texto:
      'Abre um painel staff (ephemeral) com visão geral do servidor e lista de membros em tempo real.\n' +
      '• 📋 Todos – todos os membros do cache\n' +
      '• 🟢 Online – só quem está online/idle/dnd\n' +
      '• ⚪ Offline – offline ou invisível\n' +
      '• 🤖 Bots – só bots (diferenciados dos humanos)\n' +
      '• 👑 Staff – cargos de staff / permissões\n' +
      '• 👤 Membros – humanos comuns (sem staff)\n' +
      '• 🚨 Suspeitos – com suspensões, suspeitas ou sinais de risco',
  },
  {
    titulo: '🔍 Busca e filtros (no painel)',
    palavras: ['busca', 'filtro', 'filtros', 'pesquisa', 'nome', 'tag', 'id', 'procurar'],
    texto:
      'No painel, toque em 🔍 Buscar para abrir um formulário e pesquisar por NOME, TAG ou ID. ' +
      'Use ◀️ ▶️ ⏮️ ⏭️ para paginar a lista. Há também um menu 👤 para selecionar um membro e ver o detalhe. ' +
      'A presença é mostrada em tempo real (via listeners de presença).',
  },
  {
    titulo: '🔄 Recarregar',
    palavras: ['recarregar', 'atualizar', 'refresh', 'cache'],
    texto: 'No painel, 🔄 força um novo fetch de membros/presenças e atualiza o cache. Use se a lista estiver desatualizada.',
  },
  {
    titulo: '🔎 Histórico de um membro (Omnitrix)',
    palavras: ['historico', 'membro', 'omnitrix', 'suspensao', 'suspensao', 'suspeito', 'risco'],
    texto:
      'Use $omnitrix para abrir o histórico completo: suspensões (servidor e Discord, e quantas vezes), ' +
      'suspeitas anotadas, sinais de risco do Discord (ex.: conta nova) e marcações do servidor. ' +
      'Você também pode marcar como SUSPEITO ou REGISTRAR UMA SUSPENSÃO direto nos botões.',
  },
  {
    titulo: '🚨 Como funciona a suspeita',
    palavras: ['suspeita', 'suspeito', 'risco', 'conta', 'nova', 'bot', 'heuristica'],
    texto:
      'O bot cruza dados do Discord (idade da conta, se é bot) e o histórico salvo em data/historico.json. ' +
      'Suspensões registradas contam quantas vezes o membro já foi suspenso e se foi no servidor ou no Discord.',
  },
  {
    titulo: '⚙️ Requisitos (intents)',
    palavras: ['requisito', 'intent', 'intents', 'privilegiado', 'desenvolvedor', 'portal', 'tempo', 'real'],
    texto:
      'Para dados 100% em tempo real, o .env precisa de ENABLE_PRIVILEGED_INTENTS=true e as intents ' +
      'Server Members e Presences ativadas no Discord Developer Portal. Sem isso, o cache é populado sob demanda.',
  },
];

function buildManualEmbed(termo) {
  const t = (termo || '').trim().toLowerCase();
  const embeds = t
    ? SECOES.filter((s) => s.titulo.toLowerCase().includes(t) || s.palavras.some((p) => p.includes(t) || t.includes(p)))
    : SECOES;

  const lista = embeds.length ? embeds : SECOES;
  const embed = criarEmbed({
    titulo: '🌟 Omnitrix — Manual de Segurança 🌟',
    descricao:
      t && embeds.length
        ? `${THEME.div.bolinhas}\n\n🔎 Resultados para \`${termo}\`:\n\n` + lista.map((s) => `**${s.titulo}**\n${s.texto}`).join('\n\n') + `\n\n${THEME.div.estrelado}`
        : `${THEME.div.bolinhas}\n\nO **Omnitrix** é o centro de controle de segurança da Mila Bot. Abaixo está o guia completo.\n\n` +
          lista.map((s) => `**${s.titulo}**\n${s.texto}`).join('\n\n') +
          `\n\n💡 Use o botão 🔍 para buscar um termo específico no manual, ou 👤 para abrir o histórico de um membro.\n\n${THEME.div.coracao}`,
    cor: THEME.corPrincipal,
  });
  return embed;
}

function buildHistoricoEmbed(member) {
  const hist = obterHistorico(member.user.id);
  const risco = avaliarRisco(member);
  const marcacoes = obterMarcacoes(member.guild.id)[member.user.id];
  const st = presenceStatus(member);
  const criadoEm = member.user.createdAt ? formatarDataAbsoluta(member.user.createdAt.getTime()) : 'desconhecido';
  const entrouEm = member.joinedAt ? formatarDataAbsoluta(member.joinedAt.getTime()) : 'desconhecido';

  const desc =
    `**Tag:** ${member.user.tag}\n` +
    `**ID:** \`${member.user.id}\`\n` +
    `**Tipo:** ${member.user.bot ? '🤖 Bot' : '👤 Humano'}  ${isGuildStaff(member) ? '• 👑 Staff' : ''}\n` +
    `**Status agora:** ${STATUS_EMOJI[st] || '⚪'} ${st}\n` +
    `**Conta criada:** ${criadoEm}\n` +
    `**Entrou no servidor:** ${entrouEm}\n`;

  const embed = criarEmbed({
    titulo: `🔍 Histórico de ${member.user.username}`,
    descricao: desc,
    cor: hist.suspenso > 0 || risco.length ? THEME.corErro : THEME.corPrincipal,
  });

  embed.addFields({
    name: '🚫 Suspensões registradas',
    value: `Total: **${hist.suspenso}**  (servidor: ${hist.suspensoServidor || 0} • Discord: ${hist.suspensoDiscord || 0})`,
    inline: false,
  });

  if (hist.historico && hist.historico.length) {
    const linhas = hist.historico
      .slice(-8)
      .reverse()
      .map((h) => {
        const quando = formatarDataAbsoluta(h.em);
        const det = h.motivo ? ` — ${h.motivo}` : '';
        const quem = h.por ? ` (por ${h.por})` : '';
        return `• **${h.tipo}** [${h.origem}] em ${quando}${det}${quem}`;
      });
    embed.addFields({ name: '📜 Log de eventos', value: linhas.join('\n') || 'Sem eventos.', inline: false });
  }

  if (hist.suspeitas && hist.suspeitas.length) {
    const linhas = hist.suspeitas
      .slice(-8)
      .reverse()
      .map((s) => `• [${s.escopo}] ${s.motivo || 'sem motivo'} (${formatarDataAbsoluta(s.em)})`);
    embed.addFields({ name: '🚨 Suspeitas anotadas', value: linhas.join('\n') || 'Nenhuma.', inline: false });
  }

  if (risco.length) {
    embed.addFields({ name: '⚠️ Sinais de risco (Discord)', value: risco.map((r) => `• ${r}`).join('\n'), inline: false });
  }

  if (marcacoes) {
    embed.addFields({ name: '📌 Marcação no servidor', value: `**${marcacoes.tipo}**: ${marcacoes.nota || ''}`, inline: false });
  }

  embed.addFields({
    name: '🧭 Ações',
    value: 'Use os botões para marcar este membro como suspeito ou registrar uma suspensão no histórico.',
    inline: false,
  });

  return embed;
}

function buildHistoricoBotoes() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('omni_suspeito').setLabel('Marcar suspeito').setEmoji('🚨').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('omni_suspensao').setLabel('Registrar suspensão').setEmoji('🚫').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('omni_voltar').setLabel('Voltar ao manual').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function buildAcoesRow() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('omni_voltar').setLabel('Voltar ao manual').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
    ),
  ];
}

function membroSelectRow(guildId) {
  const membros = (clientCache.get(guildId)?.members ? Array.from(clientCache.get(guildId).members.values()) : []).slice(0, 25);
  const menu = new StringSelectMenuBuilder()
    .setCustomId('omni_membro_select')
    .setPlaceholder('👤 Selecionar membro')
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

function buildBuscaManualModal() {
  return new ModalBuilder()
    .setCustomId('omni_busca_modal')
    .setTitle('🔍 Buscar no manual')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('omni_termo')
          .setLabel('Termo (ex: busca, suspeito, intents)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('termo...')
          .setRequired(true)
          .setMaxLength(64)
      )
    );
}

function buildSuspeitoModal(userId) {
  return new ModalBuilder()
    .setCustomId(`omni_suspeito_modal:${userId}`)
    .setTitle('🚨 Marcar suspeito')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('omni_suspeito_motivo')
          .setLabel('Motivo / escopo (interno ou externo)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: externo — comportamento estranho fora do servidor')
          .setRequired(true)
          .setMaxLength(500)
      )
    );
}

function buildSuspensaoModal(userId) {
  return new ModalBuilder()
    .setCustomId(`omni_suspensao_modal:${userId}`)
    .setTitle('🚫 Registrar suspensão')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('omni_suspensao_origem')
          .setLabel('Origem (servidor ou discord)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('servidor')
          .setRequired(true)
          .setMaxLength(20)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('omni_suspensao_motivo')
          .setLabel('Motivo')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: flood, quebra de regra')
          .setRequired(false)
          .setMaxLength(500)
      )
    );
}

module.exports = {
  data: { name: 'omnitrix', description: '🌟 Manual de segurança e histórico de membros' },

  async execute(interaction) {
    await mostrarDigitando(interaction.channel, 1200);
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Acesso negado', descricao: 'Somente staff pode usar este comando.', cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    const guild = interaction.guild;

    const mostrarManual = (termo) => buildManualEmbed(termo);

    const reply = await interaction.reply({
      embeds: [mostrarManual()],
      components: buildAcoesRow(),
      ephemeral: true,
    });

    async function abrirBuscaManual(i) {
      await i.showModal(buildBuscaManualModal());
      try {
        const submitted = await i.awaitModalSubmit({
          filter: (m) => m.user.id === interaction.user.id,
          time: 5 * 60 * 1000,
        });
        const termo = submitted.fields.getTextInputValue('omni_termo');
        await submitted.editReply({ embeds: [mostrarManual(termo)], components: buildAcoesRow() });
      } catch {}
    }

    const collector = reply.createMessageComponentCollector({
      time: 10 * 60 * 1000,
      filter: (i) => i.user.id === interaction.user.id,
    });

    collector.on('collect', async (i) => {
      try {
        // Busca textual no manual
        if (i.customId === 'omni_buscar_manual') {
          await abrirBuscaManual(i);
          return;
        }

        // Abre select de membro
        if (i.customId === 'omni_membro') {
          return i.update({ embeds: [criarEmbed({ titulo: 'Selecione um membro', descricao: 'Escolha abaixo o membro para ver o histórico.', cor: THEME.corPrincipal })], components: [membroSelectRow(guild.id)] });
        }

        // Selecionou membro
        if (i.customId === 'omni_membro_select') {
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
          _ultimo.set(reply.id, m);
          return i.update({ embeds: [buildHistoricoEmbed(m)], components: buildHistoricoBotoes() });
        }

        if (i.customId === 'omni_voltar') {
          return i.update({ embeds: [mostrarManual()], components: buildAcoesRow() });
        }

        if (i.customId === 'omni_suspeito') {
          await i.showModal(buildSuspeitoModal(ultimoMembro(i).user.id));
          return;
        }
        if (i.customId.startsWith('omni_suspeito_modal:')) {
          const userId = i.customId.split(':')[1];
          const motivo = i.fields.getTextInputValue('omni_suspeito_motivo');
          marcarSuspeito(userId, { escopo: /externo/i.test(motivo) ? 'externo' : 'interno', motivo, por: i.user.username });
          const m = await resolverMembro(guild, userId);
          return i.update({ embeds: [buildHistoricoEmbed(m)], components: buildHistoricoBotoes() });
        }

        if (i.customId === 'omni_suspensao') {
          await i.showModal(buildSuspensaoModal(ultimoMembro(i).user.id));
          return;
        }
        if (i.customId.startsWith('omni_suspensao_modal:')) {
          const userId = i.customId.split(':')[1];
          const origem = (i.fields.getTextInputValue('omni_suspensao_origem') || 'servidor').toLowerCase().includes('discord') ? 'discord' : 'servidor';
          const motivo = i.fields.getTextInputValue('omni_suspensao_motivo') || '';
          registrarSuspensao(userId, { origem, motivo, por: i.user.username, guildId: guild.id });
          const m = await resolverMembro(guild, userId);
          return i.update({ embeds: [buildHistoricoEmbed(m)], components: buildHistoricoBotoes() });
        }
      } catch (err) {
        console.error('Erro no collector omnitrix:', err);
      }
    });

    collector.on('end', async () => {
      try {
        await reply.edit({ components: [] });
      } catch {}
    });
  },
};

// Referência ao membro atual em tela (último embed de histórico editado)
const _ultimo = new Map();
function ultimoMembro(interaction) {
  return _ultimo.get(interaction.message?.id) || interaction.member;
}
async function resolverMembro(guild, userId) {
  let m = clientCache.get(guild.id)?.members?.get(userId) || guild.members.cache.get(userId) || null;
  if (!m) m = await guild.members.fetch(userId).catch(() => null);
  return m;
}
