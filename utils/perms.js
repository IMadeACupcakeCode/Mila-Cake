// ── Cargos do servidor Mila Cake ──────────────────────────────────────
// Admin: pode usar comandos de moderação
const STAFF_CARGO_IDS = [
  '1286338774850211991', // Admin
  '1236738710943305765', // Fundador
  '1236744432242528358', // Fundador
];

// Fundadores (acima de admin)
const FOUNDER_IDS = [
  '1236738710943305765',
  '1236744432242528358',
];

// Membro comum (apenas visualização, sem privilégios)
const MEMBRO_CARGO_ID = '1236738710943305764';

/**
 * Verifica se um membro é staff (admin+ ou fundador).
 * Inclui permissão Administrador e ManageGuild como fallback.
 */
function isStaff(member) {
  if (!member) return false;
  // Permissões padrão de admin
  const temPermissao = member.permissions?.has('Administrator') || member.permissions?.has('ManageGuild');
  if (temPermissao) return true;
  // Verifica nos cargos do membro
  const cargos = member.roles?.cache || [];
  return cargos.some((r) => STAFF_CARGO_IDS.includes(r.id));
}

/**
 * Verifica se um membro é fundador (acima de admin).
 */
function isFounder(member) {
  if (!member) return false;
  const cargos = member.roles?.cache || [];
  return cargos.some((r) => FOUNDER_IDS.includes(r.id));
}

/**
 * Verifica se um membro é admin (mas não fundador).
 */
function isAdmin(member) {
  if (!member) return false;
  if (isFounder(member)) return false;
  const cargos = member.roles?.cache || [];
  return cargos.some((r) => r.id === '1286338774850211991');
}

/**
 * Verifica se um membro tem o cargo de membro comum.
 */
function isMembro(member) {
  if (!member) return false;
  const cargos = member.roles?.cache || [];
  return cargos.some((r) => r.id === MEMBRO_CARGO_ID);
}

module.exports = { isStaff, isFounder, isAdmin, isMembro, STAFF_CARGO_IDS, FOUNDER_IDS, MEMBRO_CARGO_ID };
