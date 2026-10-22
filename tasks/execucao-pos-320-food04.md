# FOOD04 — ledger de execução técnica

Branch `docs/pos320-food04-planning`, base main `9e1984a2`.
Planejamento: commits `059c6bd9` e `6ede1beb`. Desenvolvimento autorizado pelo
proprietário em “Pode seguir”, após apresentação da especificação ampliada.
Sol médio permanece no backend/authz/snapshots/BFF. Pausar antes de Luna alto
para UI T11–T12. Uma PR funcional, ainda não aberta neste checkpoint.

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

- UI T11–T12 e helpers de aplicação/undo: não implementados. Contratos e
  próxima ação no [handoff Luna](handoff-pos-320-food04-luna.md). Pausar antes
  da troca manual, conforme preferência do proprietário.
- Regressões finais, revisão R4, cadeia PostgreSQL oficial com extensões,
  Playwright desktop/mobile/a11y e CI/scanners do HEAD final: pendentes.
- `nest build` padrão tentou escrever no workspace e falhou por ENOSPC. Uma
  compilação com o mesmo tsconfig e artefatos em `/tmp` é alternativa local;
  registrar resultado sem ocultar a falha do comando padrão. Web build após UI.
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
 `/tmp/food04-tools/web-authz-final.log`. UI/Playwright/build Web continuam pendentes.

Checkpoint validado em Sol médio e preparado para troca manual a Luna alto.
A fase não está concluída: UI, revisão R4 e gates da PR seguem pendentes.
