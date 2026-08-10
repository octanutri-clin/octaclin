import http from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { URL } from 'node:url';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const port = Number(process.env.GMAIL_OAUTH_PORT || 8765);
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
const escopo = 'https://www.googleapis.com/auth/gmail.send';
const estadoEsperado = randomBytes(32).toString('hex');
const arquivoSaida = process.env.GMAIL_REFRESH_TOKEN_OUTPUT
  ? resolve(process.env.GMAIL_REFRESH_TOKEN_OUTPUT)
  : undefined;

if (!clientId || !clientSecret || !arquivoSaida) {
  console.error('Defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN_OUTPUT antes de executar este script.');
  process.exit(1);
}

const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', redirectUri);
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const codigo = url.searchParams.get('code');
    const erro = url.searchParams.get('error');
    const estadoRecebido = url.searchParams.get('state');
    const estadoValido = Boolean(
      estadoRecebido &&
        estadoRecebido.length === estadoEsperado.length &&
        timingSafeEqual(Buffer.from(estadoRecebido), Buffer.from(estadoEsperado))
    );
    if (erro || !codigo || !estadoValido) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Falha no OAuth: ${erro ?? (!estadoValido ? 'state invalido' : 'codigo ausente')}`);
      servidor.close();
      return;
    }

    const resposta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: codigo,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      })
    });
    const corpo = await resposta.json();

    if (!resposta.ok || !corpo.refresh_token) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Falha ao trocar codigo por refresh_token. Veja o terminal.');
      console.error(JSON.stringify(corpo, null, 2));
      servidor.close();
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>OctaClin Gmail autorizado</h1><p>Volte ao Codex. O refresh token foi capturado.</p>');
    writeFileSync(arquivoSaida, corpo.refresh_token, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    console.log(`Refresh token gravado no arquivo temporario informado (${Buffer.byteLength(corpo.refresh_token)} bytes).`);
    servidor.close();
  } catch (erro) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erro inesperado no helper OAuth.');
    console.error(erro);
    servidor.close();
  }
});

servidor.listen(port, '127.0.0.1', () => {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', escopo);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', estadoEsperado);

  console.log(`Abra esta URL no navegador e autorize a conta Gmail:\n${authUrl.toString()}`);
  console.log(`Redirect URI usado: ${redirectUri}`);
});
