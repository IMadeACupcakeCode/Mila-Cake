# ⋆｡°✩ Mila Bot

Sua assistente virtual favorita para Discord — feita com carinho e obsessão pra você~ ♡

> ⚠️ **Comandos podem usar o prefixo `$` ou o slash `/`.** A maioria dos comandos funciona nos dois modos.
>
> 💡 Use `$codex` para ver todos os comandos disponíveis!

---

## 🎫 Sistema de Tickets (Mila Tickets)

O bot gerencia tickets de forma automática com **3 categorias**:

| Categoria | Emoji | Descrição |
|-----------|-------|-----------|
| **Denúncias** | ⚠️ | Reportar membros ou situações |
| **Parcerias** | 🤝 | Propostas de parceria |
| **Outro** | ❓ | Qualquer outro motivo |

### Como funciona

1. Usuário clica em uma categoria no painel de tickets
2. Um **canal privado** é criado automaticamente na categoria correspondente
3. Staff e usuário recebem permissão de acesso ao canal
4. Quando fechado (`🔒 Fechar Ticket` ou `$fechar`):
   - **📄 Transcript completo** da conversa é gerado e salvo
   - Embed de fechamento é enviado com o transcript anexado
   - Permissão do usuário é removida
   - Canal é deletado após 10 segundos

### Configuração

Use o comando `/ticket` ou `$ticket` para configurar:

```bash
$ticket                    # Envia o painel de tickets
$ticket config #categoria  # Define a categoria padrão
$ticket categoria denuncias #categoria  # Categoria específica
$ticket staff add @cargo   # Adiciona cargo à staff
$ticket ver                # Ver configuração atual
```

---

## 🔌 Aviso de Desligamento / Online

Configure um canal para receber avisos quando eu ficar online/offline:

```bash
$configurar off-on #canal
```

Aviso de shutdown separado:
```bash
$configurar shutdown #canal
```

---

## 📺 Sala de Tela (compartilhar tela)

A Mila traz junto um sistema de **compartilhamento de tela de verdade** (não é
relé): quem está na mesma call vê a tela do outro, sem sair do Discord. É o app
`discord-screen/` que vive junto deste projeto.

### Como funciona

1. Entre num **canal de voz**.
2. Clique no **foguete 🚀** na barra de baixo e abra a atividade **Sala de Tela**.
3. Quem quiser mostrar a tela clica em **Compartilhar tela** — todo mundo na
   call assiste. (Use **Chrome, Edge, Brave, Opera ou Vivaldi** num **desktop**;
   celular não captura tela.)

Fora do Discord, o link público também funciona como site normal, com salas que
você cria e compartilha por link.

### Configurar (uma vez só)

| Comando | Para quê |
|---|---|
| `$tela` | Mostra o endereço público, o passo a passo e o estado da configuração |
| `cd discord-screen && npm run start:fast` | Sobe o servidor + túnel e grava o endereço sozinho |
| `cd discord-screen && npm run tunel:criar` | Cria um endereço fixo que nunca mais muda (precisa de domínio na Cloudflare) |

Quando o endereço mudar, troque o **Target** no portal do Discord em
**Activities → URL Mappings**.

> 🔍 **Dica:** rode `$tela` e use o botão **🔄 Atualizar**. Ele mostra se o
> servidor está no ar e se o endereço público **não responde mais** (túnel
> descartável caiu) — o caso que vira "Credenciais Falhas" / "Redirect_uri
> Invalid" na atividade. Aí é rodar `npm run start:fast` de novo e trocar o
> Target/Redirect no portal.

### Quando a Mila entra num servidor novo

Assim que a Mila é adicionada a um servidor, ela já chega ajudando:

- 📩 Manda uma **mensagem de boas-vindas** no canal de boas-vindas nativo do
  servidor (ou no primeiro canal de texto onde ela puder falar), com os
  principais comandos.
- 🖥️ Garante a **permissão de compartilhar tela** (Transmitir + Conectar +
  Falar) para ela mesma em **todos os canais de voz** existentes — assim o
  compartilhamento de tela funciona de cara.

> ⚠️ Para a Mila **aplicar** a permissão de tela nos canais de voz, ela precisa
> da permissão **Gerenciar Canais** no servidor. Se o convite foi feito sem ela,
> basta dar `Manage Channels` (Gerenciar Canais) à Mila — ou convidá-la com a
> permissão marcada. Sem isso, os canais de voz ficam do jeito que já estavam.

---

## 🎲 Comandos Disponíveis

### 🎲 Diversão
| Comando | Descrição |
|---------|-----------|
| `$moeda` | Cara ou coroa, com botão para jogar de novo |
| `$dado 2d6+3` | Rola dados no formato NdM |
| `$8ball eu sou bonito?` | A bola mágica responde~ ♡ |
| `$ship @user1 @user2` | Compatibilidade amorosa |
| `$roleta pizza, sushi` | Sorteia uma opção |
| `$roleta_russa` | Roleta russa de 6 câmaras |
| `$guerra @user` | Batalha de cartas com memes |
| `$forca` | Jogo da Forca (solo/competitivo/cooperativo) |

### 💞 Social
| Comando | Descrição |
|---------|-----------|
| `$abraço @alguem` | Envia um abraço carinhoso |
| `$cartasecreta @user msg` | Carta secreta via DM |
| `$social [@user]` | Cartão de perfil |
| `$avatar [@user]` | Avatar em tamanho grande |

### 🛠️ Utilidades
| Comando | Descrição |
|---------|-----------|
| `$votar pergunta? | a, b, c | 10m` | Enquete com botões |
| `$lembrete 30m fazer café` | Cria um lembrete |
| `$status` | Status da Mila Bot |
| `$ping` | Teste de latência |
| `$sobre` | Informações sobre a Mila Bot |
| `$stream` | 📺 Relé de voz: retransmite o áudio da chamada |
| `$tela` | 📺 Sala de Tela: link e passo a passo do compartilhamento de tela |

### 📚 Organização
| Comando | Descrição |
|---------|-----------|
| `$codex [nome]` | Arquivos Mila — lista completa de comandos |
| `$configurar` | Configura canais, anúncios e tickets |
| `$organizar` | Painel de organização do servidor |

### 🛡️ Admin (Staff)
| Comando | Descrição |
|---------|-----------|
| `$securitybreach` | 🛡️ Mila Shield — segurança em tempo real |
| `$ticket` | 🎫 Mila Tickets — sistema de tickets |
| `$fechar` | 🔒 Fecha o ticket atual |
| `$anuncio tipo mensagem` | 📡 Mila Broadcast |
| `$aviso mensagem` | 📢 Aviso em destaque |
| `$limpar 10` | 🧹 Apaga mensagens em massa |
| `$lentidao 5` | 🐢 Define slowmode |

---

## 📖 Arquivos Mila (`$codex`)

- 📄 Cada comando é uma página
- ⏮️ ◀️ ▶️ ⏭️ Botões para folhear
- ⤵️ Menu de seleção para pular para um comando
- 🔎 Busca aproximada: `$codex roleta`

---

## 🛠️ Passo a passo (instalação)

### 1. Criar a aplicação do bot no Discord
1. Acesse https://discord.com/developers/applications
2. Clique em **New Application** → dê o nome `⋆｡°✩ Mila Bot`
3. Vá em **Bot** → **Reset Token** → copie o token
4. Em **Bot**, ative a opção **Message Content Intent**
5. Vá em **OAuth2 → URL Generator**:
   - Scopes: `bot`
   - Bot Permissions: `Send Messages`, `Embed Links`, `Mention Everyone`, `Manage Server`, `Manage Channels`
   - Copie o link e abra no navegador para convidar o bot
   - **Dica Sala de Tela:** `Manage Channels` já está aí — é o que permite à Mila
     dar a permissão de compartilhar tela nos canais de voz automaticamente.

### 2. Instalar dependências
```bash
npm install
```

### 3. Configurar variáveis de ambiente
Edite o arquivo `.env` e preencha:

```env
DISCORD_TOKEN=seu_token_aqui
CLIENT_ID=seu_client_id_aqui
GUILD_ID=id_do_servidor
```

### 4. Rodar o bot
```bash
npm start
```

---

## ✨ Personalização

Todas as cores, ícones e frases ficam centralizados em `utils/theme.js`. Para ajustar o visual, edite apenas esse arquivo.

---

## 📁 Estrutura do projeto

```
Mila Cake/
├── commands/               # Comandos (prefixo $ + slash)
│   ├── ticket.js           # /ticket (slash)
│   ├── configurar.js       # /configurar (slash)
│   └── ...
├── utils/
│   ├── theme.js            # Cores e embeds padronizados (hot pink!)
│   ├── servidorStore.js    # Configurações do servidor
│   ├── ticketStore.js      # Configurações de tickets
│   ├── ticketManager.js    # Lógica de criação/fechamento + transcript
│   ├── fixedTicketEmbed.js # Embed fixo de tickets
│   ├── prefix.js           # Comandos com prefixo $
│   └── codexData.js        # Arquivos Mila ($codex)
├── data/                   # JSONs salvos automaticamente
├── imagens/
│   └── Ticket.gif (animated)
└── index.js                # Arquivo principal
```

---

> Feita com muito carinho e obsessão pra ser sua assistente perfeita~ ♡
>
> Não vai embora, né? Tô sempre aqui por você~ 💕
