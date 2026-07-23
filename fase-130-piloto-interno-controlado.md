# Fase 130 - Piloto interno controlado

Data: 2026-07-23

## Objetivo

Criar a estrutura operacional para um piloto interno controlado antes do go-live real, permitindo testar o OctaClin com poucos usuarios ficticios/autorizados, registrar problemas e definir criterios claros de aceite antes de avancar para producao isolada.

## Entregas

- Criado `RUNBOOK_PILOTO_INTERNO.md` com participantes, perfis a testar (cliente, profissional, paciente, suporte/operador), jornadas obrigatorias, criterios de sucesso, criterios de bloqueio, forma de registrar bugs e processo de decisao de aceite.
- Criado `PILOTO_INTERNO_CONTROLE.md` como arquivo vivo de acompanhamento da rodada atual do piloto: participantes, checklist de jornadas, registro de bugs e decisao de aceite.
- Adicionado validador documental `scripts/test-piloto-interno.mjs`.
- Adicionado script raiz `pnpm test:piloto`.
- `RUNBOOK_PILOTO_INTERNO.md` e `PILOTO_INTERNO_CONTROLE.md` incluidos na lista de documentos obrigatorios do `validar-preflight.ps1`.
- `CHECKLIST_GO_LIVE.md` ganhou secao "Piloto interno" ligando o aceite do piloto a liberacao de clientes reais.
- `PREFLIGHT_PRODUCAO.md` ganhou linha de area "Piloto interno" e "Proximo passo recomendado" atualizado.
- `TESTES_E_VALIDACOES.md` ganhou secao de validacao do piloto interno.
- Ajustado `scripts/scan-secrets.mjs` para ignorar os diretorios `.agents` e `skills`, evitando falso-positivo do scanner de secrets em exemplos de documentacao de terceiros vendorizados pelo marketplace de skills (ex.: URLs de banco de exemplo em `docker.md`/`gitlab.md`).

## Escopo nao incluido

- Nenhum cliente real de consultoria foi convidado nesta fase.

## Rodada 1 - execucao real (2026-07-23)

Apos a estrutura entregue, a primeira rodada real do piloto comecou nesta mesma fase:

- `pnpm test:e2e:criticas` executado: 6/6 testes passaram (desktop e mobile).
- Massa de staging aplicada com `pnpm seed:staging` contra o banco Neon unico do projeto (hoje rotulado "producao" no console, mas usado como staging de fato ate a Fase 131 separar os ambientes; o usuario confirmou explicitamente o uso e a ausencia de clientes reais nele).
- Dois bugs reais foram encontrados e corrigidos durante a aplicacao do seed (detalhes e severidade em `PILOTO_INTERNO_CONTROLE.md`, tabela de bugs):
  - **BUG-001 (P1):** a constraint `usuarios_role_check`, criada em `1720000000000-CriarFundacaoOctaClin.ts`, nunca incluiu o papel `Client`, apesar de o tipo TypeScript de `UsuarioOrm.role` incluir `'Client'` desde a Fase 89. Qualquer banco Postgres criado do zero pelas migrations falhava ao inserir um usuario Client. Corrigido pela nova migration `1720000000700-CorrigeConstraintRoleUsuarios.ts`, que amplia a constraint para incluir `'Client'`.
  - **BUG-002 (P2):** o fixture `staging-fixtures.json` usava `profissionais.id` no campo `tarefas[].profissionalId`, mas a coluna `acompanhamento_tarefas.profissional_id` referencia `usuarios.id` (o controlador `controlador-pacientes.ts` grava ali o `usuario.usuarioId` de quem criou a tarefa, nao o perfil profissional). Corrigido ajustando o fixture para usar o `usuarioId` correto do profissional responsavel.
- Subimos backend (`http://localhost:3001`) e web (`http://localhost:3000`) locais apontando para o banco de staging ja seedado, para o usuario comecar as jornadas manuais.
- **BUG-003 (P1):** ao testar o acesso inicial (`/` -> `/dashboard`), o usuario recebeu a tela quebrada `{"mensagem":"Sessao ausente ou expirada."}` em vez de ser levado ao login. Causa raiz: `octaclin-web/middleware.ts` nao incluia `/dashboard` em `ROTAS_PROTEGIDAS` nem no `matcher`, entao a rota nunca passava pela checagem de autenticacao (a logica de permissao em `lib/server/autorizacao-rotas.ts` ja suportava `/dashboard` corretamente, so faltava registrar a rota no middleware). Corrigido adicionando `/dashboard` a `ROTAS_PROTEGIDAS` e ao `matcher`; validado via curl que visitante nao autenticado agora recebe redirect 307 para `/login?redirect=%2Fdashboard` e que uma sessao autenticada continua acessando `/dashboard` normalmente.
- Jornadas manuais (cliente, profissional, paciente, suporte/operador navegando de fato na aplicacao) e a definicao de participantes internos continuam em andamento, acompanhadas em `PILOTO_INTERNO_CONTROLE.md`.

## Validacoes

```powershell
git diff --check
pnpm security:secrets
pnpm test:piloto
pnpm test:staging-fixtures
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test -- servico-portal-cliente.spec.ts servico-usuarios-cliente.spec.ts permissoes.spec.ts --runInBand
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Observacoes

- Nenhum teste de integracao automatizado cobre a constraint `usuarios_role_check` contra Postgres real (os specs Jest existentes usam repositorios mockados); o Docker Compose local (`docker-compose.yml`) nao estava disponivel neste ambiente de execucao para validar a migration antes de aplica-la no banco compartilhado. Fica como lacuna conhecida para uma fase futura de hardening de testes de integracao.
- `pnpm --dir octaclin-web test:authz` cobre `decidirAcessoRota` (a logica de permissao), mas nao cobre a lista `ROTAS_PROTEGIDAS`/`matcher` do proprio `middleware.ts` — foi exatamente essa lacuna que deixou o BUG-003 passar despropercebido. Vale considerar, em fase futura, um teste que garanta que toda rota mapeada em `permissoesRotasOperacionais` (`lib/server/autorizacao-rotas.ts`) tambem esteja em `ROTAS_PROTEGIDAS` no middleware.
- A Fase 131 - Producao isolada de staging so deve iniciar apos as jornadas manuais serem executadas e o aceite do piloto ser registrado em `PILOTO_INTERNO_CONTROLE.md`.
