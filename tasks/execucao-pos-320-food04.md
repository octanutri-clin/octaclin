# FOOD04 — ledger de execução técnica

Branch `docs/pos320-food04-planning`, base main `9e1984a2`.
Planejamento: commits `059c6bd9` e `6ede1beb`. Desenvolvimento autorizado pelo
proprietário em “Pode seguir”, após apresentação da especificação ampliada.
Checkpoint backend/BFF commit `78e7ee61`; UI T11–T12 em implementação no
checkpoint Luna. Uma PR funcional, ainda não aberta neste checkpoint.

## Ambiente e limites

- Node22.23.4 oficial extraído em `/tmp/food04-tools`, SHA256 confrontado com
  SHASUMS256 da mesma distribuição. pnpm11.25.0 instalado somente em `/tmp`.
- Dependências backend reaproveitadas por symlink do checkout FOOD03, evitando
  nova instalação com disco restrito. Nenhum lockfile/dependência do produto alterado.
- PostgreSQL15-alpine já disponível no Docker; Testcontainers cria e remove
  instância descartável `food04_test`. Sem acesso a bancos externos/pacientes.
- Checkout principal/next-env.d.ts preexistente preservado. Sem migration externa,
  configuração, merge, deploy ou ativação operacional.

## RED/GREEN e provas observadas

- Domínio de grupo: stub executável produziu10 FAIL/2 PASS; implementação inicial
 12 PASS. Três bordas adicionais (troca de identidade mantendo autorização antiga,
  porção física igual com unidade diferente e duplicata dentro do grupo) depois
  produziram3 FAIL/18 PASS; corrigidas. Suítes domínio/aplicação/biblioteca
  posteriormente30 PASS, sem skips nessas três suítes.
- DTO/migration:4 FAIL/1 PASS antes da implementação e registro;5 PASS depois.
- Fontes/capacidades:5 FAIL/9 PASS antes de implementar; fontes e regressão
  FOOD02 passaram depois. Leitor canônico custom extraído para evitar duplicação.
- Serviço da biblioteca:8 FAIL antes do código;8 PASS depois. Nova prova da
  primeira aplicação ficou RED por método inexistente e passou no ciclo seguinte.
- PostgreSQL real: primeira rodada3 PASS/1 FAIL (consulta ainda ausente);
  segunda rodada4 PASS. Prova role não-owner/NOBYPASSRLS, FORCE RLS, tenant
  ausente/incorreto, criações concorrentes com UUID em capitalizações diferentes,
  CAS, filtros, favoritos e duplicação concorrente. Fonte nesta suíte é sintética
  no limite do serviço; regras de fonte real têm unitários próprios.
- Controladores:2 FAIL antes das guardas/delegação;2 PASS depois.
- Aplicação/projeção:8 FAIL/3 PASS (intenção não reconhecida, resolver ausente,
  origem interna vazando em catálogo/manual);11 PASS após implementação inicial.
- Integração do save em fake de repositório:2 FAIL antes da integração;2 PASS
  depois (106 testes filtrados por `-t FOOD04`, NÃO executados). Canonicaliza
  composição e flags, guarda origem cifrada e preserva cópia salva sem consultar
  grupo arquivado; falha de nova aplicação não vira save pendente bem-sucedido.
- Publicação/nova versão/primeiro save: regressão custom inicialmente RED,
  corrigida com recuperação da origem do snapshot autorizado. Mesmo após arquivo
  da fonte/grupo, preserva composição/origem custom e proveniência sem reconsulta.
- BFF:4 FAIL/54 PASS antes dos handlers;58 PASS depois. Novo negativo de
  projeção administrativa ficou1 FAIL/58 PASS e depois59 PASS. Seletor de
  fontes administrativas ficou1 FAIL/59 PASS e depois60 PASS. Todos sintéticos.
- Última prova de favorito em detalhe:1 FAIL/3 PASS no PostgreSQL; correção
  seguida por4 PASS. Falhas de preparação por disco/metadata não são contadas
  como RED de comportamento.
- Regressão backend completa, antes da proteção adicional do PATCH legado:
  361 suítes e3230 testes PASS;8 suítes/142 testes SKIPPED condicionais. Esses
  skips não são provas de integração; comandos PostgreSQL explícitos abaixo.
- Typecheck backend e Web e lint Web focal passaram no checkpoint BFF.
  Nova rodada após o PATCH legado será registrada no fechamento deste checkpoint.
- Gate de redação inicialmente falhou por duas chaves novas de metadata; mínimo
  corrigido para usar `versao` existente e ação administrativa explícita.
  `node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/validar-redacao-auditoria.mjs`:
  PASS,209 chaves em202 call sites. Nenhum texto/composição registrado na auditoria.

## Implementado

- Domínio/DTOs, ORM grupos/favoritos, migration1078 aditiva registrada, CRUD,
  administração segregada, duplicação, filtros/HMAC, favorito e arquivo/restauração.
- Controladores e capacidades específicas sem prontuário ao Client. Consulta de
  fontes administrativa mínima não aceita custom pessoal e escapa curingas SQL.
- Resolver editorial seletivo/dedup/replay, intenção fechada e projeção factual
  que remove origem interna de catálogo/manual/custom.
- Save revalida grupo na mesma transação e guarda proveniência cifrada.
  Nova versão recupera origem autorizada, sem transformar UUID em capability.
- BFF/tipos/wrappers profissional/admin com allowlists, limites, no-store,
  autorização anterior ao corpo e projeção explícita. Mapa de rotas atualizado.
- Runner PostgreSQL do CI estendido para incluir a suíte/flag FOOD04.

## PostgreSQL clínico real e limites da prova

`pnpm --dir octaclin-backend test:food04:clinica-local` —3 PASS,64 testes
filtrados por `-t FOOD04`. Fontes custom/catálogo reais, save, snapshot cifrado,
arquivamento, transferência de carteira e lock save→arquivo. Dados sintéticos.
A consulta administrativa exclui pessoal; catálogo escapa `%`/`_` literal.

Runner reproduzível `octaclin-backend/scripts/prova-food04-clinica-local.cjs`:
exige `--descartavel`, cria/remove PostgreSQL15, usa role runtime sem bypass,
não aceita URL de banco externo. Para rodar no postgres-alpine disponível,
a preparação local omite somente extensões Timescale/pgvector e usa texto no
campo de embedding não utilizado. **Não prova a cadeia oficial com extensões**.
O runner oficial `test:rls:testcontainers`/CI continua gate final independente.
Containers com data dir em tmpfs para não agravar restrição de disco.

Prova separada da migration/biblioteca, sem adaptação da migration1078:
`FOOD04_RLS_TESTCONTAINERS=true ./node_modules/.bin/jest --runInBand src/infraestrutura/banco-dados/migracoes/1720000001078-GruposSubstituicoes.integracao.spec.ts`
(no backend) —4 PASS. Schema mínimo de pais sintéticos; fontes do grupo são
fakes apenas nessa suíte. As três provas clínicas acima cobrem fontes reais.

## Revisão própria e limites de rastreabilidade

Revisão própria não é independente. Proveniência é preservada na aplicação
original e em novas versões do plano. PA02/modelos copiam fatos e geram novas
identidades, sem transferir autoridade da aplicação; justificativa no plano.
Não declarar rastreabilidade de cópia entre pacientes por simples UUID do cliente.

Achado adicional: PATCH legado podia apagar origem de grupo. Teste RED com
snapshot editorial reproduziu a perda; a primeira proteção deixou aberto o
caso materializado sem documento, também reproduzido em RED. A correção exige
editor atualizado nesses casos e mantém o legado sem grupos funcionando.
Serviço completo após os dois casos:110 PASS. Novo achado de replay no primeiro
pedido:2 FAIL/8 PASS antes da correção; o resolvedor agora registra as ações
novas também durante o pedido. Domínio + serviço:120 PASS. Não houve necessidade
de nova migration para essas proteções.

PA02:12 testes PASS, incluindo duas provas de contrato existente que copiam
fatos/porções sem reutilizar a intenção da aplicação no novo pai. Nenhum runtime
de cópia foi alterado. Uma primeira fixture vazia foi corrigida antes da prova;
isso não é RED de vulnerabilidade.

## Gates em aberto e próxima ação

- O registro seguinte deste ledger atualiza o checkpoint antigo: T11–T12 já têm
  interface, helpers, build, regressões PA07 e dois fluxos FOOD04 em Playwright.
- Continuam pendentes regressões finais, revisão R4 independente, execução da
  cadeia PostgreSQL oficial com extensões e CI/scanners do HEAD completo.
- `nest build` padrão tentou escrever no workspace e falhou por ENOSPC. Uma
  compilação com o mesmo tsconfig e artefatos em `/tmp` é alternativa local;
  o backend já foi compilado em `/tmp`; o Web build também passou mais adiante
  com `.next` em `/tmp`. As duas limitações originais de espaço permanecem
  registradas junto aos resultados substitutos bem-sucedidos.
- Preflight PowerShell BLOCKED (ferramenta ausente); não inferir PASS.
- Sem PR, revisão independente, migration externa, merge, deploy ou ativação.

## Validações finais do checkpoint

- PASS: nova regressão completa após proteção do PATCH:361 suítes/3232 testes;
 8 suítes/142 testes SKIPPED condicionais. Após o ajuste adicional de replay,
 120 focados PASS e nova rodada integral PASS:361 suítes/3234 testes,
 8 suítes/142 testes SKIPPED condicionais no código corrigido.
- PASS: typecheck backend/Web (`tsc --noEmit --incremental false`), lint Web
 focal,60 BFF,12 cópia factual e24 testes de governança de guardas/migrations.
- PASS: compilação com `tsc -p tsconfig.build.json --outDir /tmp/food04-tools/backend-dist --incremental false`
 e verificação oficial `scripts/verificar-artefato-producao.mjs` com esse
 artefato em diretório temporário. Não substitui o registro do ENOSPC no comando
 padrão nem comprova build Web/CI.
- PASS: diff/secrets, matriz40, redação209 chaves/202 sites e links locais
 FOOD04. Fetch reconfirmou main9e1984a2. Nenhuma alteração em lockfile.
- PASS: `pnpm --dir octaclin-web test:authz`, 27 comandos concluídos
 com exit0; nenhum subteste falhou. Log temporário
  `/tmp/food04-tools/web-authz-final.log`. No checkpoint T10, antes da UI, os
  gates de navegador/build ainda estavam pendentes.

## Checkpoint T11–T12 — interface e integração do editor

- Biblioteca profissional em `BibliotecaGruposSubstituicoes`: pesquisa/categoria/
  etiqueta/escopo/estado/favoritos com paginação; formulário com entradas
  explícitas em gramas, até20 itens, descrição/categoria/etiquetas, busca nos
  catálogos permitidos e custom pessoal/clínica, ordem por botões acessíveis,
  edição, duplicação pessoal, promoção explícita a clínica, arquivamento e
  restauração. Grupos com fontes indisponíveis não são reconstruídos por cópia
  parcial: edição/duplicação ficam bloqueadas e a limitação é comunicada.
- Superfície administrativa reusa a mesma UI no portal Client e painel de
  Operações SuperAdmin, ambas condicionadas à capacidade `grupos_substituicoes.administrar`;
  endpoints e escopo efetivo continuam autoritativos no backend.
- Aplicação seletiva no item principal: prévia em diálogo inline, paginação e
  busca por grupo, seleção parcial, porções em gramas, principal omitido,
  duplicata exata bloqueada, porção divergente exige confirmação explícita e
  informação sem fonte não pode ser aplicada. Alternativas novas iniciam
  `preferida=false`/`liberadaParaPaciente=false`.
- O editor serializa/reidrata apenas a intenção fechada `origemGrupo` em cada
  alternativa, limpa a intenção ao mudar identidade da fonte e mantém composição
  canônica resolvida no backend. Aplicação pausa o autosave, aguarda envio em
  curso e revalida paciente/plano/rascunho/posse; confere o teto de20 alternativas
  e96KiB antes de alterar o formulário. Undo local remove apenas as novas linhas
  ainda inalteradas, no mesmo contexto/posse, e expira quando o autosave começa.
- TDD helper local: primeiro ciclo revelou inclusão indevida de candidato quando
  o principal tinha outra origem e ausência de confirmação da porção distinta;
  critérios corrigidos. A revisão também conferiu o validador real do domínio:
  ele rejeita alimento e porção duplicados. A UI agora explica e bloqueia a
  inclusão repetida com a porção padrão antes do request. O aviso pós-aplicação
  permanece visível até nova ação, sem timeout que pudesse ocultar a opção de
  desfazer. `test:grupos-substituicoes:aplicacao` agora4 PASS.
- TDD de interface detectou uma corrida adicional na troca/cancelamento de grupo:
  o teste de resposta tardia do grupo A depois de reabrir e selecionar B falhou
  antes da correção. O seletor agora fica bloqueado durante a leitura e Cancelar
  aborta/versiona o pedido pendente; a resposta antiga não muda B. RED reproduzido,
  GREEN em desktop e mobile.
- Revalidações executadas no worktree dedicado: Web `typecheck` PASS;
  `test:grupos-substituicoes:aplicacao`4 PASS; `test:copia-refeicoes`12 PASS;
  `test:nutricao-plano`67 PASS; `test:authz` exit0 em27 comandos, incluindo
  BFF FOOD04 (60 casos no script de planos alimentares) e demais regressões.
- ESLint focal exit0, sem erros. Nos arquivos do checkpoint UI, os componentes
  FOOD04 ficaram sem avisos; no conjunto ampliado aparecem avisos `react-hooks`
  existentes no editor/hooks e padrões assíncronos de carregamento via effect.
- ESLint global Web exit0 (0 erros,71 avisos durante a execução); um aviso do
  novo fixture E2E por variável de desestruturação não usada foi removido depois
  e a spec foi revalidada focalmente.
- Web `build` PASS com os artefatos `.next` temporariamente redirecionados a
  `/tmp/food04-tools/web-next` (o volume da worktree tinha 0 bytes livres). O
  Next emitiu os avisos já observados de depreciação do middleware e `process.cwd`
  na cadeia Edge; build terminou com exit0.
- Playwright: regressão completa `pa07-coordenacao-abas.spec.mjs`,54/54 PASS
  nos projetos desktop/mobile (PA07, FOOD01–04); os 12 casos FOOD04 cobrem
  criação, aplicação seletiva com desfazer antes do salvamento e bloqueio depois,
  resposta tardia/cancelamento, edição/arquivo/restauração, favorito/duplicação
  e compartilhamento confirmado. Em `portal-cliente.spec.mjs`, Client com e sem
  capacidade administrativa,4 PASS; em `acessibilidade.spec.mjs`, SuperAdmin
  com capacidade administrativa,2 PASS. Total documentado:60 testes únicos
  PASS, todos com respostas de API sintéticas interceptadas. No início,
  tentativas do teste novo falharam por expectativas incorretas do teste (porção
  é `1 porção` com 100g, e a proveniência enriquecida é materializada no backend);
  os critérios foram alinhados aos contratos, sem relaxar validações de produto.
- A primeira tentativa do Playwright usou Turbopack e bloqueou antes de iniciar
  testes devido ao symlink compartilhado de `node_modules` entre worktrees. Os
  testes executados passaram com configuração temporária fora do repositório
  que usa `next dev --webpack`; nenhuma configuração versionada foi alterada.
- Ainda falta rodar as regressões editoriais completas FOOD01–03 e PA02–PA07
  fora desta suíte, acessibilidade geral, backend completo, cadeia PostgreSQL do
  runner, C2/R4
  independente e CI.
- `git diff --check` PASS antes do commit `8c93fdd9`.
- Continuação T12/backend (2026-10-22): a regressão completa
  `pa07-coordenacao-abas.spec.mjs` passou 54/54 em desktop e mobile. Os testes de
  autorização Client/SuperAdmin passaram 6/6. ESLint dos specs alterados e
  `git diff --check` passaram. Testes unitários backend FOOD04 passaram 43/43;
  TypeScript backend passou ao redirecionar o arquivo incremental para `/tmp`,
  pois o comando padrão não conseguiu escrever `dist/tsconfig.tsbuildinfo` com o
  volume cheio. Web typecheck passou.
- PostgreSQL: `1720000001078-GruposSubstituicoes.integracao.spec.ts` passou 4/4
  em PostgreSQL 15 Testcontainers descartável; `test:food04:clinica-local` passou
  3 verificações FOOD04 de RLS, com 64 casos não aplicáveis pulados por filtro.
  O runner agregado `test:rls:testcontainers` não concluiu PASS: falhou no
  conjunto legado da Fase 317 por não encontrar `timescale/timescaledb-ha:pg15`;
  o processo foi interrompido após esse erro e a prova FOOD04 foi executada
  separadamente. Não atribuir esse resultado a um defeito FOOD04, mas manter C2
  bloqueado até o runner/CI integral passar.
- O teste de aplicação FOOD04 foi reexecutado em desktop/mobile (2/2 PASS) com
  a resposta de salvamento pausada: o botão de undo já fica desabilitado durante
  a gravação e continua bloqueado depois da confirmação.
- A superfície compartilhada do SuperAdmin passou Axe (WCAG 2.1 AA) e Playwright
  em desktop/mobile (2/2), sem violações no painel testado.
- Recorte Playwright `acessibilidade.spec.mjs --grep "operacoes|FOOD04"`:38/38
  PASS em desktop/mobile, incluindo áreas de operações, navegação por teclado,
  autorização SuperAdmin e tabs ARIA. A suíte a11y completa (276 casos) não foi
  executada; não declarar a11y global PASS.
- Regressões Web adicionais: `test:nutricao-plano` 67/67,
  `test:calculo-combinado-planos` 4/4, `test:copia-refeicoes` 12/12,
  `test-grupos-substituicoes-aplicacao.mjs` 4/4 e `test-fase-314-bff.mjs` 1/1.
  Não foi executado o `test:authz` agregado inteiro nesta continuação.
- T11/T12 permanecem PARCIAIS: criação, edição/arquivo/restauração, favorito,
  duplicação pessoal, compartilhamento confirmado e aplicação têm provas visuais;
  testes Client/SuperAdmin
  confirmam autorização para a superfície compartilhada e ausência de criação
  pessoal por administradores; aplicação pode ser desfeita e reaplicada no
  rascunho antes de salvar, e o undo fica bloqueado após salvar; faltam corridas
  FOOD04 adicionais,
  regressões PA02–PA07/FOOD01–03 completas, acessibilidade geral e revisão R4
  independente. Não afirmar C3 PASS nem criar PR até fechar.

## Continuação dos gates de autorização — 2026-10-22

- Reexecutei `pnpm --dir octaclin-web test:authz` com a suíte iniciada no
  ambiente Node 24 do runner (apesar de Node 22 estar disponível no `PATH`, o
  pnpm global manteve seu runtime próprio; os scripts TypeScript filhos usaram
  Node 22). Os dez primeiros scripts em sequência passaram integralmente:
  correlação BFF (57), origem do backend (9), autorização de rotas (30), sessões
  (9), integrações profissionais (9), pacientes Fase 254 (3), agendamento
  público (9), revisão de questionários (5), dashboard clínico (5) e timeline do
  prontuário (4). O próximo script emitiu quatro casos TAP verdes, mas a cadeia
  foi cancelada antes de seu término e antes dos demais comandos. Portanto, o
  agregado `test:authz` desta execução é INCOMPLETO, não PASS.
- O motivo para interromper foi o custo de recompilar cada subconjunto do Web
  (cerca de um minuto por script) e a duração projetada do agregado completo.
  Nenhum arquivo da worktree foi alterado pelo teste. O resultado anterior de
  `test:authz` com exit 0 em 27 comandos permanece registrado no checkpoint de
  implementação, mas não substitui uma execução integral do HEAD atual.
- A execução usou somente respostas sintéticas. Logs `headers() indisponível`
  ocorreram nos casos negativos que exercitam chamadas fora de uma requisição e
  não fizeram os scripts falhar.
- O agregado de autorização do HEAD continua pendente; os testes focados FOOD04,
  backend, BFF, Playwright, PostgreSQL descartável e regressões citados acima
  mantêm seus resultados individuais. C3 e a entrega permanecem parciais.
- T12 recebeu cobertura adicional para perda de posse enquanto a prévia de
  grupo está aberta: `pa07-coordenacao-abas.spec.mjs --grep='FOOD04 perda de
  posse com prévia aberta' --project=desktop-chromium --project=mobile-chromium`
  passou 2/2 com fixtures sintéticas. A confirmação desabilita após
  `pagehide/pageshow` e a alternativa não entra no rascunho. Não houve alteração
  de runtime; a execução modificou apenas o `next-env.d.ts` gerado pelo Next,
  que foi restaurado. `git diff --check` passou depois da restauração.
- Repeti a spec completa `pa07-coordenacao-abas.spec.mjs` nos projetos
  desktop/mobile: 56/56 PASS em 9,8 min, cobrindo os fluxos PA07 e FOOD01–04.
  Todos os dados são fixtures sintéticas interceptadas. `next-env.d.ts` foi
  novamente restaurado após a execução; a spec passou ESLint focal.

Checkpoint UI commitado em `6cee690c`; a branch permanece aberta para completar
T11–T14. A fase não está concluída: regressões restantes, revisão R4, CI e PR
seguem pendentes.

## Regressão PA02–PA06 e sincronização da fixture — 2026-10-22

- A execução desktop/mobile da `pa02-copia-refeicoes.spec.mjs` revelou uma
  corrida nos testes: interações começavam antes da reconferência de posse de
  edição entre abas. A fixture agora aguarda o campo editável ficar habilitado;
  também clica no controle de expandir refeições, deixando a cobertura de
  teclado no teste dedicado. No caso que usa relógio controlado, a fixture
  avança a hidratação após reload e aguarda o cabeçalho do plano.
- O resultado completo após os ajustes foi 47/48. O único caso restante parou
  com a tela ainda em “Carregando prontuário do paciente”, antes de renderizar o
  editor ou iniciar o fluxo de revogação da origem. O mesmo cenário, repetido
  isoladamente em mobile, passou 1/1; os cinco cenários que haviam oscilado na
  primeira tentativa passaram em rerun focal 10/10, e quatro cenários focais
  passaram 8/8 após a espera explícita pela posse. Portanto, não registrar a
  suíte integral como PASS; há um sinal de instabilidade no carregamento da
  fixture que precisa ser reavaliado.
- ESLint da spec e `git diff --check` passaram. O diff desta continuação é
  somente teste; `next-env.d.ts` gerado pelo Next foi restaurado. Sem alteração
  no runtime.
- T11–T12/C3 continuam parciais: além desta execução inconclusiva, permanecem
  pendentes revisão R4 independente, acessibilidade global e regressões
  restantes. Nenhuma PR foi aberta.

## Retomada em ambiente reiniciado — 2026-10-23

- O ambiente novo não preservou `/tmp/food04-tools` e iniciou em Node 24, fora
  da faixa do `package.json`. Baixei Node 22.23.4 para `/tmp` e usei um `.next`
  temporário em `/tmp`; nenhum runtime, dependência ou migration do repositório
  foi alterado.
- Com Node 24, uma tentativa da spec completa fechou 46/48, mas não é evidência
  válida para o projeto por incompatibilidade de runtime. Com Node 22, a spec
  PA02 isolada chegou a permanecer em leitura: `Objetivo clínico` ficou
  desabilitado após 30 s enquanto a tela aguardava planos. No PA07 isolado, a
  segunda aba exibiu “A edição está em outra aba” e o botão de retomada, porém
  o clique não foi acionado pelo Playwright no executor reiniciado. Os
  snapshots e traces estão em `/tmp/food04-rerun2/output` para diagnóstico
  reproduzível enquanto esse ambiente existir.
- Um rerun anterior em ambiente aquecido aprovou o cenário de navegação PA02
  (1/1) e os dois cenários que haviam falhado no ciclo precedente (2/2), mas a
  reprodução em Node 22 recém-inicializado não foi consistente. Logo, não
  afirmar regressão integral PA02/PA07 PASS para a revisão atual; investigar a
  interação Web Locks/BroadcastChannel com o lifecycle de navegação e repetir
  em um runner estável.
- Aumentei no teste PA02 o limite de aquisição/espera e sincronizei a
  navegação pela lista; são alterações locais ainda não commitadas. A fixture
  também usa ativação por teclado para abrir as refeições. ESLint e `diff
  --check` devem ser repetidos antes de eventual commit. Não alterei runtime e
  não abri PR.

## Diagnóstico cold runner de coordenação — 2026-10-23

- Reproduzi em Node22.23.4 duas falhas focais sob `next dev --webpack`: a
  segunda aba não estabilizava em consulta e o teste de aquisição não encontrava
  “Editar nesta aba”. Instrumentação temporária mostrou reexecuções do hook em
  ambas as páginas com a mesma chave Web Locks durante a compilação/HMR; não
  houve `pagehide` ou `visibilitychange`. Os logs de diagnóstico foram
  removidos e o runtime não foi alterado.
- Com `next build --webpack` concluído e `next start` sem HMR, passaram em Node22
  os casos focais PA07 consulta/retomada (1/1), aquisição com leitura pendente
  (1/1) e PA02 descarte de resposta obsoleta após troca de paciente (1/1).
  O build de produção local compilou com os avisos existentes de Edge Runtime
  e middleware. Isso identifica a oscilação como específica do runner de
  desenvolvimento frio neste executor; não substitui a regressão integral.
- Nos testes PA07, a instalação do relógio controlado foi movida para depois
  da inicialização e confirmação explícita do estado em consulta. Isso impede
  que relógios falsos cubram a inicialização da coordenação; nada muda no
  runtime do produto. A suíte completa PA02 passou depois, abaixo; PA04–PA06 e
  integração PA02–PA07/FOOD01–03 ainda precisam da regressão consolidada.
- O `next-env.d.ts` gerado foi restaurado; `.next` voltou ao symlink baseline
  `/tmp/food04-tools/web-next`. Não houve consulta ou alteração externa,
  migration, dependência, merge ou deploy.
- Reexecutadas as suítes completas em servidor `next start` com fixtures
  sintéticas: `pa07-coordenacao-abas.spec.mjs` 56/56 (desktop/mobile) e
  `pa02-copia-refeicoes.spec.mjs` 48/48 (desktop/mobile). A build usada para
  esse diagnóstico continha apenas `console.log` temporários no hook, sem
  mudança de fluxo; eles foram removidos antes de encerrar. A especificação
  PA07 também foi ajustada para instalar relógio falso somente depois de o
  estado de consulta estar visível. ESLint focal e `git diff --check` passaram.
- O cold `next dev` continua classificado como harness não estável neste
  executor; testes focais e as duas suites completas passaram em `next start`.
  Não extrapolar isso para PA04/lista, a11y global, R4, authz agregado, CI ou
  regressões FOOD01–03 consolidadas no HEAD final.
- Em `next start`, as specs visuais `fase-320-pa05-apresentacao.spec.mjs`,
  `fase-320-pa06-ativacao.spec.mjs` e `pa06-calculo-combinado.spec.mjs`
  passaram 40/40 desktop/mobile. Não encontrei spec visual com o rótulo PA04;
  sua cobertura específica de lista continua sem prova nomeada nesta rodada.

## Fechamento do agregado de autorização — 2026-10-23

- `PATH="/tmp/node-v22-runtime/bin:$PATH" pnpm --dir octaclin-web test:authz`
  terminou com exit 0: os 27 comandos do agregado passaram no HEAD atual. A
  suíte inclui os testes BFF/autorização de FOOD04 no script de planos
  alimentares (60/60), além das regressões de planos, documentos, exames,
  operação, notificações e Fases 311–318. Os subtestes executados reportaram
  zero falhas; o resumo por comando está no log temporário
  `/tmp/food04-tools/web-authz-final.log`.
- O launcher global `pnpm` reportou aviso de engine por iniciar sob Node 24,
  embora os scripts tenham sido executados com Node 22 via `PATH`. Portanto,
  o resultado comprova o agregado concluído neste executor, mas não substitui
  o job canônico de CI nem validação de engine do pipeline.
- T10 passa pelos testes locais do agregado. R4 independente, CI/scanners,
  cobertura nomeada de PA04/lista e os demais gates de T13–T14 seguem
  pendentes; este resultado não autoriza merge ou operação externa.
- Também passaram `test-grupos-substituicoes-aplicacao.mjs` (4/4), o contrato
  operacional do BFF (10/10), `pnpm --dir octaclin-web typecheck` e
  `git diff --check`. A aplicação de grupo foi verificada em regras de
  seleção/duplicata/porção; typecheck não altera o bloqueio de R4 independente.
- Reexecução `pnpm --dir octaclin-backend test:rls:testcontainers` terminou
  FAIL depois de 293,6 s: 4 testes FOOD04 (`1720000001078`) passaram em
  PostgreSQL descartável; 99 testes de duas suítes legadas falharam durante o
  setup, antes dos cenários, porque a imagem
  `timescale/timescaledb-ha:pg15` não existe localmente e o runner não a
  conseguiu obter. Resultado agregado não é PASS; o teste FOOD04 isolado é
  PASS. Não foi criado container persistente nem tocado ambiente externo.
- A prova PA04 `lista totais salvos das versões e pagina sem carregar versões
  por card`, em servidor `next start` local com fixtures sintéticas, passou
  2/2 (desktop/mobile). A primeira tentativa usou host `127.0.0.1`, incompatível
  com os cookies sintéticos host-only de `localhost`, e falhou antes da lista;
  a repetição com `E2E_WEB_URL=http://localhost:3000` passou. Artefatos ficaram
  em `/tmp/food04-diag/pa04-output`; symlink `.next` restaurado ao alvo
  baseline `/tmp/food04-tools/web-next` e nenhum `test-results` foi criado no
  workspace.

## Correção focada de segurança da biblioteca — 2026-10-24

- A revisão local identificou que a seleção de outro grupo enquanto o editor
  estava aberto podia trocar o alvo usado pelo `PATCH`, embora o formulário
  ainda contivesse dados do grupo anterior. Confirmações pendentes também
  sobreviviam à troca de seleção. A revisão foi manual e não independente.
- Antes da correção, dois testes Playwright sintéticos falharam em desktop e
  mobile: o PATCH do conteúdo editado apontava para o outro grupo; a confirmação
  de compartilhamento continuava visível ao abrir outro grupo. A evidência RED
  está nos resultados locais temporários `/tmp/food04-fix-test/test-results`.
- A correção captura ID e revisão do grupo ao iniciar edição/duplicação e usa
  esse contexto imutável no save; bloqueia abertura/favorito/criação enquanto o
  editor está ativo; invalida detalhes pendentes e limpa confirmações ao mudar
  ou fechar a seleção. Cancelar limpa o alvo e a chave de idempotência.
- Os dois testes novos passaram em desktop e mobile (4/4). A suíte FOOD04
  Playwright completa passou em 17 cenários; o cenário de criação teve timeout
  do axe no primeiro agregado e passou isolado na repetição (1/1). Portanto,
  todos os 18 resultados por viewport foram aprovados nas tentativas finais;
  registrar o timeout inicial como transiente do executor, sem ocultá-lo.
- ESLint dos dois arquivos alterados, typecheck, `test:planos-alimentares:bff`
  (60/60), `test:grupos-substituicoes:aplicacao` (4/4), `security:secrets` e
  `git diff --check` passaram. Os comandos usaram Node 24.19.0, fora da faixa
  declarada do frontend (22.x); o typecheck concluiu sem erros, mas CI com a
  versão suportada ainda é a evidência canônica.
- `.next` e `test-results` foram redirecionados temporariamente para `/tmp`
  devido ao filesystem de overlay cheio; o servidor local foi encerrado e os
  symlinks temporários foram restaurados/removidos. Nenhum ambiente externo,
  banco, migration ou flag foi alterado.
- Os checks verdes anteriores pertencem ao HEAD anterior à correção. CI/scanners
  do novo HEAD precisam rodar novamente. O gate R4 independente permanece
  aberto; a autocorreção e estes testes não equivalem a revisão independente.

## Correcao dos gates Governanca e Mobile — 2026-10-24

- O HEAD `f2ff69e9` passou Backend, Web, Demo smoke, imagens e scanners, mas
  Governanca reprovou pelo inventario vencido e Mobile por um advisory Zod novo.
- [Revisao e evidencias consolidadas](../docs/governance/REVISAO_SECURITY_QUALITY_2026-10-24.md):
  captura autenticada da main, hash e 175 referencias reconciliadas sem
  dispensas; pendencias certifi/musl-utils e residuos IA continuam rastreados.
- Zod 4.6.7 restrito a CLI Expo 57.0.27: dois testes negativos RED antes e GREEN
  depois; contratos reais da CLI preservados. Nenhuma excecao nova no audit.
- Node 22/pnpm 11.25: seguranca Mobile 14/14, a11y 15/15, typecheck, licencas de
  586 pacotes, audit com backport node-forge e export Android/iOS/Web PASS.
  `doctor` local teve 19/21 PASS e dois metadados externos inacessiveis; exigir
  o gate canonico no CI. O agregado de inventario passou 73/73 e cobertura175.
- CI e revisao cruzada deste novo conjunto ainda pendentes neste registro.
  Sem merge, deploy, distribuicao Mobile, nova PoC ou migrations externas.


## Fechamento corretivo R4 — 2026-10-24

- Dois P2 confirmados pela revisao cruzada foram reproduzidos antes da correcao:
  tres RED de snapshot de catalogo mutavel/inativo e dois RED de cancelamento
  durante save em voo (desktop/mobile). Relatorio completo e limites:
  [revisao-seguranca-food04.md](revisao-seguranca-food04.md).
- `c0247662`: contexto autoritativo cifrado/versionado preserva composicao ja
  aplicada; documentos editoriais schema1 continuam compativeis, envelope2
  interno nao e aceito como DTO. AbortSignal cancela confirmacao pendente antes
  de alterar o editor, sem cancelar o autosave anterior.
- Revisor distinto da autoria reavaliou `d3157af0..c0247662`, somente leitura:
  ambos resolvidos, nenhum novo Critical/P1/P2 confirmado. Nao e auditoria humana
  externa; execucao de suites e CI sao evidencias separadas.
- GREEN: servico113/113, helper7/7; backend integral362 suites/3244 testes PASS,
  8 suites/142 testes SKIPPED condicionais. Playwright FOOD04 20/20 PASS em
  desktop/mobile. Typecheck/build/artefato backend, typecheck Web e scan de
  segredos PASS; ESLint zero erros/oito avisos preexistentes. Runners de banco
  nao habilitados na suite integral local; nao atribuir PASS a esses skips.
- CI checkpoint `d3157af0`: run40074420091 SUCCESS, incluindo Mobile,
  Governanca, Backend/Testcontainers, Web e Demo smoke. CodeQL, Semgrep, Trivy
  e Dependency Review tambem SUCCESS. CI/scanners do HEAD corretivo final ainda
  pendentes e obrigatorios antes de aprovar merge.
- Sem schema SQL novo, migration externa, flag, merge ou deploy. Rollback apos
  gravar envelope2 exige writer compativel; preservar ciphertext/historico e
  preferir correcao adiante. Migration1078 externa continua operacao separada.


## Pós-merge e operação autorizada — 24/10/2026

PR #441 MERGED/CI final PASS; migration1078 aplicada/validada em staging após
ensaio isolado e backup. Produção BLOCKED por quota Neon HTTP402; nenhuma escrita
nessa base. Último deploy automático do backend de produção update_failed pelo
mesmo erro. Smokes HTTP inconclusivos por timeout; jornada autenticada não rodada.
[Evidências, testes e retomada](../docs/governance/EVIDENCIAS_ROLLOUT_FOOD04_2026-10-24.md).
A autorização operacional desta sessão supera os limites históricos do plano,
mas não permite declarar rollout de produção concluído nem alterar cobrança.
