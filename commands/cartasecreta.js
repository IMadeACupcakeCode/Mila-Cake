const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { clientCache } = require('../utils/cache');
const { registrarCarta, obterCartas } = require('../utils/cartasStore');
const { formatarDataAbsoluta } = require('../utils/tempo');

const POR_PAGINA = 12;
const EMOJI_ANT = '◀️';
const EMOJI_PROX = '▶️';

// Todos os membros do servidor (cache em memória) — sem limite de 25.
function todosMembros(guild) {
  const entry = clientCache.get(guild.id);
  let membros = entry && entry.members ? Array.from(entry.members.values()) : Array.from(guild.members.cache.values());
  return membros || [];
}

// Menu de escolha sincronizado com a página atualmente exibida (máx. 25 opções).
function menuDestinatario(paginaMembros) {
  const membros = (paginaMembros || []).slice(0, 25);
  if (!membros.length) return null;
  const menu = new StringSelectMenuBuilder()
    .setCustomId('cs_alvo')
    .setPlaceholder('👤 Escolha quem receberá a carta (lista ao lado)')
    .addOptions(
      membros.map((m) => ({
        label: m.user.username.slice(0, 100),
        value: m.user.id,
        description: m.user.bot ? '🤖 Bot' : '👤 Humano',
        emoji: m.user.bot ? '🤖' : '👤',
      }))
    );
  return new ActionRowBuilder().addComponents(menu);
}

// Botões de navegação da lista de membros
function navButtons(pagina, totalPaginas) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('cs_ant').setLabel('◀️ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(pagina <= 0),
    new ButtonBuilder().setCustomId('cs_prox').setLabel('Próximo ▶️').setStyle(ButtonStyle.Primary).setDisabled(pagina >= totalPaginas - 1)
  );
}

function modalConteudo() {
  return new ModalBuilder()
    .setCustomId('cs_conteudo_modal')
    .setTitle('✍️ Escreva sua carta secreta')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cs_conteudo')
          .setLabel('Conteúdo da carta')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Escreva aqui o que será entregue no privado do destinatário...')
          .setRequired(true)
          .setMaxLength(2000)
      )
    );
}

function modalAutor() {
  return new ModalBuilder()
    .setCustomId('cs_autor_modal')
    .setTitle('✍️ Como assinar a carta?')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cs_autor')
          .setLabel('Nome do autor (como deve aparecer)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Um admirador secreto, Fulano, etc.')
          .setRequired(true)
          .setMaxLength(80)
      )
    );
}

module.exports = {
  data: { name: 'cartasecreta', description: '✉️ Entrega uma carta misteriosa para um membro' },
  async execute(interaction) {
    const autor = interaction.user;
    const guild = interaction.guild;
    const client = interaction.client;
    const msgOriginal = interaction.message; // mensagem `$cartasecreta ...` no canal

    // ✨ Mensagem de "carregando" animada para não aparecer o "Demorando para responder"
    const pontos = ['·', '··', '···', '····'];
    let pi = 0;
    const loadingMsg = await interaction.reply({
      embeds: [
        criarEmbed({
          titulo: '✉️ Preparando sua carta secreta...',
          descricao: `🌙 Selando o envelope${pontos[0]}`,
          cor: THEME.corPrincipal,
        }),
      ],
      fetchReply: true,
    });
    const loadingTimer = setInterval(() => {
      pi = (pi + 1) % pontos.length;
      loadingMsg
        .edit({
          embeds: [
            criarEmbed({
              titulo: '✉️ Preparando sua carta secreta...',
              descricao: `🌙 Selando o envelope${pontos[pi]}`,
              cor: THEME.corPrincipal,
            }),
          ],
        })
        .catch(() => {});
    }, 600);

    const membros = todosMembros(guild);
    if (!membros.length) {
      try {
        const fetched = await guild.members.fetch({ withPresences: false });
        membros.push(...Array.from(fetched.values()));
      } catch {}
    }
    clearInterval(loadingTimer);

    const total = membros.length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    let pagina = 0;
    let destinatarioId = null;
    let conteudo = null;

    function renderLista() {
      pagina = Math.min(Math.max(0, pagina), totalPaginas - 1);
      const fatia = membros.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA);
      const linhas = fatia.length
        ? fatia.map((m, i) => `${i + 1}. ${m.user.bot ? '🤖' : '👤'} \`${m.user.username}\` — \`${m.user.id}\``).join('\n')
        : 'Nenhum membro encontrado.';

      const embed = criarEmbed({
        titulo: '✉️ Carta Secreta — Passo 1/3',
        descricao:
          `**Escolha quem receberá a carta.** Use ◀️ ▶️ para navegar, ou o menu abaixo (sincronizado com esta lista).\n\n` + linhas,
        cor: THEME.corPrincipal,
        rodape: `Página ${pagina + 1}/${totalPaginas} • ${total} membros`,
      });
      const comps = [navButtons(pagina, totalPaginas)];
      const row = menuDestinatario(fatia);
      if (row) comps.push(row);
      return { embed, comps };
    }

    // Abre a conversa no privado do autor (só ele enxerga)
    let dm;
    try {
      const { embed, comps } = renderLista();
      dm = await autor.send({ embeds: [embed], components: comps });
    } catch {
      if (loadingMsg && loadingMsg.channel) {
        await loadingMsg
          .edit({
            embeds: [
              criarEmbed({
                titulo: 'Não consegui abrir o privado',
                descricao: `${autor}, sua DM está fechada. Abra as mensagens diretas para usar a carta secreta.`,
                cor: THEME.corErro,
              }),
            ],
          })
          .catch(() => {});
      }
      return;
    }

    // Aviso de sucesso no canal some logo após abrir a DM (mantém privacidade)
    if (loadingMsg) {
      try {
        await loadingMsg.edit({
          embeds: [
            criarEmbed({
              titulo: '✨ Carta a caminho...',
              descricao: '🌙 Envelope selado e entregue no seu privado. Confira sua DM!',
              cor: THEME.corSucesso,
            }),
          ],
        });
        setTimeout(() => loadingMsg.delete().catch(() => {}), 4000);
      } catch {}
    }

    // 🔒 Privacidade: apaga a mensagem pública do comando DEPOIS de responder.
    if (msgOriginal && msgOriginal.deletable) {
      try {
        await msgOriginal.delete();
      } catch {}
    }

    const coletor = dm.createMessageComponentCollector({ time: 10 * 60 * 1000, filter: (i) => i.user.id === autor.id });

    coletor.on('collect', async (i) => {
      try {
        // Navegação por botões
        if (i.customId === 'cs_prox') {
          pagina = Math.min(totalPaginas - 1, pagina + 1);
          const { embed, comps } = renderLista();
          return i.update({ embeds: [embed], components: comps });
        }
        if (i.customId === 'cs_ant') {
          pagina = Math.max(0, pagina - 1);
          const { embed, comps } = renderLista();
          return i.update({ embeds: [embed], components: comps });
        }

        // 1️⃣ Escolheu o destinatário (sincronizado com a lista visível)
        if (i.customId === 'cs_alvo') {
          destinatarioId = i.values[0];
          const alvo = client.users.cache.get(destinatarioId) || (await client.users.fetch(destinatarioId).catch(() => null));
          if (alvo && alvo.id === autor.id) {
            return i.update({
              embeds: [criarEmbed({ titulo: '🚫 Destinatário inválido', descricao: 'Você não pode enviar a carta para si mesmo. Escolha outra pessoa na lista.', cor: THEME.corErro })],
              components: [navButtons(pagina, totalPaginas), menuDestinatario(membros.slice(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA))].filter(Boolean),
            });
          }
          const nome = alvo ? alvo.username : destinatarioId;
          return i.update({
            embeds: [
              criarEmbed({
                titulo: '✉️ Carta Secreta — Passo 2/3',
                descricao: `**Destinatário:** ${nome}\n\nAgora clique no botão para **escrever o conteúdo** da carta.`,
                cor: THEME.corPrincipal,
              }),
            ],
            components: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('cs_trocar').setLabel('🔄 Trocar destinatário').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
                new ButtonBuilder().setCustomId('cs_escrever').setLabel('✍️ Escrever conteúdo').setStyle(ButtonStyle.Primary).setEmoji('✍️')
              ),
            ],
          });
        }

        // Trocar destinatário -> volta para a lista
        if (i.customId === 'cs_trocar') {
          const { embed, comps } = renderLista();
          return i.update({ embeds: [embed], components: comps });
        }

        // 2️⃣ Abrir modal de conteúdo
        if (i.customId === 'cs_escrever') {
          await i.showModal(modalConteudo());
          try {
            const submitted = await i.awaitModalSubmit({ filter: (m) => m.user.id === autor.id, time: 10 * 60 * 1000 });
            conteudo = submitted.fields.getTextInputValue('cs_conteudo');
            const alvo = client.users.cache.get(destinatarioId) || (await client.users.fetch(destinatarioId).catch(() => null));
            await submitted.update({
              embeds: [
                criarEmbed({
                  titulo: '✉️ Carta Secreta — Passo 3/3',
                  descricao: `**Para:** ${alvo ? alvo.tag : destinatarioId}\n\n> ${conteudo}\n\nComo deseja enviar?`,
                  cor: THEME.corRoleta,
                }),
              ],
              components: [
                new ActionRowBuilder().addComponents(
                  new ButtonBuilder().setCustomId('cs_anon').setLabel('🕶️ Anônimo').setStyle(ButtonStyle.Secondary).setEmoji('🕶️'),
                  new ButtonBuilder().setCustomId('cs_assin').setLabel('✍️ Assinar').setStyle(ButtonStyle.Primary).setEmoji('✍️')
                ),
              ],
            });
          } catch {
            // modal expirou
          }
          return;
        }

        // 3️⃣ Escolha de autoria: anônimo segue direto; assinar pede o nome
        if (i.customId === 'cs_anon') {
          await entregar(i, false, null);
          coletor.stop();
          return;
        }
        if (i.customId === 'cs_assin') {
          await i.showModal(modalAutor());
          try {
            const submitted = await i.awaitModalSubmit({ filter: (m) => m.user.id === autor.id, time: 10 * 60 * 1000 });
            const nomeAutor = (submitted.fields.getTextInputValue('cs_autor') || '').trim().slice(0, 80) || autor.username;
            await entregar(submitted, true, nomeAutor);
            coletor.stop();
          } catch {
            // modal expirou
          }
          return;
        }
      } catch (err) {
        console.error('Erro no fluxo cartasecreta:', err);
      }
    });

    // Função de entrega reutilizável (anon / assinado com nome custom)
    async function entregar(i, assinar, nomeAutor) {
      const alvo = client.users.cache.get(destinatarioId) || (await client.users.fetch(destinatarioId).catch(() => null));

      if (!alvo) {
        return i.update({
          embeds: [criarEmbed({ titulo: 'Destinatário ausente', descricao: 'Não achei o usuário. Recomece com `$cartasecreta`.', cor: THEME.corErro })],
          components: [],
        });
      }

      const assinatura = assinar ? nomeAutor : `${THEME.nome} entregou discretamente — de alguém que admira você sob a lua 🌙`;

      const carta = criarEmbed({
        titulo: '✉️ Uma carta misteriosa chegou...',
        descricao: `**Para:** ${alvo.tag}\n\n> ${conteudo}`,
        cor: THEME.corRoleta,
        rodape: assinatura,
      });

      try {
        await alvo.send({ embeds: [carta] });

        // 📜 Registra na "cartas enviadas" do autor (rascunhos/outbox)
        registrarCarta(autor.id, {
          paraTag: alvo.tag,
          autorExibido: assinar ? nomeAutor : null,
          anonimo: !assinar,
          conteudo,
        });

        // Mostra o outbox (lista de cartas enviadas) em vez de sumir
        await mostrarOutbox(i, autor, guild);
      } catch {
        await i.update({
          embeds: [criarEmbed({ titulo: 'Não consegui entregar', descricao: `${alvo.username} tem a DM fechada. A carta não foi enviada.`, cor: THEME.corErro })],
          components: [],
        });
      }
    }
  },
};

// ── Outbox: "📜 Cartas enviadas" (rascunhos organizados) ──────────────────
async function mostrarOutbox(i, autor, guild) {
  const cartas = obterCartas(autor.id);
  let pag = 0;
  const POR = 8;

  function render() {
    const total = cartas.length;
    const paginas = Math.max(1, Math.ceil(total / POR));
    pag = Math.min(Math.max(0, pag), paginas - 1);
    const fatia = cartas.slice(pag * POR, pag * POR + POR);
    const linhas = fatia.length
      ? fatia
          .map((c) => {
            const quando = formatarDataAbsoluta(c.em);
            const modo = c.anonimo ? '🕶️ Anônima' : `✍️ ${c.autorExibido}`;
            const txt = c.conteudo.length > 80 ? c.conteudo.slice(0, 80) + '…' : c.conteudo;
            return `• **Para:** ${c.paraTag}\n  _${modo} • ${quando}_\n  > ${txt}`;
          })
          .join('\n\n')
      : 'Você ainda não enviou nenhuma carta. 🌙';

    const embed = criarEmbed({
      titulo: '📜 Cartas enviadas',
      descricao: linhas,
      cor: THEME.corPrincipal,
      rodape: `Página ${pag + 1}/${paginas} • ${total} carta(s) — suas cartas ficam salvas aqui`,
    });
    const nav = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('out_ant').setLabel('◀️ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(pag <= 0),
      new ButtonBuilder().setCustomId('out_prox').setLabel('Próximo ▶️').setStyle(ButtonStyle.Primary).setDisabled(pag >= paginas - 1),
      new ButtonBuilder().setCustomId('out_nova').setLabel('✉️ Nova carta').setStyle(ButtonStyle.Success).setEmoji('✉️')
    );
    return { embed, nav };
  }

  const { embed, nav } = render();
  await i.update({ embeds: [embed], components: [nav] });

  // Coletor próprio do outbox (reage com botões para navegar / nova carta)
  const col = i.message.createMessageComponentCollector({ time: 10 * 60 * 1000, filter: (x) => x.user.id === autor.id });
  col.on('collect', async (x) => {
    try {
      if (x.customId === 'out_prox') {
        pag = Math.min(Math.ceil(cartas.length / POR) - 1, pag + 1);
        const r = render();
        return x.update({ embeds: [r.embed], components: [r.nav] });
      }
      if (x.customId === 'out_ant') {
        pag = Math.max(0, pag - 1);
        const r = render();
        return x.update({ embeds: [r.embed], components: [r.nav] });
      }
      if (x.customId === 'out_nova') {
        col.stop();
        // Reinicia o fluxo de envio abrindo a lista de membros de novo
        const membros = todosMembros(guild);
        const total = membros.length;
        const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
        let p2 = 0;
        const fatia = membros.slice(0, POR_PAGINA);
        const linhas = fatia.length
          ? fatia.map((m, idx) => `${idx + 1}. ${m.user.bot ? '🤖' : '👤'} \`${m.user.username}\` — \`${m.user.id}\``).join('\n')
          : 'Nenhum membro.';
        const embed2 = criarEmbed({
          titulo: '✉️ Carta Secreta — Passo 1/3',
          descricao: `**Escolha quem receberá a carta.** Use ◀️ ▶️ para navegar, ou o menu abaixo.\n\n` + linhas,
          cor: THEME.corPrincipal,
          rodape: `Página 1/${totalPaginas} • ${total} membros`,
        });
        const comps = [navButtons(0, totalPaginas)];
        const row = menuDestinatario(fatia);
        if (row) comps.push(row);
        return x.update({ embeds: [embed2], components: comps });
      }
    } catch (err) {
      console.error('Erro no outbox:', err);
    }
  });
  col.on('end', () => {
    try {
      i.message.edit({ components: [] }).catch(() => {});
    } catch {}
  });
}