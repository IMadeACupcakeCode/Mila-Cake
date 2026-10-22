# Changelog

## 2026-10-21 — Cookies de navegador e login do Discord

- Escolha de cookies do yt-dlp passou a ser **validada na prática**: cada navegador é sondado pelo próprio yt-dlp e o bot fica com o primeiro que entrega cookies utilizáveis, dando prioridade ao que está aberto agora.
- Suporte a **Zen** (lido como `firefox:<perfil>`), Brave, Edge, Chrome, Chromium, Vivaldi, Opera e Firefox.
- Navegador aberto deixou de ser motivo de descarte; se o banco estiver travado, o bot simplesmente usa outro.
- Leitura guardada em snapshot (`data/ytdlp-cookies-navegador.txt`) com validade de 6 h: boot instantâneo e música sem depender do navegador continuar aberto.
- `npm run cookies` para diagnosticar qual navegador foi escolhido e o motivo dos descartes.
- Reprodução do YouTube com `--js-runtimes node` + `--remote-components ejs:github`: sem isso o yt-dlp falhava com "Requested format is not available".
- `/tocar` agora usa o binário correto do yt-dlp e envia os mesmos cookies nas buscas e metadados.
- `DISCORD_TOKEN` inválido (401) encerra o processo com instruções claras, em vez de fingir que o bot continua online.

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
