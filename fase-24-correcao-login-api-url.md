# Fase 24 - Correcao de login e API URL

## Problema

Ao tentar fazer login, a interface exibia uma pagina HTML de erro do Next.js com:

- `Cannot find module './522.js'`
- stack em `.next/server/webpack-runtime.js`
- `buildId: "development"`

A causa encontrada foi uma instancia `next dev -p 3001` rodando no `octaclin-web`. Assim, o campo `API = http://localhost:3001` apontava para outro servidor Next.js, nao para o backend NestJS.

## Correcao

- Encerrada a instancia web antiga que ocupava a porta `3001`.
- Mantida a convencao:
  - web: `http://localhost:3000`
  - backend/API: `http://localhost:3001`
- Criada API demo local `scripts/api-demo-local.mjs` para permitir login e navegacao sem Docker/Postgres.
- Adicionado script `npm run mock:api` no backend.
- Cookies BFF usam `Secure` somente quando `OCTACLIN_COOKIE_SECURE=true`, evitando bloquear sessao em `localhost` HTTP.
- `app/api/auth/login/route.ts` agora trata:
  - backend indisponivel;
  - API apontando para HTML/servidor errado;
  - resposta de login invalida.
- `lib/auth-api.ts` agora transforma erro HTML em mensagem curta para a tela.
- README web atualizado com a regra de porta.

## Campos corretos

- API: `http://localhost:3001`
- Tenant: `clinica-carla`
- Email SuperAdmin: `admin@octaclin.local`
- Senha: `OctaClin@123`

## Validacao

- web `tsc --noEmit`: aprovado.
- web `next build`: aprovado.
- `GET http://localhost:3000/login`: `200`.
- `POST http://localhost:3000/api/auth/login` com backend ausente em `3001`: `502` com JSON controlado `{"mensagem":"Nao foi possivel conectar ao backend informado no campo API."}`.
- `GET http://localhost:3001/health` com API demo: `200`.
- `POST http://localhost:3000/api/auth/login` contra API demo: `200`.
- `GET http://localhost:3000/api/auth/session` apos login: `200`.
- `GET http://localhost:3000/api/pacientes` apos login: `200`.
- `GET http://localhost:3000/api/operacoes/resumo` apos login: `200`.
