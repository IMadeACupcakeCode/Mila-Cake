# 🍰 Mila Cake Bot

**Mila Cake** é um bot multifuncional para Discord inspirado na essência de bots famosos (Loritta, Mudae, bots de música e economia), mas com identidade própria e temática de confeitaria, doces, festas e comunidade.

> A Mila é a "anfitriã" do seu servidor: presença amigável, divertida e útil. Ela traz utilidade, personalização, colecionismo, música, economia e sistemas de level — tudo com cara de bolo, cupcake e muita doçura.

---

## 📦 Instalação

1. **Clone ou baixe este repositório**  
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd Mila-Cake
   ```

2. **Instale as dependências**  
   ```bash
   npm install
   ```
   O sistema de música usa `distube`, `@distube/yt-dlp`, `@distube/spotify` e `ffmpeg-static`, todos declarados no `package.json`. Não é preciso instalar yt-dlp nem ffmpeg no sistema operacional: o bot gerencia os binários sozinho.

   Requisitos: **Node.js 22 ou superior** e um bot com as permissões **Ver canais**, **Enviar mensagens**, **Conectar** e **Falar** no canal de voz.

3. **Configure as variáveis de ambiente**  
   Crie um arquivo `.env` na raiz do projeto com:
   ```
   DISCORD_TOKEN=SEU_TOKEN_DO_BOT_AQUI
   CLIENT_ID=SEU_CLIENT_ID_DO_BOT (opcional, usado para gerar link de convite)
   ENABLE_PRIVILEGED_INTENTS=true  # opcional, para cache de membros/presença
   ```

4. **Inicie o bot**  
   ```bash
   npm start
   ```
   Ou, diretamente:
   ```bash
   node index.js
   ```

---

## ☁️ Rodar apenas com `npm start` (local ou nuvem)

O bot foi feito para não precisar de nenhum processo auxiliar aberto ao mesmo tempo:

| Recurso | Como funciona | Passo manual |
| --- | --- | --- |
| yt-dlp (YouTube e SoundCloud) | Na primeira execução reaproveita o binário baixado pelo npm ou baixa do GitHub para `data/bin` | nenhum |
| ffmpeg | Binário estático do pacote `ffmpeg-static` | nenhum |
| Spotify | Busca e metadados via Client Credentials (`SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`) | nenhum |
| Cookies do YouTube | Detectados do navegador local **ou** fornecidos por variável de ambiente | opcional |

Em VPS, container ou painel de hospedagem (sem navegador instalado), configure os cookies uma única vez por variável de ambiente — o bot grava o arquivo e passa a usá-lo sozinho:

```bash
# Linux/macOS: gere a string a partir do cookies.txt exportado
base64 -w0 cookies.txt
```

```env
YTDLP_COOKIES_BASE64=<string gerada acima>
```

Sem cookies o bot continua funcionando; apenas alguns vídeos do YouTube podem exigir login e cair no fallback de SoundCloud/links diretos.

### Cookies do navegador (Brave, Edge, Zen, Chrome, Firefox...)

No Windows não é preciso exportar nada: na primeira execução o bot sonda cada navegador instalado com o próprio `yt-dlp` e escolhe o que realmente entrega cookies utilizáveis **naquele momento**, dando preferência ao que está aberto agora. A leitura é guardada em `data/ytdlp-cookies-navegador.txt` (ignorado pelo Git) e vale por 6 horas, então o navegador pode abrir, fechar ou ser trocado sem derrubar a música.

```bash
npm run cookies   # mostra qual navegador foi escolhido e por que os outros falharam
```

Motivos comuns de descarte, todos tratados automaticamente com troca de navegador:

| Navegador | Situação | Resultado |
| --- | --- | --- |
| Brave / Chrome / Edge / Vivaldi | aberto, banco de cookies travado | descartado, tenta o próximo |
| Edge / Chrome recentes | criptografia app-bound recusa a DPAPI | descartado, tenta o próximo |
| Zen | não é reconhecido pelo yt-dlp | lido como `firefox:<perfil>`, funciona normalmente |
| Firefox | perfil sem `cookies.sqlite` | ignorado |

Para forçar um navegador específico, use `YTDLP_COOKIES_FROM_BROWSER` (ex.: `zen` ou `firefox:C:\caminho\do\perfil`). A ordem de preferência é definida em `YTDLP_BROWSER_ORDER`.

### 🎧 Música: entrar, tocar e sair

| Comando | O que acontece |
| --- | --- |
| `/join` (ou `/entrar`, `$join`, `$entrar`) | A Mila entra no seu canal de voz e toca a saudação, mesmo sem música. Se já estiver no canal, só confirma; se estiver tocando em outro canal, avisa em vez de cortar a fila. |
| `/tocar <nome ou link>` | Se ainda não estiver na call, entra e toca a saudação. Depois entra o som de elevador enquanto o yt-dlp resolve; quando o áudio fica pronto, o elevador sai em fade out e a música começa. |
| `/sair` (ou `/leave`) | Para a fila, toca **"me deixa dormir mita"** e só então desconecta de verdade. |

A saudação é **aguardada**: a música só começa depois que ela termina (ou depois de `SOM_ENTRADA_MAX_MS`). Por isso a primeira faixa pode demorar alguns segundos a mais — é intencional.

### 🔊 Sons de voz

| Som | Quando toca | Padrão |
| --- | --- | --- |
| Saudação de entrada | Toda vez que uma conexão nova é criada (`/join`, `/tocar`, `/playlist`, ...) | Sorteia entre **"um chapéu"** e **"saudações boininha"** |
| Elevador | Enquanto a primeira música é resolvida, com a fila vazia | `elevator_2jN6tnc.mp3`, em loop com fade in/out |
| Despedida | Antes do `/sair` desconectar | **"me deixa dormir mita"** |

Os MP3 são baixados uma única vez para `data/sons/` (ignorado pelo Git) e depois funcionam sem internet. Se o arquivo já existir, o bot não baixa de novo.

Quer trocar os sons? Use `SOM_DESPEDIDA_ARQUIVO` e `SOM_ESPERA_ARQUIVO` para apontar para um MP3 seu. A saudação sorteia entre os dois arquivos de `data/sons/` — substitua-os mantendo os nomes (`saudacao-chapeu.mp3` e `saudacao-boininha.mp3`).

```env
# Saudação de entrada
SOM_ENTRADA_ATIVO=true
SOM_ENTRADA_VOLUME=0.5
SOM_ENTRADA_FADE_IN_MS=250
SOM_ENTRADA_MAX_MS=6000      # a música espera no máximo isso pela saudação

# Despedida do /sair
SOM_DESPEDIDA_ATIVO=true
SOM_DESPEDIDA_VOLUME=0.55
SOM_DESPEDIDA_ARQUIVO=       # opcional: usar um arquivo local
SOM_DESPEDIDA_MAX_MS=20000

# Elevador
SOM_ESPERA_ATIVO=true
SOM_ESPERA_URL=https://www.myinstants.com/media/sounds/elevator_2jN6tnc.mp3
SOM_ESPERA_ARQUIVO=        # opcional: usar um arquivo local em vez de baixar
SOM_ESPERA_VOLUME=0.3
SOM_ESPERA_FADE_IN_MS=900
SOM_ESPERA_FADE_OUT_MS=800
SOM_ESPERA_MAX_MS=120000   # rede de segurança: o elevador nunca toca para sempre
```

### 🗄️ Cache de áudio (o fim do `FFMPEG_EXITED`)

O CDN do YouTube entrega o áudio para o yt-dlp, mas devolve **403** ao ffmpeg do DisTube quando ele tenta abrir o mesmo link. Para contornar isso, o bot:

1. baixa a faixa pelo **yt-dlp** para `data/cache-audio/`;
2. sobe um **servidor HTTP local** em `127.0.0.1` (porta aleatória) com suporte a `Range`/`206`;
3. entrega ao ffmpeg a URL local, que ele consegue ler;
4. pré-baixa a próxima faixa da fila em segundo plano;
5. faz um `HEAD` na URL local antes de usá-la, para nunca mandar ao ffmpeg um arquivo que não está sendo servido.

Transmissões ao vivo continuam usando a URL original (não faz sentido baixar um fluxo infinito). O cache é limpo na primeira faixa de cada execução, por idade e por tamanho total:

```env
AUDIO_CACHE_ATIVO=true
AUDIO_CACHE_DIR=              # padrão: data/cache-audio
AUDIO_CACHE_HORAS=12
AUDIO_CACHE_MB=1024
AUDIO_CACHE_CONCORRENCIA=2
AUDIO_CACHE_TIMEOUT_MS=300000
```

A busca do `/tocar` mostra cada resultado em um card com **capa do vídeo/faixa**, fonte, artista e duração (até 5 por página). O som de espera só entra quando a fila está vazia — se já existe música tocando, o áudio do canal continua com ela.

### 🩺 Diagnóstico de música e sons

No boot, o console deve mostrar:

```
[Música] Cache de áudio local: ATIVO (...\data\cache-audio)
Slash commands registrados (76 na guild ...)
```

Ao entrar na call e tocar, aparecem linhas como:

```
[Música] Saudação de entrada: saudacao-chapeu.mp3
[Música] Tocando saudação: saudacao-chapeu.mp3
[Música] Audio em cache: <arquivo>.webm
```

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| `FFMPEG_EXITED` (código `3199971767`) | Bot rodando código antigo, ou `AUDIO_CACHE_ATIVO=false` | Confira `Cache de áudio local: ATIVO` no boot. Se não aparecer, encerre **todas** as instâncias antigas (Windows: Gerenciador de Tarefas → `node.exe`) e rode `npm start` |
| Entra na call, mas nenhum som toca | Instância antiga com o código anterior | O código novo loga `Saudação de entrada` e `Tocando saudação/despedida`; se não logar, o processo em execução é antigo |
| ffmpeg dos sons: `At least one output file must be specified` | Versão anterior a esta correção (faltava `pipe:1`) | Atualize o código e reinicie o bot |
| `Sign in to confirm you're not a bot` | Cookies do YouTube inválidos ou expirados | Rode `npm run cookies` para ver o navegador escolhido, ou configure `YTDLP_COOKIES_BASE64` / `YTDLP_COOKIES_FILE` |
| A Mila entra, mas ninguém ouve | Permissões de voz | Dê **Conectar** e **Falar** ao bot no canal e confira se ele não está silenciado no próprio Discord |
| O elevador não toca | A fila já tinha música, ou `SOM_ESPERA_ATIVO=false` | Com música tocando é o comportamento esperado (não dá para sobrepor áudio); confira o `.env` |

> **Sempre que atualizar o código, reinicie o bot.** O Node não recarrega arquivos sozinho: uma instância antiga continua com o comportamento antigo mesmo que os arquivos no disco já estejam corrigidos.

**Limites reais da "nuvem"** (nenhum código contorna):
- O Discord exige que o próprio bot receba e transmita o áudio no canal de voz; o processo do bot precisa estar rodando continuamente (em casa ou em um servidor).
- A Web API do Spotify não entrega áudio — só metadados e previews de 30 s. O bot usa o Spotify para buscar e identificar a faixa e reproduz a versão equivalente do YouTube/SoundCloud.
- APIs públicas de terceiros (Piped/Invidious/Cobalt) foram testadas e se mostraram instáveis (instâncias fora do ar ou sem streams de áudio), por isso não são usadas como caminho principal.

### 🎬 MilaTube (Activity de watch party)

O `/assistir <link>` abre uma sala do **MilaTube** dentro do Discord: o vídeo
continua no player oficial do YouTube, mas a moldura é uma janela do **Windows 7**
(Aero), com barra de título, navegação, fila, participantes, play/pause/seek
sincronizados e um “modo livre” opcional.

> **YouTube dentro do Discord:** a CSP do proxy de Activities bloqueia iframes e
> scripts do YouTube. Por isso, dentro do Discord o MilaTube usa um **player
> externo**: a fila, o play/pause, o seek, o relógio e o avanço automático ficam
> na janela, e o vídeo abre no YouTube pelo botão **Abrir no YouTube** (ou pelo
> **Sincronizar**, que reabre no tempo atual). Fora do Discord, o player
> embutido continua funcionando. É o máximo que uma Activity de terceiros pode
> fazer sem proxy de vídeo; o Watch Together oficial é first-party e usa o
> player da própria Discord.

| Comando | O que acontece |
| --- | --- |
| `/assistir <url>` | Valida o link, prepara a sala e abre a Activity na call em que você está |
| `$assistir <url>` | Cria um convite de Activity no canal (útil fora de uma interação slash) |

A experiência foi feita para uma call: entre no canal de voz antes de usar o
comando. O host controla a sala por padrão; o botão **Modo livre** permite que
todos controlem. A fila e o vídeo atual são separados, e a sala usa a mesma
tolerância de sincronização do Watch Together oficial (1,25 s). No player
externo, pequenas diferenças são corrigidas com o botão **Sincronizar**.

> A Activity precisa estar habilitada na **mesma aplicação do bot**. O
> `/assistir` usa `LAUNCH_ACTIVITY`, que abre a Activity da aplicação que recebeu
> a interação; um aplicativo separado só para o frontend não é lançado.

```env
# MilaTube Activity (opcional; sem isso /assistir explica o que falta)
ACTIVITY_API_URL=https://mila-tube-sync.SEU-SUBDOMINIO.workers.dev
ACTIVITY_API_SECRET=O_MESMO_VALOR_DE_BOT_API_SECRET
ACTIVITY_APPLICATION_ID=SEU_APPLICATION_ID
```

O Worker, o Pages, as URL Mappings `/api`, `/ws` e `/` e os segredos estão
detalhados em [`activity/DEPLOY.md`](activity/DEPLOY.md). O frontend fica em
`activity/public/` e não precisa de build.

> **Anúncios:** o MilaTube não bloqueia anúncios. O player oficial do YouTube
> não expõe controle de anúncios, e o Worker não faz proxy nem download de
> vídeo. Use YouTube Premium ou escolha vídeos sem anúncio; a sala apenas
> sincroniza a reprodução. O aviso também aparece dentro da Activity.

---

### 🎵 Mila Music
- `/tocar <nome ou link>` – Toca música no canal de voz  
- `/join` (ou `/entrar`) – Entra no seu canal de voz e toca a saudação, sem precisar de música  
- Resultados da busca com **preview em imagem** (capa do YouTube, SoundCloud ou Spotify)  
- Saudação aleatória ao entrar na call, elevador com fade in/out e despedida no `/sair`  
- `/pausar`, `/retomar`, `/pular`, `/fila` – Controles básicos  
- `/playlist criar <nome>` – Cria playlists salvas (em desenvolvimento)  
- `/dj modo festa` – Ativa efeitos sonoros (aplausos, risadas, "parabéns")  
- `/pedido <música> @amigo` – Dedica uma música a alguém  
- A Mila "canta" junto em algumas músicas (frases engraçadas, respeitando direitos autorais)

### 💰 Mila Economy (Confeitaria Virtual)
- Moeda: **Açúcares** (🍬)  
- `/diario` – Resgata recompensa diária (com bônus por streak)  
- `/trabalhar` – Mini-jogos para ganhar açúcares (ex: "decorar bolo", "vender doces")  
- `/loja` – Compra itens como "Bolo Personalizado", "Confeiteiro VIP", "Emotes exclusivos"  
- `/doar @usuario <quantidade>` – Presenteia outros membros  
- `/ranking` – Mostra os maiores "confeiteiros" do servidor  
- Eventos sazonais como "Festival de Chocolate" ou "Semana do Cupcake" com recompensas limitadas

### 🎮 Mila Games (Mini-games e Colecionismo)
- `/coletar` – Gira uma "roleta de doces" para coletar personagens (ex: "Cupcake", "Donut", "Brownie")  
- `/coleção` – Mostra seus personagens coletados  
- `/batalha @oponente` – Batalha de doces (turn-based, com habilidades temáticas)  
- `/trocar @usuario <personagem>` – Troca personagens com amigos  
- `/evento` – Participa de eventos limitados (ex: "Caça ao Ovo de Páscoa")  
- Personagens com histórias próprias, arte original e evoluções (ex: "Cupcake → Cupcake Supremo")

### 📈 Mila Level (Sistema de XP)
- XP por mensagens, voz e participação em eventos  
- `/perfil` – Mostra nível, XP, badges e título personalizado  
- `/ranking` – Leaderboard do servidor (por nível ou por Açúcares)  
- `/cargos` – Cargos automáticos por nível (ex: "Confeiteiro Iniciante", "Mestre dos Doces")  
- `/badges` – Conquistas especiais (ex: "Primeiro a atingir nível 10", "Participou de 5 eventos")  
- Títulos temáticos como "Rei do Chocolate" ou "Rainha dos Cupcakes"

### 🛠️ Utilidades e Personalização (Inspirado na Loritta)
- `/prefixo` – Altera o prefixo do bot no servidor  
- `/idioma` – Define idioma (PT-BR, EN, ES, etc.)  
- `/convite` – Gera link de convite personalizado  
- `/ajuda` – Mostra comandos com exemplos (menu interativo)  
- `/config` – Painel de configuração do servidor (canais de música, economia, etc.)

---

## 📋 Lista de Comandos Slash

> Todos os comandos também funcionam via prefixo (`$` por padrão, configurável com `/prefixo`).

| Categoria | Comando | Descrição |
|-----------|---------|-----------|
| **Música** | `/tocar` | Toca música no canal de voz |
| | `/assistir` | Abre o MilaTube com um vídeo do YouTube na sua call |
| | `/join` | Entra no seu canal de voz e toca a saudação, sem precisar de música |
| | `/entrar` | Alias de `/join` |
| | `/pausar` | Pausa a música atual |
| | `/retomar` | Retoma a música pausada |
| | `/pular` | Pula para a próxima música |
| | `/fila` | Mostra a fila de músicas |
| | `/playlist criar` | Cria uma playlist salva |
| | `/dj modo festa` | Ativa efeitos sonoros de festa |
| | `/pedido` | Dedica uma música a um usuário |
| | `/sair` | Toca a despedida e sai do canal de voz |
| | `/leave` | Alias de `/sair` |
| **Economia** | `/diario` | Resgata recompensa diária de Açúcares |
| | `/trabalhar` | Mini-jogo para ganhar Açúcares |
| | `/loja` | Abre a loja de itens e títulos |
| | `/doar` | Transfere Açúcares para outro usuário |
| | `/ranking` | Ranking de riqueza (mais Açúcares) |
| **Games** | `/coletar` | Gira a roleta de doces (custa 100 🍬) |
| | `/colecao` | Mostra sua coleção de cartas |
| | `/batalha` | Batalha de doces contra outro usuário |
| | `/trocar` | Troca cartas com outro usuário |
| | `/evento` | Participa de eventos sazonais |
| **Level** | `/perfil` | Mostra seu nível, XP, Açúcares e título |
| | `/ranking` | Leaderboard por nível ou por Açúcares |
| | `/cargos` | Ver cargos automáticos por nível |
| | `/badges` | Ver conquistas e badges obtidas |
| **Utilidades** | `/ajuda` | Painel interativo de ajuda e comandos |
| | `/prefixo` | Altera o prefixo do bot (ex: de `$` para `!`) |
| | `/idioma` | Define idioma do bot (PT-BR/EN) |
| | `/convite` | Gera link de convite para adicionar o bot |
| | `/config` | Painel de configuração de canais e permissões |

---

## 🧁 Toque Final: Originalidade

- **Arte original**: Personagens, emotes e temas visuais únicos da Mila Cake.  
- **História própria**: Um "universo Mila" com lore, eventos e personagens recorrentes.  
- **Comunidade**: Envolvimento dos usuários para sugerir comandos, personagens e eventos.  

### Exemplo de Comando Original
```
/festadoce
```
Inicia uma "festa" no canal de texto:
- Todos ganham +10 🍬.  
- A Mila posta uma mensagem animada com confetes.  
- Um mini-game aleatório é iniciado (ex: "Quem digita mais rápido em 30s").

---

## 🛠️ Manutenção e Atualizações

- O banco de dados SQLite é salvo em `data/mila.db`. Não exclua ou modifique manualmente enquanto o bot estiver em execução.  
- Para atualizar o bot, repuxe as mudanças, rode `npm install` se houver novos pacotes e **reinicie o processo**. Os comandos slash são registrados automaticamente no boot; se precisar forçar, use `npm run deploy:commands`.  
- Antes de subir uma alteração, rode `npm test` (testa o registro dos slash commands, os dados e a deduplicação de mensagens).  
- Os arquivos de configuração por servidor ficam em `data/servidores.json` (com backups automáticos).  
- São ignorados pelo Git e **não devem ser apagados sem backup**: `.env` (contém o token e segredos), `data/mila.db` (economia, níveis e coleções) e `data/servidores.json` (configuração dos servidores).  
- Podem ser apagados com o bot **parado** e são recriados sozinhos: `data/sons/` (baixa de novo), `data/cache-audio/` (baixa de novo) e `data/ytdlp-cookies-navegador.txt` (detecta de novo). Apagar um arquivo que está sendo tocado derruba a reprodução.

---

## 💖 Créditos e Inspirações

- **Loritta**: [GitHub - LorittaBot](https://github.com/LorittaBot/Loritta) – utilidade, personalização e multilíngue.  
- **Mudae**: [Mudae Wiki](https://mudae.wiki) – colecionismo, gacha e mini-games sociais.  
- **Música**: CaptainShepard01/MusicBot – base para reprodução de áudio.  
- **Economia**: discord-bot-eco – sistema de moeda virtual e loja.  
- **Leveling**: Defxult/discordLevelingSystem – base de XP e leveling.  
- **Bot completo**: Logiq – referência de bot multifunção completo.  

---

Feito com 💖 por **Mila Cake** e a comunidade.  
Que seu servidor fique ainda mais doce e divertido!
