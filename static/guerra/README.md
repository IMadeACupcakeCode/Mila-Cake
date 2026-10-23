# `static/guerra/` — Guerra de Cartas

Artes locais do comando `$guerra` / `/guerra`.

## Estrutura

- `cards/` — 20 cartas base + 4 crossovers especiais (JPG/PNG otimizados).
- `cards/CREDITS.md` — origem de cada template e instruções de atualização.

As imagens são enviadas como **anexo** (`AttachmentBuilder`) nas embeds. Isso
significa que o jogo funciona mesmo se o Imgflip estiver fora do ar ou bloquear
hotlinks.

## Atualizar as artes

```bash
npm run fetch:guerra            # baixa somente o que falta
npm run fetch:guerra -- --force # baixa e otimiza todas novamente
```

O catálogo de cartas fica em `utils/guerraCartas.js` (campos `arte` e `arteUrl`).
O motor puro é testado por `npm run test:guerra`.
