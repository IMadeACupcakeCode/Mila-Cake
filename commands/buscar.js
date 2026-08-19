const { SlashCommandBuilder } = require('discord.js');

const { criarEmbed, THEME } = require('../utils/theme');
const { isStaff } = require('../utils/perms');
const { clientCache } = require('../utils/cache');
const { buildMembroEmbed, isGuildStaff } = require('../utils/membroEmbed');

// ── Cache de fallback simples (evita fetch repetido na mesma sessão) ──────
const fallbackCache = new Map(); // guildId -> { members: Map, timestamp }

// ── Obtém membros do servidor de forma robusta ────────────────────────────
async function obterMembros(guild) {
  // 1. Tenta do cache gerenciado (populado no boot)
  const entry = clientCache.get(guild.id);
  if (entry && entry.members && entry.members.size) {
    return Array.from(entry.members.values());
  }

  // 2. Tenta do cache nativo do Discord.js (se GuildMembers intent ativa)
  if (guild.members.cache.size) {
    return Array.from(guild.members.cache.values());
  }

  // 3. Tenta do nosso fallback local
  const fb = fallbackCache.get(guild.id);
  if (fb && fb.members.size) {
    return Array.from(fb.members.values());
  }

  // 4. Último recurso: fetch sob demanda (pode falhar sem intents)
  try {
    const fetched = await guild.members.fetch({ withPresences: false });
    const arr = Array.from(fetched.values());
    // Guarda no fallback para não precisar refetchar
    fallbackCache.set(guild.id, { members: fetched, timestamp: Date.now() });
    return arr;
  } catch {
    return [];
  }
}

// ── Algoritmo de busca estilo Google ──────────────────────────────────────
function pontuacao(m, t) {
  let pontos = 0;
  const username = (m.user.username || '').toLowerCase();
  const globalName = (m.user.globalName || '').toLowerCase();
  const tag = (m.user.tag || '').toLowerCase();
  const id = m.user.id;
  const displayName = (m.displayName || '').toLowerCase();
  const nick = (m.nickname || '').toLowerCase();

  // Correspondência exata no começo = maior pontuação
  if (username === t) pontos += 100;
  else if (username.startsWith(t)) pontos += 80;
  else if (username.includes(t)) pontos += 50;

  if (globalName === t) pontos += 90;
  else if (globalName.startsWith(t)) pontos += 70;
  else if (globalName.includes(t)) pontos += 40;

  if (displayName === t) pontos += 85;
  else if (displayName.startsWith(t)) pontos += 65;
  else if (displayName.includes(t)) pontos += 35;

  if (nick === t) pontos += 75;
  else if (nick.startsWith(t)) pontos += 55;
  else if (nick.includes(t)) pontos += 30;

  // Tag (username#discriminator)
  if (tag === t) pontos += 60;
  else if (tag.startsWith(t)) pontos += 40;
  else if (tag.includes(t)) pontos += 20;

  // ID
  if (id === t) pontos += 200;
  else if (id.startsWith(t)) pontos += 100;
  else if (id.includes(t)) pontos += 10;

  // Bots aparecem depois
  if (m.user.bot) pontos -= 50;

  return pontos;
}

// ── Sugestões ao vivo (autocomplete estilo Google) ───────────────────────
async function sugerir(termo, guild) {
  const membros = await obterMembros(guild);
  if (!membros.length) return [];

  const t = (termo || '').trim().toLowerCase();

  // Se não digitou nada, mostra os 25 primeiros (ordenados por nome)
  if (!t) {
    return membros
      .sort((a, b) => (a.user.username || '').localeCompare(b.user.username || ''))
      .slice(0, 25)
      .map((m) => {
        const icone = m.user.bot ? '🤖' : '👤';
        return { name: `${icone} ${m.user.username}`.slice(0, 100), value: m.user.id };
      });
  }

  // Filtra e ordena por pontuação (mais relevante primeiro)
  const resultados = membros
    .map((m) => ({ m, pontos: pontuacao(m, t) }))
    .filter((x) => x.pontos > 0)
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 25)
    .map(({ m }) => {
      const icone = m.user.bot ? '🤖' : '👤';
      // Mostra o nome + discriminador para ajudar na identificação
      const nome = m.user.globalName
        ? `${icone} ${m.user.globalName} (@${m.user.username})`
        : `${icone} ${m.user.username}`;
      return { name: nome.slice(0, 100), value: m.user.id };
    });

  return resultados;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buscar')
    .setDescription('🔍 Busca um membro em tempo real — digite para ver sugestões (como o Google)')
    .addStringOption((opt) =>
      opt
        .setName('membro')
        .setDescription('Nome, tag, nome global ou ID do membro')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  // Disparado a cada tecla digitada no campo de busca
  async autocomplete(interaction) {
    try {
      const termo = interaction.options.getFocused();
      const sugestoes = await sugerir(termo, interaction.guild);
      await interaction.respond(sugestoes);
    } catch (error) {
      // Autocomplete NUNCA pode lançar erro, senão o Discord mostra "Interaction failed"
      console.error('Erro no autocomplete de buscar:', error);
      try {
        await interaction.respond([]);
      } catch {
        // ignora se já expirou
      }
    }
  },

  // Quando o usuário escolhe uma sugestão e envia o comando
  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Acesso negado', descricao: 'Somente staff pode usar este comando.', cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    const id = interaction.options.getString('membro');
    const guild = interaction.guild;

    // Tenta encontrar o membro de várias fontes
    let m = clientCache.get(guild.id)?.members?.get(id) ||
            guild.members.cache.get(id) ||
            fallbackCache.get(guild.id)?.members?.get(id) ||
            null;

    if (!m) {
      try {
        m = await guild.members.fetch(id);
      } catch {
        m = null;
      }
    }

    if (!m) {
      return interaction.reply({
        embeds: [criarEmbed({ titulo: 'Membro não encontrado', descricao: 'Não achei esse ID.', cor: THEME.corErro })],
        ephemeral: true,
      });
    }

    await interaction.reply({ embeds: [buildMembroEmbed(m)], ephemeral: true });
  },
};