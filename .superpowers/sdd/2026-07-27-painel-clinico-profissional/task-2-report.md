# Task 2 - Leitura clinica de formulario e contratos de fila

## Status

Concluida.

## Escopo entregue

- Migração `1720000001003` com:
  - `envios_questionario.revisado_em`;
  - `envios_questionario.revisado_por_usuario_id`, referenciando `usuarios`;
  - indice `(tenant_id, status, revisado_em)`;
  - rollback das colunas e do indice.
- `EnvioQuestionarioOrm` e contrato web com os campos opcionais de revisao.
- Metodo transacional `marcarEnvioComoRevisado`:
  - aceita apenas envios `respondido`;
  - aplica filtro por `tenantId`;
  - limita `Professional` ao paciente sob sua responsabilidade;
  - retorna `Envio nao encontrado.` sem expor existencia fora do escopo;
  - usa bloqueio pessimista para preservar a primeira revisao em chamadas concorrentes;
  - mantem `revisadoEm` e `revisadoPorUsuarioId` na repeticao idempotente.
- Endpoint `POST /questionarios/envios/:envioId/revisar` protegido por
  `questionarios.gerenciar`.
- Auditoria `questionarios.envio.revisar`, com origem segura `questionarios`
  definida pelo backend e sem leitura de headers externos.
- BFF `POST /api/questionarios/envios/:envioId/revisar`:
  - exige `questionarios.gerenciar`;
  - nao envia header de origem forjavel;
  - reduz respostas bem-sucedidas aos campos clinicos minimos;
  - nao expoe `tokenFormulario`, `linkFormulario`, tenant ou paciente.
- Cliente `revisarEnvioQuestionario(envioId)` com tipo de resposta dedicado,
  separado do contrato de criacao do envio.
- Testes de controlador garantem origem de auditoria segura e resposta minima.
- Testes da rota BFF cobrem `401`, `403`, ausencia de chamada ao backend em
  recusas, ausencia do header de origem e remocao defensiva de tokens publicos.
- Nenhuma alteracao em agenda, estados de consulta ou desmarcamento.
- Nenhuma dependencia adicionada e nenhum novo tipo explicito `any`.

## TDD

### RED

Comando:

```text
pnpm --dir octaclin-backend exec jest servico-questionarios.spec.ts --runInBand
```

Resultado esperado observado: falha de compilacao `TS2339`, pois
`marcarEnvioComoRevisado` ainda nao existia.

Na correcao round 1, os novos testes falharam de forma comportamental:

- o controlador registrou `origem_forjada`;
- o controlador retornou o objeto completo;
- o BFF enviou `x-octaclin-origem: dashboard_clinico`.

### GREEN

Casos adicionados:

- profissional responsavel revisa envio respondido;
- envio de paciente de outro profissional e tratado como inexistente;
- repeticao preserva a primeira revisao e o primeiro revisor.

Resultado focado: `1` suite e `15` testes aprovados.

Correcao round 1:

- backend focado: `2` suites e `17` testes aprovados;
- BFF focado: `3/3` testes aprovados.

## Validacoes

- Backend focused Jest: aprovado, `15/15`.
- Backend complete Jest: aprovado, `54` suites e `289` testes.
- Backend typecheck: aprovado.
- Backend build: aprovado.
- Web typecheck: aprovado.
- Web lint: aprovado.
- Web authorization e BFF tests: aprovado, `14/14`.
- Web production build: aprovado; nova rota BFF registrada.
- `git diff --check`: aprovado.
- Verificacao de novos tipos explicitos `any`: aprovado.

## Preocupacoes residuais

- A migração foi validada por compilacao e revisao estatica, mas nao foi aplicada
  contra uma instancia PostgreSQL externa nesta tarefa. A execucao real continua
  sendo responsabilidade do fluxo normal de deploy/migrations.
- A origem especifica `dashboard_clinico` somente podera ser reintroduzida quando
  existir uma assercao interna autenticada entre BFF e backend. Header simples nao
  e considerado evidencia confiavel.
