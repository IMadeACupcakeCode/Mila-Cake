// Converte strings como "10m", "1h", "2h30m", "45s", "1d" em milissegundos
// Também suporta datas absolutas: "25/12/2026 15:30", "amanhã 14:00",
// "2pm 21/08/2026", "13:40 02/12", "2pm", "13:40"
function parseTempo(texto) {
  if (!texto) return null;

  // Tenta interpretar como data absoluta primeiro
  const dataAbs = parseDataAbsoluta(texto);
  if (dataAbs) return dataAbs;

  // Fallback: formato relativo (10m, 1h30m, 2d, etc.)
  const regex = /(\d+)\s*(d|h|m|s)/gi;
  let totalMs = 0;
  let encontrouAlgo = false;
  let match;

  while ((match = regex.exec(texto)) !== null) {
    encontrouAlgo = true;
    const valor = parseInt(match[1], 10);
    const unidade = match[2].toLowerCase();

    switch (unidade) {
      case 'd':
        totalMs += valor * 24 * 60 * 60 * 1000;
        break;
      case 'h':
        totalMs += valor * 60 * 60 * 1000;
        break;
      case 'm':
        totalMs += valor * 60 * 1000;
        break;
      case 's':
        totalMs += valor * 1000;
        break;
    }
  }

  if (!encontrouAlgo || totalMs <= 0) return null;
  return totalMs;
}

// Interpreta datas absolutas no formato:
//   "25/12/2026 15:30" → timestamp futuro
//   "25/12/2026"       → 9:00 desse dia
//   "13:40 02/12"      → 13:40 do dia 02/12 (ano atual ou próximo)
//   "2pm 21/08/2026"   → 14:00 do dia 21/08/2026
//   "2pm"              → 14:00 de hoje
//   "13:40"            → 13:40 de hoje
//   "amanhã 14:00"     → amanhã às 14:00
//   "hoje 18:30"       → hoje às 18:30
function parseDataAbsoluta(texto) {
  const t = texto.trim().toLowerCase();
  const agora = new Date();
  let alvo = new Date(agora);

  // "amanhã" / "hoje" com hora opcional
  if (t.startsWith('amanhã') || t.startsWith('amanha')) {
    alvo.setDate(alvo.getDate() + 1);
    const resto = t.replace(/^amanh[ãa]/, '').trim();
    if (resto) {
      const h = parseHora(resto);
      if (h !== null) {
        alvo.setHours(h.h, h.m, 0, 0);
      }
    } else {
      alvo.setHours(9, 0, 0, 0);
    }
    const diff = alvo.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  if (t.startsWith('hoje')) {
    const resto = t.replace(/^hoje/, '').trim();
    if (resto) {
      const h = parseHora(resto);
      if (h !== null) {
        alvo.setHours(h.h, h.m, 0, 0);
      }
    } else {
      alvo.setHours(23, 59, 0, 0);
    }
    const diff = alvo.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  // Tenta "13:40 02/12" ou "2pm 21/08/2026" ou "13:40" ou "2pm"
  // Primeiro: "13:40 02/12/2026" ou "13:40 02/12"
  const matchHoraData = t.match(/^(\d{1,2})[.:](\d{2})\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (matchHoraData) {
    const hh = parseInt(matchHoraData[1], 10);
    const mm = parseInt(matchHoraData[2], 10);
    const dia = parseInt(matchHoraData[3], 10);
    const mes = parseInt(matchHoraData[4], 10) - 1;
    let ano = matchHoraData[5] ? parseInt(matchHoraData[5], 10) : agora.getFullYear();
    alvo = new Date(ano, mes, dia, hh, mm, 0, 0);
    // Se já passou, tenta próximo ano
    if (alvo.getTime() <= Date.now() && !matchHoraData[5]) {
      alvo.setFullYear(ano + 1);
    }
    const diff = alvo.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  // "2pm 21/08/2026" ou "2pm 21/08"
  const matchPmData = t.match(/^(\d{1,2})\s*(am|pm)\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/i);
  if (matchPmData) {
    let hh = parseInt(matchPmData[1], 10);
    const ampm = matchPmData[2].toLowerCase();
    if (ampm === 'pm' && hh < 12) hh += 12;
    if (ampm === 'am' && hh === 12) hh = 0;
    const mm = 0;
    const dia = parseInt(matchPmData[3], 10);
    const mes = parseInt(matchPmData[4], 10) - 1;
    let ano = matchPmData[5] ? parseInt(matchPmData[5], 10) : agora.getFullYear();
    alvo = new Date(ano, mes, dia, hh, mm, 0, 0);
    if (alvo.getTime() <= Date.now() && !matchPmData[5]) {
      alvo.setFullYear(ano + 1);
    }
    const diff = alvo.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  // "25/12/2026 15:30" ou "25/12/2026"
  const matchData = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[.:](\d{2}))?$/);
  if (matchData) {
    const dia = parseInt(matchData[1], 10);
    const mes = parseInt(matchData[2], 10) - 1;
    const ano = parseInt(matchData[3], 10);
    alvo = new Date(ano, mes, dia);
    if (matchData[4] && matchData[5]) {
      alvo.setHours(parseInt(matchData[4], 10), parseInt(matchData[5], 10), 0, 0);
    } else {
      alvo.setHours(9, 0, 0, 0);
    }
    const diff = alvo.getTime() - Date.now();
    return diff > 0 ? diff : null;
  }

  // Só hora: "13:40" ou "2pm"
  const h = parseHora(t);
  if (h !== null) {
    alvo.setHours(h.h, h.m, 0, 0);
    const diff = alvo.getTime() - Date.now();
    // Se já passou hoje, agenda para amanhã
    if (diff <= 0) {
      alvo.setDate(alvo.getDate() + 1);
      return alvo.getTime() - Date.now();
    }
    return diff;
  }

  return null;
}

// Interpreta hora: "13:40", "2pm", "2:30pm", "14:00"
function parseHora(texto) {
  const t = texto.trim().toLowerCase();

  // "2pm" ou "2:30pm"
  const matchPm = t.match(/^(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)$/i);
  if (matchPm) {
    let h = parseInt(matchPm[1], 10);
    const m = matchPm[2] ? parseInt(matchPm[2], 10) : 0;
    const ampm = matchPm[3].toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    if (ampm === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    return null;
  }

  // "13:40" ou "14"
  const matchHora = t.match(/^(\d{1,2})(?:[.:](\d{2}))?$/);
  if (matchHora) {
    const h = parseInt(matchHora[1], 10);
    const m = matchHora[2] ? parseInt(matchHora[2], 10) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
    return null;
  }

  return null;
}

function formatarDuracao(ms) {
  if (ms <= 0) return 'agora';
  const segundos = Math.floor(ms / 1000);
  const dias = Math.floor(segundos / 86400);
  const horas = Math.floor((segundos % 86400) / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const segs = segundos % 60;

  const partes = [];
  if (dias) partes.push(`${dias}d`);
  if (horas) partes.push(`${horas}h`);
  if (minutos) partes.push(`${minutos}m`);
  if (segs && !dias) partes.push(`${segs}s`);

  return partes.join(' ') || '0s';
}

function formatarDataAbsoluta(ts) {
  const d = new Date(ts);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

module.exports = { parseTempo, formatarDuracao, formatarDataAbsoluta, parseDataAbsoluta };