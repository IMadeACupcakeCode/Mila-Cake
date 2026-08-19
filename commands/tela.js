// ⋆｡°✩ Mila Tela — comando de Compartilhamento de Tela (Sala de Tela)
//
// Este comando é o ATALHO do bot para o sistema de compartilhamento de tela
// que vem junto: `discord-screen/`. Não é um relé de voz (isso é o $stream) —
// é a ponte para a Activity de tela, que roda como app web separado.
//
// ── Como funciona para quem usa ─────────────────────────────────────────
// 1. A pessoa entra num canal de voz.
// 2. Abre a Mila em "Sala da call" OU o link público (fora do Discord).
// 3. Clica em "Compartilhar tela" e escolhe Chrome/Edge num DESKTOP.
//
// ── O que este painel mostra ───────────────────────────────────────────
// • O endereço público atual (endereço do túnel) para HTML compartilhar.
// • O passo a passo de usar dentro do Discord (foguete 🚀 → atividade).
// • O que ainda falta configurar no portal do Discord, quando faltar.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { estadoTela, verificarServidor } = require('../utils/telaStore');

const ATIVO = '●';

/** Monta o estado atual da Sala de Tela de forma legível. */
function renderizarEstado({ verbo = '' }) {
  const est = estadoTela();
  const linhas = [];

  // ── App instalado? ──
  if (!est.appPresente) {
    return {
      cor: THEME.corErro,
      titulo: '❌ Sala de Tela não instalada',
      descricao: [
        'A pasta `discord-screen/` não foi encontrada junto do bot.',
        '',
        'Clone o repositório para dentro da pasta do bot:',
        '```',
        'git clone https://github.com/Jc007zZ/discord-screen.git',
        'cd discord-screen',
        'npm install',
        '```',
      ].join('\n'),
    };
  }

  // ── Endereço configurado? ──
  if (!est.origem) {
    return {
      cor: THEME.corErro,
      titulo: '⚠️ Endereço público ainda não definido',
      descricao: [
        'O servidor da Sala de Tela está instalado, mas **sem endereço público**.',
        '',
        'Na pasta `discord-screen/`, rode:',
        '```',
        'npm run start:fast',
        '```',
        'Ele sobe o túnel e grava o endereço sozinho. Depois rode `$tela` de novo.',
      ].join('\n'),
    };
  }

  linhas.push(`🔗 **Endereço público:**\n\`${est.origem}\``);
  linhas.push(
    `💡 Quem está fora do Discord pode abrir esse link e criar uma **sala** própria.`
  );

  // Verificação dos componentes que precisam estar no portal do Discord.
  if (est.clientId) {
    linhas.push(`🆔 **Client ID:** \`${est.clientId}\``);
    linhas.push('');
    linhas.push(
      '🧩 **Estado da configuração no portal do Discord:** (reveja em `⚙️ Ajuda do portal`)'
    );
  } else {
    linhas.push('', '⚠️ **Client ID** não encontrado no `.env` do app.');
  }

  return {
    cor: THEME.corSucesso,
    titulo: '📺 Sala de Tela — compartilhamento de tela',
    descricao: [
      `${verbo}O camarada que quer **mostrar a tela** escolhe um canal de voz e clica em **Compartilhar tela**; todo mundo que está na call assiste.`,
      '',
      `📡 **O servidor está instalado** e este é o estado atual:`,
      '',
      ...linhas,
    ].join('\n'),
  };
}

/** Embed com o passo a passo de usar (uma vez que o endereço existe). */
function embedComoUsar(est) {
  return criarEmbed({
    titulo: '📺 Como usar a Sala de Tela',
    descricao: [
      '**Dentro do Discord:**',
      '1️⃣ Entre no canal de voz',
      '2️⃣ Clique no **foguete 🚀** na barra de baixo',
      '3️⃣ Abra a atividade **Sala de Tela**',
      '4️⃣ Clicar em **Compartilhar tela** e escolher o que mostrar',
      '',
      '> 👉 Para **transmitir**, use **Chrome, Edge ou Brave** num **DESKTOP**.',
      '> 👉 Navegador de celular não permite capturar a tela.',
      '',
      '**Fora do Discord (link):**',
      `🔗 \`${est.origem}\` — abra em qualquer navegador e crie uma sala.`,
      '',
      '**Quando o endereço mudar** (o túnel muda a cada reinício), troque o **Target**',
      'no portal do Discord em **Activities → URL Mappings**. Para o endereço ficar',
      'fixo: `npm run tunel:criar` (precisa de um domínio na Cloudflare).',
    ].join('\n'),
    cor: THEME.corPrincipal,
    rodape: `${THEME.nome} — Sala de Tela de verdade, não um relé`,
  });
}

/** Embed com o que precisa estar no Discord Developer Portal. */
function embedPortal(est) {
  const origem = est.origem || 'SEU-ENDERECO';
  const clientId = est.clientId || 'SEU-CLIENT-ID';
  return criarEmbed({
    titulo: '⚙️ Portal do Discord (uma vez só)',
    descricao: [
      'Abra [discord.com/developers/applications](https://discord.com/developers/applications)',
      'na aplicação de vocês (a mesma da Mila) e confira:',
      '',
      `**1. OAuth2 → Redirects** — add:`,
      `\`${origem}/auth/callback\``,
      '**2. Activities → Settings** — ative **Enable Activities**',
      '**3. Activities → URL Mappings** — add:',
      `**Prefix:** \`/\`  ·  **Target:** \`${origem.replace(/^https?:\/\//, '')}\``,
      '**4. Instalar no servidor:**',
      `\`https://discord.com/oauth2/authorize?client_id=${clientId}\``,
      `**(Client ID:** \`${clientId}\`**)**`,
      '',
      '> O próprio app tem um assistente que já deixa isso pronto:',
      '> ```npm run start:fast``` (na pasta `discord-screen/`).',
    ].join('\n'),
    cor: 0x5865F2,
    rodape: '♡ Configuração de uma vez só — não é preciso repetir',
  });
}

function botoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tela_usar').setLabel('📺 Como usar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tela_portal').setLabel('⚙️ Ajuda no portal').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tela_atualizar').setLabel('🔄 Atualizar').setStyle(ButtonStyle.Secondary),
  );
}

async function execute(interaction, client = null) {
  const inicial = renderizarEstado({});
  const reply = await interaction.reply({
    embeds: [criarEmbed(inicial)],
    components: [botoes()],
    ephemeral: true,
  });

  const coletor = reply.createMessageComponentCollector({
    time: 3 * 60 * 1000,
    filter: (i) => i.user.id === interaction.user.id,
  });

  coletor.on('collect', async (i) => {
    try {
      if (i.customId === 'tela_usar') {
        const est = estadoTela();
        if (!est.origem) {
          return i.update({
            embeds: [criarEmbed(renderizarEstado({}))],
            components: [botoes()],
          });
        }
        return i.update({
          embeds: [embedComoUsar(est)],
          components: [botoes()],
        });
      }

      if (i.customId === 'tela_portal') {
        return i.update({
          embeds: [embedPortal(estadoTela())],
          components: [botoes()],
        });
      }

      if (i.customId === 'tela_atualizar') {
        await i.deferUpdate();
        const check = await verificarServidor();
        const est = estadoTela();
        if (check.ok) {
          const embed = criarEmbed({
            titulo: '✔ Sala de Tela no ar',
            descricao: [
              `🔗 **Endereço:** \`${est.origem}\``,
              `⏱ **Latência:** \`${check.ms}ms\` • **Health:** \`${check.status}\``,
            ].join('\n'),
            cor: THEME.corSucesso,
          });
          return i.editReply({ embeds: [embed], components: [botoes()] });
        }
        const motivo = check.motivo || 'sem_endereco';
        const msg =
          motivo === 'fora_do_ar'
            ? `**Servidor não responde.** Está rodando? Rode \`npm run start:fast\` na pasta \`discord-screen/\`.`
            : motivo === 'timeout'
              ? `**Servidor demorou demais.** Confira se \`${est.origem}\` está no ar.`
              : '**Sem endereço público configurado.** Rode `npm run start:fast` na pasta `discord-screen/`.';
        return i.editReply({
          embeds: [criarEmbed({ titulo: '📡 Sala de Tela offline', descricao: msg, cor: THEME.corErro })],
          components: [botoes()],
        });
      }
    } catch (erro) {
      console.error('Erro no coletor $tela:', erro);
    }
  });

  coletor.on('end', async () => {
    try { await reply.edit({ components: [] }); } catch {}
  });
}

module.exports = {
  data: { name: 'tela', description: '📺 Compartilhamento de tela da Mila (Sala de Tela) — link e passo a passo' },
  execute,
};