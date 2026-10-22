const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const PORT = Number(process.env.SPOTIFY_AUTH_PORT || 8888);
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`;
const TOKEN_FILE = path.join(__dirname, '..', '.spotify-token.json');
const SCOPES = 'user-read-private';
let authPromise;
let cacheToken = undefined; // undefined = ainda não lido do disco

function lerToken() {
  if (cacheToken !== undefined) return cacheToken;
  try { cacheToken = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')); } catch { cacheToken = null; }
  return cacheToken;
}

function guardarToken(token) {
  cacheToken = token;
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2), { mode: 0o600 });
}

function base64Url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function iniciarAutorizacao() {
  if (!CLIENT_ID) return Promise.reject(new Error('SPOTIFY_CLIENT_ID não configurado.'));
  if (authPromise) return authPromise;
  authPromise = new Promise((resolve, reject) => {
    const verifier = base64Url(crypto.randomBytes(48));
    const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
    const authorization = new URL('https://accounts.spotify.com/authorize');
    authorization.search = new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, scope: SCOPES, redirect_uri: REDIRECT_URI, code_challenge_method: 'S256', code_challenge: challenge }).toString();
    const servidor = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (url.pathname !== new URL(REDIRECT_URI).pathname) return;
      if (url.searchParams.get('error')) {
        res.end('Autorização Spotify cancelada. Pode fechar esta janela.');
        servidor.close();
        authPromise = null;
        reject(new Error(`Autorização Spotify recusada: ${url.searchParams.get('error')}`));
        return;
      }
      try {
        const resposta = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000), body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'authorization_code', code: url.searchParams.get('code'), redirect_uri: REDIRECT_URI, code_verifier: verifier }) });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error_description || dados.error || `HTTP ${resposta.status}`);
        guardarToken({ ...dados, expires_at: Date.now() + (dados.expires_in * 1000) });
        res.end('Spotify autorizado. Pode fechar esta janela.');
        servidor.close();
        authPromise = null;
        resolve(dados.access_token);
      } catch (erro) {
        res.end('Falha ao autorizar o Spotify. Pode fechar esta janela.');
        servidor.close();
        authPromise = null;
        reject(erro);
      }
    });
    servidor.once('error', (erro) => { authPromise = null; reject(erro); });
    // Sem este teto, uma autorização esquecida deixava o Promise pendurado
    // para sempre (e o comando esperando).
    const expiracao = setTimeout(() => {
      try { servidor.close(); } catch {}
      authPromise = null;
      reject(new Error('Tempo de autorização do Spotify esgotado. Tente novamente.'));
    }, 5 * 60 * 1000);
    expiracao.unref?.();
    servidor.once('close', () => clearTimeout(expiracao));
    servidor.listen(PORT, '127.0.0.1', () => console.log(`[Spotify] Autorize o bot abrindo: ${authorization}`));
  });
  return authPromise;
}

async function obterAccessToken() {
  if (!CLIENT_ID) return null;
  const token = lerToken();
  if (token?.access_token && token.expires_at > Date.now() + 60_000) return token.access_token;
  if (token?.refresh_token) {
    const resposta = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000), body: new URLSearchParams({ client_id: CLIENT_ID, grant_type: 'refresh_token', refresh_token: token.refresh_token }) });
    const dados = await resposta.json();
    if (resposta.ok) {
      guardarToken({ ...token, ...dados, refresh_token: dados.refresh_token || token.refresh_token, expires_at: Date.now() + (dados.expires_in * 1000) });
      return dados.access_token;
    }
  }
  return iniciarAutorizacao();
}

module.exports = { obterAccessToken, REDIRECT_URI };
