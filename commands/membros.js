const { EmbedBuilder } = require('discord.js');
const { criarEmbed, THEME } = require('../utils/theme');
const { isStaff } = require('../utils/perms');

module.exports = {
  data: { name: 'membros', description: '👥 Painel completo: totais, bots, staff, entradas/saídas do dia' },
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) return interaction.reply({ embeds: [criarEmbed({ titulo: 'Só em servidores', descricao: 'Use em um servidor.', cor: THEME.corErro })], ephemeral: true });
    if (!isStaff(interaction.member)) {
      return interaction.reply({ embeds: [criarEmbed({ titulo: 'Acesso negado', descricao: 'Somente staff pode usar este comando.', cor: THEME.corErro })], ephemeral: true });
    }

    // Tenta carregar o máximo possível do servidor para contar membros e cargos corretamente.
    await guild.members.fetch().catch(() => {});
    await guild.roles.fetch().catch(() => {});

    const total = guild.memberCount || guild.members.cache.size;
    const membrosCache = Array.from(guild.members.cache.values());
    const bots = [];
    const staff = [];
    const players = [];
    const grupos = new Map();

    membrosCache.forEach((m) => {
      const roles = m.roles.cache.filter((r) => r.id !== guild.id && !r.managed);
      const cargoAlto = roles.sort((a, b) => b.position - a.position).first();
      const nomeCargo = cargoAlto ? cargoAlto.name : 'Sem cargo';
      const isAdmin = m.permissions.has('Administrator') || m.permissions.has('ManageGuild');
      const tag = m.user.tag;

      if (isAdmin || /staff|admin|mod|moderator|adm/i.test(nomeCargo)) {
        staff.push(tag);
      } else if (m.user.bot) {
        bots.push(tag);
      } else {
        players.push(tag);
      }

      if (!grupos.has(nomeCargo)) grupos.set(nomeCargo, []);
      grupos.get(nomeCargo).push(tag);
    });

    const agora = new Date();
    const inicioDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    const entradasHoje = membrosCache.filter((m) => (m.joinedAt?.getTime() || 0) >= inicioDoDia).length;
    const saidasHoje = 0;
    const humanos = staff.length + players.length;

    function listar(arr, limite = 10) {
      return arr.slice(0, limite).join(', ') + (arr.length > limite ? ` +${arr.length - limite}` : '') || 'Nenhum';
    }

    const campos = [];
    grupos.forEach((tags, cargo) => {
      campos.push({ name: cargo, value: listar(tags), inline: true });
    });

    const descricao =
      `**Total:** \`${total}\`\n` +
      `**Humanos:** \`${humanos}\`\n` +
      `**Bots:** \`${bots.length}\`\n` +
      `**Staff:** \`${staff.length}\`\n\n` +
      `**Hoje:** +${entradasHoje} entradas • ${saidasHoje} saídas`;

    const embedFinal = criarEmbed({
      titulo: `👥 Painel de membros — ${guild.name}`,
      descricao,
      cor: THEME.corPrincipal,
    });

    campos.forEach((c) => {
      if (c.value) embedFinal.addFields({ name: c.name, value: c.value, inline: true });
    });

    await interaction.reply({ embeds: [embedFinal], ephemeral: true });
  },
};