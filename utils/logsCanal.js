// ⋆｡°✩ Logs de eventos no canal configurado com $configurar logs.
// Este módulo concentra o envio de embeds de auditoria (mensagens apagadas,
// edições e afins) para o canal definido em `canalLogs`.
//
// Regra de ouro: nada aqui pode derrubar a Mila. Todo acesso a canal,
// mensagem parcial ou edição é protegido — o Discord responde
// "Unknown Message" quando a mensagem some antes do fetch, e isso não é erro
// do bot.

const { criarEmbed, THEME } = require('./theme');
const { obterConfig } = require('./servidorStore');

const LIMITE_CAMPO = 1024;
const LIMITE_ANEXOS = 10;

function cortar(texto, limite = LIMITE_CAMPO) {
  const valor = String(texto ?? '');
  if (valor.length <= limite) return valor;
  return `${valor.slice(0, limite - 3)}...`;
}

function dataCurta(data) {
  const d = data instanceof Date ? data : new Date(data || Date.now());
  if (Number.isNaN(d.getTime())) return '`data desconhecida`';
  return `<t:${Math.floor(d.getTime() / 1000)}:F>`;
}

/** Busca o canal de logs configurado, sem lançar em caso de falha. */
async function obterCanalLogs(client, guild) {
  if (!guild) return null;
  let config;
  try {
    config = obterConfig(guild.id);
  } catch {
    return null;
  }
  const canalId = config?.canalLogs;
  if (!canalId) return null;

  let canal = guild.channels?.cache?.get?.(canalId) || null;
  if (!canal && typeof guild.channels?.fetch === 'function') {
    canal = await guild.channels.fetch(canalId).catch(() => null);
  }

  if (!canal || typeof canal.send !== 'function') return null;
  if (typeof canal.isTextBased === 'function' && !canal.isTextBased()) return null;
  return canal;
}

/**
 * Envia um embed de auditoria para o canal de logs do servidor.
 * Retorna a mensagem enviada ou null quando não há canal configurado.
 */
async function enviarLogCanal(client, guild, embed) {
  const canal = await obterCanalLogs(client, guild);
  if (!canal) return null;
  try {
    return await canal.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (erro) {
    // Canal apagado, sem permissão ou rate limit: segue a vida.
    console.warn(`[logs] Não consegui enviar log em #${canal.id}:`, erro?.message || erro);
    return null;
  }
}

function descreverAutor(message) {
  const autor = message?.author;
  if (!autor) return { nome: '`desconhecido`', icone: null, id: null };
  const nome = autor.bot ? `${autor.tag || autor.username} \`(bot)\`` : autor.tag || autor.username || '`desconhecido`';
  return { nome, icone: autor.displayAvatarURL?.({ size: 128 }) || null, id: autor.id || null };
}

function listarAnexos(message) {
  const anexos = message?.attachments;
  if (!anexos || anexos.size === 0) return null;
  const linhas = [...anexos.values()]
    .slice(0, LIMITE_ANEXOS)
    .map((a) => `˖ [${cortar(a.name || 'arquivo', 80)}](${a.url})`);
  if (anexos.size > LIMITE_ANEXOS) linhas.push(`˖ …e mais ${anexos.size - LIMITE_ANEXOS} anexo(s).`);
  return linhas.join('\n');
}

/** Tenta enriquecer uma mensagem parcial; devolve null se já foi apagada. */
async function completarMensagem(message) {
  if (!message) return null;
  if (!message.partial) return message;
  try {
    return await message.fetch();
  } catch {
    // "Unknown Message": a mensagem já foi apagada e não há mais o que buscar.
    return null;
  }
}

function montarEmbedMensagemApagada(message, { completa = false } = {}) {
  const autor = descreverAutor(message);
  const canal = message?.channel ? `<#${message.channel.id}>` : '`canal desconhecido`';
  const conteudo = completa
    ? cortar(message?.content || '`sem texto (embed, imagem ou conteúdo não armazenado)`')
    : '`conteúdo indisponível — mensagem antiga ou fora do cache`';

  const embed = criarEmbed({
    titulo: '🗑️ Mensagem apagada',
    descricao: `${THEME.div.bolinhas}\n\n**Conteúdo:**\n>>> ${conteudo}\n\n${THEME.div.coracao}`,
    cor: THEME.corErro,
    rodape: `${THEME.nome} registra tudo pra você~ ♡`,
  });

  const campos = [
    { name: '👤 Autor', value: autor.nome, inline: true },
    { name: '📍 Canal', value: canal, inline: true },
    { name: '🕒 Enviada em', value: dataCurta(message?.createdAt), inline: false },
  ];

  if (autor.id) campos.push({ name: '🆔 ID do autor', value: `\`${autor.id}\``, inline: true });
  if (message?.id) campos.push({ name: '🆔 ID da mensagem', value: `\`${message.id}\``, inline: true });

  const anexos = listarAnexos(message);
  if (anexos) campos.push({ name: '📎 Anexos', value: anexos, inline: false });

  embed.addFields(campos.slice(0, 25));
  if (autor.icone) embed.setThumbnail(autor.icone);
  return embed;
}

function montarEmbedMensagensApagadas(mensagens, canal) {
  const lista = [...mensagens.values()].slice(0, 10);
  const linhas = lista.map((m, i) => {
    const autor = m?.author?.tag || m?.author?.username || 'desconhecido';
    const texto = cortar(m?.content || '`sem texto`', 160);
    return `**${i + 1}.** ${autor}: ${texto}`;
  });
  if (mensagens.size > lista.length) linhas.push(`…e mais ${mensagens.size - lista.length} mensagem(ns).`);

  return criarEmbed({
    titulo: `🗑️ ${mensagens.size} mensagens apagadas de uma vez`,
    descricao: `${THEME.div.bolinhas}\n\n${linhas.join('\n')}\n\n${THEME.div.coracao}`,
    cor: THEME.corErro,
    rodape: `${THEME.nome} registra tudo pra você~ ♡`,
  }).addFields(
    { name: '📍 Canal', value: canal ? `<#${canal.id}>` : '`desconhecido`', inline: true },
    { name: '🕒 Registrado em', value: dataCurta(new Date()), inline: true }
  );
}

/**
 * Embed de auditoria de mensagem editada.
 * @param {object|null} antes  estado anterior (pode ser parcial)
 * @param {object} depois      estado atual
 * @param {{ completoAntes?: boolean }} opcoes
 */
function montarEmbedMensagemEditada(antes, depois, { completoAntes = false } = {}) {
  const autor = descreverAutor(depois || antes);
  const canal = depois?.channel ? `<#${depois.channel.id}>` : '`canal desconhecido`';

  const textoAntes = completoAntes
    ? cortar(antes?.content || '`sem texto (embed, imagem ou conteúdo não armazenado)`')
    : '`conteúdo anterior indisponível — mensagem fora do cache`';
  const textoDepois = cortar(depois?.content || '`sem texto (embed, imagem ou conteúdo não armazenado)`');

  const link =
    depois?.url ||
    (depois?.guildId && depois?.channelId && depois?.id
      ? `https://discord.com/channels/${depois.guildId}/${depois.channelId}/${depois.id}`
      : null);

  const edicoes = Number(depois?.edits?.length || 0) || 1;

  const embed = criarEmbed({
    titulo: '✏️ Mensagem editada',
    descricao:
      `${THEME.div.bolinhas}\n\n` +
      `**Antes:**\n>>> ${textoAntes}\n\n` +
      `**Depois:**\n>>> ${textoDepois}\n\n` +
      `${THEME.div.coracao}`,
    cor: THEME.corSecundario,
    rodape: `${THEME.nome} registra tudo pra você~ ♡`,
  });

  const campos = [
    { name: '👤 Autor', value: autor.nome, inline: true },
    { name: '📍 Canal', value: canal, inline: true },
    { name: '🔁 Edições', value: `\`${edicoes}\``, inline: true },
    { name: '🕒 Editada em', value: dataCurta(depois?.editedAt || new Date()), inline: false },
  ];

  if (autor.id) campos.push({ name: '🆔 ID do autor', value: `\`${autor.id}\``, inline: true });
  if (depois?.id) campos.push({ name: '🆔 ID da mensagem', value: `\`${depois.id}\``, inline: true });
  if (link) campos.push({ name: '🔗 Link', value: `[ir para a mensagem](${link})`, inline: false });

  embed.addFields(campos.slice(0, 25));
  if (autor.icone) embed.setThumbnail(autor.icone);
  return embed;
}

module.exports = {
  obterCanalLogs,
  enviarLogCanal,
  completarMensagem,
  montarEmbedMensagemApagada,
  montarEmbedMensagensApagadas,
  montarEmbedMensagemEditada,
};
