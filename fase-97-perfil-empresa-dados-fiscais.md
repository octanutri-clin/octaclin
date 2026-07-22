# Fase 97 - Perfil da empresa/consultoria e dados fiscais

Data: 2026-07-22

## Objetivo

Adicionar ao portal do cliente um cadastro persistente de perfil da empresa/consultoria, com dados fiscais, responsavel, endereco e contatos para preparar recibos/notas futuras sem integrar ainda um gateway fiscal.

## Entregas

- Backend `GET/PATCH /cliente/perfil-empresa` protegido por `cliente.configuracoes.gerenciar`.
- Persistencia tenant-aware em `tenant_configuracoes` com chave `perfil_empresa`.
- Auditoria no `PATCH /cliente/perfil-empresa` com acao `cliente.perfil_empresa.atualizar`.
- BFF `GET/PATCH /api/cliente/perfil-empresa`.
- UI no portal do cliente com secao `Perfil fiscal`.
- Testes unitarios de servico e controller.
- Teste visual Playwright cobrindo exibicao e salvamento do perfil fiscal.

## Decisoes

- O perfil fiscal usa a infraestrutura flexivel de `tenant_configuracoes`, evitando criar uma tabela fiscal antes de existir emissao real de nota/recibo.
- A auditoria registra campos alterados e tipo de pessoa, mas nao replica documento fiscal completo nos metadados.
- A permissao reutilizada e `cliente.configuracoes.gerenciar`, pois o perfil fiscal e configuracao sensivel da conta.

## Arquivos principais

- `octaclin-backend/src/modulos/clientes/aplicacao/servico-portal-cliente.ts`
- `octaclin-backend/src/modulos/clientes/aplicacao/dtos.ts`
- `octaclin-backend/src/modulos/clientes/apresentacao/controlador-portal-cliente.ts`
- `octaclin-backend/src/modulos/clientes/apresentacao/controlador-portal-cliente.spec.ts`
- `octaclin-web/app/api/cliente/perfil-empresa/route.ts`
- `octaclin-web/lib/cliente-api.ts`
- `octaclin-web/components/cliente/portal-cliente.tsx`
- `octaclin-web/tests/visual/portal-cliente.spec.mjs`

## Validacoes

```powershell
pnpm --dir octaclin-backend exec jest servico-portal-cliente.spec.ts controlador-portal-cliente.spec.ts --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/portal-cliente.spec.mjs --reporter=list
```

## Resultado

Fase pronta para persistir dados fiscais por tenant e preparar a futura emissao de recibos/notas.
