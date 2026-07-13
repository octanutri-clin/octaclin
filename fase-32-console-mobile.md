# Fase 32 - Console Mobile

## Objetivo

Abrir no console web o modulo mobile ja existente no backend, permitindo acionar fluxos usados pelo app: diario rapido, upload de midia, acompanhantes e sincronizacao offline.

## Entregue

- Nova rota protegida `/mobile`.
- Item de navegacao `Mobile` no console OctaClin.
- BFF autenticado para:
  - `POST /api/mobile/diario-rapido`
  - `POST /api/mobile/midias/uploads`
  - `POST /api/mobile/acompanhantes`
  - `POST /api/mobile/sincronizacao/lote`
- Client API `lib/mobile-api.ts`.
- Tela operacional para registrar diario rapido.
- Tela operacional para solicitar upload de midia.
- Tela operacional para criar acompanhante.
- Tela operacional para sincronizar lote mobile.
- API demo local com suporte aos endpoints mobile.
- Smoke E2E expandido para validar pagina protegida e os quatro comandos mobile.

## Fluxo funcional

1. Usuario autentica no BFF.
2. Abre `/mobile`.
3. Seleciona paciente.
4. Registra diario rapido, solicita upload, cria acompanhante ou envia lote de sincronizacao.
5. Backend persiste ou simula a operacao e retorna o recurso criado.

## Validacao esperada

Com web e API demo ativas:

```powershell
node outputs/octaclin-web/scripts/smoke-e2e-bff.mjs
```

O resultado esperado e `smoke-e2e-bff-ok`.
