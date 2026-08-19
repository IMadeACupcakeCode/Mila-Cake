const { PermissionFlagsBits } = require('discord.js');

const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { obterConfig, TIPOS_ANUNCIO } = require('../utils/servidorStore');

// Rótulos para cada tipo de anúncio
const ROTULOS = {
  geral: { titulo: 'Aviso Geral', emoji: '📣', cor: THEME.corPrincipal },
  evento: { titulo: 'Evento', emoji: '🎉', cor: 0xFF9FF3 },
  regra: { titulo: 'Regra do Servidor', emoji: '📜', cor: 0x00CED1 },
  atualizacao: { titulo: 'Atualização', emoji: '✨', cor: THEME.corRoleta },
  aviso: { titulo: 'Aviso Importante', emoji: '⚠️', cor: THEME.corErro },
};

module.exports = {
  data: { name: 'anuncio', description: '📡 Envia um anúncio — Mila Broadcast' },

  async execute(interaction, client) {
    const guildId = interaction.guildId;
    const tipo = interaction.options.getString('tipo');
    const mensagem = interaction.options.getString('mensagem');
    const tituloPersonalizado = interaction.options.getString('titulo');
    const mencionar = interaction.options.getBoolean('mencionar') || false;

    const cfg = obterConfig(guildId);
    const canalId = cfg.anuncios[tipo];

    if (!canalId) {
      const embedErro = criarEmbed({
        titulo: 'Nenhum canal configurado',
        descricao:
          `Não há um canal definido para anúncios do tipo **${tipo}**.\n` +
          `Use \`$configurar anuncio ${tipo} #canal\` primeiro.`,
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    let canal;
    try {
      canal = await client.channels.fetch(canalId);
    } catch {
      canal = null;
    }

    if (!canal) {
      const embedErro = criarEmbed({
        titulo: 'Canal não encontrado',
        descricao: `O canal salvo para **${tipo}** sumiu ou não tenho acesso a ele.`,
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    const rotulo = ROTULOS[tipo] || { titulo: 'Anúncio', emoji: '📢', cor: THEME.corPrincipal };
    const embed = criarEmbed({
      titulo: `${rotulo.emoji} ${tituloPersonalizado || rotulo.titulo}`,
      descricao: mensagem,
      cor: rotulo.cor,
      rodape: `📡 Mila Broadcast • ${interaction.user.username}`,
    });

    try {
      await canal.send({
        content: mencionar ? '@everyone' : undefined,
        embeds: [embed],
      });
    } catch (erro) {
      const embedErro = criarEmbed({
        titulo: 'Não consegui enviar',
        descricao: `Tentei mandar em <#${canalId}>, mas falhou: ${erro.message}`,
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    const embedOk = criarEmbed({
      titulo: 'Anúncio enviado',
      descricao: `Seu anúncio do tipo **${tipo}** foi para ${canal}.`,
      cor: THEME.corSucesso,
    });
    return interaction.reply({ embeds: [embedOk], ephemeral: true });
  },
};
