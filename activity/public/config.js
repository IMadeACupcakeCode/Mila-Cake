/*
 * MilaTube — configuração pública da Activity.
 *
 * Só há UM valor para editar aqui: CLIENT_ID.
 * Ele é o mesmo CLIENT_ID do bot (Developer Portal > General Information).
 * Nenhum segredo pode ficar neste arquivo: ele é servido ao navegador.
 *
 * API_BASE vazio significa "mesma origem". A Activity roda atrás do proxy
 * do Discord e as URL Mappings encaminham /api e /ws para o Worker.
 * Trocar de URL no Developer Portal não é necessário depois da configuração
 * inicial das rotas.
 */
window.MILA_CONFIG = {
  // ID da aplicação que tem a Activity habilitada. É a mesma aplicação do bot.
  CLIENT_ID: '1495499255497097297',

  // Deixe vazio em produção: /api e /ws são mapeados pelo proxy do Discord.
  // Para testar o Worker localmente, use algo como 'http://127.0.0.1:8787'.
  API_BASE: '',

  // Cartucho usado no modo demonstração (quando a página é aberta fora do Discord).
  DEMO_VIDEO_ID: 'aqz-KE-bpKQ',
  DEMO_TITLE: 'Big Buck Bunny',
  DEMO_QUEUE: [
    { videoId: 'aqz-KE-bpKQ', title: 'Big Buck Bunny', duration: 634 },
    { videoId: 'jNQXAC9IVRw', title: 'Me at the zoo', duration: 19 }
  ],

  // A mesma tolerância usada pelo Watch Together oficial: pequenas diferenças
  // são normais; acima disso, a Mila corrige o relógio.
  SYNC_TOLERANCE: 1.25,
  MAX_QUEUE: 30,

  // Texto exibido na interface. Não é uma promessa de bloqueio de anúncios.
  ADS_NOTE: 'Os anúncios são inseridos pelo player oficial do YouTube e continuam sob controle do YouTube. Esta Activity não os bloqueia, não faz proxy de vídeo e não baixa mídia. No Discord, o vídeo abre no navegador/app do YouTube porque a CSP da Activity bloqueia iframes externos.'
};
