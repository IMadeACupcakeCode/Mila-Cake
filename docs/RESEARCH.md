# Pesquisa técnica — Watch Together para Discord

## Escopo e conclusão

A solução viável e compatível com os Termos do Discord é uma Activity web executada em iframe, com reprodução local em cada cliente e um servidor autoritativo coordenando intenções de reprodução. O bot apenas registra/lança a Activity e publica controles; ele não entra no canal de voz para transmitir vídeo, não captura tela do servidor e não baixa nem faz proxy de mídia de plataformas.

O repositório existente é um bot JavaScript com comandos e persistência própria. A nova solução será organizada como monorepo TypeScript com `apps/bot`, `apps/activity`, `apps/server` e `packages/shared`, mantendo a migração incremental e sem misturar a lógica nova com o player de música existente.

## Fontes consultadas

### Referências solicitadas

- [ed-asriyan/watch-together](https://github.com/ed-asriyan/watch-together) — Svelte + Firebase, sala simples, playlist e sincronização baseada em estado compartilhado.
- [amankumarsingh77/watch-together](https://github.com/amankumarsingh77/watch-together) — separação de frontend, API, sinalização, sincronização e SFU; útil como referência de limites operacionais, mas amplo demais para o primeiro corte.
- [ArsalanKaleem/simul-watch-together-app](https://github.com/ArsalanKaleem/simul-watch-together-app) — YouTube sincronizado, chat, reações e compartilhamento de aba com áudio via LiveKit; destaca a necessidade de tokens LiveKit emitidos pelo servidor em produção.
- [seoloon/flick_server](https://github.com/seoloon/flick_server) — servidor Rust em memória, tokens curtos, rate limiting, reconexão, transferência de host, chat e sincronização sem transportar mídia.
- [discord/embedded-app-sdk-examples](https://github.com/discord/embedded-app-sdk-examples) — estrutura oficial para Activity Starter, SDK Playground e Nested Messages.
- [Discord Activities Overview](https://docs.discord.com/developers/activities/overview) — Activity como web app em iframe, SDK incorporado, comandos/eventos e execução em desktop, web e mobile.
- [Discord How Activities Work](https://docs.discord.com/developers/activities/how-activities-work) — ciclo READY, OAuth, autenticação, `postMessage`, erros e ciclo de vida.
- [Discord Building an Activity](https://docs.discord.com/developers/activities/building-an-activity) — URL Mapping, `cloudflared`, `LAUNCH_ACTIVITY`, OAuth2 e troca server-side do código.

### Referências adicionais

- [calzoneman/sync (CyTube)](https://github.com/calzoneman/sync) — modelo maduro de canal com playlist, chat, providers variados e sincronização de mídia.
- [Syncplay](https://syncplay.pl/) e [protocolo Syncplay](https://syncplay.pl/about/protocol/) — referência para play/pause/seek, salas virtuais e correção de pequenas diferenças sem retransmitir conteúdo.
- [Watch2Gether](https://w2g.tv/) — UX de criação de sala sem conta, fila/playlist, chat integrado e providers oficiais.
- [Teleparty](https://www.teleparty.com/) — sincronização em sites de streaming e chat; confirma que serviços DRM precisam ser abertos na conta do participante, sem proxy de vídeo.
- [Discord Embedded App SDK](https://github.com/discord/embedded-app-sdk) — API oficial e exemplo mínimo de `ready`, `authorize`, `/api/token` e `authenticate`.
- [Colyseus Discord Activity](https://github.com/colyseus/discord-activity) — padrão de separar client/server, mapear `/` para a Activity e um prefixo para o servidor realtime.
- [Impeccable](https://github.com/pbakaus/impeccable) — fluxo `init`, `shape`, `critique`, `audit`, `polish`, `animate`, `adapt` e `harden`; detectores de padrões visuais genéricos e recomendações de acessibilidade/performance.

## Padrões extraídos

### Sincronização

1. O servidor deve ser a fonte de verdade, não o relógio ou evento local de um cliente.
2. Cada mutação precisa de versão monotônica e validação de versão recebida; comandos antigos devem ser rejeitados com snapshot atual.
3. Estado de reprodução deve ser representado como uma âncora (`anchorPosition`, `anchorServerTime`, `rate`, `status`) em vez de enviar posição continuamente.
4. O cliente calcula a posição projetada e só informa intenções. Eventos causados por aplicação de snapshot precisam ser marcados como sistêmicos para evitar eco.
5. Pequeno drift deve ser corrigido suavemente com taxa; drift grande deve usar seek. Esse padrão aparece explicitamente no Syncplay/Flick.
6. Reconexão deve entregar snapshot completo e conservar identidade por uma janela curta; entrada tardia deve alinhar sem exigir contagem manual.
7. Latência e relógio precisam de medição própria. Será usado NTP simplificado com várias amostras, seleção das de menor RTT e mediana do offset.

### Estrutura de sala

- Sala em memória é suficiente para a primeira implantação e facilita expiração de salas vazias.
- Redis deve ser adaptador opcional para presença/pub-sub em múltiplas instâncias, sem tornar Redis obrigatório no desenvolvimento.
- Sala deve registrar membros, host, controle, fila, histórico, mensagens de chat e auditoria mínima.
- Host deve poder ser transferido quando desconecta; permissões devem ser verificadas no servidor.
- Tokens de sessão devem ser curtos e validados em cada conexão Socket.IO.

### UX da fila e controles

- Colar URL deve resolver e mostrar preview antes de adicionar.
- Fila precisa de ordenação explícita, quem adicionou, duração, provider, ações de remover/embaralhar e estado vazio.
- Votação para pular reduz conflitos em salas com controle coletivo; host/DJ podem executar diretamente.
- Chat e reações são complementares ao vídeo e devem recuar visualmente quando a reprodução está em foco.
- Erros de provider precisam explicar a causa e oferecer trocar a fonte, abrir externamente ou usar Sync Timer.

### Providers

- `PlayerProvider` deve normalizar `load`, `play`, `pause`, `seek`, `setRate`, `getCurrentTime`, `getState` e eventos.
- YouTube deve usar exclusivamente IFrame Player API; Vimeo, Twitch e Dailymotion devem usar seus SDKs/embeds oficiais.
- Arquivos diretos podem usar `<video>`; HLS e DASH usam `hls.js`/`dash.js` somente para URLs diretas fornecidas pelo usuário e permitidas por CORS/CSP.
- Netflix, Prime e outros DRM não podem ser reproduzidos dentro do player da Activity de forma legítima. O fallback é Sync Timer: sincroniza ações e relógio, enquanto cada participante abre o serviço na própria conta.
- Compartilhamento de tela é opcional, iniciado pelo próprio usuário com `getDisplayMedia`; LiveKit deve receber tokens do servidor e nunca expor API secret no cliente.

### Discord Activity

- A Activity é um iframe e precisa concluir `ready`, `authorize`, troca do código em `/api/token` e `authenticate`.
- O client ID pode estar no frontend; client secret e tokens de troca ficam apenas no servidor.
- `cloudflared` fornece URL pública durante o desenvolvimento; cada URL efêmera exige atualizar o URL Mapping.
- O Developer Portal precisa ter Activities habilitado, URL Mapping raiz para a Activity e redirect OAuth placeholder/adequado.
- O proxy do Discord e CSP tornam obrigatória a documentação dos domínios externos usados por iframes, imagens e SDKs. Providers podem exigir URL mappings específicos e políticas de referrer.

## Comparação

| Projeto | Pontos fortes | O que será adaptado | Limitações para este produto |
| --- | --- | --- | --- |
| Movie Together | Simplicidade de sala e playlist | Estado explícito e Activity | Firebase aberto não serve como autorização por socket |
| Go Watch Together | Separação por serviços e WebRTC | Interfaces de servidor e observabilidade | Complexidade excessiva para o MVP |
| SIMUL | UX social, reações e LiveKit | Compartilhamento opcional e tokens server-side | Flutter não atende o stack obrigatório |
| Flick Server | Estado em memória, tokens e reconexão | Expiração, host handoff e auditoria | Focado em Jellyfin/Plex, não em embeds de Activity |
| CyTube | Playlist, chat e múltiplos providers | Resolver/provider registry | Arquitetura histórica e não específica para Discord |
| Syncplay | Correção de drift e sem transporte de mídia | Algoritmo de âncora, rate e seek | Cliente nativo, sem iframe/SDK Discord |
| Watch2Gether | Fluxo de sala e descoberta | Preview, fila e fallback | Produto proprietário; não usar scraping ou APIs não oficiais |
| Teleparty | Modelo para serviços DRM | Sync Timer e abertura externa | Extensão de navegador não pode ser copiada para iframe |
| Discord SDK/Colyseus | Lifecycle, auth e deployment | Activity + realtime separado | Exemplos não resolvem player ou permissões de watch party |

## Decisões para a implementação

1. **Socket.IO** com reconexão/backoff para realtime; mensagens de entrada e saída sempre passam por schemas Zod compartilhados.
2. **Estado em memória** no servidor, com interface para Redis adapter posterior.
3. **Vitest** para máquina de estados, NTP, drift, permissões e cenários de latência; **Playwright** para clientes simulados da Activity.
4. **React + Vite** na Activity, carregando providers pesados sob demanda.
5. **Bot discord.js v14** com slash commands e resposta `LAUNCH_ACTIVITY` quando suportado; o bot não toca vídeo.
6. **Fastify ou Express** no servidor HTTP, com pino, health check, métricas básicas, rate limiting e endpoint de OAuth token.
7. **SSRF protection** para resolver genérico: apenas HTTPS/HTTP, bloqueio de loopback/privados/reservados, timeout, limite de resposta, allowlist de hosts e nenhum download de mídia.
8. **UI em português do Brasil**, preparada para i18n, com OKLCH, contraste AA, foco visível, skeletons e suporte a mobile/desktop.
9. **Impeccable** será aplicado depois da base funcional: init/context, shape, critique, audit, polish, animate, adapt e harden, registrando os resultados nos artefatos compartilhados do projeto.

## Limitações conhecidas

- A Activity não pode contornar DRM, restrições regionais, bloqueios de embed ou autoplay. O produto deve mostrar estado recuperável e oferecer Sync Timer/abrir externamente.
- A reprodução simultânea perfeita não significa mesmo frame em redes adversas; o objetivo mensurável será convergência dentro dos limites definidos, com relatório de desvio máximo por cenário.
- URL Mappings e CSP são configuração do Developer Portal e não podem ser garantidos apenas pelo código.
- LiveKit exige infraestrutura e credenciais próprias; será entregue como módulo opcional desativado por padrão.
- O código atual do repositório contém dependências de `yt-dlp`/`ytdl-core` para o bot de música existente. Elas não serão usadas na Activity; a remoção global dessas dependências exigirá decisão separada porque pode quebrar funcionalidades legadas.
