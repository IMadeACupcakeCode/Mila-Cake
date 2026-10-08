const { PermissionFlagsBits } = require('discord.js');

const { criarEmbed, THEME, rodapeAleatorio } = require('../utils/theme');
const { obterConfig, TIPOS_ANUNCIO } = require('../utils/servidorStore');
const { isStaff } = require('../utils/perms');
const { mostrarDigitando } = require('../utils/milaDecoracao');

// Rótulos para cada tipo de anúncio
const ROTULOS = {
  geral: { titulo: 'Aviso Geral', emoji: '📣', cor: THEME.corPrincipal },
  evento: { titulo: 'Evento', emoji: '🎉', cor: 0xFF9FF3 },
  regra: { titulo: 'Regra do Servidor', emoji: '📜', cor: 0x00CED1 },
  atualizacao: { titulo: 'Atualização', emoji: '✨', cor: THEME.corRoleta },
  aviso: { titulo: 'Aviso Importante', emoji: '⚠️', cor: THEME.corErro },
};

module.exports = {
  meta: { guildOnly: true, permissions: ['ManageGuild', 'Administrator'] },
  data: { name: 'anuncio', description: '📡 Envia um anúncio — Mila Broadcast', options: [{ name: 'tipo', description: 'Tipo do anúncio', type: 3, required: true, choices: Object.keys(ROTULOS).map((value) => ({ name: value, value })) }, { name: 'mensagem', description: 'Texto do anúncio', type: 3, required: true, max_length: 4096 }, { name: 'titulo', description: 'Título personalizado', type: 3, required: false, max_length: 256 }, { name: 'mencionar', description: 'Mencionar everyone (staff)', type: 5, required: false }] },

  async execute(interaction, client) {
    await mostrarDigitando(interaction.channel, 1000);
    const guildId = interaction.guildId;

    // Risco original: qualquer usuário podia enviar anúncios, incluindo @everyone.
    // O Slash command registration via default_member_permissions não é confiável
    // quando o comando é chamado via prefix bridge ($anuncio).
    if (!isStaff(interaction.member)) {
      return interaction.reply({
        embeds: [
          criarEmbed({
            titulo: 'Sem permissão',
            descricao: 'Você precisa de **Gerir Servidor** ou cargo de staff para usar `$anuncio` / `/anuncio`.',
            cor: THEME.corErro,
          }),
        ],
        ephemeral: true,
      });
    }

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
        // Risco original: sem allowedMentions, a @everyone no conteúdo do bot
        // ou de terceiros poderia ser reenviada. Restringe tudo.
        allowedMentions: { parse: [], repliedUser: false },
      });
    } catch (erro) {
      // Risco original: expunha erro.message (pode conter paths internos).
      console.error('Erro ao enviar anúncio:', erro);
      const embedErro = criarEmbed({
        titulo: 'Não consegui enviar',
        descricao: `Tentei mandar em <#${canalId}>, mas falhou. Verifique se a bot tem permissão no canal.`,
        cor: THEME.corErro,
      });
      return interaction.reply({ embeds: [embedErro], ephemeral: true });
    }

    const embedOk = criarEmbed({
      titulo: 'Anúncio enviado',
      descricao: `${THEME.div.bolinhas}\n\nSeu anúncio do tipo **${tipo}** foi para ${canal}.\n\n${THEME.div.coracao}`,
      cor: THEME.corSucesso,
    });
    return interaction.reply({ embeds: [embedOk], ephemeral: true });
  },
};
