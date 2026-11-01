const db = require('../utils/db');
const UI = require('../utils/economyUI');
const theme = require('../utils/economyTheme');
const criador = require('../utils/criador');

module.exports = {
  meta: { staff: true },
  data: {
    name: 'retiraracucares',
    description: '🛠️ (Admin) Remove Açúcares de um usuário',
    options: [
      { name: 'usuario', description: 'Usuário', type: 6, required: true },
      { name: 'quantidade', description: 'Quantidade a remover', type: 4, required: true, min_value: 1 },
    ],
  },
  async execute(interaction) {
    const tema = theme.temaDe(interaction);
    const alvo = interaction.options.getUser('usuario');
    const qtd = Number(interaction.options.getInteger('quantidade'));
    if (!alvo) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Admin', 'Usuário inválido.')], ephemeral: true });
    if (alvo.bot) return interaction.reply({ embeds: [theme.janelaAviso(tema, 'Admin', 'Bots não têm Açúcares.')], ephemeral: true });

    db.addAcucares(alvo.id, -qtd);
    try { db.registrarTransacao(alvo.id, 'admin_remove', -qtd, `Removido por ${interaction.user.tag}`); } catch {}
    const saldo = criador.ehCriador(alvo.id) ? criador.PONTOS_INFINITOS : db.getUsuario(alvo.id).acucares;

    const embed = theme.janela({
      tema,
      titulo: '🛠️ Açúcares removidos',
      descricao: `${qtd} Açúcares removidos de ${alvo}.`,
      cor: tema.cor2,
      campos: [
        { name: 'Usuário', value: `${alvo}`, inline: true },
        { name: 'Removido', value: `${qtd}`, inline: true },
        { name: 'Saldo atual', value: `\`${UI.saldoTexto(saldo, criador.ehCriador(alvo.id))}\``, inline: true },
      ],
      rodape: `${tema.rodape} • Admin`,
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
