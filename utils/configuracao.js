// ⋆｡°✩ Configuração central da Mila Bot.
// Tudo adaptável via .env para você customizar sem caçar o código.

require('dotenv').config();

// Nome de exibição da bot (usado em embeds, footers, activity, etc.)
const NOME_BOT = process.env.BOT_NOME || '⋆｡°✩ Mila Bot';

// ID do servidor (guild) alvo. Usado para registrar slash commands apenas na guild.
const SERVIDOR_ALVO = process.env.GUILD_ID || null;

// Comando "sobre a bot".
// `nome`  → nome principal do comando (slash + prefixo)
// `alias` → nomes alternativos aceitos no prefixo $ (ex.: $mila, $milabot, $botinfo)
const COMANDO_SOBRE = {
  nome: process.env.COMANDO_SOBRE_NOME || 'sobre',
  alias: (process.env.COMANDO_SOBRE_ALIAS || 'mila,milabot,botinfo')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  descricao: '⋆｡°✩ Sobre a Mila Bot',
};

// Contexto do servidor (para usar em descrições e embeds).
const CONTEXTO_SERVIDOR = process.env.CONTEXTO_SERVIDOR || 'Mila Cake';

module.exports = { NOME_BOT, SERVIDOR_ALVO, COMANDO_SOBRE, CONTEXTO_SERVIDOR };
