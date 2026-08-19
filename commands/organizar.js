const { criarEmbed, THEME } = require('../utils/theme');
const { obterConfig, TIPOS_ANUNCIO } = require('../utils/servidorStore');

// Categorias de organização do servidor que a bot ajuda a manter
const CATEGORIAS = [
  { nome: '🎲 Diversão', itens: '$dado, $roleta', desc: 'Rolagens e sorteios' },
  { nome: '⏰ Lembretes', itens: '$lembrete', desc: 'Avisos agendados por pessoa' },
  { nome: '📣 Comunicação', itens: '$anuncio, $configurar', desc: 'Canais e anúncios classificados' },
  { nome: '🛠️ Utilidades', itens: '$ping, $organizar', desc: 'Status e painel do servidor' },
];

module.exports = {
  data: { name: 'organizar', description: 'Mostra um painel de organização do servidor e como a bot está distribuída' },

  async execute(interaction, client) {
    const guild = interaction.guild;
    const cfg = obterConfig(guild.id);

    // Campo: estrutura de categorias de comandos
    const camposComandos = CATEGORIAS.map((c) => ({
      name: c.nome,
      value: `> ${c.desc}\n> \`${c.itens}\``,
      inline: true,
    }));

    // Campo: roteamento de anúncios (classificação por tipo)
    const roteamento = TIPOS_ANUNCIO.map((t) => {
      const id = cfg.anuncios[t];
      return `˖ **${t}** → ${id ? `<#${id}>` : '`sem canal`'}`;
    }).join('\n');

    const embedPainel = criarEmbed({
      titulo: `Painel de Organização — ${guild.name}`,
      descricao:
        'Aqui está como a **Mila Bot** mantém este servidor organizado. ' +
        'Use `$configurar` para ajustar os canais e `$anuncio` para enviar avisos classificados.',
      cor: THEME.corPrincipal,
      rodape: `${THEME.nome} organiza por aqui...`,
    })
    .addFields(
      { name: '✦ Centro de comandos', value: camposComandos.map((c) => `**${c.name}**`).join('   '), inline: false },
      ...camposComandos,
      {
        name: '📍 Roteamento de anúncios',
        value: roteamento,
        inline: false,
      },
      {
        name: '🗣️ Onde a bot fala',
        value:
          cfg.canaisPermitidos.length > 0
            ? `Somente em: ${cfg.canaisPermitidos.map((id) => `<#${id}>`).join('  ·  ')}`
            : 'Em qualquer canal (exceto os bloqueados)',
        inline: false,
      }
    );

    return interaction.reply({ embeds: [embedPainel] });
  },
};