Pasta `static/guerra/` — imagens para o comando `guerra`

Coloque imagens nomeadas como:
- `atk_dank_1.png` ... `atk_dank_100.png`
- `atk_rage_1.png` ...
- `atk_brasileiro_1.png` ...
- `atk_classic_1.png` ...
- `special_1.png` ... `special_20.png`

Recomendações:
- PNGs em 512x512 ou 256x256 funcionam bem.
- Se preferir usar URLs externas, substitua o valor `image` em `commands/guerra.js` por URLs.

Exemplo de uso no código:
- O campo `image` de cada ataque aponta para `static/guerra/<filename>`; para usar como embed image, carregue com `attachment` ou sirva via um host estático.

Notas técnicas:
- Atualmente o bot usa o caminho como string; para enviar imagens locais em embeds, você pode usar `MessageAttachment` e anexar ao editar a mensagem.
- Se quiser que eu implemente envio automático das imagens como anexos no embed (para que apareçam inline), eu posso atualizar o comando para anexar os arquivos ao `edit` e usar `setImage('attachment://<filename>')`.
