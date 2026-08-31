// ⋆｡°✩ Mila Stream — comando de relé de voz
// Entra no canal de voz, fala "Estou a funcionar" (TTS), depois RELÉ de voz:
// capta o áudio de quem fala e o retransmite (transmissão real de áudio).
// Painel com todos os botões funcionando + Desconectar + Voltar; janelas ao
// vivo com PAGINAÇÃO (sem limite de 25 — navega por todas).
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { listarJanelas, listarMonitores, fonteDesktop, decodificarFonte } = require('../utils/streamSources');
const { iniciarStream, pararStream, desconectar, listarSessoes, getSessao, suportaStream, FRASE_TTS } = require('../utils/milaStream');

// ── Configuração de paginação das janelas ──
const POR_PAGINA = 25; // Discord permite até 25 opções por select

// ── Helpers de renderização ────────────────────────────────────────────

function embedPainel() {
  return criarEmbed({
    titulo: '📺 Transmissão da Mila',
    descricao: [
      'Escolha **onde** eu devo entrar na chamada:',
      '',
      '🪟 **Janela** — eu retransmito o áudio da chamada, com a janela escolhida',
      '🖥️ **Monitor** — retransmito o áudio, usando o monitor escolhido',
      '🖥️ **Desktop** — retransmito o áudio, usando a tela inteira',
      '',
      '✦•┈๑⋅⋯ ⋯⋅๑┈•✦',
      '',
      '🔊 Ao entrar, eu falo **"Estou a funcionar"** para avisar.',
      'Depois sou um **relé**: quando alguém fala na chamada,',
      '**eu capto e retransmito o áudio** — ignorando a tua voz e a de bots.',
      'Quando ninguém fala (além de ti), fico silenciosa.',
      '',
      '🔇 **Desconectar** — eu saio da chamada.',
      '🔒 Isso usa a API oficial do Discord (não é selfbot).',
    ].join('\n'),
    cor: THEME.corPrincipal,
    rodape: '⋆｡°✩ Mila Stream — relé de voz',
  });
}

function botoesPainel() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stream_janela').setLabel('🪟 Janela').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stream_monitor').setLabel('🖥️ Monitor').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('stream_desktop').setLabel('🖥️ Desktop').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('stream_status').setLabel('📊 Status').setStyle(ButtonStyle.Secondary),
  );
}

function botoesAcoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stream_desconectar').setLabel('🔇 Desconectar').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('stream_status').setLabel('📊 Status').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stream_voltar').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
  );
}

function botoesVoltar() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stream_voltar').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stream_cancelar').setLabel('✖️ Cancelar').setStyle(ButtonStyle.Danger),
  );
}

function botoesPagina(pagina, totalPaginas) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stream_pag_prev').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 0),
    new ButtonBuilder().setCustomId('stream_pag_next').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(pagina >= totalPaginas - 1),
    new ButtonBuilder().setCustomId('stream_voltar').setLabel('◀ Voltar').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('stream_cancelar').setLabel('✖️ Cancelar').setStyle(ButtonStyle.Danger),
  );
}

function paginarJanelas(janelas, pagina) {
  // Values únicos (sem duplicatas → sem erro 50035). Mantém "live": re-captura a página.
  const vistos = new Map();
  const ops = janelas
    .filter((j) => j.titulo && j.titulo.length > 0)
    .map((j) => {
      const key = j.titulo;
      const n = (vistos.get(key) || 0) + 1;
      vistos.set(key, n);
      const rotulo = n > 1 ? `${j.titulo} (${n})`.slice(0, 100) : j.titulo.slice(0, 100);
      const value = `${key}${n > 1 ? `#${n}` : ''}`;
      return { label: rotulo, value: `janela|${value}`, description: j.largura && j.altura ? `${j.largura}×${j.altura}` : undefined };
    });
  const inicio = pagina * POR_PAGINA;
  const paginaOps = ops.slice(inicio, inicio + POR_PAGINA);
  const totalPaginas = Math.max(1, Math.ceil(ops.length / POR_PAGINA));
  const menu = new StringSelectMenuBuilder()
    .setCustomId('stream_select_janela')
    .setPlaceholder(`🪟 Janelas (${ops.length} ao vivo — pág. ${pagina + 1}/${totalPaginas})`)
    .addOptions(paginaOps);
  return { menuRow: new ActionRowBuilder().addComponents(menu), totalPaginas, total: ops.length, pagina };
}

function selectMonitores(monitores) {
  const ops = monitores.map((m) => ({
    label: `Monitor ${m.indice}${m.primary ? ' (principal)' : ''}`,
    value: m.id,
    description: `${m.largura}×${m.altura}`,
  }));
  const menu = new StringSelectMenuBuilder()
    .setCustomId('stream_select_monitor')
    .setPlaceholder('🖥️ Escolha o monitor...')
    .addOptions(ops);
  return new ActionRowBuilder().addComponents(menu);
}

/** Verifica que o autor está num canal de voz; retorna o id ou null. */
function canalVozDoAutor(interaction) {
  return interaction.member?.voice?.channelId || null;
}

async function executarInicio(interaction, fonte, canalId, client) {
  const guildId = interaction.guildId;
  try {
    const sessao = await iniciarStream(guildId, canalId, fonte, client, interaction.user?.id || null);
    const em = criarEmbed({
      titulo: '✅ Estou na chamada!',
      descricao: [
        `Entrei em <#${canalId}> e falei **"${FRASE_TTS}"** para avisar.`,
        '',
        `🪟 Fonte selecionada: **${fonte.rotulo}**`,
        '',
        '🔉 Agora sou um **relé de voz**: quando alguém **fala** na chamada,',
        '**eu capto e retransmito o áudio**.',
        '',
        '🚫 **Ignoro a tua voz e a de bots/Discord** — só retransmito os outros.',
        'Quando ninguém fala (além de ti), fico silenciosa.',
        '',
        '🔇 Use **Desconectar** para eu sair.',
      ].join('\n'),
      cor: THEME.corSucesso,
      rodape: `Mila relé ativo desde ${new Date(sessao.ativoEm).toLocaleTimeString('pt-BR')}`,
    });
    return interaction.update({
      embeds: [em],
      components: [botoesAcoes()],
    });
  } catch (erro) {
    console.error('Erro ao iniciar stream:', erro);
    return interaction.update({
      embeds: [criarEmbed({
        titulo: '❌ Não consegui iniciar a transmissão',
        descricao: 'Houve um erro ao conectar ao canal de voz. Verifique se estou conectada e tento de novo.',
        cor: THEME.corErro,
      })],
      components: [],
    });
  }
}

// ── Execute principal ─────────────────────────────────────────────────

async function execute(interaction, client = null) {
  const canalId = canalVozDoAutor(interaction);
  if (!canalId) {
    return interaction.reply({
      embeds: [criarEmbed({
        titulo: '❌ Entre num canal de voz primeiro',
        descricao: 'Eu preciso que você esteja num **canal de voz** para eu entrar lá e retransmitir o áudio.',
        cor: THEME.corErro,
      })],
      ephemeral: true,
    });
  }

  if (!suportaStream()) {
    return interaction.reply({
      embeds: [criarEmbed({
        titulo: '⚠️ ffmpeg não disponível',
        descricao: 'O `ffmpeg-static` não está instalado. Rode `npm install` para continuar.',
        cor: THEME.corErro,
      })],
      ephemeral: true,
    });
  }

  let paginaJanelas = 0;

  const reply = await interaction.reply({
    embeds: [embedPainel()],
    components: [botoesPainel()],
    ephemeral: true,
  });

  const coletor = reply.createMessageComponentCollector({
    time: 5 * 60 * 1000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  coletor.on('collect', async (i) => {
    try {
      // ── Painel principal ──
      if (i.customId === 'stream_janela') {
        const janelas = await listarJanelas();
        if (janelas.length === 0) {
          return i.update({
            embeds: [criarEmbed({ titulo: 'Nenhuma janela', descricao: 'Não encontrei janelas visíveis nesta máquina.', cor: THEME.corErro })],
            components: [botoesVoltar()],
          });
        }
        paginaJanelas = 0;
        const { menuRow, totalPaginas, total } = paginarJanelas(janelas, 0);
        return i.update({
          embeds: [criarEmbed({
            titulo: `🪟 Escolher Janela (${total} ao vivo)`,
            descricao: 'Seleciona uma janela. Use **◀ ▶** para navegar por todas (sem limite).',
            cor: THEME.corPrincipal,
            rodape: `Página 1/${totalPaginas} • ${total} janela(s)`,
          })],
          components: [menuRow, botoesPagina(0, totalPaginas)],
        });
      }

      if (i.customId === 'stream_monitor') {
        const monitores = await listarMonitores();
        if (monitores.length === 0) {
          return i.update({
            embeds: [criarEmbed({ titulo: 'Nenhum monitor', descricao: 'Não encontrei monitores nesta máquina.', cor: THEME.corErro })],
            components: [botoesVoltar()],
          });
        }
        return i.update({
          embeds: [criarEmbed({
            titulo: '🖥️ Escolher Monitor',
            descricao: 'Selecione o monitor que eu devo usar:',
            cor: THEME.corPrincipal,
          })],
          components: [selectMonitores(monitores), botoesVoltar()],
        });
      }

      if (i.customId === 'stream_desktop') {
        const fonte = fonteDesktop();
        return executarInicio(i, fonte, canalVozDoAutor(i), client);
      }

      // ── Paginação de janelas (◀ ▶) ──
      if (i.customId === 'stream_pag_prev' || i.customId === 'stream_pag_next') {
        const janelas = await listarJanelas(); // re-captura ao vivo
        if (!janelas.length) {
          return i.update({
            embeds: [criarEmbed({ titulo: 'Nenhuma janela', descricao: 'Não há janelas visíveis.', cor: THEME.corErro })],
            components: [botoesVoltar()],
          });
        }
        const totalPaginas = Math.max(1, Math.ceil(janelas.length / POR_PAGINA));
        if (i.customId === 'stream_pag_prev') paginaJanelas = Math.max(0, paginaJanelas - 1);
        else paginaJanelas = Math.min(totalPaginas - 1, paginaJanelas + 1);
        const { menuRow, total, totalPaginas: tp } = paginarJanelas(janelas, paginaJanelas);
        return i.update({
          embeds: [criarEmbed({
            titulo: `🪟 Escolher Janela (${total} ao vivo)`,
            descricao: 'Seleciona uma janela. Use **◀ ▶** para navegar por todas (sem limite).',
            cor: THEME.corPrincipal,
            rodape: `Página ${paginaJanelas + 1}/${tp} • ${total} janela(s)`,
          })],
          components: [menuRow, botoesPagina(paginaJanelas, tp)],
        });
      }

      if (i.customId === 'stream_parar') {
        await pararStream(i.guildId);
        return i.update({
          embeds: [criarEmbed({ titulo: '🛑 Transmissão parada', descricao: 'EU parei o stream na guild.', cor: THEME.corSucesso })],
          components: [],
        });
      }

      if (i.customId === 'stream_desconectar') {
        await desconectar(i.guildId);
        return i.update({
          embeds: [criarEmbed({ titulo: '🔇 Desconectada', descricao: 'Saí da chamada de voz. Até já~ ♡', cor: THEME.corSucesso })],
          components: [],
        });
      }

      if (i.customId === 'stream_status') {
        const s = getSessao(i.guildId);
        const embed = s
          ? criarEmbed({
              titulo: '📊 Status da Transmissão',
              descricao: `Relé ativo: retransmitindo o áudio de quem fala.\n\n**Canal:** <#${s.canalVozId}>\n**Fonte:** \`${s.fonte.rotulo}\`\n**Ativo desde:** ${new Date(s.ativoEm).toLocaleString('pt-BR')}`,
              cor: THEME.corSucesso,
            })
          : criarEmbed({
              titulo: '📊 Status da Transmissão',
              descricao: 'Nenhuma transmissão ativa neste servidor.',
              cor: THEME.corPrincipal,
            });
        return i.update({ embeds: [embed], components: [botoesAcoes()] });
      }

      if (i.customId === 'stream_voltar') {
        return i.update({ embeds: [embedPainel()], components: [botoesPainel()] });
      }

      if (i.customId === 'stream_cancelar') {
        return i.update({ embeds: [], components: [], content: '✅ Cancelado.' });
      }

      // ── Selecionou uma fonte ──
      if (i.customId === 'stream_select_janela') {
        const value = i.values[0];
        const fonte = decodificarFonte(value);
        const canalVoz = canalVozDoAutor(i);
        if (!canalVoz) {
          return i.update({
            embeds: [criarEmbed({ titulo: '❌ Entre num canal de voz', descricao: 'Você saiu do canal de voz.', cor: THEME.corErro })],
            components: [],
          });
        }
        if (!fonte) {
          return i.update({
            embeds: [criarEmbed({ titulo: '❌ Fonte inválida', descricao: 'Escolha uma janela válida do menu.', cor: THEME.corErro })],
            components: [botoesVoltar()],
          });
        }
        return executarInicio(i, fonte, canalVoz, client);
      }

      if (i.customId === 'stream_select_monitor') {
        const value = i.values[0];
        const fonte = decodificarFonte(value);
        const canalVoz = canalVozDoAutor(i);
        if (!canalVoz) {
          return i.update({
            embeds: [criarEmbed({ titulo: '❌ Entre num canal de voz', descricao: 'Você saiu do canal de voz.', cor: THEME.corErro })],
            components: [],
          });
        }
        if (!fonte) {
          return i.update({
            embeds: [criarEmbed({ titulo: '❌ Fonte inválida', descricao: 'Escolha um monitor válido do menu.', cor: THEME.corErro })],
            components: [botoesVoltar()],
          });
        }
        return executarInicio(i, fonte, canalVoz, client);
      }
    } catch (erro) {
      console.error('Erro no coletor $stream:', erro);
      try {
        if (!i.replied && !i.deferred) {
          await i.update({
            embeds: [criarEmbed({ titulo: '❌ Erro', descricao: 'Ocorreu um erro durante a transmissão.', cor: THEME.corErro })],
            components: [],
          });
        }
      } catch {}
    }
  });

  coletor.on('end', async () => {
    try { await reply.edit({ components: [] }); } catch {}
  });
}

module.exports = {
  data: { name: 'stream', description: '📺 Relé de voz: retransmite o áudio da chamada no canal de voz (escolhe janela/monitor)' },
  execute,
  embedPainel,
  botoesPainel,
};