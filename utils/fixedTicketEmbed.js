const fs = require('fs');
const path = require('path');
const { criarEmbedPainel, criarBotoesPainel } = require('./ticketManager');
const { obterConfig } = require('./servidorStore');

/** Cache local do ID da mensagem do embed fixo (por guild) */
const CAMINHO_CACHE = path.join(__dirname, '..', 'data', 'fixedEmbedCache.json');

function lerCache() {
  try {
    if (fs.existsSync(CAMINHO_CACHE)) {
      return JSON.parse(fs.readFileSync(CAMINHO_CACHE, 'utf-8'));
    }
  } catch {}
  return {};
}

function salvarCache(dados) {
  const pasta = path.dirname(CAMINHO_CACHE);
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(CAMINHO_CACHE, JSON.stringify(dados, null, 2), 'utf-8');
}

/**
 * Envia (ou substitui) o embed de ticket fixo no canal configurado por servidor.
 * Apenas guilds com canalTicketFixo configurado via $configurar terão o embed.
 */
async function enviarEmbedTicketFixo(client) {
  const cache = lerCache();

  for (const guild of client.guilds.cache.values()) {
    try {
      const cfg = obterConfig(guild.id);
      const canalFixoId = cfg?.canalTicketFixo;
      if (!canalFixoId) continue;

      const canal = await client.channels.fetch(canalFixoId).catch(() => null);
      if (!canal) continue;

      const guildCache = cache[guild.id] || {};
      const msgIdAntiga = guildCache.mensagemId;

      // Remove embed antigo
      if (msgIdAntiga) {
        try {
          const msgAntiga = await canal.messages.fetch(msgIdAntiga).catch(() => null);
          if (msgAntiga && msgAntiga.author.id === client.user.id) {
            await msgAntiga.delete();
          }
        } catch {}
      }

      // Limpa mensagens antigas do bot
      try {
        const mensagens = await canal.messages.fetch({ limit: 50 });
        const minhasMsgs = mensagens.filter(
          (m) => m.author.id === client.user.id && m.id !== msgIdAntiga
        );
        for (const [, msg] of minhasMsgs) {
          await msg.delete().catch(() => {});
        }
      } catch {}

      // Envia novo embed
      const { embed, arquivo } = criarEmbedPainel();
      const botoes = criarBotoesPainel();

      const mensagem = await canal.send({
        embeds: [embed],
        components: botoes,
        files: [{ attachment: arquivo, name: 'Ticket.gif' }],
      });

      cache[guild.id] = { mensagemId: mensagem.id, guildId: guild.id };
      console.log(`⋆｡°✩ Embed de ticket enviado no servidor ${guild.id}`);
    } catch (erro) {
      // Silencia erros para guilds sem permissão
    }
  }

  salvarCache(cache);
}

/**
 * Remove os embeds de ticket fixo (usado no desligamento).
 */
async function removerEmbedTicketFixo(client) {
  const cache = lerCache();

  for (const [guildId, guildCache] of Object.entries(cache)) {
    try {
      const msgId = guildCache.mensagemId;
      if (!msgId) continue;

      // Tenta buscar o canal salvo na cache
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const cfg = obterConfig(guildId);
      const canalFixoId = cfg?.canalTicketFixo;
      if (!canalFixoId) continue;

      const canal = await client.channels.fetch(canalFixoId).catch(() => null);
      if (!canal) continue;

      const msg = await canal.messages.fetch(msgId).catch(() => null);
      if (msg && msg.author.id === client.user.id) {
        await msg.delete();
      }
    } catch {}
  }

  salvarCache({});
}

module.exports = {
  enviarEmbedTicketFixo,
  removerEmbedTicketFixo,
};
