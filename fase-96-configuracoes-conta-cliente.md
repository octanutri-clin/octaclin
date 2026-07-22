# Fase 96 - Configuracoes da conta do cliente

## Objetivo

Permitir que o gestor da conta configure dados operacionais basicos do tenant pelo portal do cliente, sem depender de ajuste manual no banco ou no painel administrativo interno.

## Entregas

- ORM para `tenant_configuracoes`.
- Leitura e atualizacao de configuracoes da conta pela chave `conta_cliente`.
- Endpoint backend `GET /cliente/configuracoes`.
- Endpoint backend `PATCH /cliente/configuracoes`.
- BFF `GET/PATCH /api/cliente/configuracoes` com permissao `cliente.configuracoes.gerenciar`.
- Formulario no portal do cliente para:
  - nome da clinica;
  - nome exibido;
  - timezone;
  - idioma;
  - email remetente;
  - cor primaria;
  - canais padrao: email, WhatsApp e Google Calendar.
- Testes backend para defaults e persistencia.
- Regressao visual do portal do cliente cobrindo a nova secao.

## Decisoes

- `tenants.nome` continua sendo o nome principal da conta.
- Preferencias flexiveis ficam em `tenant_configuracoes.valor`, chave `conta_cliente`.
- A rota nao aceita `tenantId` vindo do cliente; o tenant vem da sessao autenticada.
- Dados fiscais ficam para a Fase 97.

## Arquivos principais

- `octaclin-backend/src/modulos/tenancy/infraestrutura/tenant-configuracao.orm.ts`
- `octaclin-backend/src/modulos/clientes/aplicacao/servico-portal-cliente.ts`
- `octaclin-backend/src/modulos/clientes/aplicacao/dtos.ts`
- `octaclin-backend/src/modulos/clientes/apresentacao/controlador-portal-cliente.ts`
- `octaclin-web/app/api/cliente/configuracoes/route.ts`
- `octaclin-web/lib/cliente-api.ts`
- `octaclin-web/components/cliente/portal-cliente.tsx`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
```

## Resultado

Fase concluida. O portal do cliente passa a ter uma primeira area real de configuracoes da conta, preparando a proxima etapa de perfil comercial/fiscal.
