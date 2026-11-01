// utils/milaSite.js
// ── Endereço oficial do site da Mila ──────────────────────────────────
// Um único lugar define o link exibido nos embeds (/economia, /perfil,
// /sobre) e a descrição pública da aplicação no Discord.
// Para trocar o domínio sem mexer no código: MILA_SITE_URL no .env

const URL_PADRAO = 'http://localhost:3000';
const TEXTO = 'localhost:3000';

/** URL normalizada (sempre com http(s) e sem barra no final). */
function url() {
  const bruto = String(process.env.MILA_SITE_URL || '').trim() || URL_PADRAO;
  const comProtocolo = /^https?:\/\//i.test(bruto) ? bruto : `https://${bruto}`;
  return comProtocolo.replace(/\/+$/, '');
}

/** Link mascarado: mostra "Milablr.com" e abre o site ao clicar. */
function link() {
  return `[${TEXTO}](${url()})`;
}

/** Linha pronta para o corpo de um embed. */
function linha() {
  return `🌐 **Site:** ${link()}`;
}

/** Texto da descrição pública da aplicação (limite do Discord: 400). */
function descricaoAplicacao() {
  return (
    'Mila Cake 🧁 — a doceria virtual: economia de açúcares, diário, trabalho, ' +
    `loja, ranking, conquistas e temas de 2009–2012. Site oficial: ${url()}`
  ).slice(0, 400);
}

/**
 * Atualiza a descrição do bot no Discord (aba "About Me" da aplicação).
 * Falhas são silenciosas: o bot continua funcionando sem essa alteração.
 */
async function atualizarDescricaoAplicacao(client, descricao = descricaoAplicacao()) {
  const app = client?.application;
  if (!app?.edit) return null;
  await app.edit({ description: descricao });
  return descricao;
}

module.exports = {
  URL_PADRAO,
  TEXTO,
  url,
  link,
  linha,
  descricaoAplicacao,
  atualizarDescricaoAplicacao,
};
