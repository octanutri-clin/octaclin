# Fase 38 - Hardening operacional do BFF

## Objetivo

Reduzir riscos na borda web/backend antes de ampliar novas telas: validar o backend informado no login, padronizar respostas de falha operacional e reforcar comportamento de sessao.

## Entregas

- Validacao e normalizacao do campo `API` no BFF:
  - aceita apenas HTTP/HTTPS;
  - rejeita credenciais embutidas;
  - rejeita query string e hash;
  - suporta allowlist opcional via `OCTACLIN_API_ORIGENS_PERMITIDAS`.
- Login BFF passa a usar URL normalizada e chamadas `no-store`.
- Chamadas autenticadas do BFF passam a enviar `Accept: application/json`, `cache: no-store` e erro JSON 502 quando o backend esta indisponivel.
- Backend retornando HTML para chamadas autenticadas passa a virar erro JSON 502 com mensagem operacional.
- Sessao e logout BFF retornam `Cache-Control: no-store`.
- Middleware remove `x-middleware-subrequest` dos headers encaminhados nas rotas protegidas.
- Smoke E2E cobre API invalida no login e `Cache-Control: no-store` da sessao.
- README documenta a allowlist de origens e as rejeicoes do campo `API`.

## Validacao

Comandos esperados:

```powershell
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/typescript/bin/tsc --noEmit
& 'C:\Users\octav\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules/next/dist/bin/next build
powershell -ExecutionPolicy Bypass -File outputs/verificar-demo-local.ps1
```

## Proximo passo recomendado

Fase 39 - Auditoria de mutacoes backend: expandir `ServicoAuditoria` para criacao, edicao, arquivamento, comunicacoes, automacoes, IA, mobile e gamificacao, mantendo payloads sem dados sensiveis.
