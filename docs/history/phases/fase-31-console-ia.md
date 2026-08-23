# Fase 31 - Console de IA

## Objetivo

Abrir no console web o modulo de IA ja existente no backend, permitindo acionar analise de sentimento e reconhecimento alimentar a partir do BFF autenticado.

## Entregue

- Nova rota protegida `/ia`.
- Item de navegacao `IA` no console OctaClin.
- BFF autenticado para:
  - `POST /api/ia/sentimento`
  - `POST /api/ia/reconhecimento-alimentar`
- Client API `lib/ia-api.ts`.
- Tela operacional para analisar texto de paciente.
- Tela operacional para reconhecer alimentos a partir de referencia de midia/imagem.
- API demo local com heuristicas de sentimento e reconhecimento alimentar.
- Smoke E2E expandido para validar pagina protegida, analise de sentimento e reconhecimento alimentar.

## Fluxo funcional

1. Usuario autentica no BFF.
2. Abre `/ia`.
3. Seleciona paciente e envia texto para analise de sentimento.
4. Seleciona paciente e envia referencia de imagem para reconhecimento alimentar.
5. Backend persiste os resultados retornados pelo servico de IA ou pela heuristica demo.

## Validacao esperada

Com web e API demo ativas:

```powershell
node outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
```

O resultado esperado e `smoke-e2e-bff-ok`.
