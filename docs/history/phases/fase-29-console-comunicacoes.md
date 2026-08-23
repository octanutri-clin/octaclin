# Fase 29 - Console de Comunicacoes

## Objetivo

Abrir no console web o modulo de comunicacoes ja existente no backend, conectando canais, templates e mensagens ao BFF autenticado.

## Entregue

- Nova rota protegida `/comunicacoes`.
- Item de navegacao `Comunicacoes` no console OctaClin.
- BFF autenticado para:
  - `GET /api/comunicacoes/canais`
  - `POST /api/comunicacoes/canais`
  - `GET /api/comunicacoes/templates`
  - `POST /api/comunicacoes/templates`
  - `POST /api/comunicacoes/mensagens`
- Client API `lib/comunicacoes-api.ts`.
- Tela operacional para criar canal, criar template e disparar mensagem manual para paciente.
- API demo local com seed de canal/template e suporte aos endpoints de comunicacoes.
- Smoke E2E expandido para validar pagina protegida, canal, template e mensagem.

## Fluxo funcional

1. Usuario autentica no BFF.
2. Abre `/comunicacoes`.
3. Cria ou reutiliza um canal ativo.
4. Cria um template compatível com o canal.
5. Dispara uma mensagem manual para um paciente.
6. Backend cria mensagem `pendente` e registra evento de outbox `notificacao.enviar`.

## Validacao esperada

Com web e API demo ativas:

```powershell
node outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
```

O resultado esperado e `smoke-e2e-bff-ok`.
