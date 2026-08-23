# Fase 197 - Racionalizacao dos modulos avancados

Status: concluida, validada localmente e publicada na PR #10 em 2026-08-01.

## Entregue

- IA integrada como sugestao assistida: fonte e limitacoes persistidas, estado
  pendente e decisao obrigatoria de aceitar, editar ou rejeitar.
- Alertas de sentimento so sao liberados depois da revisao humana; correcoes
  editadas passam a ser exibidas como resultado revisado.
- Cache de reconhecimento alimentar isolado por paciente.
- Automacoes descritas como `Quando`/`Fazer`, criadas sempre em rascunho e
  ativadas somente depois de simulacao persistida no historico.
- Mobile retirado da navegacao funcional e redirecionado para Operacoes, sem
  remover as APIs necessarias ao paciente. Patient acessa apenas o proprio
  cadastro; Professional, apenas pacientes sob sua responsabilidade;
  SuperAdmin, o tenant atual; Collaborator e bloqueado.
- Idempotencia mobile isolada por paciente para impedir colisao de `idLocal`.
- Gamificacao transformada em opt-in do tenant. Metas/badges, comunidade e
  ranking possuem gates independentes; comunidade e ranking ficam desligados
  por padrao.
- Operacoes exclusiva do SuperAdmin dividida em Saude, Incidentes,
  Comunicacoes, LGPD, Auditoria e Filas. Sync mobile fica em Filas.

## Seguranca e integridade

- IA nao libera conduta, alerta ou atalho antes de uma revisao registrada.
- Escopo de IA, Automacoes, Mobile e Gamificacao e derivado do usuario
  autenticado e aplicado dentro de `ExecutorTenant`.
- Ativacao de automacao procura uma simulacao real persistida, sem depender do
  estado informado pelo navegador.
- Operacoes passou a exigir `GuardaPermissoes` e manteve reprocessamento sob a
  permissao especifica.
- Configuracoes de Gamificacao usam `tenant_configuracoes`, sem nova tabela.

## Migrations

- `1720000001011-AdicionarRevisaoHumanaIa`: revisao/limitacoes da IA, cache por
  paciente e regras de automacao inativas por padrao.
- `1720000001012-IsolarIdempotenciaMobilePorPaciente`: vincula sincronizacoes
  ao paciente e substitui a unicidade global por tenant/paciente/id local.
- Ambas estao registradas explicitamente em `opcoes-typeorm.ts`. Quando
  `BANCO_EXECUTAR_MIGRACOES=false`, devem ser aplicadas antes do deploy de
  backend e web desta fase.

## Validacoes

```powershell
pnpm --dir octaclin-backend test -- --runInBand
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:next15
pnpm --dir octaclin-web build
pnpm --dir octaclin-web exec playwright test tests/visual/fase-197-modulos-avancados.spec.mjs --reporter=line
pnpm --dir octaclin-web smoke:e2e:bff
pnpm security:secrets
pnpm test:confiabilidade
```

Resultados finais locais: 69 suites/395 testes backend; 2 testes Python da IA;
6 jornadas Playwright desktop/mobile; smoke BFF contra API demo e web reais;
lint, typechecks, builds, autorizacao, Next 15, secrets e confiabilidade sem
falhas.

## Proxima fase

Fase 198 - Validacao final de usabilidade e consolidacao visual.
