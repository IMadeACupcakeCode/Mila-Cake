const { PermissionFlagsBits } = require('discord.js');
const { criarEmbed, THEME } = require('./theme');
const { STAFF_CARGO_IDS } = require('./perms');
const { obterHistorico, avaliarRisco, obterMarcacoes } = require('./segurancaStore');
const { presenceMap } = require('./cache');
const { formatarDataAbsoluta } = require('./tempo');

// ── Constantes de presença ─────────────────────────────────────────────────
const ONLINE_STATUSES = new Set(['online', 'idle', 'dnd']);
const STATUS_EMOJI = { online: '🟢', idle: '🌙', dnd: '⛔', offline: '⚪' };
const STAFF_KEYWORDS = /(staff|moderador|moderadora|moderador\(a\)|admin|administrador|adm|gerente|suporte)/i;

// ── Verificação de staff ────────────────────────────────────────────────────
function isGuildStaff(member) {
  if (!member) return false;
  if (member.permissions?.has(PermissionFlagsBits.Administrator) || member.permissions?.has(PermissionFlagsBits.ManageGuild)) {
    return true;
  }
  const cargos = member.roles?.cache || [];
  if (cargos.some((role) => STAFF_CARGO_IDS.includes(role.id))) return true;
  return cargos.some((role) => STAFF_KEYWORDS.test(role.name));
}

// ── Presença em tempo real ──────────────────────────────────────────────────
function presenceStatus(member) {
  return presenceMap.get(member.id) || member.presence?.status || 'offline';
}

function isOnline(member) {
  return ONLINE_STATUSES.has(presenceStatus(member));
}

// ── Embed de detalhe de um membro ──────────────────────────────────────────
function buildMembroEmbed(member) {
  const hist = obterHistorico(member.user.id);
  const risco = avaliarRisco(member);
  const marcacoes = obterMarcacoes(member.guild.id)[member.user.id];
  const st = presenceStatus(member);
  const criadoEm = member.user.createdAt ? formatarDataAbsoluta(member.user.createdAt.getTime()) : 'desconhecido';
  const entrouEm = member.joinedAt ? formatarDataAbsoluta(member.joinedAt.getTime()) : 'desconhecido';

  const desc =
    `**Tag:** ${member.user.tag}\n` +
    `**ID:** \`${member.user.id}\`\n` +
    `**Tipo:** ${member.user.bot ? '🤖 Bot' : '👤 Humano'}  ${isGuildStaff(member) ? '• 👑 Staff' : ''}\n` +
    `**Status agora:** ${STATUS_EMOJI[st] || '⚪'} ${st}\n` +
    `**Conta criada:** ${criadoEm}\n` +
    `**Entrou no servidor:** ${entrouEm}\n`;

  const embed = criarEmbed({
    titulo: `🔍 Detalhe de ${member.user.username}`,
    descricao: desc,
    cor: hist.suspenso > 0 || risco.length ? THEME.corErro : THEME.corPrincipal,
  });

  embed.addFields({
    name: '🚫 Suspensões registradas',
    value: `Total: **${hist.suspenso}**  (servidor: ${hist.suspensoServidor || 0} • Discord: ${hist.suspensoDiscord || 0})`,
    inline: false,
  });

  if (risco.length) {
    embed.addFields({ name: '⚠️ Sinais de risco (Discord)', value: risco.map((r) => `• ${r}`).join('\n'), inline: false });
  }
  if (marcacoes) {
    embed.addFields({ name: '📌 Marcação no servidor', value: `**${marcacoes.tipo}**: ${marcacoes.nota || ''}`, inline: false });
  }
  return embed;
}

module.exports = {
  isGuildStaff,
  presenceStatus,
  isOnline,
  STATUS_EMOJI,
  buildMembroEmbed,
};
