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

Checkpoint UI commitado em `8c93fdd9`; a branch permanece aberta para completar
T11–T14. A fase não está concluída: regressões restantes, revisão R4, CI e PR
seguem pendentes.
