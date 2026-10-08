# Decisões técnicas

## 2026-10-03 — Aceitar metadata legada no registro inicial

A maioria dos módulos exporta `data` como objeto JSON, enquanto somente `buscar` usa `SlashCommandBuilder`. O loader slash passa a serializar ambos os formatos para ativar os comandos existentes sem reescrever 32 arquivos e sem quebrar o bridge de prefixo. A conversão individual para builders continua planejada para validação detalhada de opções e permissões.

## 2026-10-03 — Manter prefixo e componentes

O prefixo `$` continua suportado e o listener slash processa apenas chat-input/autocomplete. Botões, menus e modais permanecem nos handlers existentes para evitar respostas duplicadas em tickets, say e forca.
