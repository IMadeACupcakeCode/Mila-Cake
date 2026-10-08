# Auditoria inicial — Mila Cake

Data: 2026-10-03

## Retrato do repositório

- Runtime: Node.js/CommonJS (`package.json`, `type: commonjs`).
- Biblioteca Discord: `discord.js` 14.14.1; voz com `@discordjs/voice`.
- Entrada: `index.js`; prefixo legado `$` em `utils/prefix.js`.
- Dados: JSON local em `data/`; transcripts em `data/transcripts/`.
- Segredos: `.env` carregado por `dotenv`; `.env.example` contém placeholders.
- Comandos: 33 módulos em `commands/`; antes desta correção, só `buscar.js` usava `SlashCommandBuilder`.
- Eventos: `ready`, `messageCreate`, `interactionCreate` para componentes, reações, voz, entrada em guilda e cache opcional de membros.
- Testes: não havia suíte automatizada nem script de validação.

## Gap prioritário de comandos Discord

| Item | Prioridade | Esforço | Situação | Fase |
|---|---:|---:|---|---:|
| Registro slash não era chamado pelo `index.js` | P0 | S | Corrigido nesta tarefa: registro no `ready` | 1/2 |
| Router slash não era chamado | P0 | S | Corrigido nesta tarefa: listener dedicado a chat-input/autocomplete | 1/2 |
| Loader descartava 32 módulos por exigir `.toJSON()` | P0 | M | Corrigido nesta tarefa: serialização de metadata compatível | 1/2 |
| Falhas slash não respondiam interação | P0 | S | Corrigido nesta tarefa: resposta ephemeral/follow-up segura | 1 |
| Não existia validação offline/deploy script | P1 | S | Corrigido nesta tarefa: `validate:commands` e `deploy:commands` | 2 |
| 33 comandos precisam de revisão de schema/opções e paridade | P1 | L | Parcial: metadata legada é aceita; conversão para builders permanece | 3 |
| `$forca`, `$say`, `$fechar` não são módulos slash | P1 | M | Não convertidos; dependem de handlers de componentes/prefixo | 3 |
| Cooldown/permissões centralizados | P0 | M | Ainda distribuídos entre prefix bridge e comandos | 1/2 |

## Segurança e operação

- `.env` é ignorado e não há `.env` rastreado; `.env.example` contém placeholders.
- Não foi confirmado segredo exposto no histórico disponível; a árvore de trabalho já estava modificada antes desta tarefa.
- Dados JSON locais não têm transações atômicas: economia persistente completa ainda não existe e deve ser tratada antes de novos módulos econômicos.
- Logs usam utilitário local; não há `pino`, rotação ou testes automatizados.
- A aplicação possui handlers globais de rejeições, mas o tratamento deve evoluir para shutdown gracioso no caso de exceções fatais.

## Plano priorizado

1. P0: validar e proteger entradas, permissões, cooldowns, erros e segredos.
2. P0: criar testes para descoberta/registro/dispatch slash e comandos puramente funcionais.
3. P1: converter schemas legados para builders, incluindo opções e permissões, sem quebrar `utils/prefix.js`.
4. P1: versionar/migrar armazenamento e revisar operações concorrentes.
5. P2: continuar módulos de economia, moderação, música, gacha e RPG conforme o roadmap mestre.

## Referência

O repositório irmão Dellusion-Falta-Lua foi consultado somente para comparação estrutural e não foi modificado.
