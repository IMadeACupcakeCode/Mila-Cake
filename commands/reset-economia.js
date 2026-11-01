const db = require('../utils/db');
const theme = require('../utils/economyTheme');
const { THEME } = require('../utils/theme');
const criador = require('../utils/criador');

module.exports = {
  data: { name: 'reset-economia', description: 'Reseta a economia e itens de loja no servidor (não afeta Pokémon)' },
  async execute(interaction) {
    const guildId = interaction.guildId;
    const membro = interaction.member;
    if (!membro?.permissions?.has('Administrator') && !criador.ehCriador(interaction.user.id)) {
      return interaction.reply({ embeds: [require('../utils/theme').criarEmbed({ titulo: 'Acesso restrito', descricao: 'Apenas administradores podem resetar a economia.', cor: THEME.corErro })], ephemeral: true });
    }
    const dbraw = db.db;
    // Reset saldos (exceto criador)
    const usuarios = dbraw.prepare('SELECT id FROM usuarios').all();
    let resetados = 0;
    for (const u of usuarios) {
      if (criador.ehCriador(u.id)) continue;
      dbraw.prepare('UPDATE usuarios SET acucares = 0 WHERE id = ?').run(u.id);
      dbraw.prepare('DELETE FROM inventario WHERE user_id = ?').run(u.id);
      resetados++;
    }
    const msg = await interaction.reply({ embeds: [require('../utils/theme').criarEmbed({ titulo: 'Economia resetada', descricao: `Servidor <#${guildId || 'DM'}>: saldos zerados e mochila de loja limpa para ${resetados} usuário(s). Pokémon não foram afetados.`, cor: THEME.corSucesso })], fetchReply: true });
    try { await msg.react('✅'); await msg.react('❌'); } catch {}
    const collector = msg.createReactionCollector({ time: 30000, filter: (r, u) => u.id === interaction.user.id && ['✅','❌'].includes(r.emoji.name) });
    collector.on('collect', async (reaction) => {
      if (reaction.emoji.name === '❌') {
        collector.stop();
        return msg.edit({ content: 'Reset cancelado.', embeds: [], components: [] }).catch(() => {});
      }
      collector.stop();
    });
  }
};
