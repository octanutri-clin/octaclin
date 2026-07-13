# Fase 12 - Seed demo operacional

## Objetivo

Criar uma massa local idempotente para validar login, painel de operacoes, outbox e sincronizacao mobile sem montagem manual no banco.

## Entregas

- Script `npm run seed:demo` no backend.
- Arquivo `src/infraestrutura/banco-dados/seeds/seed-demo.ts`.
- Tenant demo:
  - `clinica-carla`
- Usuarios demo:
  - `admin@octaclin.local` com papel `SuperAdmin`
  - `dra.carla@example.com` com papel `Professional`
  - `paciente.demo@example.com` com papel `Patient`
- Senha padrao:
  - `OctaClin@123`
- Dados operacionais:
  - profissional e paciente vinculados;
  - canal e template de email;
  - mensagem falha;
  - evento de outbox falho para reprocessamento;
  - evento de outbox pendente;
  - sincronizacoes mobile sincronizadas e com erro.

## Como usar

Com a infraestrutura local de Postgres ativa:

```bash
npm run migration:run
npm run seed:demo
```

Depois acesse `/login`, use o tenant `clinica-carla`, o email `admin@octaclin.local` e a senha `OctaClin@123`.

## Decisoes

- UUIDs fixos para permitir reexecucao sem duplicar os mesmos registros.
- Uso dos servicos reais de senha e criptografia para manter compatibilidade com `POST /auth/login`.
- Transacao com `set_config('app.tenant_id', ...)` para respeitar o modelo de RLS do backend.

## Proximo risco a fechar

Executar validacao ponta a ponta com Postgres/Redis locais: migration, seed, login real, carregamento de `/operacoes` e reprocessamento do outbox falho.

## Validacao executada

- Backend `tsc --noEmit`: passou.
- Backend `jest`: 10 suites e 25 testes passando.
- Backend `nest build`: passou.
- `work/checar-imports-relativos.js`: 113 imports backend OK.
- Varredura de nome legado em `outputs`: sem ocorrencias.
- Execucao direta do seed via `ts-node`: script iniciou e falhou somente ao conectar em `localhost:5432` com `ECONNREFUSED`.
- Docker/Compose nao estao disponiveis neste ambiente para subir Postgres/Redis localmente.
