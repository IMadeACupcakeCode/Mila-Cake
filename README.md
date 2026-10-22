# 🍰 Mila Cake Bot

**Mila Cake** é um bot multifunível para Discord inspirado na essência de bots famosos (Loritta, Mudae, bots de música e economia), mas com identidade própria e temática de confeitaria, doces, festas e comunidade.

> A Mila é a "anfitriã" do seu servidor: presença amigável, divertida e útil. Ela traz utilidade, personalização, colecionismo, música, economia e sistemas de level — tudo com cara de bolo, cupcake e muita doçura.

---

## 📦 Instalação

1. **Clone ou baixe este repositório**  
   ```bash
   git clone <URL_DO_REPOSITORIO>
   cd Mila Cake
   ```

2. **Instale as dependências**  
   ```bash
   npm install
   ```
   O sistema de música usa `distube`, `@distube/yt-dlp`, `@distube/spotify` e `ffmpeg-static`, todos declarados no `package.json`. Não é preciso instalar yt-dlp nem ffmpeg no sistema operacional: o bot gerencia os binários sozinho.

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

**Limites reais da "nuvem"** (nenhum código contorna):
- O Discord exige que o próprio bot receba e transmita o áudio no canal de voz; o processo do bot precisa estar rodando continuamente (em casa ou em um servidor).
- A Web API do Spotify não entrega áudio — só metadados e previews de 30 s. O bot usa o Spotify para buscar e identificar a faixa e reproduz a versão equivalente do YouTube/SoundCloud.
- APIs públicas de terceiros (Piped/Invidious/Cobalt) foram testadas e se mostraram instáveis (instâncias fora do ar ou sem streams de áudio), por isso não são usadas como caminho principal.

---

### 🎵 Mila Music
- `/tocar <nome ou link>` – Toca música no canal de voz  
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
| | `/pausar` | Pausa a música atual |
| | `/retomar` | Retoma a música pausada |
| | `/pular` | Pula para a próxima música |
| | `/fila` | Mostra a fila de músicas |
| | `/playlist criar` | Cria uma playlist salva |
| | `/dj modo festa` | Ativa efeitos sonoros de festa |
| | `/pedido` | Dedica uma música a um usuário |
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
- Para atualizar o bot, simplesmente repuxe as mudanças e reinstale as dependências se houver novos pacotes.  
- Os arquivos de configuração por servidor ficam em `data/servidores.json` (com backups automáticos).  

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
