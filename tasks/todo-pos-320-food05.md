# FOOD05 — T01–T18, dependências e critérios de aceite

Contrato: [plan-pos-320-food05.md](plan-pos-320-food05.md).
Estado: implementação autorizada pelo proprietário em “Pode seguir, sol médio”.
Execução/evidências reais em [execucao-pos-320-food05.md](execucao-pos-320-food05.md).
D01–D14 e M01–M08 não são opcionais. Cada caixa representa prova, não código existente.
Paths BE = `octaclin-backend/src/modulos/planos-alimentares/`;
FE = `octaclin-web/`. Novos nomes são propostas, não arquivos criados nesta rodada.

## Checkpoint intermediário de execução

| Tarefas | Estado real |
| --- | --- |
| T01–T05 | Fundamentos implementados e verificações focadas PASS; fechamento integrado ainda depende dos gates finais |
| T06 | Motor, writer/ACK, revisão e snapshots implementados; suites focadas PASS, conclusão funcional ainda vinculada às cópias e regressões finais |
| T07 | Cópia entre refeições/planos salvos usa referências opacas e revalidação server-side; modelo continua bloqueado. T07 não concluído |
| T08 | Preferências e migration 1079 implementadas; CAS/RLS/JSON exercitados no PostgreSQL de CI |
| T09 | Backend, BFF, cliente tipado e integração principal com a UI implementados; verificações Web passam |
| T10–T13 | Implementação parcial integrada; FOOD05/PA07 18/18 desktop/mobile após cancelamento e 0/0; limites, matriz completa, cópias e critérios restantes ainda pendentes |
| T14 | PostgreSQL/migrations/RLS e Redis/idempotência do fluxo executado no GitHub CI PASS; matriz integral de concorrência e todos os critérios ainda precisam ser fechados |
| T15–T18 | Smoke visual global, PR Gate, regressões executadas e scanners CI PASS no HEAD bb513d1d; revisão R4 independente e fechamento final pendentes |

As caixas abaixo continuam sendo critérios de aceite detalhados; nenhuma prova
focada isolada encerra a entrega. Uma PR funcional foi escolhida dentre as opções
aprovadas, mantendo as dependências dos blocos A/B/C.

## Ciclo obrigatório de cada tarefa de implementação

- [ ] Escrever os testes indicados e executar o comando focado para registrar RED real.
- [ ] Implementar somente os arquivos/responsabilidade da tarefa, usando as interfaces do plano.
- [ ] Reexecutar focados/regressões pertinentes e registrar GREEN/FAIL/BLOCKED/SKIPPED.
- [ ] Revisar diff, segredos e integração; commit pequeno. Não declarar teste independente se usa o próprio algoritmo como esperado.

## PR A — fundamento, backend e persistência

### T01 — contratos de entrada e casos especiais

Dependência: autorização expressa do plano; D01/D02/D10/D13.
Arquivos novos: BE `dominio/equivalencia-nutriente.ts`,
`dominio/equivalencia-nutriente.spec.ts`, `aplicacao/dtos-equivalencias.ts` e spec.
Interface: tipos EntradaEquivalencia/ResultadoEquivalencia, enum alvo e DTO fechado
conforme seção3; fingerprint hexadecimal64, UUIDs, lote<=20, corpo<=96KiB.

- [ ] RED: alvo fora dos4, múltiplos alvos, campos extras/tenant/resultado forjado,
  porção<=0,NaN/Infinity, base ausente, lote21 e contexto pai inexistente são recusados.
- [ ] GREEN:4 alvos e dados incompletos por alternativa são representados sem zeros.
- [ ] Comando: `pnpm --dir octaclin-backend exec jest --runInBand dtos-equivalencias equivalencia-nutriente`.

### T02 — aritmética exata e oráculo independente

Dep: T01; M03/M05/M08.
Criar BE `dominio/decimal-nutricional.ts` e spec;
`tests/fixtures/food05/oraculo-equivalencias.json` e gerador `.py` no backend.
Modificar BE `dominio/micronutrientes.ts` somente para reexport/delegação compatível,
sem alterar semântica dos micros. Razões assinadas para deltas; entradas não negativas.

- [ ] RED: exemplos fixados no plano, half-up, periódicos, base diferente e negativos;
  ao menos1000 casos/alvo, seed314159, monotonicidade/proporção/resíduo e limites de parsing.
- [ ] GREEN: frações inteiras exatas, erros estáveis, nenhum NaN/Infinity ou float intermediário.
- [ ] Oráculo Python stdlib Fraction independente, fixture/seed/hashes versionados;
  não gerar esperado pela implementação TS. Tolerâncias fixadas no plano.
- [ ] Comando: Jest `decimal-nutricional equivalencia-nutriente micronutrientes`;
  gerador offline só com fixtures sintéticas. Sem dependência nova por conveniência.

### T03 — extensão do motor, composição e impacto da refeição

Dep: T02; M01/M03/M04.
Modificar BE `dominio/calculo-nutricional.ts`/spec e criar
`dominio/impacto-equivalencia-refeicao.ts`/spec. Nova política explícita
racional-v1, defaults legados intactos; saída materializada4 casas.

- [ ] RED: energia/proteína/carboidrato/gordura, normalização bases, alvo ausente,
  zero/zero, positivo/zero, residual não nulo formatado e refeição350→300.
- [ ] GREEN: porção efetiva determina nutrientes; principal e outros itens não mudam;
  resultados parciais por indicador; todas as fixtures legadas de macros/micros mantidas.
- [ ] Comando: Jest `calculo-nutricional impacto-equivalencia-refeicao resumo-nutricional-plano`.

### T04 — resolução/autorização e prévia sem escrita

Dep: T03; D02/D05/D10/D12/M01/M06.
Criar BE `aplicacao/servico-equivalencias-plano.ts`/spec e
`aplicacao/fatos-equivalencia-plano.ts`/spec; integração interna com
`servico-planos-alimentares.ts`, `fontes-grupos-substituicoes.ts`, módulo existente.
Não registrar rota liberada na PR A. Extrair somente resolvers necessários,
sem tornar métodos privados em API pública não autorizada.

- [ ] RED: tenant/carteira/fonte privada/direito inválido, transferência/revogação,
  preparo/IDs distintos, fonte alterada e lote parcialmente indisponível.
- [ ] GREEN: mesmo serviço individual/grupo; documento não salvo resolvido em memória,
  nenhum repository.save/INSERT/auditoria clínica de preview, nenhuma mutação no objeto original.
- [ ] Comando: Jest `servico-equivalencias-plano fatos-equivalencia-plano fontes-grupos-substituicoes`.

### T05 — medidas e política de porções

Dep: T04; M02/M05/M08.
Modificar BE `dominio/medidas-caseiras.ts`/spec e
`aplicacao/servico-medidas-caseiras.ts`/spec somente para reutilização/read-only;
complementar `equivalencia-nutriente.ts`/spec com avisos versionados.

- [ ] RED: medida de outro alimento/preparo/tenant, revisão/inatividade para nova
  aplicação, nenhuma medida, ml sem conversão, quantidade arredondada incompatível.
- [ ] GREEN: g sempre presente, quantidade caseira aproximada não muda Qg;
  aplicar pela medida recalcula peso/resíduo. Avisos nas bordas10x/0,1x/passo,
  sem proibir porção válida, sem limiar clínico. Não clamp de0/fora dos limites.
- [ ] Comando: Jest `medidas-caseiras servico-medidas-caseiras equivalencia-nutriente`.

### T06 — envelope, save, publicação e revisão semântica

Dep: T05; M07/D03/D08/D09.
Criar BE `aplicacao/resolver-equivalencias-edicao.ts`/spec e
`aplicacao/snapshot-equivalencias.ts`/spec.
Modificar BE `dominio/edicao-plano.ts`/spec,
`aplicacao/snapshot-edicao-grupos.ts`/spec e `servico-planos-alimentares.ts`/spec
em subcommits separados (não um diff indiscriminado).

- [ ] RED: envelope interno no HTTP, fingerprint/porção adulterados, omissão/null,
  pai/versão/aplicação cruzados, comando consumido versus referência no ACK,
  recálculo com UUID novo/anterior esperado, tombstone/desvinculação sem ressurreição,
  incompletude de rascunho, duplicidade/replay,
  falha de materialização, mudança semântica/visual e nova publicação pendente.
- [ ] GREEN: read1/2/3, writer3, CAS/transação inteira, snapshots antigos imutáveis,
  novo cálculo autorizado, manual distinguível, revisão pendente preserva porção,
  resolução explícita recalcular/desvincular; revisão/publicação conforme plano.
- [ ] Comando: Jest `snapshot-edicao-grupos snapshot-equivalencias resolver-equivalencias-edicao servico-planos-alimentares edicao-plano`.

### T07 — cópias e projeções sem vazamento

Dep: T06; D08/D09/M07.
Modificar BE `aplicacao/origens-grupos-materializadas.ts`,
`aplicacao/projecao-composicao.ts`/spec, caminhos de clonar/cópia/modelos em
`servico-planos-alimentares.ts` e `servico-modelos-plano-alimentar.ts`/specs.
Adicionar `projecao-equivalencias-profissional.ts`/spec.

Checkpoint parcial: a projeção profissional de versão inclui `equivalenciaAplicada`
e as chaves editoriais estáveis, nunca um contexto de cálculo como capability.
Copiar refeição salva ou plano salvo envia referências de origem/destino; o backend
revalida profissional, paciente, plano e versão dentro da transação, lê contexto
cifrado (ou snapshot materializado publicado), remapeia identidades e marca a nova
aplicação para revisão. A UI não confirma essa intenção até ACK e remove o envelope
de transporte ao reconciliar o salvamento. Duplicação local sem referência verificada
continua falhando fechada.

Persistir/aplicar equivalência em modelo permanece bloqueado: modelos são compartilhados
na clínica e não podem expor IDs de paciente de origem aos demais profissionais; o
fluxo atual devolve refeições ao browser antes de salvar o plano. Exige aplicação
server-side com autorização de modelo e da origem, sem retornar o contexto cifrado.
Não remover esse bloqueio nem marcar T07 completo antes desse contrato e testes.

- [ ] RED/GREEN: projeção profissional mantém chaves/referências fora do portal/PDF;
  cópia de rascunho/publicação, autorização atual, remapeamento e revisão pendente
  têm testes focados. As suítes já existentes de projeção/portal devem continuar.
- [ ] RED/GREEN: aplicação por modelo executa inteiramente server-side, verifica
  acesso ao modelo e origem, remapeia chaves e nunca devolve IDs/contexts da origem
  clínica ao navegador; sem esse contrato, manter bloqueio explícito.
- [ ] Comando: Jest `projecao-composicao projecao-equivalencias-profissional servico-modelos-plano-alimentar servico-planos-alimentares`.

### T08 — preferências pessoais e migration mínima

Dep: T06; M08.
Criar BE `dominio/preferencias-equivalencia.ts`/spec,
`aplicacao/servico-preferencias-equivalencia.ts`/spec e DTO.
Modificar `profissionais/infraestrutura/profissional.orm.ts`.
Criar futura migration1079/spec (reconfirmar numeração) e registrar em
`infraestrutura/banco-dados/opcoes-typeorm.ts`; nenhum arquivo1078 alterado.

- [ ] RED: outro profissional/tenant, JSON arbitrário, casas/passo inválidos,
  atualização concorrente com mesma revisão, role runtime com DDL/owner.
- [ ] GREEN: defaults/CAS/config por profissional, só apresentação em JSON fechado,
  nenhuma PHI;2 colunas e schema aditivo, reader compatível, rollback não destrutivo.
- [ ] Comando: Jest `preferencias-equivalencia opcoes-typeorm`; typecheck/build.

**C1 — checkpoint A:** G01/G02 focados PASS, nenhuma superfície FOOD05 liberada
sem autorização; M01–M08 ainda não são entrega funcional.

## PR B — API e experiência integrada

### T09 — controladores/BFF e contrato de sessão

Dep: T04/T07/T08 e checkpoint A.
Criar BE `apresentacao/controlador-equivalencias-plano.ts`/spec e controlador
pessoal de preferências (registro explícito no módulo existente).
Criar FE `app/api/pacientes/[id]/planos-alimentares/[planoId]/equivalencias/previa/route.ts`
e BFF de preferências pessoais sob `app/api/profissionais/me/preferencias-equivalencia/route.ts`.
A família atual usa `/api/pacientes/:pacienteId/planos-alimentares`
(`lib/plano-alimentar-api.ts:521`); manter essa convenção sem novos aliases.
Criar FE `lib/equivalencias-plano-api.ts`, tipos e script `test-equivalencias-plano-bff.mjs`.

- [ ] RED: ausência de sessão, papel/permissão, erro interno/PII, excesso de body,
  cache, cancelamento, userId/profissionalId escolhidos no corpo.
- [ ] GREEN: wrappers BFF atuais/no-store,401/403/404/409/413 estáveis, DTO mínimo;
  endpoint “me” resolve próprio vínculo, não herda permissão de gerenciar terceiros.
- [ ] Comando: `pnpm --dir octaclin-web test:authz`; script novo registrado no gate;
  Jest `controlador-equivalencias` e matriz de rotas/decorators.

### T10 — painel comparativo e preferências

Dep: T09; M01–M06/M08.
Criar FE `components/pacientes/comparacao-equivalencias.tsx`,
`components/pacientes/preferencias-equivalencia.tsx`,
`lib/usar-previa-equivalencias.ts`; componentes UI/modal/campos existentes.

- [ ] RED: resposta antiga após novo alvo/porção, cancelamento, estado ausente,
  residual oculto por arredondamento, equivalência0/0, viewport/teclado.
- [ ] GREEN: mesmo painel20 linhas,4 nutrientes visíveis, antes/depois por cenário,
  seleção/porção, preferência pessoal persistida, erro por item, nenhuma soma de alternativas.
- [ ] Comando: typecheck/lint e futuro Playwright `tests/visual/food05-equivalencias.spec.mjs`
  desktop/mobile com mocks sintéticos e axe.

### T11 — integração individual e coordenação editorial

Dep: T10; D02/D03/D09/M06.
Modificar FE `components/pacientes/plano-alimentar-profissional.tsx`,
`lib/edicao-plano.ts`, `lib/plano-alimentar-api.ts` somente nos tipos/callbacks
necessários; novo helper `lib/aplicacao-equivalencias-plano.ts`/spec.

- [ ] RED: Cancelar aguardando ACK, transferência de posse, troca paciente,
  autosave com dirty anterior, falha de save, capacidade20/96KiB e duplicata.
- [ ] GREEN: aplicação única selecionada, flags falsas para novas, não muda
  principal/ordem/existentes, autosave60s e espera ACK legítimo; desfazer local seguro.
- [ ] Comando: testes de aplicação, `test:proteger-alteracoes-nao-salvas`,
  Playwright FOOD05+PA07 (duas abas/“Editar nesta aba”).

### T12 — FOOD04, grupos e recálculo seletivo

Dep: T11; todas M01–M07 no segundo contexto.
Modificar FE `components/pacientes/aplicar-grupo-substituicoes.tsx`,
`lib/aplicacao-grupo-substituicoes.ts`, tipos de grupos/projeção autorizada;
reutilizar painel/API T10, sem novo motor.

- [ ] RED: grupo pessoal/clinica duplicado/arquivado, alimento principal incluído,
  porção divergente, nova composição inesperada, resposta tardia grupoA→B.
- [ ] GREEN: biblioteca intacta, origem/revisão preservada, cálculo só selecionadas,
  diferenças permitem decisão explícita; recálculo mantém preferências/liberações
  existentes legítimas e novas seguem não liberadas. Manual não vira FOOD05 ocultamente.
- [ ] Comando: `test:grupos-substituicoes:aplicacao`, FOOD04 Playwright+FOOD05 grupos.

### T13 — revisão pendente e histórico reproduzível

Dep: T12; M07/M08.
Adicionar componente FE `revisao-equivalencia.tsx`, detalhes do cálculo,
projeção do histórico e serialização tipada do editor; sem contexto no portal/PDF.

- [ ] RED: mudança porção/identidade/base/fatos/passo efetivo/medida, edição manual,
  renomear/ordenar/casas visuais, preferências alteradas depois do cálculo.
- [ ] GREEN: selo só para FOOD05, revisão pendente não muda quantidade, recálculo
  selecionado ou conversão explícita para manual; versão histórica reproduz com
  parâmetros originais; publicação não simula aceite anterior.
- [ ] Comando: focados T06/T07+Playwright estados/reabertura/publicação/modelos.

### T14 — integração PostgreSQL/RLS e concorrência reais

Dep: T08/T13; R4.
Criar BE `aplicacao/equivalencias-plano.integracao.spec.ts` e migration1079
integração; registrar no runner `scripts/test-rls-testcontainers.mjs` existente.

- [ ] RED: A/B, runtime não-owner/NOBYPASSRLS, prefs de outro usuário, arquivo/revogação/
  transferência entre prévia/save, corrida CAS/fonte/recalcular/mesmo aplicacaoId,
  rollback se um selecionado falha; nenhum filho/contexto parcialmente persistido.
- [ ] GREEN: SQL real e múltiplas conexões quando provar concorrência; constraints e
  autorizadores reais, não só mocks; fixtures sintéticas, nenhum staging/produção.
- [ ] Comando: runner PostgreSQL/Testcontainers + suite específica com flag registrada;
  documentar imagem/major/role/contagens/skips. Não confundir CAS sequencial com corrida real.

**C2 — checkpoint B:** M01–M08 funcionais nos dois contextos e G01–G04
proporcionais PASS; a feature ainda aguarda regressão/revisão/CI e operação.

## PR C — fechamento sem retirada de escopo

### T15 — regressões e limites de compatibilidade

Dep: T14.
Expandir specs dos motores/projeções/serviços/BFF e Playwright existentes,
sem alterar comportamento das fases anteriores para fazer o teste passar.

- [ ] PASS PA02–PA07 e FOOD01–04, totais/combinado, plano/refeição ON/OFF,
  escolhas do paciente, portal/PDF, cópia/modelo, snapshot legado/cipher corrompido,
  histórico publicado sem fonte ativa e clientes antigos/omissão/null.
- [ ] Comandos: suite backend `pnpm --dir octaclin-backend test --runInBand`,
  `test:authz`, `test:copia-refeicoes`, `test:calculo-combinado-planos`,
  `test:nutricao-plano`, `test:grupos-substituicoes:aplicacao` e visuais focados.

### T16 — acessibilidade, segurança e revisão cruzada

Dep: T15.
Completar `tests/visual/food05-equivalencias.spec.mjs` e matriz a11y/rotas,
revisão focada do diff por revisor distinto; registrar autoria e limitações.

- [ ] PASS teclado/foco/mobile/desktop/leitor de tela/aria-live/Axe e erro de
  rede, autorização negativa, tamanho/DoS, vazamento em projections/logs/caches.
- [ ] Achados com reprodução RED/correção/GREEN e reavaliação do delta; não aceitar
  “revisão independente” do próprio autor. Nenhum R4 confirmado aberto sem decisão.

### T17 — documentação, gates e checklist M01–M08

Dep: T16.
Atualizar plano/checklist/handoff/roadmap, políticas/métodos/versionamento e
runbook de migration apenas quando o procedimento real existir.

- [ ] Registrar PASS/FAIL/BLOCKED/SKIPPED, artefatos/seed/hash/comandos, todas M01–M08
  com evidência; distinguir matemática, entrega funcional, staging e produção.
- [ ] `git diff --check`, secret scan, links/documentos sem contratos contraditórios.

### T18 — CI final e preparação operacional

Dep: T17; G05/G06.

- [ ] HEAD exato: Backend/PostgreSQL/RLS, Web/BFF, Demo smoke, governança e scanners
  aplicáveis PASS; skips explicados. Executar novamente após correções relevantes.
- [ ] Preparar rollout mínimo/rollback compatível; FOOD04 quota/1078/saúde precisa
  ser regularizada com autorização específica, nunca inferida de merge/CI.
- [ ] Migration1079, deploy/ativação e dados reais continuam sujeitos às autorizações
  operacionais. Não executar para “fechar checklist” sem autorização.
- [ ] Entrega funcional FOOD05 só aceita com todas M01–M08 e dois contextos prontos;
  prontidão de produção depende de G06 mesmo se código/CI estiverem completos.

## Estado desta rodada

| Verificação | Resultado |
| --- | --- |
| Leitura de código/contratos e base main | PASS documental |
| Rastreamento D01–D14/M01–M08/T01–T18 e links locais | PASS documental; revisão cruzada incorporada |
| Referências específicas e licenças | Registradas no documento de referências |
| Novos testes/motor/UI/BFF/migration | NOT RUN / não implementados |
| Banco/infra/provedor/deploy nesta rodada | NOT RUN / não autorizados |
| FOOD04 produção | BLOCKED no último registro; não reconsultada |
| Autorização de executar T01–T18 | PENDENTE após revisão deste planejamento |

## Estado de execução — checkpoint de 2026-10-24

Esta tabela supersede apenas os estados “NOT RUN / não implementados” acima; os
requisitos e critérios T01–T18 permanecem vigentes.

| Tarefa/área | Estado observado | Limite atual |
| --- | --- | --- |
| T06 motor, snapshot e resolução de equivalência | Implementação técnica exercitada em suites focadas e CI | Cópias com proveniência e fechamento dos critérios integrados permanecem pendentes |
| T07 cópias/modelos com proveniência | BLOCKED | UI recusa a conversão silenciosa; contratos atuais de cópia não transportam proveniência com segurança |
| T10–T13 interface, FOOD04, revisão e histórico | Parcialmente implementados; Playwright FOOD05/PA07 18/18 em desktop e mobile no HEAD local atual | T10 ainda carece de toda a matriz de limites/teclado/reflow; há bloqueios deliberados para cópias; não considerar M01–M08 fechadas |
| T14 PostgreSQL/RLS e concorrência real | Parcial: PostgreSQL/migrations, Redis/idempotência e RLS executados com PASS no GitHub CI | Não equivale à matriz integral de concorrência/aceitação T14; Testcontainers local continua indisponível |
| T15–T18 regressões, R4, documentação e CI final | Run GitHub `40124900107` e PR Gate concluídos PASS no HEAD `bb513d1d`; smoke global e scanners PASS | R4 independente e fechamento integral dos critérios continuam pendentes |
| G01–G05 e prontidão clínica/operacional | Não PASS | Ver [execução FOOD05](execucao-pos-320-food05.md) para evidências locais e bloqueios |

Playwright focalizado FOOD05/PA07: 14/14 desktop e 14/14 mobile PASS; typecheck Web,
build Web webpack e testes puros de cópia 14/14 PASS. O run GitHub `40124900107` no
HEAD `bb513d1d` e o PR Gate concluíram PASS, incluindo Backend/PostgreSQL/RLS, Web,
Mobile, AI, Demo local smoke, governança e scanners. Esses resultados não substituem
R4 independente nem demonstram prontidão de produção.

## Atualização do checkpoint — 2026-10-25

Este registro atualiza somente as evidências recentes; não fecha T10 nem gates:

- HEAD enviado anteriormente: `76f266c7921332fe85cc8ce9e439a9658a8d3634`, PR #446
  continua Draft. Nesse HEAD, Dependency Review e Semgrep passaram; OctaClin CI,
  CodeQL e Trivy ainda estavam em andamento na última consulta.
- Teste de regressão enviado no commit `7dacf56b`: resposta de prévia anterior é
  descartada quando o alvo muda de energia para proteínas durante uma requisição
  pendente. Bateria Playwright FOOD05/cópia FOOD05: 20/20 PASS, 10 cenários por
  navegador desktop e mobile, com mocks sintéticos. O teste foi fortalecido localmente
  para o servidor entregar a resposta apesar do cancelamento: sem a guarda de geração,
  reproduziu RED; com a guarda restaurada, passou desktop 1/1 e mobile 1/1. A repetição
  integral posterior também passou 20/20 (10 por projeto).
- Checks GitHub para `7dacf56b`: Dependency Review, Semgrep, CodeQL PASS; OctaClin CI
  e Trivy seguem em andamento. Uma atualização documental posterior exigirá checks
  do HEAD seguinte antes de usar os resultados como gate final.
  Revisão R4 independente, T10 integral, T14/T15/T16 completos e demais critérios
  seguem pendentes; não promover a PR nem habilitar uso assistencial.

### Continuação — acessibilidade do comparativo (worktree após `b33ab6e8`)

- Run GitHub `40157902718` no HEAD `b33ab6e8`: OctaClin CI, Demo local smoke, Backend,
  PostgreSQL/RLS, Web build, Mobile, governança, PR Gate e scanners terminaram PASS.
- Mudança local ainda não enviada: a região rolável da tabela recebeu nome acessível
  e foco por teclado. O teste reproduziu RED antes do ajuste e passou 1/1 desktop e
  1/1 mobile; Axe, ESLint focal e `git diff --check` passaram depois do ajuste.
- Também foi coberta a fronteira do DTO: 20 alternativas aceitas, 21 e duplicadas
  rejeitadas (Jest focal 23/23 PASS).
- A interface recebeu cenário de lote máximo: 20 linhas renderizadas, seleção
  parcial provada, Playwright focal completo 22/22 PASS (11 desktop, 11 mobile).
- T10 continua parcial. O próximo commit precisará de CI no HEAD exato; demais
  critérios FOOD05 e R4 seguem abertos.
