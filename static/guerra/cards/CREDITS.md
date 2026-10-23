# Créditos das artes — Guerra de Cartas

As imagens são templates de memes hospedados publicamente no **Imgflip** e foram
baixadas/otimizadas localmente para que o bot não dependa de hotlink em runtime.
O uso é recreativo, sem fins comerciais. Cada embed também exibe o crédito da
carta no rodapé.

| Arquivo | Template | Fonte |
| --- | --- | --- |
| `anakin.jpg` | Anakin Padme 4 Panel | https://i.imgflip.com/5c7lwq.png |
| `gru.jpg` | Gru's Plan | https://i.imgflip.com/26jxvz.jpg |
| `spongebob.jpg` | Mocking SpongeBob | https://i.imgflip.com/1otk96.jpg |
| `drake.jpg` | Drake Hotline Bling | https://i.imgflip.com/30b1gx.jpg |
| `cinema.jpg` | Absolute Cinema | https://i.imgflip.com/8d317n.png |
| `distracted.jpg` | Distracted Boyfriend | https://i.imgflip.com/1ur9b0.jpg |
| `cat.jpg` | Woman Yelling At Cat | https://i.imgflip.com/345v97.jpg |
| `pikachu.jpg` | Surprised Pikachu | https://i.imgflip.com/2kbn1e.jpg |
| `fine.jpg` | This Is Fine | https://i.imgflip.com/wxica.jpg |
| `brain.jpg` | Expanding Brain | https://i.imgflip.com/1jwhww.jpg |
| `nazare.jpg` | Nazaré Confusa | https://i.imgflip.com/1n1gyg.jpg |
| `luva.jpg` | Luva de Pedreiro | https://i.imgflip.com/8g5y9u.jpg |
| `capivara.jpg` | Giga Capybara | https://i.imgflip.com/5odwlr.jpg |
| `caramelo.jpg` | Vira-lata | https://i.imgflip.com/55enl5.jpg |
| `joelma.jpg` | Laughing With Myself | https://i.imgflip.com/3bm0ge.jpg |
| `shrek.jpg` | Shrek For Five Minutes | https://i.imgflip.com/2hiv1g.jpg |
| `doge.jpg` | Buff Doge vs. Cheems | https://i.imgflip.com/43a45p.png |
| `spiderman.jpg` | Spider Man Triple | https://i.imgflip.com/1tkjq9.jpg |
| `rollsafe.jpg` | Roll Safe Think About It | https://i.imgflip.com/1h7in3.jpg |
| `handshake.jpg` | Epic Handshake | https://i.imgflip.com/28j0te.jpg |

## Como atualizar

```bash
npm run fetch:guerra            # baixa apenas o que falta
npm run fetch:guerra -- --force # baixa e otimiza tudo de novo
```

O script usa `ffmpeg-static` para redimensionar as imagens para no máximo 700px
de largura, mantendo o repositório leve.
