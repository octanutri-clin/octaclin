# Fase 9 - Integracao real da tela de operacoes

## Objetivo

Conectar a superficie web de operacoes aos endpoints reais do backend, removendo dados estaticos da Fase 8.

## Entregas

- Cliente tipado em `octaclin-web/lib/operacoes-api.ts`.
- Componente client-side `PainelOperacoes` com token SuperAdmin persistido localmente.
- Carregamento real de:
  - `GET /operacoes/resumo`
  - `GET /operacoes/outbox/falhas?limite=50`
  - `GET /operacoes/mobile/sincronizacoes?limite=50`
- Reprocessamento real por:
  - `POST /operacoes/outbox/:id/reprocessar`
- Estados de carregamento, erro e listas vazias.

## Decisoes

- A tela aceita `NEXT_PUBLIC_API_URL`, mas permite trocar a URL no navegador para facilitar homologacao.
- O token fica no `localStorage` apenas como mecanismo operacional temporario. Login web completo deve substituir isso antes de producao.
- A pagina continua isolada em `/operacoes`, sem alterar o editor de questionarios.

## Proximo risco a fechar

Criar login web real, armazenar access token com politica consistente e trocar o campo manual de token por sessao autenticada.

## Validacao executada

- Web `tsc --noEmit`: passou.
- Web `next build`: passou, com rota `/operacoes` gerada.
- `work/checar-imports-web.js`: 13 imports web OK.
- `GET http://localhost:3001/operacoes`: HTTP 200.
- Varredura de nome legado em `outputs`: sem ocorrencias.
