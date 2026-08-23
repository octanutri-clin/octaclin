# Fase 11 - Renovacao automatica de sessao web

## Objetivo

Evitar que a tela operacional pare de funcionar quando o `accessToken` curto expira, usando o `refreshToken` emitido pelo backend.

## Entregas

- Erro HTTP tipado no cliente operacional (`ErroApiOperacoes`).
- Helper de sessao para atualizar tokens e detectar expiracao proxima.
- `/operacoes` agora:
  - renova o access token antes da chamada se a sessao estiver perto de expirar;
  - tenta renovar e repetir a operacao quando recebe HTTP 401;
  - redireciona para `/login?redirect=/operacoes` se a renovacao falhar;
  - mantem logout local mesmo quando a API de revogacao estiver indisponivel.

## Decisoes

- Margem de renovacao: 60 segundos antes de `expiraEm`.
- A renovacao fica no cliente nesta fase para manter o escopo pequeno.
- A sessao continua em `localStorage` ate existir um desenho definitivo com cookies seguros ou boundary server-side.

## Proximo risco a fechar

Mover a sessao para cookies `HttpOnly` com middleware Next.js ou BFF, reduzindo exposicao de tokens no navegador.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, com rotas `/login` e `/operacoes`.
- `work/checar-imports-web.js`: 17 imports web OK.
- `GET http://localhost:3001/login`: HTTP 200.
- `GET http://localhost:3001/operacoes`: HTTP 200.
- Varredura de nome legado em `outputs`: sem ocorrencias.
