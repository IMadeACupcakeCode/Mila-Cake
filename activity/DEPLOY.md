# MilaTube — implantação da Activity

O MilaTube é a Activity de watch party da Mila. O bot continua cuidando de
música, `/join` e efeitos de voz; a Activity é um frontend separado que abre o
player **oficial** do YouTube dentro do Discord.

## 1. O que roda onde

| Peça | Pasta | Serviço |
| --- | --- | --- |
| Frontend (sem build) | `activity/public/` | Cloudflare Pages |
| API + OAuth + WebSocket | `activity/worker/worker.js` | Cloudflare Worker |
| Sala sincronizada | classe `MilaRoom` | Durable Object (SQLite) |
| Comando `/assistir` | `commands/assistir.js` | Bot da Mila |

O navegador nunca recebe `DISCORD_CLIENT_SECRET`, `BOT_API_SECRET` nem
`WS_TICKET_SECRET`. O frontend só conhece o `CLIENT_ID` público.

---

## 2. Pré-requisitos

- Conta Cloudflare com Workers e Pages habilitados.
- Wrangler instalado e autenticado (`wrangler login`).
- Aplicação existente no Discord Developer Portal, com **Activities** ligado.
- Bot da Mila já funcionando, com `CLIENT_ID` e `DISCORD_TOKEN` no `.env`.

> O plano gratuito da Cloudflare aceita Durable Objects com armazenamento
> SQLite. O `wrangler.toml` já usa `new_sqlite_classes`, então não é preciso
> escolher classe KV.

---

## 3. Publicar o Worker

No diretório `activity/worker`:

```bash
wrangler deploy
```

Na primeira publicação, o Wrangler cria o Worker, o Durable Object e a migração
`v1`. Guarde o endereço devolvido, por exemplo:

```text
https://mila-tube-sync.SEU-SUBDOMINIO.workers.dev
```

### Segredos do Worker

Cadastre uma vez (o Wrangler pede o valor em seguida):

```bash
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put BOT_API_SECRET
wrangler secret put WS_TICKET_SECRET
```

Para testar localmente com `wrangler dev`, os mesmos valores podem ficar em
`activity/worker/.dev.vars` (ignorado pelo Git). Esse arquivo é só local; em
produção, cadastre os segredos com `wrangler secret put`.

| Segredo | De onde vem | Para que serve |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Developer Portal → General Information | Troca do código OAuth |
| `DISCORD_CLIENT_SECRET` | Developer Portal → OAuth2 | Troca do código OAuth (nunca vai ao navegador) |
| `DISCORD_BOT_TOKEN` | mesmo token do bot | Conferir se o usuário é membro do servidor |
| `BOT_API_SECRET` | valor aleatório seu | Bot cria/atualiza salas; deve ser igual a `ACTIVITY_API_SECRET` no `.env` |
| `WS_TICKET_SECRET` | outro valor aleatório, diferente | Assinar tickets curtos de WebSocket |

Gere segredos longos (32 bytes ou mais). No PowerShell:

```powershell
[Convert]::ToBase64String(
  [Security.Cryptography.RandomNumberGenerator]::GetBytes(48)
)
```

Opcional: para restringir CORS à origem da Activity, defina a variável
`ALLOWED_ORIGINS` no `wrangler.toml` como
`https://SEU-APP-ID.discordsays.com`. O padrão `*` é seguro aqui porque a
autenticação usa `Authorization`/ticket, não cookies.

### Conferir o Worker

```bash
curl https://mila-tube-sync.SEU-SUBDOMINIO.workers.dev/health
```

Resposta esperada (valores `true`):

```json
{
  "ok": true,
  "roomsBound": true,
  "oauthConfigured": true,
  "botSecretConfigured": true,
  "botTokenConfigured": true,
  "ticketSecretConfigured": true
}
```

Não publique o Worker sem os cinco segredos: sem eles, `/assistir` falha com
uma mensagem clara em vez de abrir uma sala quebrada. `botTokenConfigured`
aparece como `false` se `DISCORD_BOT_TOKEN` não foi cadastrado; nesse caso a
sala funciona, mas a checagem de membro do servidor é ignorada.

---

## 4. Publicar o frontend no Pages

O frontend é estático e não tem etapa de build.

1. Edite `activity/public/config.js` e troque:
   ```js
   CLIENT_ID: '000000000000000000'
   ```
   pelo ID da aplicação (o mesmo do bot, com Activities habilitado).
   A Activity precisa pertencer à **mesma aplicação do bot**: `LAUNCH_ACTIVITY`
   abre a Activity da aplicação que recebeu a interação. Um aplicativo separado
   só para o frontend não funciona com o `/assistir` do bot.
2. Deixe `API_BASE: ''` em produção. O proxy de URL Mappings do Discord
   encaminha `/api` e `/ws` para o Worker; assim não há CORS nem URL externa
   fixa no navegador.
3. Publique a pasta `activity/public` como um projeto Pages:
   - **Dashboard**: Workers & Pages → Create → Pages → Upload assets, enviando
     o conteúdo de `activity/public`.
   - **Wrangler** (opcional, a partir de `activity/worker/`):
     ```bash
     npx wrangler pages deploy ../public --project-name mila-tube --branch main-cake
     ```

> **Atenção à branch de produção:** o projeto `mila-tube` foi criado com a
> branch de produção **`main-cake`**. Um deploy com `--branch main` entra como
> **Preview**, não atualiza `https://mila-tube.pages.dev/` e o Discord continua
> mostrando a versão antiga. Use sempre `--branch main-cake` para publicar em
> produção. O comando acima já faz isso.

O endereço do Pages será algo como
`https://mila-tube.pages.dev`. Ele não é o endereço que o usuário abre no
Discord: quem abre é sempre `https://SEU-APP-ID.discordsays.com/`.

### YouTube dentro da Activity (limite do Discord)

O proxy do Discord injeta uma CSP na Activity que **não permite** scripts,
iframes nem conexões com `youtube.com`/`youtube-nocookie.com`. Por isso o
`iframe_api` do YouTube falha dentro do Discord com “A API do YouTube não
carregou”, mesmo que a CSP do `index.html` permita o YouTube fora dali.

A solução do MilaTube é detectar o iframe do Discord (`frame_id`/`instance_id`)
e usar o **player externo**: a janela continua sincronizando fila, play, pause,
seek, relógio e avanço automático, mas o vídeo em si abre no YouTube pelo botão
**Abrir no YouTube** (via `openExternalLink` do SDK). O botão **Sincronizar**
reabre o YouTube no tempo atual da sala. Fora do Discord (modo demo), o player
embutido do YouTube continua funcionando normalmente.

Para testar o player externo sem abrir o Discord, use
`http://127.0.0.1:8787/?player=external` (com o servidor estático ligado em
`activity/public`).

Não faça proxy de vídeo nem extração de mídia do YouTube: isso viola os termos
do YouTube e não é necessário para o funcionamento da sala.

Se usar um domínio próprio no Pages ou no Worker, acrescente a origem em
`connect-src` no CSP de `activity/public/index.html` e ajuste `API_BASE` ou as
URL Mappings. Para o caminho padrão, nada disso é necessário.

---

## 5. URL Mappings no Developer Portal

No Developer Portal, abra a aplicação → **Activities** → **URL Mappings** (ou
o campo equivalente da sua versão do portal) e crie três rotas:

| Prefixo | Destino (somente host, sem `https://`) |
| --- | --- |
| `/api` | `mila-tube-sync.SEU-SUBDOMINIO.workers.dev` |
| `/ws` | `mila-tube-sync.SEU-SUBDOMINIO.workers.dev` |
| `/` | `mila-tube.pages.dev` |

Regras importantes:

- O destino é **sem protocolo**: `mila-tube-sync...workers.dev`, não
  `https://mila-tube-sync...workers.dev`.
- O prefixo mais específico vence. Deixe `/` por último.
- O Worker normaliza `/api/token` e `/token`; por isso a mesma rota serve tanto
  para a chamada relativa do frontend quanto para testes diretos.
- Depois de mapear `/api` e `/ws`, **não é preciso trocar a URL da Activity**
  quando o Worker for atualizado.

O frontend usa caminhos relativos:

```text
/api/token      -> Worker /token
/api/rooms/...  -> Worker /rooms/...
/api/oembed     -> Worker /oembed
/ws             -> Worker /ws (WebSocket)
```

---

## 6. Configurar a aplicação no Discord

1. Ative **Activities** na aplicação.
2. Em **OAuth2 → Redirects**, adicione `https://127.0.0.1`. Esse é o
   placeholder usado pelo fluxo de Activity; a troca de token no Worker não
   envia `redirect_uri`, seguindo o exemplo oficial da Discord.
3. A Activity pede os escopos `identify` e `guilds`:
   - `identify` para o perfil exibido na sala;
   - `guilds` para ler o nome do canal da call via `getChannel`.
4. Garanta que o bot foi convidado com as permissões normais de canal e voz.
   A Activity em si não precisa de permissão de administrador.

> **Enquanto a aplicação não estiver distribuída**, a Discord só permite abrir a
> Activity para o dono e para os membros do time de desenvolvimento. Para os
> amigos usarem, distribua o app (App Directory) ou adicione-os ao time em
> **Developer Portal → Team**. O bot e os comandos podem funcionar para todos,
> mas o botão da Activity não abre para quem não tem essa permissão.

### Fluxo do `/assistir`

1. O usuário entra em uma call e usa `/assistir <link>`.
2. O bot valida o link, busca o título via oEmbed e cria a sala no Worker.
3. O bot responde com `LAUNCH_ACTIVITY` (tipo 12); o Discord abre a Activity no
   contexto do canal.
4. A Activity faz OAuth, troca o código por token no Worker e conecta o
   WebSocket com ticket assinado.
5. A sala sincroniza play/pause/seek/fila; o player continua sendo o YouTube.

Como o Discord pode abrir a Activity no canal de texto do comando ou no canal
de voz, o bot prepara a sala nos dois IDs quando eles são diferentes. O comando
também exige que o usuário esteja em uma call.

### Prefixo `$assistir`

O caminho por prefixo não tem uma interação que aceite `LAUNCH_ACTIVITY`. Nesse
caso o bot cria um **convite de Activity** no canal (`target_type: 2`) e o
envia em um embed com botão. O convite expira em 1 hora. Se o convite falhar,
use `/assistir`.

---

## 7. Variáveis do bot

No `.env` da Mila:

```env
ACTIVITY_APPLICATION_ID=SEU_APPLICATION_ID
ACTIVITY_API_URL=https://mila-tube-sync.SEU-SUBDOMINIO.workers.dev
ACTIVITY_API_SECRET=O_MESMO_VALOR_DE_BOT_API_SECRET
```

- `ACTIVITY_API_URL` é a origem do Worker, **sem** `/api` no final.
- `ACTIVITY_API_SECRET` precisa ser idêntico ao segredo `BOT_API_SECRET` do
  Worker.
- `ACTIVITY_APPLICATION_ID` é opcional; se vazio, o bot usa
  `client.application.id` ou `CLIENT_ID`.

Sem essas variáveis, `/assistir` orienta a configurar a Activity e não abre uma
sala incompleta.

---

## 8. Anúncios: o limite real

O MilaTube **não bloqueia anúncios**. O vídeo é carregado no iframe oficial do
YouTube, e a IFrame API não oferece controle de anúncios. O Worker também não
faz proxy, download ou transcodificação do vídeo.

O que é possível:

- usar YouTube Premium na conta de quem assiste;
- escolher vídeos que não exibem anúncios;
- assistir pelo player oficial, respeitando as regras do YouTube.

O que **não** é feito: proxy de mídia, extração de URL de vídeo, injeção de
script no iframe do YouTube ou bloqueio por extensão externa. Essas abordagens
quebram os Termos do YouTube, a CSP da Activity e a segurança da sala.

O aviso aparece no rodapé/ajuda do MilaTube e está descrito em
`activity/public/config.js` (`ADS_NOTE`).

---

## 9. Testes rápidos

Sem abrir o Discord:

```bash
node scripts/test-slash.js
node scripts/test-youtube.js
```

Com a página estática aberta fora do Discord, o MilaTube entra em **modo
demonstração** (sem OAuth e sem sala real). É útil para revisar o visual, mas o
`frame_id` só existe dentro do cliente Discord.

Dentro do Discord:

1. `/assistir https://youtu.be/ID` em um canal de texto, estando em uma call.
2. A Activity deve abrir com o título e o player.
3. Em outro cliente, abra a mesma Activity; os dois devem entrar na mesma sala.
4. Teste play, pause, seek, fila e “modo livre”.
5. Teste `$assistir` para conferir o convite de Activity.

---

## 10. Diagnóstico

| Sintoma | Causa provável | O que fazer |
| --- | --- | --- |
| “Activity ainda não conectada” | `ACTIVITY_API_URL` vazio no `.env` | Configure a origem do Worker |
| `401` ao criar sala | `ACTIVITY_API_SECRET` diferente de `BOT_API_SECRET` | Iguale os dois segredos |
| `frame_id query param is not defined` | Página aberta fora do Discord | Use o botão/`/assistir`; fora do Discord só existe o modo demo |
| Activity abre, mas sem vídeo | Sala criada no canal errado | Confirme as três URL Mappings e use `/assistir` de novo na call |
| WebSocket fecha/reconecta | `/ws` não mapeado ou CSP bloqueando | Confira a mapping `/ws` e `connect-src` |
| “O criador não permite incorporar” | Restrição do próprio vídeo | Escolha outro vídeo; não é falha da Mila |
| “A API do YouTube não carregou” dentro do Discord | CSP do proxy de Activities bloqueia `youtube.com` | Normal no Discord; o app usa o player externo. Fora do Discord, confira rede/CSP local |
| Player externo abre no tempo errado | O vídeo do YouTube foi pausado/adiantado manualmente | Use **Sincronizar** para reabrir no tempo da sala |
| Anúncio aparece | Comportamento do YouTube | Use Premium ou outro vídeo; a Activity não bloqueia anúncios |
| Activity não abre para amigos | App ainda não distribuído | Distribua a aplicação ou adicione as pessoas ao time de desenvolvimento |

Logs úteis:

- Worker: Cloudflare Dashboard → Workers → `mila-tube-sync` → Logs.
- Bot: console da Mila, linhas `MilaTube:`.
- Activity: DevTools do cliente Discord (quando disponível) e o console do
  WebView.
