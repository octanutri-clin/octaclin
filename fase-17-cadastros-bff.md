# Fase 17 - Cadastros via BFF

## Objetivo

Substituir placeholders de Pacientes e Profissionais por listagens operacionais conectadas aos endpoints reais do backend, mantendo tokens restritos ao BFF.

## Entregas

- Rotas BFF:
  - `GET /api/pacientes`
  - `GET /api/profissionais`
- Cliente web:
  - `octaclin-web/lib/cadastros-api.ts`
- Telas client-side:
  - `components/cadastros/lista-pacientes.tsx`
  - `components/cadastros/lista-profissionais.tsx`
- `/pacientes` agora lista status de adesao, score de risco, responsavel e datas.
- `/profissionais` agora lista registro, especialidade, usuario vinculado e datas.

## Decisoes

- Campos sensiveis permanecem criptografados no backend e nao sao exibidos no frontend nesta fase.
- A interface mostra metadados operacionais seguros enquanto nao existe endpoint de leitura descriptografada controlada.
- As chamadas passam por `/api/*`, preservando cookies `HttpOnly` e renovacao server-side.

## Proximo risco a fechar

Criar DTOs de resposta no backend para expor nomes descriptografados de forma autorizada, com auditoria e minimizacao de dados.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, com `/api/pacientes` e `/api/profissionais`.
- `work/checar-imports-web.js`: 35 imports web OK.
- `GET /pacientes` sem cookie: HTTP 307 para `/login?redirect=%2Fpacientes`.
- `GET /profissionais` sem cookie: HTTP 307 para `/login?redirect=%2Fprofissionais`.
- `GET /api/pacientes` sem cookie: HTTP 401.
- `GET /api/profissionais` sem cookie: HTTP 401.
- `GET /pacientes` com cookies simulados: HTTP 200.
- `GET /profissionais` com cookies simulados: HTTP 200.
- Varredura de nome legado em `outputs`: sem ocorrencias.
