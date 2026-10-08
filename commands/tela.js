// ⋆｡°✩ Mila Tela — comando de Compartilhamento de Tela
//
// Este comando mostra o link e o passo a passo para o compartilhamento de tela
// usando o serviço externo golive.nemtudo.me (Nem-Tudo/sharescreen-discord-bot).
// Não requer app local, túnel, nem configuração complexa — só apontar o portal
// do Discord para o endereço fixo do serviço.
//
// Créditos:
// - discord-screen original: JC007zZ (https://github.com/Jc007zZ/discord-screen)
// - sharescreen-discord-bot: Nem-Tudo (https://github.com/Nem-Tudo/sharescreen-discord-bot)
// - Serviço de tela: golive.nemtudo.me (hospedado por Nem-Tudo)
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { mostrarDigitando } = require('../utils/milaDecoracao');

// Endereço fixo do serviço externo de compartilhamento de tela
const TELA_PUBLIC_ORIGIN = 'https://golive.nemtudo.me';
const TELA_PUBLIC_PATH = '/app';
const TELA_BASE_URL = `${TELA_PUBLIC_ORIGIN}${TELA_PUBLIC_PATH}`; // https://golive.nemtudo.me/app

const ATIVO = '●';

/**
 * Verifica a saúde do serviço externo.
 */
async function verificarSaudeExterna() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${TELA_PUBLIC_ORIGIN}/`, { signal: controller.signal });
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: e?.message || 'timeout' };
  }
}

/**
 * Monta o estado do serviço externo.
 */
async function renderizarEstado({ verbo = '' }) {
  const saudavel = await verificarSaudeExterna();
  const linhas = [];

  linhas.push(`${THEME.div.bolinhas}`);
  linhas.push('');
  linhas.push(`${verbo}Compartilhamento de tela via **serviço externo** (golive.nemtudo.me).`);
  linhas.push('');
  linhas.push(`🔗 **Link base:** \`${TELA_BASE_URL}\``);
  linhas.push(`💡 Quem está fora do Discord pode abrir esse link e criar uma **sala** própria.`);
  linhas.push('');

  if (saudavel.ok) {
    linhas.push(`✅ **Serviço online** — endereço respondendo (HTTP ${saudavel.status}).`);
  } else {
    linhas.push(`⚠️ **Serviço indisponível** — ${saudavel.error || 'não respondeu'}.`);
    linhas.push('   Tente novamente em alguns instantes.');
  }

  linhas.push('');
  linhas.push('📋 **Para a atividade funcionar, configure no portal do Discord:**');
  linhas.push('');
  linhas.push('**1. Activities → Settings** — ative **Enable Activities**');
  linhas.push('');
  linhas.push('**2. OAuth2 → Redirects → Redirect:**');
  linhas.push('```');
  linhas.push(`${TELA_BASE_URL}`);
  linhas.push('```');
  linhas.push('');
  linhas.push('**3. Activities → URL Mappings → Target:**');
  linhas.push('```');
  linhas.push(TELA_PUBLIC_ORIGIN.replace(/^https?:\/\//, ''));
  linhas.push('```');
  linhas.push('   **Prefix:** `/`');
  linhas.push('');
  linhas.push('> O endereço é **fixo** — não muda a cada reinício.');
  linhas.push('> Client ID da aplicação: use o mesmo da Mila Bot.');

  const cor = saudavel.ok ? THEME.corSucesso : THEME.corSecundario;

  return {
    cor,
    titulo: '📺 Compartilhamento de Tela — Sala de Tela',
    descricao: linhas.join('\n'),
  };
}

/** Embed com o passo a passo de usar. */
function embedComoUsar() {
  return criarEmbed({
    titulo: '📺 Como usar o Compartilhamento de Tela',
    descricao: [
      '**Dentro do Discord:**',
      '1️⃣ Entre no canal de voz',
      '2️⃣ Clique no **foguete 🚀** na barra de baixo (Atividades)',
      '3️⃣ Abra a atividade **Sala de Tela** (ou o nome que aparecer)',
      '4️⃣ Clique em **Compartilhar tela** e escolha o que mostrar',
      '',
      '> 👉 Para **transmitir**, use **Chrome, Edge, Brave, Opera ou Vivaldi** num **DESKTOP**.',
      '> 👉 Navegador de celular **não permite** capturar a tela.',
      '',
      '**Fora do Discord (link direto):**',
      `🔗 \`${TELA_BASE_URL}\` — abra em qualquer navegador desktop e entre numa sala.`,
      '',
      '**Configuração no portal (uma vez só):**',
      '• Activities → Settings → Enable Activities ✅',
      `• OAuth2 → Redirects → add: \`${TELA_BASE_URL}\``,
      `• Activities → URL Mappings → Target: \`${TELA_PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}\``,
      `   · Prefix: \`/\``,
      '',
      '> O endereço é **fixo** — não precisa atualizar nunca.',
    ].join('\n'),
    cor: THEME.corPrincipal,
    rodape: `${THEME.nome} — Sala de Tela via serviço externo (sem app local)`,
  });
}

/** Embed com ajuda do portal. */
function embedPortal() {
  return criarEmbed({
    titulo: '⚙️ Portal do Discord (configuração única)',
    descricao: [
      'Abra [discord.com/developers/applications](https://discord.com/developers/applications)',
      'na aplicação da Mila Bot e configure:',
      '',
      `**1. OAuth2 → Redirects** — add:`,
      `\`${TELA_BASE_URL}\``,
      '',
      '**2. Activities → Settings** — ative **Enable Activities**',
      '',
      '**3. Activities → URL Mappings** — add:',
      `**Prefix:** \`/\`  ·  **Target:** \`${TELA_PUBLIC_ORIGIN.replace(/^https?:\/\//, '')}\``,
      '',
      '**4. Instalar/Reinstalar no servidor:**',
      `\`https://discord.com/oauth2/authorize?client_id=SEU_CLIENT_ID\``,
      '**(Substitua `SEU_CLIENT_ID` pelo Client ID da Mila)**',
      '',
      '> ✨ Pronto! O endereço **não muda** — não precisa de túnel nem app local.',
    ].join('\n'),
    cor: 0x5865F2,
    rodape: '♡ Configuração de uma vez só — serviço externo g.nemtudo.me',
  });
}

function botoes() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('tela_usar').setLabel('📺 Como usar').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tela_portal').setLabel('⚙️ Ajuda no portal').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('tela_atualizar').setLabel('🔄 Verificar serviço').setStyle(ButtonStyle.Secondary),
  );
}

async function execute(interaction, client = null) {
  await mostrarDigitando(interaction.channel, 1000);
  const inicial = await renderizarEstado({ verbo: '' });

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
        return i.update({
          embeds: [embedComoUsar()],
          components: [botoes()],
        });
      }

      if (i.customId === 'tela_portal') {
        return i.update({
          embeds: [embedPortal()],
          components: [botoes()],
        });
      }

      if (i.customId === 'tela_atualizar') {
        await i.deferUpdate();
        const novoEstado = await renderizarEstado({ verbo: '🔄 ' });
        return i.editReply({ embeds: [criarEmbed(novoEstado)], components: [botoes()] });
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
  data: { name: 'tela', description: '📺 Compartilhamento de tela da Mila (Sala de Tela) — link e passo a passo via serviço externo' },
  execute,
};