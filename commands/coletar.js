const db = require('../utils/db');
const loja = require('../utils/economyLoja');
const service = require('../utils/economyService');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const criador = require('../utils/criador');

const PRECO = 100;

const CORES_RARIDADE = {
  Comum: 0x95A5A6,
  Incomum: 0x3498DB,
  Especial: 0x9B59B6,
  Raro: 0xF1C40F,
};

module.exports = {
  data: {
    name: 'coletar',
    description: `🎰 Gire a roleta da confeitaria e tente uma carta rara (custa ${PRECO} 🍬)`,
  },
  async execute(interaction, client) {
    const tema = theme.temaDe(interaction);
    const usuario = db.getUsuario(interaction.user.id);
    const ehCriador = criador.ehCriador(interaction.user);
    const saldo = ehCriador ? criador.PONTOS_INFINITOS : Number(usuario.acucares) || 0;

    if (!ehCriador && saldo < PRECO) {
      return interaction.reply({
        embeds: [
          theme.janelaAviso(
            tema,
            'Roleta sem ficha',
            `A ficha custa \`${PRECO}\` ${theme.MOEDA}, mas você tem \`${theme.formatarNumero(saldo)}\`.\n\n` +
              `Use \`/diario\` ou \`/trabalhar\` para juntar mais açúcares.`,
            { rodape: 'Mila Roleta' }
          ),
        ],
        ephemeral: true,
      });
    }

    if (!ehCriador) {
      db.addAcucares(interaction.user.id, -PRECO);
      db.incrementarEstatistica(interaction.user.id, 'gasto', PRECO);
      db.registrarTransacao(interaction.user.id, 'coleta', -PRECO, 'Girada na roleta');
    }
    db.incrementarEstatistica(interaction.user.id, 'coleta', 1);

    const carta = loja.sortearCarta(false);
    db.addInventario(interaction.user.id, carta.nome, 1);
    const conquistas = service.concederConquistas(interaction.user.id);

    const cor = CORES_RARIDADE[carta.raridade] || tema.cor;
    const saldoFinal = ehCriador ? criador.PONTOS_INFINITOS : db.getUsuario(interaction.user.id).acucares;

    const descricao =
      `${theme.linhaUsuario(tema, interaction.user, 'roleta girada')}\n\n` +
      `${theme.separador(tema)}\n\n` +
      `**${carta.nome}**\n\n` +
      `${tema.marcador} Raridade: \`${carta.raridade}\`\n` +
      `${tema.marcador} Custo: \`${PRECO}\` ${theme.MOEDA}\n` +
      `${tema.marcador} Saldo: \`${UI.saldoTexto(saldoFinal, ehCriador)}\` ${theme.MOEDA}\n\n` +
      `${theme.separador(tema)}\n\n` +
      `*A carta foi guardada na sua mochila. Veja com \`/colecao\`.*` +
      (conquistas.length
        ? `\n\n🏆 **Conquistas:** ${conquistas.map((c) => `${c.emoji} ${c.nome}`).join(' · ')}`
        : '');

    const embed = theme.janela({
      tema,
      titulo: 'Roleta da Confeitaria',
      descricao,
      cor,
      thumbnail: interaction.user.displayAvatarURL?.({ size: 128 }),
      autorNome: `${tema.icone} Mila · Roleta`,
      autorIcone: client?.user?.displayAvatarURL?.({ size: 128 }),
      rodape: `${tema.rodape} · boa sorte`,
    });

    await interaction.reply(UI.comMascote(embed));
  },
};
