const { criarEmbed, THEME } = require('./theme');
const { carregarLembretes, removerLembrete } = require('./lembretesStore');

// Limite do setTimeout do Node (~24.8 dias). Usamos um teto seguro de 20 dias
// por "tick" e reagendamos até faltar o tempo real, cobrindo lembretes longos.
const TICK_MAXIMO_MS = 20 * 24 * 60 * 60 * 1000;

function agendarLembrete(client, lembrete) {
  const restante = lembrete.disparaEm - Date.now();

  if (restante <= 0) {
    dispararLembrete(client, lembrete);
    return;
  }

  const espera = Math.min(restante, TICK_MAXIMO_MS);

  setTimeout(() => {
    // Se ainda não chegou a hora (lembrete muito longo), reagenda o próximo pedaço
    if (Date.now() < lembrete.disparaEm) {
      agendarLembrete(client, lembrete);
    } else {
      dispararLembrete(client, lembrete);
    }
  }, espera);
}

async function dispararLembrete(client, lembrete) {
  try {
    const canal = await client.channels.fetch(lembrete.channelId);
    if (canal) {
      const embed = criarEmbed({
        titulo: 'A lua trouxe seu lembrete',
        descricao: `<@${lembrete.userId}>, você pediu pra lembrar:\n\n> "${lembrete.mensagem}"`,
        cor: THEME.corLembrete,
        rodape: THEME.nome,
      });
      await canal.send({ content: `<@${lembrete.userId}>`, embeds: [embed] });
    }
  } catch (erro) {
    console.error(`Não consegui entregar o lembrete ${lembrete.id}:`, erro.message);
  } finally {
    removerLembrete(lembrete.id);
  }
}

// Chamado uma vez ao iniciar o bot: recarrega e reagenda tudo que ficou pendente
function reagendarTodosLembretes(client) {
  const lembretes = carregarLembretes();
  for (const lembrete of lembretes) {
    agendarLembrete(client, lembrete);
  }
  console.log(`${THEME.iconeFooter} ${lembretes.length} lembrete(s) reagendado(s).`);
}

module.exports = { agendarLembrete, reagendarTodosLembretes };
