# Fase 315 — inventário do legado score_risco

Levantamento estático em 2026-10-11, base `c77c4520`. Reproduzir com
`rg -n 'score_risco|scoreRisco' --glob '!pnpm-lock.yaml' --glob '!package-lock.json' .`.
As linhas abaixo localizam referências; não provam consumo externo.
Documentos históricos excluídos da tabela devem ser preservados.

| Arquivo | Linhas na base | Tratamento previsto |
| --- | --- | --- |
| `octaclin-backend/scripts/api-demo-local.mjs` | 50, 400, 459 | Paridade PATCH/projeções; impedir vazamento por spread/Object.assign |
| `octaclin-backend/src/infraestrutura/banco-dados/migracoes/1720000000000-CriarFundacaoOctaClin.ts` | 99 | Preservar migration histórica; nenhum DROP nesta fase |
| `octaclin-backend/src/infraestrutura/banco-dados/seeds/seed-demo.ts` | 127 | Preservar amostras históricas; evitar escrita nova não-zero |
| `octaclin-backend/src/infraestrutura/banco-dados/seeds/seed-staging.ts` | 33, 164 | Preservar amostras históricas; evitar escrita nova não-zero |
| `octaclin-backend/src/infraestrutura/banco-dados/seeds/staging-fixtures.json` | 60, 70, 80 | Preservar amostras históricas; evitar escrita nova não-zero |
| `octaclin-backend/src/infraestrutura/http/pipe-validacao-http.spec.ts` | 48 | Separar fixture ORM histórica de resposta; manter testes negativos |
| `octaclin-backend/src/infraestrutura/performance/benchmark-prontuario.spec.ts` | 33 | Separar fixture ORM histórica de resposta; manter testes negativos |
| `octaclin-backend/src/infraestrutura/smoke/smoke-busca-pacientes.ts` | 60 | Avaliar omissão do default na criação; manter schema/ORM |
| `octaclin-backend/src/modulos/clientes/aplicacao/servico-painel-operacao.spec.ts` | 21 | Separar fixture ORM histórica de resposta; manter testes negativos |
| `octaclin-backend/src/modulos/dashboard/aplicacao/servico-dashboard-clinico.spec.ts` | 72, 169, 173, 415, 421 | Separar fixture ORM histórica de resposta; manter testes negativos |
| `octaclin-backend/src/modulos/pacientes/aplicacao/dtos.ts` | 185, 359 | Separar compatibilidade de entrada do contrato de saída |
| `octaclin-backend/src/modulos/pacientes/aplicacao/servico-importacao-pacientes.ts` | 175 | Avaliar omissão do default na criação; manter schema/ORM |
| `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts` | 209, 342, 493, 611, 666, 705, 758, 817, 1067, 1131, 1258, 1368, 1454, 1575, 1750, 1816, 2001, 2045, 2299, 2333, 2365, 2742, 2877, 2923 | Separar fixture ORM histórica de resposta; manter testes negativos |
| `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts` | 168, 323, 341, 398, 612 | Contrato/PATCH/projeção/CSV; seguir decisão D01 |
| `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts` | 529, 782, 783, 784, 1035, 1389, 1495, 1583, 1695, 1941 | Separar fixture ORM histórica de resposta; manter testes negativos |
| `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts` | 152 | Revisar caso a caso; preservar asserções negativas e comentários de proteção |
| `octaclin-backend/src/modulos/pacientes/aplicacao/servico-recalculo-prioridade-acompanhamento.ts` | 33 | Revisar caso a caso; preservar asserções negativas e comentários de proteção |
| `octaclin-backend/src/modulos/pacientes/dominio/paciente.ts` | 12 | Remover propriedade de domínio após reconfirmar ausência de consumidores |
| `octaclin-backend/src/modulos/pacientes/infraestrutura/paciente.orm.ts` | 40, 41 | Preservar mapeamento e valores históricos |
| `octaclin-web/lib/cadastros-api.ts` | 15, 46 | Separar compatibilidade de entrada do contrato de saída |
| `octaclin-web/lib/portal-api.ts` | 47 | Revisar caso a caso; preservar asserções negativas e comentários de proteção |
| `octaclin-web/scripts/e2e-staging-mutavel.mjs` | 168 | Trocar escrita legado por cenário de status; executar só local autorizado |
| `octaclin-web/scripts/smoke-e2e-bff.mjs` | 323 | Trocar escrita legado por cenário de status; executar só local autorizado |
| `octaclin-web/scripts/test-base-visual-navegacao.mjs` | 45 | Revisar caso a caso; preservar asserções negativas e comentários de proteção |
| `octaclin-web/tests/visual/acessibilidade.spec.mjs` | 290, 301, 533, 1260, 1274, 4343, 5701 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/aviso-acesso-negado.spec.mjs` | 4 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/comunicacoes-disparo-manual.spec.mjs` | 102 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/comunicacoes-visao-unificada.spec.mjs` | 14, 15, 16 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/console-regression.spec.mjs` | 89, 954, 968, 1609, 2411 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/fase-199-busca-paginacao.spec.mjs` | 35 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/fase-248-estados-recuperacao.spec.mjs` | 18 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/fase-249-densidade-responsividade.spec.mjs` | 13 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/fase-254-pacientes.spec.mjs` | 6, 70 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/fase-269-duplicar-plano.spec.mjs` | 25 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/fase-270-condicao-especial-manual.spec.mjs` | 25 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/jornadas-criticas.spec.mjs` | 241, 301, 457, 603, 884 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/paleta-comandos.spec.mjs` | 67 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/portal-paciente.spec.mjs` | 8 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/primeiro-acesso-paciente.spec.mjs` | 12 | Retirar de respostas simuladas; preservar prioridade e estados |
| `octaclin-web/tests/visual/reflow-visual.spec.mjs` | 313 | Retirar de respostas simuladas; preservar prioridade e estados |

## Consumidores indiretos e contratos distintos

- BFF `octaclin-web/app/api/pacientes/[id]/route.ts` encaminha corpo/resposta; tipos não ocultam campos. Conferir listagem, busca, arquivados e prontuário.
- `integracoes/aplicacao/servico-api-publica.ts::mapearPaciente`: allowlist sem legado nem prioridade. Não ampliar `/v1` ou webhooks.
- `projecao-prioridade-acompanhamento.ts` lê tabela própria. Filtros `risco`, status `risco`, override e gatilho `paciente.risco_alto` são contratos distintos.
- Formulário atual não possui campo score; tipos e mocks ainda o exigem.
- Nenhuma ocorrência literal encontrada em `octaclin-mobile`, `scripts` e `.github`; não comprova ausência de cliente antigo fora do repositório.

## Exclusões

Não substituir globalmente `risco`, `score`, `scoreCalculado` ou `frustracaoScore`. Preservar prioridades, questionários, avaliações, proteções gestacionais/pediátricas e snapshots. Fixtures ORM com valor legado são necessárias para provar preservação histórica.
