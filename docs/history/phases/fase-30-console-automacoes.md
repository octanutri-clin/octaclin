# Fase 30 - Console de Automacoes

## Objetivo

Abrir no console web o modulo de automacoes ja existente no backend, permitindo configurar regras clinicas e solicitar avaliacoes manuais para pacientes.

## Entregue

- Nova rota protegida `/automacoes`.
- Item de navegacao `Automacoes` no console OctaClin.
- BFF autenticado para:
  - `GET /api/automacoes/regras`
  - `POST /api/automacoes/regras`
  - `POST /api/automacoes/avaliacoes`
- Client API `lib/automacoes-api.ts`.
- Tela operacional para criar regra com gatilho, condicao e acao.
- Tela operacional para solicitar avaliacao manual de regra por paciente.
- API demo local com seed de regra e suporte aos endpoints de automacoes.
- Smoke E2E expandido para validar pagina protegida, criacao de regra e criacao de avaliacao.

## Fluxo funcional

1. Usuario autentica no BFF.
2. Abre `/automacoes`.
3. Cria uma regra vinculada a um profissional.
4. Define gatilho, condicao e acao.
5. Solicita avaliacao manual para um paciente.
6. Backend cria execucao `pendente` para processamento assincrono.

## Validacao esperada

Com web e API demo ativas:

```powershell
node outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
```

O resultado esperado e `smoke-e2e-bff-ok`.
