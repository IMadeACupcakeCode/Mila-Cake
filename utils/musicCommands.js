function obterFila(interaction, client) {
  return client.distube.getQueue(interaction.guildId);
}

function responder(interaction, content) {
  return interaction.reply({ content, ephemeral: true });
}

async function executarControle(interaction, client, acao) {
  const queue = obterFila(interaction, client);
  if (!queue) return responder(interaction, '❌ Não há música tocando agora.');
  return acao(queue);
}

function criarControle({ name, description, execute }) {
  return {
    meta: { guildOnly: true },
    data: { name, description },
    execute,
  };
}

function criarComandoFila(name, description) {
  return criarControle({
    name,
    description,
    execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
      const atual = queue.songs[0];
      const proximas = queue.songs.slice(1, 11).map((song, indice) => `**${indice + 1}.** ${song.name} — ${song.formattedDuration}`).join('\n');
      return responder(interaction, `🎵 **Tocando agora:** ${atual?.name || 'Desconhecida'}\n\n📜 **Fila:**\n${proximas || '_Nenhuma música na fila._'}`);
    }),
  });
}

function criarComandoPausa(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    if (queue.paused) return responder(interaction, '⏸️ A música já está pausada.');
    queue.pause();
    return responder(interaction, '⏸️ Música pausada.');
  }) });
}

function criarComandoRetomar(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    if (!queue.paused) return responder(interaction, '▶️ A música já está tocando.');
    queue.resume();
    return responder(interaction, '▶️ Música retomada.');
  }) });
}

function criarComandoPular(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    if (queue.songs.length > 1) {
      await queue.skip();
      return responder(interaction, '⏭️ Música pulada.');
    }
    queue.stop();
    return responder(interaction, '⏹️ Fila encerrada.');
  }) });
}

function criarComandoLimparFila(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    const removidas = Math.max(0, queue.songs.length - 1);
    queue.songs.splice(1);
    return responder(interaction, removidas ? `🧹 ${removidas} música(s) removida(s) da fila.` : '📜 A fila já estava vazia.');
  }) });
}

function criarComandoParar(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    queue.stop();
    return responder(interaction, '⏹️ Reprodução parada.');
  }) });
}

function criarComandoVolume(name, description) {
  return {
    meta: { guildOnly: true },
    data: { name, description, options: [{ name: 'nivel', description: 'Volume entre 0 e 100', type: 4, required: true, min_value: 0, max_value: 100 }] },
    execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
      const nivel = Number(interaction.options.getInteger('nivel'));
      if (!Number.isFinite(nivel) || nivel < 0 || nivel > 100) return responder(interaction, '❌ O volume deve estar entre 0 e 100.');
      queue.setVolume(nivel);
      return responder(interaction, `🔊 Volume ajustado para **${nivel}%**.`);
    }),
  };
}

function criarComandoEmbaralhar(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    queue.shuffle();
    return responder(interaction, '🔀 Fila embaralhada.');
  }) });
}

function criarComandoRepetir(name, description) {
  return {
    meta: { guildOnly: true },
    data: { name, description, options: [{ name: 'modo', description: 'Repetir música, fila ou desativar', type: 3, required: true, choices: [{ name: 'desativado', value: 'off' }, { name: 'música', value: 'song' }, { name: 'fila', value: 'queue' }] }] },
    execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
      const modo = interaction.options.getString('modo');
      queue.setRepeatMode(modo === 'song' ? 1 : modo === 'queue' ? 2 : 0);
      return responder(interaction, `🔁 Repetição: **${modo === 'off' ? 'desativada' : modo === 'song' ? 'música' : 'fila'}**.`);
    }),
  };
}

function criarComandoAgora(name, description) {
  return criarControle({ name, description, execute: async (interaction, client) => executarControle(interaction, client, async (queue) => {
    const song = queue.songs[0];
    return responder(interaction, `🎵 **Tocando agora:** ${song?.name || 'Desconhecida'}\n${song?.url || ''}`);
  }) });
}

module.exports = {
  criarComandoFila,
  criarComandoPausa,
  criarComandoRetomar,
  criarComandoPular,
  criarComandoParar,
  criarComandoLimparFila,
  criarComandoVolume,
  criarComandoEmbaralhar,
  criarComandoRepetir,
  criarComandoAgora,
};
