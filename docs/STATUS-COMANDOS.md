# Status dos comandos Discord

**Atualizado em:** 2026-10-03  
**Escopo:** registro, schemas, roteamento e compatibilidade de comandos da Mila.

## Concluído nesta revisão

- O registro slash carrega e serializa os módulos em `commands/`.
- Foram criados adapters slash para `/forca`, `/say`, `/falar` e `/fechar`, reaproveitando `forcaManager`, `sayManager` e `ticketManager`.
- `/forca` abre o painel atual ou mostra o ranking.
- `/say` e `/falar` exigem administrador, aceitam mensagem direta ou abrem o painel interativo.
- `/fechar` só funciona em canais `ticket-*` e reutiliza a confirmação de fechamento existente.
- O prefixo `$` continua preservado.
- Os listeners de botões, menus e modais permanecem separados do router de chat-input.

## Evidência local

- `npm run validate:commands`: **37 comandos carregados, 0 inválidos** (33 módulos originais + `forca`, `say`, `falar` e `fechar`).
- `node --check` passou para os adapters novos e para `utils/slash.js`.
- Mock offline confirmou resposta privada para comando inexistente.
- Nenhum registro live foi executado nesta revisão.
- `npm test`: **Slash smoke tests: OK**.
- A validação recursiva de opções agora detecta nomes duplicados, opções malformadas e ordem inválida de opções obrigatórias/opcionais.
- Foi adicionado preflight opt-in de guilda e permissões para comandos administrativos e adapters novos.
- `npm test` cobre rejeição em DM e usuário sem permissão para `/say`.

## Pendências reais

1. **Teste live no Discord:** requer `.env` com token, `CLIENT_ID`, `GUILD_ID` válido e execução autorizada de `npm run deploy:commands`.
2. **Builders nativos:** parte dos schemas ainda usa objetos JSON legados; eles são serializados e validados offline, mas podem ser migrados individualmente para `SlashCommandBuilder`.
3. **Testes automatizados:** o projeto não possui Vitest/Jest; a validação atual é determinística e offline.
4. **Cooldown/permissões centralizados:** as verificações continuam distribuídas entre comandos e bridge de prefixo.
5. **Economia transacional:** o armazenamento JSON ainda não oferece garantias de concorrência do roadmap.

## Simulador local em tempo real

Foi adicionado `npm run simulator`, que inicia um painel somente local em `http://127.0.0.1:4173`. O painel lista os 37 comandos, aceita opções JSON, permite alternar DM/permissão e mostra respostas/eventos via SSE em tempo real. O simulador não usa `DISCORD_TOKEN`, não chama `registrar()` e não envia nada ao Discord.

Verificação realizada:

- `/api/commands` retornou os 37 comandos e seus schemas.
- `/api/simulate` executou `/ping` e capturou embed, latência, rodapé e resposta ephemeral.
- O processo foi iniciado em loopback, sem exposição externa.

## Teste recomendado

Em uma guilda de teste, registrar e testar `/ping`, `/buscar`, `/ship`, `/configurar`, `/lembrete criar`, `/ticket`, `/forca`, `/say`, `/falar` e `/fechar`, incluindo os botões, menus e modais gerados. Não remover o prefixo até a paridade ser confirmada.
