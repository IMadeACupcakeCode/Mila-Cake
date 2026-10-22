// ⋆｡°✩ Mila Boas-Vindas — chegada em servidor novo
//
// Disparado no evento guildCreate (a Mila foi adicionada a um servidor).
// Envia um recado de apresentação no sistema de boas-vindas nativo do
// servidor (ou no primeiro canal de texto onde a Mila pode falar).
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('./theme');
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
 */
async function embedBoasVindas() {
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

module.exports = { enviarBoasVindas, escolherCanalBoasVindas, embedBoasVindas };