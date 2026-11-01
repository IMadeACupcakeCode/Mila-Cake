const pokemon = require('../utils/pokemon');
const db = require('../utils/db');
const { THEME } = require('../utils/theme');
const { criarEmbed } = require('../utils/theme');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

function embedTroca(ctx, de, para, dePokemon, paraPokemon, status) {
  return criarEmbed({
    titulo: '🔄 Troca de Pokémon',
    descricao: `${status}\n\n**Oferece:** ${dePokemon}\n**Recebe:** ${paraPokemon}\n\n*Ambos precisam confirmar com ✅. Use ❌ para cancelar.*`,
    cor: status.includes('Confirmado') ? THEME.corSucesso : THEME.corPrincipal,
    thumbnail: para.displayAvatarURL?.({ size: 128 }) || de.displayAvatarURL?.({ size: 128 }),
    rodape: 'Troca só é concluída quando ambos confirmam',
  });
}

module.exports = {
  data: { name: 'trocar', description: 'Troque Pokémon com outro treinador (ambos confirmam)', options: [
    { type: 6, name: 'usuario', description: 'Treinador para trocar', required: true },
    { type: 3, name: 'meu', description: 'Seu Pokémon (nome ou ID)', required: true },
    { type: 3, name: 'dele', description: 'Pokémon do outro (nome ou ID)', required: false },
  ]},
  async execute(interaction, client) {
    const alvo = interaction.options?.getUser('usuario');
    const user = interaction.user;
    const guildId = interaction.guildId;
    if (!alvo || alvo.bot || alvo.id === user.id) return interaction.reply({ embeds: [criarEmbed({ titulo: 'Troca inválida', descricao: alvo?.bot ? 'Não troco com bots.' : 'Não pode trocar consigo.', cor: THEME.corErro })], ephemeral: true });

    const meuNome = interaction.options?.getString('meu');
    const deleNome = interaction.options?.getString('dele') || '';

    const meuCaptura = pokemon.listarColecao(user.id, 5, 0, guildId).pokemon.find(c => String(c.species_name || '').toLowerCase().includes(String(meuNome).toLowerCase()) || String(c.pokemon_id).includes(meuNome));
    if (!meuCaptura) return interaction.reply({ embeds: [criarEmbed({ titulo: 'Pokémon não encontrado', descricao: `Não encontrei \`${meuNome}\` na sua coleção.`, cor: THEME.corErro })], ephemeral: true });

    let deleCaptura = null;
    if (deleNome) {
      deleCaptura = pokemon.listarColecao(alvo.id, 5, 0, guildId).pokemon.find(c => String(c.species_name || '').toLowerCase().includes(String(deleNome).toLowerCase()) || String(c.pokemon_id).includes(deleNome));
      if (!deleCaptura) return interaction.reply({ embeds: [criarEmbed({ titulo: 'Pokémon do outro não encontrado', descricao: `Não encontrei \`${deleNome}\` na coleção de ${alvo.username || alvo}.`, cor: THEME.corErro })], ephemeral: true });
    }

    const msg = await interaction.reply({ embeds: [embedTroca({ isSlash: true, user, guildId }, user, alvo, `${meuCaptura.name_pt} (#${meuCaptura.pokemon_id})`, deleCaptura ? `${deleCaptura.name_pt} (#${deleCaptura.pokemon_id})` : 'Qualquer Pokémon', 'Aguardando confirmações...')], fetchReply: true });
    try { await msg.react('✅'); await msg.react('❌'); } catch {}

    const collector = msg.createReactionCollector({ time: 60000, filter: (r, u) => !u.bot && ['✅','❌'].includes(r.emoji.name) });
    const confirmacoes = new Set();
    collector.on('collect', async (reaction, userReact) => {
      const id = userReact.id;
      if (confirmacoes.has(id)) return;
      confirmacoes.add(id);

      if (reaction.emoji.name === '❌') {
        collector.stop('cancelado');
        try { await msg.edit({ embeds: [embedTroca({ isSlash: true, user, guildId }, user, alvo, `${meuCaptura.name_pt}`, deleCaptura ? `${deleCaptura.name_pt}` : '', 'Troca cancelada.')], components: [] }); } catch {}
        return;
      }
      if (reaction.emoji.name === '✅') {
        if (confirmacoes.size >= 2) {
          collector.stop('confirmado');
          // Executa troca: atualiza pokemon_collection
          const sql = db.db;
          // Troca simples: atualiza user_id das capturas selecionadas
          sql.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?').run(alvo.id, meuCaptura.id);
          if (deleCaptura) {
            sql.prepare('UPDATE pokemon_collection SET user_id = ? WHERE id = ?').run(user.id, deleCaptura.id);
          }
          try { await msg.edit({ embeds: [embedTroca({ isSlash: true, user, guildId }, user, alvo, `${meuCaptura.name_pt}`, deleCaptura ? `${deleCaptura.name_pt}` : '', 'Troca concluída!')], components: [] }); } catch {}
        }
      }
    });
    collector.on('end', async (collected, reason) => {
      if (reason !== 'confirmado') {
        try { await msg.edit({ embeds: [embedTroca({ isSlash: true, user, guildId }, user, alvo, `${meuCaptura.name_pt}`, deleCaptura ? `${deleCaptura.name_pt}` : '', 'Tempo esgotado.')], components: [] }); } catch {}
      }
    });
  }
};
