# FOOD06 — API/BFF de registros factuais M05/M07

## Estado do incremento M05/M07 (checkpoint anterior)

Incremento da PR #455 Draft, sobre remoto `c6dd0a3d` (mesma árvore do local
`cc630629`). API factual autorizada, sem habilitar DRI, sem contexto clínico
confirmado integrado e sem nova interface. M05/M07 permanecem PARCIAIS;
37,5% administrativos, 1 concluída/7 parciais/4 pendentes. Direitos/DRI/G06 BLOCKED.
Sem migration nova, dependência nova, merge, deploy ou operação externa.

O CI da base c6dd0a3d concluiu com sucesso os seis workflows, incluindo Backend,
Web, Demo e PR Gate (run principal41725726612). Não valida este novo delta.
CI do commit API inicial6c738e79: Web falhou em test:apis-dinamicas porque rotas delegavam o tipo Promise por alias compartilhado que checker estático não reconhecia; PR Gate falhou em consequência e Demo foi skipped. Follow-up corrigiu tipos inline, imports secundários e harness que omitia o helper. APIs dinâmicas168PASS, BFF101PASS, typecheck PASS; comando pnpm test:authz completo e CI do HEAD follow-up aguardam resultado.

## Contratos

Backend: `/pacientes/:pacienteId/planos-alimentares/analises-factuais`.
BFF: `/api/pacientes/[id]/planos-alimentares/analises-factuais`.
Todas as operações são POST, respostas `private, no-store`, sem identificadores de
registros ou valores clínicos em query strings. Tenant e usuário vêm da sessão.

| Sufixo | Entrada | Permissão backend | Resposta permitida |
| --- | --- | --- | --- |
| raiz | registro: chaveIdempotencia + origem exata; selecao: ativacaoRevisaoEsperada + identidadesRefeicoes | Professional, ler e gerenciar, carteira atual | schemaVersao, registro{id,criadoEm} |
| listar | pagina inteira1–10000, limite inteiro1–100 | Professional, ler, carteira atual | metadados paginados, total/pagina/limite |
| consultar | registroId UUID | Professional, ler, carteira atual | origem/seleção congeladas e totais/cobertura projetados |
| comparar | antesId/depoisId UUID | Professional, ler, carteira atual dos dois registros | projeção das duas análises, deltas e mudanças documentais |

A origem exige planoId/versaoId UUID, numero, status e revisão editorial para
rascunho. Seleção tem até50 UUIDs únicos e revisão operacional não negativa.
Validador puro compartilhado entre serviço e DTO, pipe global estrito, sem coerção
implícita. Campos desconhecidos, callbacks, snapshots, totais, tenant ou confirmação
opaca fornecidos pelo cliente são recusados. A leitura decifra apenas depois de
reautorizar; comparação autoriza os DOIS registros antes de abrir conteúdo.

BFF exige permissão antes de ler o corpo; limite UTF-8 de16KiB em leitura limitada,
independente de Content-Length. Backend mantém parser global100KiB existente e
recusa corpos aceitos acima de16KiB por declaração e buffer rawBody após parser.
**Isso não é um limite streaming16KiB no backend.** rawBody ausente com body presente
falha fechado503. Erros de parser, validação, autorização e serviços são genéricos;
o BFF sanitiza também erros JSON/HTML de upstream, sem retry de comandos409.
O roteamento Express aceita caixa indiferente; o escopo do middleware agora usa
`/i` para conservar limite e mensagens seguras nesses mesmos caminhos.

## Persistência, projeções e compatibilidade

Reutiliza serviço transacional, locks, CAS/materialização, chave idempotente,
ExecutorTenant, criptografia, auditoria e migration1081 já desenvolvidos. Não altera
ledger nem schema. Resultado congelado não consulta catálogo atual nem reconstitui
composição ausente. Zero conhecido permanece zero; ausências continuam ausentes.

Allowlist explícita e aninhada para origem, metadados, seleção operacional congelada,
valores/cobertura/contagens/causas, exclusões e deltas. Datas de captura e origem são
distintas. Não serializa ORM, envelope cifrado, contexto clínico, fingerprint, hash
interno ou confirmacaoOrigem. Identidades de refeição/plano são limitadas à origem
autorizada. Referências numéricas indisponíveis e ajuda factual explícitas.
Não atribui diferenças automaticamente à dieta ou ao estado clínico do paciente.

Leitores v1/v2, confirmação de origem cifrada v2 e histórico imutável preservados.
Código anterior ao v2 não é rollback seguro após novas gravações; continua gate
operacional separado. O proxy legado mantém comportamento dos chamadores antigos;
leitura diferida foi adicionada como parâmetro opcional para estas quatro rotas.

## Continuidade local — leitura histórica M10

O incremento mais recente acrescenta um quinto POST `historico`, com DTO de limite
até10 e cursor keyset (`registroId` + timestamp UTC em microssegundos), endpoint
BFF e tela profissional sob demanda. A projeção mantém somente totais completos,
subtotais parciais identificados, cobertura, origem da versão e marcas booleanas
das bases documentais; referências seguem explicitamente indisponíveis. O histórico
permanece cifrado e imutável; não há migration.

Testes atuais no delta local da branch `feat/food06-main-sync` sobre o HEAD base
remoto `f731c807`: integração PostgreSQL/RLS41/41, BFF105/105, testes Web68/68,
typecheck/lint PASS, Playwright desktop/mobile24/24. Isso não é CI do HEAD enviado:
o delta ainda não foi commitado/pushado. Build backend/Web, rotas assíncronas,
scanner local de segredos e `git diff --check` também passaram. O authz agregado não
executou testes porque o harness falhou ao criar `tsbuildinfo` sem permissão; CI e
scanners GitHub do novo HEAD, UX B/C e R4 continuam pendentes. Consulte
[M10 histórico](food06-m10-historico.md).

## TDD e evidências

| Verificação | Estado/evidência |
| --- | --- |
| Projeções | 4 RED funcionais → GREEN; caso adicional de seleção congelada RED → GREEN;5 testes finais |
| HTTP e DTOs | RED de rotas ausentes → GREEN;17 testes de sessão/papel/permissão, entradas, paginação, erros, cache e limites |
| P2 independente de caixa | RED: URL em maiúsculas retornava200 para corpo>16KiB; GREEN:413/400 seguros, sem alterar roteamento global |
| Bootstrap + HTTP + projeções |42/42 PASS Node22 |
| BFF |16 RED funcionais iniciais → GREEN;101/101 PASS finais, inclui autorização antes do corpo, UTF-8,409, JSON500 sanitizado, HTML502 e stream400 |
| Integridade da evidência BFF | Teste que esperava500 para HTML recebeu502 pela normalização já existente. Expectativa corrigida: não é prova RED de vazamento. Não foi contado como vulnerabilidade reproduzida |
| API + PostgreSQL15/RLS real |38/38 PASS, inclui persistência cifrada/consulta/comparação e negação das quatro operações após transferência |
| Regressões PG FOOD04/receitas/registro |61/61 PASS,3 suítes com runtime sem owner/bypass e FORCE RLS |
| Backend completo |4.086PASS/218SKIPPED,387suítesPASS/10SKIPPED; skips não são provas de banco/provider,61PG executados separadamente |
| APIs dinâmicas Next |RED CI/local nas quatro rotas novas; cada `route.ts` declara `params: Promise` inline e resolve com `await`; helper relativo e fixture corrigidos; verificador PASS nas168 rotas |
| Typecheck backend/Web |PASS Node22.23.4 |
| Lint Web afetado |PASS |
| Build backend |PASS Nest + artefato dist/main.js Node22 |
| Build Web |PASS Node22 no processo com NODE_PATH do node_modules já instalado;194 páginas geradas. Histórico: duas tentativas ENOENT por destinos temporários ausentes e outra MODULE_NOT_FOUND pela resolução de dependências através de .next em /tmp. Não foram PASS nem RED funcional. Build compilou, typecheck interno e194 páginas; falhou ao coletar devido ao symlink PNPM entre worktrees não resolver next runtime no diretório .next externo. Execução NODE_PATH restrita ao node_modules já instalado, somente no processo local, ultrapassou static generation/optimization e está registrada no log; verificar encerramento/artefato. Nenhuma config/deps/engines alterada |
| Authz Web completa |`pnpm test:authz` oficial reexecutado após ajuste do harness; resultado em validação. BFF afetado101/101 PASS e scripts anteriores individuais não substituem o comando completo |
| R4 independente delimitada |food06_registros_api_r4: achado P2 corrigido, re-revisão sem pendências; execução própria42HTTP/projeções/bootstrap e101BFF PASS;38PG próprios anteriores com código PG inalterado. Reprodução própria inclui gzip e caixa |
| Governança/segredos |48/48PASS;52controladores verificados;93migrations declaradas/91fora de banda; scanner local sem segredos detectados |
| CI novo |PENDING HEAD próprio; base não substitui este gate |
| Browser e UX B/C |N/A neste incremento sem interface; obrigatórios quando houver jornada utilizável |

Dados exclusivamente sintéticos. Fixture PG aplica1081 real sobre relações
representativas com RLS; não é toda a cadeia de migrations nem prova de produção.
HTTP usa JWT sintético em testes, guardas de papel/permissão reais. BFF usa harness
Next; não é teste em navegador. R4 é independente do autor e read-only, com testes
próprios delimitados; não equivale a revisão integral da FOOD06 ou produção.

### Reprodução

Usar Node22 conforme engines, sem alterar dependências/configuração para setup.

```sh
# backend
node node_modules/jest/bin/jest.js --runInBand src/modulos/planos-alimentares/apresentacao/controlador-registros-factuais.http.spec.ts src/modulos/planos-alimentares/aplicacao/projecao-registro-factual.spec.ts src/main.spec.ts
FOOD06_REGISTRO_TESTCONTAINERS=true node node_modules/jest/bin/jest.js --runInBand src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts
RLS_TESTCONTAINERS=true FOOD04_RLS_TESTCONTAINERS=true FOOD06_REGISTRO_TESTCONTAINERS=true node node_modules/jest/bin/jest.js --runInBand src/infraestrutura/banco-dados/migracoes/1720000001078-GruposSubstituicoes.integracao.spec.ts src/infraestrutura/banco-dados/migracoes/1720000001080-MetadadosReceitasNutricionais.integracao.spec.ts src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
# Web
node scripts/test-planos-alimentares-bff.mjs
# todos os27 comandos de package.json test:authz, sem modificá-los
node node_modules/typescript/bin/tsc --noEmit
NODE_PATH="$PWD/node_modules" node node_modules/next/dist/bin/next build --webpack
```

Logs sintéticos locais `/tmp/food06-api-{caixa-red,http-final,bff-corrigido,
pg-final,pg-regressoes,backend-final,backend-build,web-build-nodepath,authz,lint}.log`;
R4 `/tmp/food06-r4-bff-recheck.log`. Sem pressupor retenção permanente de /tmp;
os testes versionados são a evidência reproduzível.

## Handoff e sequência

1. Publicar somente delta intencional na mesma PR455 Draft e verificar CI/scanners
   do HEAD exato, sem herdar PASS da base. Corrigir regressões comprovadas.
2. Integrar contexto confirmado/timezone canônico por fontes autorizadas reais,
   sem confiar em nascimento arbitrário ou inferir população pelo cadastro.
3. Interface M05/M07: seleção exata, captura explícita, lista paginada, comparação,
   cancelamento/erros/stale, UX B/C, teclado e desktop/mobile. Não fechar M05/M07
   só porque a API está testada.
4. Manter direitos/DRI e G06 separados. Sem merge/deploy/migrations externas.

Alterações anteriores preservadas; HEAD local/remote divergem em identidades mas
compartilham árvore base. Publicação por Git Data deve verificar blobs/árvore e CAS
no ref, sem reset, rebase, force ou descarte. next-env.d.ts preexistente na worktree
principal permanece intocado. FOOD05-MDL/D18 não iniciado.
