# Fase 10 - Login web operacional

## Objetivo

Substituir o campo manual de token da tela `/operacoes` por um fluxo de login web real usando os endpoints de autenticacao do backend.

## Entregas

- Cliente de autenticacao em `octaclin-web/lib/auth-api.ts`.
- Persistencia de sessao em `octaclin-web/lib/auth-session.ts`.
- Nova rota `/login`.
- Formulario de login com API URL, tenant, email e senha.
- `/operacoes` agora:
  - carrega a sessao local;
  - redireciona para `/login?redirect=/operacoes` quando nao ha sessao;
  - usa `accessToken` da sessao nos endpoints operacionais;
  - executa logout local e tenta revogar o refresh token via `POST /auth/sair`.

## Decisoes

- O armazenamento em `localStorage` e temporario e pragmatico para homologacao.
- `refreshToken` fica salvo para permitir logout remoto e futura renovacao automatica.
- Redirecionamento pos-login foi restrito a `/operacoes` para evitar redirects arbitrarios.

## Proximo risco a fechar

Adicionar renovacao automatica por `POST /auth/renovar`, tratamento de expiracao do access token e middleware/server boundary para protecao mais forte das rotas web.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, com rotas `/login` e `/operacoes`.
- `work/checar-imports-web.js`: 17 imports web OK.
- `GET http://localhost:3001/login`: HTTP 200.
- `GET http://localhost:3001/operacoes`: HTTP 200.
- Varredura de nome legado em `outputs`: sem ocorrencias.
