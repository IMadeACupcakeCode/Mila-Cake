const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const criador = require('../utils/criador');
const site = require('../utils/milaSite');

module.exports = {
  data: {
    name: 'perfil',
    description: '🧁 Veja o seu perfil da doceria (ou de um amigo)',
    options: [
      {
        name: 'usuario',
        description: 'Perfil de um amigo',
        type: 6,
        required: false,
      },
    ],
  },
  async execute(interaction, client) {
    const alvo = interaction.options?.getUser('usuario') || interaction.user;
    if (alvo.bot) {
      return interaction.reply({ content: '❌ Bots não colecionam doces e não têm níveis.', ephemeral: true });
    }

    const tema = theme.temaDe(interaction);
    const dados = service.carteira(alvo.id);
    const ehCriador = criador.ehCriador(alvo);
    const conquistas = service.listarConquistas(alvo.id);
    const desbloqueadas = conquistas.filter((c) => c.desbloqueada).length;

    const xpAlvo = Math.max(1, (Number(dados.level) + 1) * 1000);
    const xpBarra = theme.barra(dados.xp, xpAlvo, 12, tema);
    const titulo = ehCriador ? criador.TITULO : (dados.tituloPersonalizado || 'Confeiteiro(a) da Mila');
    const destaque = ehCriador ? '👑 Criador da Mila' : titulo;

    const descricao =
      `${theme.linhaUsuario(tema, alvo, ehCriador ? 'criador da Mila' : 'perfil da doceria')}\n\n` +
      `${theme.separador(tema)}\n\n` +
      `**${destaque}**\n\n` +
      `${tema.marcador} Saldo: \`${UI.saldoTexto(dados.acucares, ehCriador)}\` ${theme.MOEDA}\n` +
      `${tema.marcador} Posição: \`#${dados.posicaoDinheiro}\` em açúcares · \`#${dados.posicaoXp}\` em XP\n` +
      `${tema.marcador} Sequência: \`${dados.streak} dia(s)\`\n\n` +
      `${theme.separador(tema)}\n\n` +
      `Nível \`${dados.level}\`  ${xpBarra}  \`${theme.formatarNumero(dados.xp)}/${theme.formatarNumero(xpAlvo)} XP\`\n\n` +
      `${theme.separador(tema)}\n\n` +
      `${tema.marcador} 🧁 Diários: \`${dados.diarios}\`\n` +
      `${tema.marcador} 👩‍🍳 Trabalhos: \`${dados.trabalhos}\`\n` +
      `${tema.marcador} 🛍️ Compras: \`${dados.compras}\`\n` +
      `${tema.marcador} 🏆 Conquistas: \`${desbloqueadas}/${conquistas.length}\`\n\n` +
      `${theme.separador(tema)}\n\n` +
      site.linha() +
      (ehCriador ? '\n\n👑 *Reconhecido pelo Criador da Mila em todos os servidores.*' : '');

    const embed = theme.janela({
      tema,
      titulo: `Perfil de ${alvo.username}`,
      descricao,
      cor: ehCriador ? tema.cor2 : tema.cor,
      thumbnail: alvo.displayAvatarURL?.({ size: 256 }),
      autorNome: `${tema.icone} Mila · Perfil`,
      autorIcone: client?.user?.displayAvatarURL?.({ size: 128 }),
      rodape: ehCriador ? 'Mila Perfil · ∞ açúcares para o criador 👑' : `${tema.rodape} · cada doce conta`,
    });

    await interaction.reply(UI.comMascote(embed));
  },
};
