// utils/economyManager.js
// ── Botões do painel de Economia ──────────────────────────────────────
// Os customIds começam com "eco:" para não colidirem com tickets, música
// ou forca. Qualquer botão novo da economia deve ser adicionado aqui.

const service = require('./economyService');
const UI = require('./economyUI');
const theme = require('./economyTheme');
const trabalhar = require('./economyTrabalho');
const { isStaff } = require('./perms');
const { obterConfig, salvarConfig } = require('./servidorStore');
const { obterTema } = require('./economyThemeData');

async function tratarComponenteEconomia(interaction, client) {
  if (!interaction.isButton()) return false;
  const id = interaction.customId || '';
  if (!id.startsWith('eco:')) return false;

  const [, acao, valor] = id.split(':');
  const tema = theme.temaDe(interaction);
  const membro = interaction.member?.user || interaction.user;

  try {
    switch (acao) {
      case 'diario': {
        const resultado = service.resgatarDiario(membro.id);
        const status = service.statusDiario(membro.id);
        const embed = UI.embedDiario({ tema, client, membro, resultado, status });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
      }

      case 'carteira': {
        const dados = service.carteira(membro.id);
        const embed = UI.embedCarteira({ tema, client, membro, dados });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
      }

      case 'loja': {
        const dados = service.carteira(membro.id);
        const embed = UI.embedLoja({
          tema,
          client,
          membro,
          categorias: service.loja.listarPorCategoria(),
          saldo: dados.acucares,
          ehCriador: dados.ehCriador,
        });
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return true;
      }

      case 'trabalhar': {
        await trabalhar.iniciar(interaction, client);
        return true;
      }

      case 'tema': {
        if (!isStaff(interaction.member)) {
          await interaction.reply({
            embeds: [
              theme.janelaAviso(tema, 'Sem permissão', 'Apenas a equipe pode trocar o tema do servidor.', {
                rodape: 'Mila OS · tema',
              }),
            ],
            ephemeral: true,
          });
          return true;
        }
        const novo = obterTema(valor);
        const cfg = obterConfig(interaction.guildId);
        cfg.temaEconomia = novo.id;
        salvarConfig(interaction.guildId, cfg);
        await interaction.update({
          embeds: [
            UI.embedTemas({
              tema: novo,
              client,
              atual: novo,
              temas: theme.listarTemas(),
            }),
          ],
          components: [UI.botoesTema(theme.listarTemas(), novo)],
        });
        return true;
      }

      default:
        return false;
    }
  } catch (erro) {
    console.error('Erro no componente de economia:', erro?.message || erro);
    if (!interaction.replied && !interaction.deferred) {
      await interaction
        .reply({ content: '❌ A Mila tropeçou no balcão. Tente novamente.', ephemeral: true })
        .catch(() => {});
    }
    return true;
  }
}

module.exports = { tratarComponenteEconomia };
