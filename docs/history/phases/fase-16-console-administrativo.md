# Fase 16 - Console administrativo web

## Objetivo

Transformar telas isoladas em uma experiencia administrativa coesa com navegacao clara entre os modulos principais.

## Entregas

- Shell administrativo reutilizavel em `components/app/console-shell.tsx`.
- Navegacao para:
  - `/questionarios`
  - `/operacoes`
  - `/pacientes`
  - `/profissionais`
- Rota raiz `/` redirecionando para `/questionarios`.
- Editor de questionarios movido para dentro do shell comum.
- Tela `/operacoes` usando o mesmo shell, preservando BFF e cookies `HttpOnly`.
- Placeholders operacionais para Pacientes e Profissionais, prontos para integracao com endpoints reais.
- Middleware expandido para proteger rotas administrativas.

## Decisoes

- O shell usa navegacao densa e utilitaria, adequada a rotina operacional.
- Pacientes e Profissionais entram como placeholders estruturados, sem simular dados falsos como se fossem reais.
- A protecao por middleware continua sendo gate rapido por cookies; a autorizacao forte permanece no BFF/backend.

## Proximo risco a fechar

Conectar os modulos Pacientes e Profissionais aos endpoints reais do backend e substituir placeholders por listagens operacionais.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, com rotas `/questionarios`, `/operacoes`, `/pacientes` e `/profissionais`.
- `work/checar-imports-web.js`: 30 imports web OK.
- `GET /`: HTTP 307 para `/questionarios`.
- `GET /questionarios` sem cookie: HTTP 307 para `/login?redirect=%2Fquestionarios`.
- `GET /pacientes` sem cookie: HTTP 307 para `/login?redirect=%2Fpacientes`.
- `GET /profissionais` sem cookie: HTTP 307 para `/login?redirect=%2Fprofissionais`.
- `GET /questionarios` com cookies simulados: HTTP 200.
- Varredura de nome legado em `outputs`: sem ocorrencias.
