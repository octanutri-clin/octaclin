import http from 'node:http';
import { URL } from 'node:url';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
const port = Number(process.env.GMAIL_OAUTH_PORT || 8765);
const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
const escopo = 'https://www.googleapis.com/auth/gmail.send';

if (!clientId || !clientSecret) {
  console.error('Defina GMAIL_CLIENT_ID e GMAIL_CLIENT_SECRET antes de executar este script.');
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
    if (erro || !codigo) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Falha no OAuth: ${erro ?? 'codigo ausente'}`);
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
    console.log(`GMAIL_REFRESH_TOKEN=${corpo.refresh_token}`);
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

  console.log(`Abra esta URL no navegador e autorize a conta Gmail:\n${authUrl.toString()}`);
  console.log(`Redirect URI usado: ${redirectUri}`);
});
