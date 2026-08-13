# OctaClin - Runbook de dados realistas de staging

Este runbook descreve como preparar massa de dados ficticia para demonstracao e QA em staging. Nao use dados reais de clientes, pacientes ou profissionais.

## Objetivo

Popular staging com um tenant ficticio, usuarios, profissionais, pacientes, consultas, comunicacoes, materiais e tarefas para validar jornadas reais sem PII real.

## Arquivos

- Fixture: `octaclin-backend/src/infraestrutura/banco-dados/seeds/staging-fixtures.json`.
- Seed: `octaclin-backend/src/infraestrutura/banco-dados/seeds/seed-staging.ts`.
- Validador: `scripts/test-staging-fixtures.mjs`.

## Validacao local

```powershell
pnpm test:staging-fixtures
pnpm --dir octaclin-backend typecheck
```

## Aplicacao em staging

Execute somente contra banco de staging, nunca contra producao:

```powershell
$env:DATABASE_URL='<url do Neon staging>'
pnpm seed:staging
```

Depois valide:

```powershell
curl https://<backend-staging-url>/health
curl https://<backend-staging-url>/health/detalhado
pnpm test:e2e:criticas
```

## Credenciais ficticias

- Tenant: `octaclin-staging`
- Cliente: `gestor.staging@octaclin.test`
- Colaborador: `ops.staging@octaclin.test`
- Profissionais: `marina.profissional@octaclin.test`, `rafael.profissional@octaclin.test`
- Paciente: `paciente.alfa@octaclin.test`
- Senha padrao de staging: `OctaClin@123`

Essas credenciais sao ficticias e devem ser trocadas se staging for compartilhado fora da equipe interna.

## Regras

- Nao substituir `@octaclin.test` por emails reais.
- Nao inserir telefones reais nos fixtures.
- Nao rodar `seed:staging` em banco de producao.
- Rodar `pnpm test:staging-fixtures` antes de alterar a massa.
- Se a massa precisar simular erro, usar mensagens ficticias e dados mascarados.

## Jornada mutavel descartavel da Fase 231

Para validar mutacoes completas, use o workflow manual `OctaClin staging E2E
mutavel` em vez do banco persistente de staging. O workflow:

- cria uma branch Neon descartavel no projeto de integracao;
- aplica migrations com owner e executa a aplicacao com role restrita;
- prepara exatamente dois tenants `@octaclin.test`;
- valida RLS forcada e isolamento antes das jornadas;
- sobe Redis e MinIO efemeros;
- nao inicia workers externos nem envia notificacoes;
- remove a branch Neon mesmo em caso de falha.

Configuracao exigida no repositorio:

- variaveis `NEON_E2E_PROJECT_ID`, `NEON_E2E_PARENT_BRANCH_ID`,
  `NEON_E2E_DATABASE` e `NEON_E2E_RUNTIME_ROLE`;
- secret `NEON_API_KEY` limitado ao projeto de integracao.

Validar o contrato antes de alterar o workflow:

```powershell
pnpm test:e2e:staging:config
```

Nao reutilizar a URL gerada, nao registrar credenciais nos artefatos e nao
apontar as variaveis E2E para o projeto ou banco de producao.

## Cobertura atual

- 1 tenant de staging.
- 5 usuarios por papel operacional.
- 2 profissionais.
- 3 pacientes ficticios.
- 2 consultas.
- 2 canais de comunicacao.
- 2 templates.
- 2 mensagens.
- 2 materiais.
- 1 envio de material.
- 2 tarefas de acompanhamento.
- 2 configuracoes de tenant.
