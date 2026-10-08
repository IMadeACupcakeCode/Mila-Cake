# Changelog

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
