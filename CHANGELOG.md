# Changelog

## 2026-10-22 — MilaTube: Activity de watch party com player oficial

- Adicionado `/assistir <url>` (e `$assistir`) para abrir uma sala do **MilaTube** na call, com fila, participantes, play/pause/seek sincronizados e modo livre opcional.
- Criado o frontend estático `activity/public/` com estética de cartucho MiSide + YouTube de 2008, player oficial do YouTube, modo demonstração e acessibilidade (teclado, diálogo de ajuda, redução de movimento).
- Criado o Worker `activity/worker/worker.js` com troca de OAuth, salas por canal, tickets de WebSocket, oEmbed e Durable Object SQLite (`MilaRoom`).
- Mapeamento relativo `/api` e `/ws` pelo proxy do Discord, sem CORS nem URL externa fixa no navegador.
- O bot prepara a sala no canal do comando e no canal de voz para cobrir o contexto de lançamento da Activity.
- Adicionado `activity/DEPLOY.md` com Worker, Pages, URL Mappings, segredos, OAuth e diagnóstico.
- **Anúncios:** a Activity não bloqueia anúncios e não faz proxy/download de vídeo; o player continua sendo o iframe oficial do YouTube. O limite está documentado na interface e no README.
- Comandos slash agora são **76**; `npm test` inclui os testes de URL do YouTube.
- Música, `/join`, saudações e efeitos de voz continuam independentes da Activity.

## 2026-10-22 — Remoção do compartilhamento de tela e do Watch Together

- Removidos os comandos `/tela` e `/stream` (e as entradas `$tela`/`$stream` do prefixo), junto com `utils/milaStream.js` e `utils/streamSources.js`.
- Removido `docs/RESEARCH.md`, a pesquisa de Watch Together/YouTube Together e Discord Activities.
- A Mila não pede mais a permissão **Stream** no convite, não tenta aplicá-la nos canais de voz e não anuncia mais compartilhamento de tela/relé de voz nas boas-vindas.
- Removido o listener `voiceStateUpdate` que existia apenas para encerrar streams órfãos.

## 2026-10-21 — Cookies de navegador e login do Discord

- Escolha de cookies do yt-dlp passou a ser **validada na prática**: cada navegador é sondado pelo próprio yt-dlp e o bot fica com o primeiro que entrega cookies utilizáveis, dando prioridade ao que está aberto agora.
- Suporte a **Zen** (lido como `firefox:<perfil>`), Brave, Edge, Chrome, Chromium, Vivaldi, Opera e Firefox.
- Navegador aberto deixou de ser motivo de descarte; se o banco estiver travado, o bot simplesmente usa outro.
- Leitura guardada em snapshot (`data/ytdlp-cookies-navegador.txt`) com validade de 6 h: boot instantâneo e música sem depender do navegador continuar aberto.
- `npm run cookies` para diagnosticar qual navegador foi escolhido e o motivo dos descartes.
- Reprodução do YouTube com `--js-runtimes node` + `--remote-components ejs:github`: sem isso o yt-dlp falhava com "Requested format is not available".
- Corrigido o repasse desses flags: a versão 2.x do `@distube/yt-dlp` ignora `ytdlpOptions`, então `utils/ytdlpPlugin.js` assumiu as chamadas de resolução e de URL de stream, mantendo cookies e argumentos corretos em todas elas.
- `/tocar` agora usa o binário correto do yt-dlp e envia os mesmos cookies nas buscas e metadados.
- Som de espera ("elevator waiting") com fade in ao entrar na call e fade out antes de a música começar; o MP3 fica em cache em `data/sons` e nunca toca por cima de uma fila ativa.
- Busca do `/tocar` passou a exibir **previews em imagem**: um card por resultado com capa, fonte, artista e duração (até 5 por página).
- `DISCORD_TOKEN` inválido (401) encerra o processo com instruções claras, em vez de fingir que o bot continua online.
- Corrigido o `FFMPEG_EXITED` (código 3199971767/403): o CDN do YouTube aceita o link para o yt-dlp mas devolve **403** ao ffmpeg do DisTube. O áudio agora é baixado pelo yt-dlp para `data/cache-audio` e servido por um HTTP local com suporte a Range (`utils/audioCache.js`); a próxima faixa é pré-baixada em segundo plano.
- Saudação aleatória ao entrar em qualquer call ("um chapéu" ou "saudações boininha"), tocada antes do elevador.
- `/sair` (e o alias `/leave`) agora toca **"me deixa dormir mita"** antes de desconectar de verdade; a resposta da interação é deferida para o áudio não estourar o prazo de 3 s.
- Novas variáveis: `SOM_ENTRADA_*`, `SOM_DESPEDIDA_*` e `AUDIO_CACHE_*`, documentadas no `.env.example` e no README.
- Novo `/join` (e `/entrar`): a Mila entra no canal de voz sem precisar de música e já toca a saudação; se houver fila tocando em outro canal, avisa em vez de cortar a música.
- Servidor do cache passou a validar a URL local com `HEAD` antes de entregá-la ao ffmpeg, e o boot imprime `[Música] Cache de áudio local: ATIVO (...)` para deixar claro qual código está rodando.
- Logs `[Música] Saudação de entrada: ...` e `[Música] Tocando saudação/despedida: ...` para confirmar os áudios no console.
- Corrigido o ffmpeg dos sons de voz: faltava o destino de saída (`pipe:1`), então ele saía com "At least one output file must be specified" e saudação/elevador/despedida ficavam mudos.

## 2026-10-03 — Comandos slash

- Ativado o registro e roteamento de comandos slash.
- Adicionada validação offline de 33 comandos.
- Completados schemas de opções para comandos com argumentos e subcomandos.
- Mantida compatibilidade com prefixo `$` e componentes interativos.
- Documentado o estado atual em `docs/STATUS-COMANDOS.md`.
- Adicionado `npm test` com smoke tests offline para descoberta, payloads, autocomplete e respostas seguras.
- Validação recursiva de opções adicionada ao registry slash.
- Adicionado preflight opt-in para guilda e permissões com testes offline de acesso.
- Criado simulador local em tempo real com painel HTTP, SSE e execução segura de fixtures.
