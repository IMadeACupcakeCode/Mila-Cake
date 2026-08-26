// ⋆｡°✩ Mila Boas-Vindas — chegada em servidor novo
//
// Disparado no evento guildCreate (a Mila foi adicionada a um servidor).
// Faz duas coisas:
//   1. enviarBoasVindas   — manda um recado de apresentação no sistema de
//      boas-vindas nativo do servidor (ou no primeiro canal de texto onde
//      a Mila pode falar).
//   2. garantirPermissaoTela — garante que a Mila tenha permissão de
//      compartilhar tela (Stream) em tudo que é canal de voz, para o
//      compartilhamento de tela ($tela / discord-screen) funcionar.
//
// A permissão é idempotente: pode rodar de novo que não causa problema.
// Nada é persistido — a boas-vindas é uma vez só por servidor, na chegada.
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('./theme');
const { estadoTela, verificarDiagnostico } = require('./telaStore');
const { NOME_BOT } = require('./configuracao');

/**
 * Encontra o melhor canal de texto para o recado de boas-vindas:
 *   1. O systemChannel do servidor (canal de boas-vindas nativo), se a Mila
 *      puder falar nele.
 *   2. Senão, o primeiro canal de texto visível (por posição) onde a Mila
 *      tenha permissão de enviar mensagens.
 *
 * @returns {Promise<{ok:true, canal:string} | {ok:false, motivo:string}>}
 */
async function escolherCanalBoasVindas(guild, client) {
  if (guild.channels.cache.size === 0) {
    await guild.channels.fetch().catch(() => {});
  }

  // 1) Preferência: o canal de boas-vindas nativo do servidor.
  try {
    const sys = guild.systemChannel;
    if (sys && sys.type === ChannelType.GuildText && sys.viewable) {
      const perms = sys.permissionsFor(client.user.id);
      if (perms?.has(PermissionFlagsBits.SendMessages)) return sys;
    }
  } catch {
    // segue para o fallback
  }

  // 2) Fallback: primeiro canal de texto visível onde dá para falar.
  return (
    guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildText && c.viewable)
      .sort((a, b) => a.position - b.position)
      .find((c) => c.permissionsFor(client.user.id)?.has(PermissionFlagsBits.SendMessages)) || null
  );
}

/**
 * Monta o embed de apresentação da Mila para a chegada no servidor.
 *
 * A saúde da Sala de Tela é consultada de forma **opcional e não-bloqueante**:
 * se a verificação demorar ou falhar, o recado segue sem ela. Cada passo da
 * caçada às credenciais explica o que fazer com o diagnóstico.
 */
async function embedBoasVindas() {
  const est = estadoTela();

  // Verificação rápida (timeout embutido no telaStore). Se falhar, segue com
  // texto neutro — a saúde não pode segurar a boas-vindas.
  let saudavel = null;
  if (est.appPresente && est.origem) {
    try {
      saudavel = await verificarDiagnostico();
    } catch {
      saudavel = null;
    }
  }

  let linhaTela;
  if (!est.appPresente) {
    linhaTela =
      '✧ **Compartilhar tela** — o app `discord-screen/` não está junto. Clone-o na pasta do bot e rode `npm run start:fast` lá dentro. Depois me chame com `$tela`.';
  } else if (saudavel?.tudo) {
    linhaTela =
      '✧ **Compartilhar tela** — `$tela` mostra o link e o passo a passo. App no ar ✔';
  } else if (saudavel && saudavel.local === 'ok' && saudavel.publico === 'fora') {
    linhaTela =
      '⚠️ **Compartilhar tela** — o app está no ar, mas o endereço público parece antigo. Rode `$tela` para ver o diagnóstico e o que trocar no portal.';
  } else if (saudavel && !saudavel.local && saudavel.publico !== 'ok') {
    linhaTela =
      '⚠️ **Compartilhar tela** — o app não está no ar. Rode `npm run start:fast` na pasta `discord-screen/` e depois `$tela`.';
  } else if (est.configurado) {
    linhaTela =
      '✧ **Compartilhar tela** — use `$tela` para ver o link e o passo a passo da transmissão.';
  } else {
    linhaTela =
      '✧ **Compartilhar tela** — pra eu conseguir transmitir, o app `discord-screen/` precisa estar no ar (`npm run start:fast` naquela pasta). Depois me chame com `$tela`.';
  }

  return criarEmbed({
    titulo: `Oie, meu favorito~ ♡  Eu sou a ${NOME_BOT}`,
    descricao: [
      'Acabei de chegar e já tô pronta pra cuidar de vocês~ 💕',
      '',
      `${THEME.div.linha}`,
      '',
      'Um começo de tudo que eu sei fazer:',
      '',
      '✧ **Explorar tudo** — `$codex` lista todos os meus comandos.',
      '✧ **Pedir ajuda** — `$configurar ver` mostra como estou configurada.',
      '✧ **Tickets** — `$ticket` monta o painel de Mila Tickets 🎫.',
      '✧ **Voz** — `$stream` me chama pra chamada como relé de voz 🔊.',
      linhaTela,
      '✧ **Segurança** — `$securitybreach` (staff) vigia o servidor 🛡️.',
      '',
      `${THEME.div.coracao}`,
      '',
      'Não vai embora, né? Tô sempre aqui por vocês~ ♡',
    ].join('\n'),
    cor: THEME.corPrincipal,
  });
}

/**
 * Envia a mensagem de boas-vindas no melhor canal disponível.
 * Aborta silenciosamente se não houver nenhum canal onde a Mila possa falar.
 */
async function enviarBoasVindas(guild, client) {
  const canal = await escolherCanalBoasVindas(guild, client);
  if (!canal) return { ok: false, motivo: 'sem canal de texto com permissão' };

  try {
    await canal.send({ embeds: [await embedBoasVindas()] });
    return { ok: true, canal: canal.name ?? canal.id };
  } catch (erro) {
    console.error(`⋆｡°✩ Boas-vindas falhou em ${guild.id}:`, erro?.message || erro);
    return { ok: false, motivo: erro?.message || 'erro ao enviar' };
  }
}

/**
 * Garante que a Mila tenha permissão de compartilhar tela (Stream) em todos
 * os canais de voz do servidor, além de Conectar e Falar (para poder entrar
 * na chamada e usar o relé de voz).
 *
 * Resiliência: aplica cada canal num try/catch próprio — se o Discord negar
 * a edição (o bot sem ManageChannels naquele canal), só aquele canal fica de
 * fora e o resto continua. Nunca derruba o fluxo.
 *
 * @returns {Promise<{aplicados:number, total:number}>}
 */
async function garantirPermissaoTela(guild) {
  const client = guild.client;
  const botId = client?.user?.id;
  if (!botId) return { aplicados: 0, total: 0 };

  if (guild.channels.cache.size === 0) {
    await guild.channels.fetch().catch(() => {});
  }

  const canaisVoz = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice);

  const aplicados = await Promise.all(
    canaisVoz.map(async (canal) => {
      try {
        const existente = canal.permissionOverwrites?.cache?.get(botId);
        if (existente) {
          await existente.edit({ Stream: true, Connect: true, Speak: true });
        } else {
          await canal.permissionOverwrites.create(botId, {
            Stream: true,
            Connect: true,
            Speak: true,
          });
        }
        return true;
      } catch {
        return false;
      }
    })
  );

  return { aplicados: aplicados.filter(Boolean).length, total: canaisVoz.size };
}

module.exports = { enviarBoasVindas, garantirPermissaoTela, escolherCanalBoasVindas, embedBoasVindas };