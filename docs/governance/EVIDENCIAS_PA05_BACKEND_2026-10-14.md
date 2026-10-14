# PA05 — checkpoint backend e contrato para UI

Data: 2026-10-14. Branch `feat/pos320-pa05-preferencias`, base `64f54b88`.
Desenvolvimento autorizado pelo proprietário; execução Sol6.1 médio. Somente
fixtures sintéticas e bancos locais descartáveis. A interface PA05 não está
implementada; não interpretar este checkpoint como entrega assistencial completa.

## Implementação

- Preferências visualmente independentes profissional/paciente, schema1 e seis
  booleans estritos. Domínio diferencia legado, configuração e indisponibilidade.
- Migration1072 aditiva, registrada: snapshot bytea nullable cifrado e revisão
  inteira não negativa. Nenhuma migration anterior editada. Down recusa remover
  histórico; plano externo em [IMPLANTACAO_PA05_MIGRATION_1072.md](IMPLANTACAO_PA05_MIGRATION_1072.md).
- Save explícito confere identidade do rascunho + revisão sob lock e incrementa
  revisão; omissão legada conserva configurações. Conflito/validação ocorrem
  antes de escrever filhos. Mesma transação clínica; edição invalida revisão.
- Publicação inclui preferências explícitas no hash; snapshot publicado não é
  atualizado retroativamente. Nova versão herda cipher, novo ID e revisão1 para
  configuração explícita, zero somente legado. Snapshot perdido não vira default.
- Projeção comum portal/preview elimina alternativas não liberadas e campos
  internos. Portal preserva escolhas/liberadas; recebe só conjunto paciente.
- GET de prévia por versão, autenticado e no-store, revalida escopo e usa lock
  compartilhado de paciente/plano/versão. BFF reaproveita wrappers e ignora escopo
  arbitrário do cliente; API Web/tipos prontos para Luna.

## RED/GREEN observado

| Propriedade | RED | GREEN |
| --- | --- | --- |
| Contrato de flags/projeção | Módulo novo ausente (suite não compilava) | Casos de booleans estritos, corrupção, zero/ausência e allowlist passam |
| Save cifrado/CAS | 8 casos de serviço falharam: prefs ignoradas, replay aceito, revisão inválida aceita | Suite focada passou e as propriedades foram repetidas em PG real |
| Preview paciente | 6 casos falharam por método ausente | Método/escopo/projeção implementados; negativos e portal passaram |
| Migration/registro | Classe nova ausente (suite não compilava) | Registro e recusa de down passam; schema/constraint aplicados em PG |
| Snapshot publicado perdido antes do clone | Nova versão retornava legado | Clone recusa corrupção, sem copiar como ausência legítima |
| Snapshot herdado perdido no rascunho | Revisão0 tornava perda do cipher legado | Herança começa revisão1; teste recebe indisponível |
| BFF | Rota nova ausente (teste não compilava) | 401/403 sem backend e GET autorizado/no-store/escopo fixo passam |

Os RED de módulo/rota/migration ausentes são falhas de compilação, não execuções
negativas de segurança. Os RED de save/replay/clone executaram comportamento.
A primeira fixture de lock de preview tentou fabricar uma publicação incompleta
que o constraint real recusou; corrigida para rascunho válido, sem enfraquecer
constraints. A mudança de revisão inicial da herança é refinamento técnico
fundamentado nessas duas regressões; D01–D03 permanecem as mesmas.

## Verificações realmente executadas

Toolchain: Node22.21.1 e corepack pnpm11.25.0; install congelado backend/Web.

| Gate | Resultado |
| --- | --- |
| Jest focado domínio/DTO/serviço/controlador/portal/migration/registro | PASS, 157 testes no checkpoint inicial; caso adicional de perda de snapshot herdado incluído na suite final |
| `pnpm --dir octaclin-backend test --runInBand` após correção final | PASS: 327 suites, 2.860 testes; 6 suites/104 testes SKIPPED por condições de ambiente dos testes existentes |
| `node octaclin-backend/scripts/test-pa05-postgres-local.cjs` após correção final | PASS: 2 casos PA05; 32 demais casos não selecionados, SKIPPED |
| PostgreSQL/RLS/CAS específico | PASS: role sem BYPASSRLS/não owner, FORCE RLS, tenantA/B, save/save, save/publicação, preview/transferência, replay de geração, clone/histórico e constraint revisão não negativa |
| Typecheck backend e build, validação `dist/main.js` | PASS |
| Typecheck Web | PASS |
| `pnpm --dir octaclin-web test:planos-alimentares:bff` | PASS 27/27; aviso conhecido de `headers()` no runner fora de requisição |
| ESLint focado dos tipos/helpers/rota Web | PASS, sem erros/avisos |
| Sintaxe do script local, diff/links e scanner de secrets | PASS conforme fechamento do checkpoint |
| Full Testcontainers Timescale/pgvector local | BLOCKED por ENOSPC no Docker VFS ao obter a imagem; não declarar PASS |
| UI/Playwright PA05, build Web final, revisão R4 independente, CI da nova PR | SKIPPED, tarefas T07–T09 ainda pendentes |
| Staging/produção/migrations externas/deploy/merge | SKIPPED, fora desta execução |

A suite geral PASS não equivale à execução dos casos SKIPPED. A prova específica
PG foi executada separadamente e não substitui o gate integral de CI.

### Limite explícito da fixture PostgreSQL local

O script opt-in usa PostgreSQL15 oficial fixado em digest
`f7d23353e1b15400d22ebe31189f4d314b87a4c129cc400c8c2d8d4ca127bf81`, somente
instância criada por Testcontainers, banco `octaclin_pa05_descartavel`, role owner
sintética para preparar e role de prova DML não proprietária. Não recebe banco
externo; remove envs de banco antes de iniciar os testes. Dados ficam em tmpfs;
containers encerrados após testes, inclusive em falha.

A fixture omite exatamente a criação das extensões vector/timescaledb e a
conversão de metricas_temporais em hypertable; embedding da IA usa array apenas
nessa fixture. As quatro adaptações são contadas e precisam corresponder ao
escopo previsto. Ela não valida esses subsistemas. As migrations e SQL de
planos, constraints, policies e a nova1072 são executados sem adaptação; a prova
usa o serviço real TypeORM/ExecutorTenant. O Testcontainers padrão e as
migrations de produção não foram alterados. O CI final executará o gate completo.

## Revisão técnica e handoff

Revisão do diff feita pelo próprio autor: autorização/tenant/carteira antes de
leitura, ordem de locks, projeção explícita, CAS antes de escrita, ausência de
recalculo retroativo e nenhum secret/PHI real. Não é revisão independente.
A revisão R4 independente da entrega permanece pendente em T09.

[Contrato e instruções Luna](../../tasks/plan-pos-320-pa05.md) e
[checklist](../../tasks/todo-pos-320-pa05.md). Luna implementará T07/T08; retornar
para Sol médio antes de integrar R4/CI e preparar PR única. Não criar PR
separada só para estes documentos. Não executar ação operacional externa.
