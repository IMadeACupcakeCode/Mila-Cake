// utils/cache.js
// -------------------------------------------------
// Cache simples em memória, com validade explícita.
// -------------------------------------------------

// guildId -> { members: Collection, timestamp: number (ms) }
const clientCache = new Map();

// userId -> 'online' | 'idle' | 'dnd' | 'offline'
const presenceMap = new Map();

// Quanto tempo um snapshot de membros é considerado fresco. Sem um teto, o
// cache ficava válido para sempre: membros que saíram continuavam listados e
// a memória nunca era liberada.
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheValido(entry, ttlMs = CACHE_TTL_MS) {
  return Boolean(entry?.members?.size && Date.now() - (entry.timestamp || 0) < ttlMs);
}

module.exports = { clientCache, presenceMap, CACHE_TTL_MS, cacheValido };
