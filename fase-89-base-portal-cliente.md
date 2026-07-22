# Fase 89 - Base do portal do cliente

## Entregue

- Criado o papel `Client` na matriz de autenticacao.
- Criadas permissoes iniciais de cliente: acesso ao portal, leitura de assinatura, gestao de usuarios e configuracoes da conta.
- O destino inicial do papel `Client` passa a ser `/cliente`.
- O escopo de dados do cliente foi separado como `conta_cliente`.
- O middleware protege `/cliente` como area autenticada propria do cliente.
- Paciente continua restrito a `/portal`, cliente fica restrito a `/cliente` e perfis operacionais nao acessam essas areas.
- Criada a tela `/cliente` com base de conta, assinatura e usuarios.
- Criado teste visual desktop/mobile para garantir que a tela do cliente nao exponha console clinico nem portal do paciente.

## Decisoes

- A primeira versao do portal do cliente usa dados estaticos de base para validar navegacao, separacao de perfil e layout.
- Nao foi criada tabela nova nesta fase, porque o campo `usuarios.role` ja e `varchar` e aceita o novo papel sem migracao estrutural.
- A integracao real de conta, assinatura e usuarios fica para fases seguintes, depois da fundacao de acesso.

## Validacao

- `pnpm --dir octaclin-backend test -- permissoes.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test tests/visual/portal-cliente.spec.mjs`

## Proxima fase

Fase 90: conectar o portal do cliente a um resumo real de conta/tenant pelo backend e expor via BFF autenticado.
