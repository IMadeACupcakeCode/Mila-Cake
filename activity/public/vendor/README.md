# SDK vendorizado

`discord-sdk.js` é o build ESM de `@discord/embedded-app-sdk@2.5.0`, obtido do
pacote publicado no npm (jsDelivr `+esm`) e salvo localmente para que a
Activity não dependa de CDN externa. A CSP de Activities permite scripts da
própria origem e do YouTube; um import de `esm.sh` ou `jsDelivr` poderia ser
bloqueado.

- Pacote: `@discord/embedded-app-sdk`
- Versão: `2.5.0`
- Licença: MIT
- Repositório: <https://github.com/discord/embedded-app-sdk>

O arquivo é servido como módulo pelo `app.js` apenas quando a página está
dentro do Discord (presença de `frame_id`/`instance_id`). Fora do Discord, a
Activity entra em modo demonstração e não carrega o SDK.
