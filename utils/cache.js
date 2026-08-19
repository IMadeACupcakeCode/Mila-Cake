// utils/cache.js
// -------------------------------------------------
// Cache simples em memória
// -------------------------------------------------

// guildId -> { members: Collection, timestamp: number (ms) }
const clientCache = new Map();

// userId -> 'online' | 'idle' | 'dnd' | 'offline'
const presenceMap = new Map();

// userId -> [{ type: 'suspenso', notes: '...', date: Date }, ...] // histórico
const historyMap = new Map();

module.exports = { clientCache, presenceMap, historyMap };