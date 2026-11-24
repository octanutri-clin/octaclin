# Registro de execução — plan-questionarios-10-prs.md

Base inicial989f4d5c. Plano aprovado integralmente pelo proprietário.
01–10: pendentes inicialmente; só marcar concluído com evidências específicas.

## Pré-voo e decisões

- Regras AGENTS/REGRAS e worktrees verificadas; preservar Claude/FOOD06/575/582.
- Interfaces:02 compartilha AreaRespostas com01;03–05 compartilham formulário;
 07 produz leitor histórico usado por08/10;08 limita alcance dos resumos/CSV;
 09 toca agendador/migration e exige exclusividade e provas reais.
- Ruling: empilhar explicitamente novas branches/PRs dependentes quando a
 anterior ainda não estiver mergeada — evita integrar implicitamente código
 alheio; custo: revisão/merge devem seguir a ordem declarada.
- Ruling: skill cloud sem scripts locais do pacote; manter ledger versionado
 equivalente aqui — retomada deve confiar em gitlog/evidências, sem recriar.

## PR lógica01 — variação neutra

Estado: RED confirmado — indicador “Aumentou: +2” ausente no cenário positivo. Base989f4d5c, branchfeat/qst10-01-variacao-neutra.

01: primeira chamada de regressão feita no cwd raiz, sem configuração Web: falha de setup, cancelada; não é RED funcional. Reexecução no pacote Web.

01: implementação PASS, commits4c6db428(C1)/8ab4dc1e(C2). GREEN2/2 e
regressão70/70 desktop/mobile(3,4min), Node22.21.1 typecheck/lint/linguagem/
segredos/diff PASS. Sem alteração do cálculo. Dependências reutilizadas
Next16.3.8 versus manifesto^16.4.5: CI canônico pendente. Banco/RLS/build
completo local SKIPPED, fronteiras não alteradas. UXA aprovado no plano;
B/C e revisão estática final do lote pendentes, sem declaração de aceite.
PR01 mantém Draft e não herda PASS de outro commit.

## PR lógica02 — organização da leitura

Base19c94939, branchfeat/qst10-02-organizar-leitura; dependência explícita da01.
RED: abaEnvios ausente. GREEN4/4 desktop/mobile, contexto/filtros/leitura/foco,
axe200% PASS. Código9285ce6d congelado; typecheck/lint PASS. Regressão74casos
em execução, NÃO PASS até resultado. Nenhuma alteração de API/storage.
Ruling: preparar próxima worktree enquanto regressão do pai roda, sem alterar
código do pai; só publicar pai após resultado. Se falhar, corrigir e propagar
explicitamente a dependência, revalidando filhos. Custo: eventual retrabalho.

02: regressão final74/74 PASS(4,3min), código9285ce6d + checkpointb2a59f83,
typecheck/lint/linguagem/segredos/diff PASS. Publicação sobre01 explícita.

## PR lógica03 — pendências do paciente

Baseb2a59f83. RED resumo ausente + campo sem nome acessível. Após resumo/nome,
RED adicional reproduziu vazio numérico: esperadas3pendências, recebidas2.
Implementação mínima mantém vazio como stringvazia, filtrada do envio; zero
informado continua número0. Backend/capabilities/contratos não alterados.
Suíte formulário16casos e typecheck em execução, ainda NÃO PASS.

03: implementação/regressão16/16 desktop/mobile PASS(1,4min); reforço final
axe/200%2/2 PASS incluído nos16cenários, não somar reruns. Typecheck e linguagem
PASS Node22.21.1; lint0erros,1warning preexistente set-state-in-effect no
carregamento original(sem alteração desse efeito), não escondido. Segredos/
diff PASS. Commits40a50dd6(C1)/4748893f(C2). Sem prova de banco/RLS/build
completo local ou leitor de tela manual(SKIPPED, fronteiras não alteradas).
UX B/C e revisão final do lote pendentes; nenhuma declaração de aceite final.

## PR lógica04 — índice de seções

Based68607e8. RED: navSeções inexistente. Implementação usa IDs gerados,
nunca nomes livres; foco noheading e URL preservada, só se maisde1seção.
Caso desktopdeíndice PASS; regressão20casos e typecheck ainda em execução,
sem declaração de PASS até resultado. Código congelado para preparar05.

04: regressão20/20 desktop/mobile PASS(1,4min), typecheck/linguagem PASS,
lint0erros/mesmo warning preexistente no carregamento.
Ruling: executor ficou sem espaço ao criar05(ENOSPC, não falha funcional);
removidas só cópias limpas próprias01–03 comSHAremotoidêntico, preservando
branches/commits/PRs. Reutilizar sequencialmente worktree04 para próximas
branches próprias, sempre após commit/push/statuslimpo. Custo: caminhos físicos
antigos deixam de existir; código/evidências permanecem noGit/PRs.
04 ganha commitdocumental adicional por essa recuperação/evidências finais.
Fonte/código permanecem inalterados; diretóriosClaude e arquivos históricos
alheios não foram removidos. Espaço livre169MiB após recuperação.

## PR lógica05 — conferência opcional

Base937c8e4c, branchfeat/qst10-05-conferencia-paciente. C1 1004fa81 RED
conferência ausente; C2 8e14905b GREEN4/4. RED adicional2casos reproduziu
camposeditáveis duranteACK e ações habilitadas emupload. C3 4d9fb765 corrige
somente essasproteções. Final28/28 PASS(26formulário+2PWA desktop/mobile,
1,4min), lasteditantes800ms, zero/falso, foco, upload, cancelamento, ACK e
reconexão. Typecheck/linguagem PASS, lint0erros+mesmo warningpreexistente.
Sem alteraçãoAPI/backend/storage. Node22.21.1; Nextlocal16.3.8 diverge do
manifesto^16.4.5, CI/buildcanônico pendente. Banco/RLS e screenreadermanual
SKIPPED: fronteira não alterada/sem execução manual.

UX B/C01–05 e revisão técnica estática independente favoráveis, limitadas ao
material descrito/inspecionado: [relatório](../docs/agents/ux/reports/QST10-01-05-BC-2026-11-23/consolidado.md).
Substitui pendência histórica B/C/revisão01–05; não cobre06–10 nem confirmaCI.
CapturasChromium sintéticas preservadas; personas não interagiram com UI.
Sem novo requisito inferido das personas. PRs01#583/02#584/03#585/04#586Draft.
05 aguarda push/PR;06–10 ainda não implementadas.

## Recuperação de executor — 23/11/2026

O executor anterior ficou inacessível e o novo /workspace não tinha repositório,
worktrees ou /tmp anterior. Após aguardar statusready, confirmou-se isso por
listagem e ausência do objeto b674350f. Não é prova de apagamento do provider;
é perda de acesso neste ambiente. GitHub preserva01–05 (#583–#587),05HEAD
1b06fafb38e67e0aabbe1a7b5606c1b35ddb24a6. Branch06 não existia no remoto.
Clone novo filtrado da05, sem main/Claude/produção tocados; nova06 sobre05.
Reconstruir somente delta06 conforme registro da sessão. SHAs886d69eb/b674350f
e logs anteriores são históricos inacessíveis, não aprovação desta reconstrução.
Anteriormente: HTTP12PASS, serviço+HTTP61PASS após correção de projeção em memória,
BFF14PASS, navegador4PASS e PostgreSQL2PASS/31SKIPPED por filtro. Regressão do
editor e revalidações estavam em andamento: resultado perdido, NÃO PASS.
Revisão independente06 estava pendente. Reexecutar gates no novo código.
Node22.21.1 obtido de nodejs.org com SHA256 verificado; instalação inicial de
pacotes começou com Node24 antes da extração, não é validação suportada;
verificar frozeninstall e todos os testes com Node22, sem mudar lock/engines.

## PR lógica06 — checklist de validação do editor

Reconstrução preservada em8544cc4(C1),ac98a37(C2),2d08ed4(C3). RED HTTP12falhas
funcionais404. GREEN61/61serviço+HTTP,14/14BFF. Prévia/consulta de revisão
somenteleitura autorizada tenant/profissional; requisição512KiB/1000edições,
DTOs existentes, códigos allowlist por campo, lockread e versãoesperada.
Não cria ruleset clínico novo, não salva nem altera snapshots/rascunhos.

Revisão independente encontrouP2 de ressurreição de prévia A→B→A/salvarfalhou;
2REDdesktop reproduziram. Geração por identidade em2d08ed4 corrige,8GREEN
focados e62/62regressão final desktop/mobile(5,4min), com teste tardio reforçado
para aguardar resposta/conclusão/renderização. Execução anterior cancelada
quandoP2foiencontrado:5PASS/1interrompido/52NOTRUN, não aprovação global.

PostgreSQL descartável completo33/33PASS, runtimeNOSUPERUSER/NOBYPASSRLS e
FORCERLS: provasnovas de negação cross-tenant/proprietário, sem gravação no
banco/snapshot, espera por escritor e staleversion rejeitada apóscommit;
31casoslegados da cópia também executados, nenhumskip nestaexecução.
Typecheckbackend/Web, lintafetado(0erros),linguagem,backendbuild+artefato PASS.
Node22.21.1 eNext16.4.5 do lockfile nesteexecutor; frozeninstall refeito com
pnpm11.25.0 invocado peloNode22diretamente, sem alteração de lock/engines.
Nextdev atualizou somente headinggerenciado emWeb/AGENTS.md; registrado sem
alterar regrasOctaClin. next-env.d.ts gerado será excluído do diff intencional.

UX B/C e revisãoR4 estática final favoráveis, sem execução própria de testes;
[relatório](../docs/agents/ux/reports/QST10-06-BC-2026-11-23/consolidado.md).
PacienteN/A: conferência de console sem gravação/envio/conteúdo noportal.
Screenreader manual/usuáriosreais SKIPPED, sem alegar equivalência comaxe.
Suíte globaltest:authz localSKIPPED:14BFFespecíficos+HTTP/RLScobremfronteira
nova; suíteglobal permanece gate oficial deCI, não aprovada por inferência.
Webbuild em execução no checkpoint;CI/scanners do novoHEAD ainda pendentes.

05#587 confirmou21SUCCESS/1SKIPPED(SBOM) noHEAD1b06fafb em leitura atual.
PR01#583 foi promovida externamente aReadyforReview; esta execução não alterou
estado de nenhumaPR nem fez merge/deploy. Descrições01–04 atualizadas somente
com links às evidênciasUX/R4preservadas na05.06aguarda publicação comoDraft.

07emworktreeprópria/workspace/qst10-07-completude-historica, base2d08ed4,
preparaçãoTDDenquantocódigo06congelado. Antesdo primeirocommit07, integrar
explicitamente somente checkpointdocumental06 porfastforward.08–10NOTRUN.

## PR lógica07 — preenchimento histórico

C1 209eea0: domínioRED7falhasfuncionais/1PASS, depoisGREEN8/8. C2 7a2bc76:
leitor autorizado de resposta/envio exatos, q→paciente→envioFORSHARE, metadados
mínimos antes de snapshot/valores, carteira/ciclo de vida; sem fallback atual,
sem capability/revisão geradas. C3 39f1a92: consulta explícita no leitor,
fora do sticky, sem GET novo ao apenasLerenvio/navegar; validouP02original sem
alterar seus critérios. Controles estáveis preservam foco/impedem GET repetido.

REDs adicionais: interface ausente por reversão controlada da própria integração;
motivoarrayBFFaceito200quandoesperado502; foco perdido durante atualização;
revisãoR4 encontrou leitura aplicando regras de qualidade de submissão aos
históricos(2REDnull/11). Corrigido só no leitor: presença não é qualidade;
validador deescrita inalterado. UmRED de dataausente mostrou que data não é
requisito matemático; enviorespondido continua obrigatório, sem inventardata.
Fixture de revogação passou a usar estado explícito em vez de número deGETs
(StrictMode), preservando negação/hide e assertions; auditoria negada agora
assertada positivamente, não confundida com auditoria de sucesso.

Gates atuais:78/78domínio/serviço/HTTP;15/15BFF;37/37PostgreSQLdescartável
real/runtime/NOBYPASSRLS/FORCERLS, incluindo4novos sobre carteira/concorrência,
imutabilidade, null/fora-faixa/dataausente e33regressões dos pais. Backendbuild
+artefato e typechecksbackend/Web, lintafetado/linguagem PASS Node22.21.1.
Regressão80/80 desktop/mobile(6,5min) no runtime39f1a92, incluindo6novos.
Ajuste posterior só de fixtures/screenshot reconcilia2valorescom2preenchidas e
versãosalva3comenviada2;6casosreexecutadosPASS(34s), mesmos critérios/runtime.
Não somar reexecuções. Default dasfixtures74legadas permanece idêntico.
CI do novoHEAD deve executar arquivo integral atual; não herdarPASSdeoutroSHA.

Execução parcial anterior:33PASS/1FAIL(P02nav)/1interrompido/43NOTRUN, substituída
pelo80PASS apósconsultaexplícita/posição preservarem contrato. Setupfalhou antes
porReact/jsxruntimeexterno à.nextem/tmp e tipagemHTTPunknown: NÃO RED; resolvido
só porNODE_PATHlocal para dependências confiáveis já congeladas e fixturetipada,
sem alterar segurança/engines/deps/workflows. LintnoCWDerrou: setup, nãoPASS;
reexecutado no pacoteWeb com sucesso. Nenhuma dependência nova/lock modificado.

UXB/C e R4estática finais favoráveis, limites no
[relatório](../docs/agents/ux/reports/QST10-07-BC-2026-11-23/consolidado.md).
PacienteN/A, sem efeito noportal/envios/conteúdo. Screenreadermanual/usuáriosreais
SKIPPED. Globaltest:authz/buildWeb local SKIPPED: gates canônicos doCI mantidos;
15BFF e Nextdev/typecheck não substituem esses checks. Não há migration07.

Ruling: backup dos commitsverdes da07 antes de abrirPR, para não repetir perda
doexecutor; OctaClinCI/CodeQL declaram pull_request/pushmain, sem nova rodadaglobal
nessa branch semPR. Nenhuma configuração alterada. ApósC4, PRDraftúnica sobre06.

Atualização06: buildWebcompleto PASS apóscheckpoint8d06cf2(que registrava
emexecução); runtime2d08ed4 sem mudanças. PR#588Draft, head8d06cf24, último
CI consultado20SUCCESS/1SKIPPED(SBOM)/Demoemexecução, sem falha naqueleinstante.

08preparada em/workspace/qst10-08-paginacao-exportacoes, base39f1a92,
apenas leitura, sem código novo. AntesC1 fazerFF explícito só do C4documental
07.09/10NOTRUN. Sem merge, deploy, operação externa ou mudançasClaude/FOOD06.

## PR lógica08 — checkpoint backend, implementação em andamento

Worktree própria `qst10-08-paginacao-exportacoes`, branch
`feat/qst10-08-paginacao-exportacoes`, base07 `87dbeeaf`. R4: leitura clínica,
autorização e migration somente de índices. Nenhum trabalho FOOD06 integrado.
A indisponibilidade/reinicialização desta rodada preservou arquivos e logs.

C1/C2: normalizador estrito de período/paciente/25–50–100; cursor opaco cifrado
com o provider AES-GCM existente, vinculado a tenant/ator/questionário/filtros/fuso.
Keyset conserva microssegundos PostgreSQL e ordena dataDESC NULLSLAST/idDESC.
Consulta metadata+LIMIT antes dos valores; locks questionário→profissional→
pacientes→envios→respostas, carteira novamente autorizada antes dos valores.
Nova API privada e três escopos explícitos de CSV; >1000 rejeitado sem truncar;
projeção/volume limitados. Reutilizados guardas, ExecutorTenant, fuso clínico,
CSV canônico e resumo extraído sem alterar o comportamento legado. No resumo
novo, null/vazio/booleano não viram zero; definições históricas incompatíveis
não geram média. Leitores integrais legados não montam a página/exportação nova.
Migration1087 registrada: dois índices aditivos, rollback remove só os índices.
Não aplicada fora de PostgreSQL Testcontainers descartável owner/runtime.

RED funcional:20falhas/1PASS em filtros/cursor;6falhas de banco;5falhasHTTP/1PASS;
2falhas de médias históricas com67regressões e1compatibilidadePASS;1falhaíndices.
GREEN:119/119 em5suítes backend (domínio/serviço/HTTP/registroTypeORM);
44/44 PostgreSQL15descartável, runtimeNOBYPASSRLS/FORCERLS, incluindo37regressões
+7cenáriosnovos. Não somar reexecuções. Typecheckbackend Node22.21.1 PASS,
diffcheck e scannerlocal de segredosPASS. Erro intermediário TS de indexsignature
corrigido: erro de compilação não contado comoRED. Buildglobal NOTRUN nestaetapa.

API/BFF/console/Playwright/UXB-C/R4independente/CI do delta continuam pendentes;
esta é uma etapa segura de backup, não conclusão da08. Próxima ação: BFF
allowlist e integração de filtros/páginas/3CSV no console; depois regressões,
R4 ePRDraft08sobre07.09–10NOTRUN. Sem merge/deploy/migrationexterna.

Leitura GitHub desta rodada: #588HEAD8d06cf24 com21SUCCESS e1SKIPPED(SBOM),
semfalhas; #589OPEN/Draft87dbeeaf. Resultados dos pais não validam08.

### 08 C3 — integração utilizável, antes de revisão final

BFF aditivo: valida sessão/permissão/origem, query sem duplicatas, escopos CSV
não ambíguos, limites e allowlist das respostas; não repassa mensagens internas.
Console usa só página nova, filtros aplicados de paciente/período, fuso servidor,
25/50/100, cursores apenas em memória e três CSV explícitos. Busca e resumos
somente da página. Exportação pendente é descartada ao mudar de contexto.
Atualização da mesma página preserva leitura/recolhimentos; erro vigente limpa
os fatos. Navegação por teclado leva foco ao estado da nova página somente se
a resposta ainda for atual. Fonte atual não reinterpreta denominador histórico.

Novas provas:18/18 BFF(15 regressões+3novos),10/10 navegador desktop/mobile
(paginação,3CSV,respostas tardias,axe/zoom200%/teclado);4/4 regressõesP02 focadas.
Uma regressão parcial foi interrompida após demonstrar2defeitos de fechar leitor
na atualização; corrigidos sem reduzir asserts. Novo RED de foco reproduzido
e corrigido.4falhas intermediárias dos novos testes tardios eram fixture com
texto duplicado e seletor estrito, corrigida só a fixture, não contadascomoRED.

Backend módulo+registro:220PASS/52SKIPPED, sendo48 de PostgreSQL executados
separadamente e4 históricos de outro gate aindaSKIPPED nesta rodada. PostgreSQL
final48/48:11casosnovos+37regressões, incluindo carteira concorrente e limites de
snapshot/valores antes de materialização. RED adicional: snapshot9MiB era lido;
agora rejeitado antes do conteúdo, sem regravar dados. Snapshot é carregado uma
vez por envio, não uma cópia por resposta. Índices ensaiadosup/down sem alterarRLS.
Demo sintética:1RED404→1GREEN; novo contrato vazio, não prova deautorização/banco.
Typesbackend/Web,lintWebafetado,linguagem8+scanner,governance de migration e
segredos/diffPASS Node22.21.1. Tagfora-de-banda adicionada após gate apontar ausência.
Buildbackend+artefatoPASS antes do ajuste de limite; repetição do build final
pendente. Regressão90casos navegador em andamento; globalauthz/buildWeb/R4/UX/CI
pendentes. C3 não é aceite integral da08 e não permiteReady/merge.

PR07#58987dbeeaf agora também21SUCCESS/1SKIPPED(SBOM) na consulta desta rodada.

### 08 C4 — correção P2 da revisão R4

R4 independente estática87dbeeaf..0794da6 (`/root/qst08_r4`) apontou umP2:
backend media só leitura antes de montar envelope; BFF media corpo completo.
RED real PostgreSQL com oráculo debytes: leitura isolada cabia em8MiB, envelope
ultrapassava; backend indevidamente aceitava. GREEN49/49banco após medir payload
final, incluindo filtros/fuso/contagem/cursor. Não é bypass de limite nem nova
capacidade.4/4PGlegadoCSV tambémPASS nesta rodada, completando os52cenários
que ficaramSKIPPED na seleção unitária; sem somar reexecuções. Re-review estática
da correção e gates globais ainda pendentes neste checkpoint.

### 08 C5 — regressões, reflow e limites das evidências

R4re-revisão0794da6..92821c7 favorável: P2 resolvido tecnicamente, sem novos
achados; estática, sem testes próprios. Types/buildbackend+artefato pósP2PASS.
Regressão local completa90casos terminou89PASS/1FAIL: a única divergência era
GETperiódico do sino de notificações (5s) na lista de requisições do questionário,
sem regressão de consultas clínicas. Fixtureagora isola somente esseGET externo,
respondendo vazio; todos os demaisGETs e TODAS as mutações continuam registrados.
Asserções de ausência de consultas/mutações clínicas foram preservadas.8/8casos
afetadosP01/P02/abas passaram após o isolamento. Não declarar90/90localnesteHEAD.

Inspeção visual real200% revelou clipping interno não captado por largura global.
NovoRED confirmou campo início além do cartão e busca comprimida. Grid explícito
minmax0/colunaúnica e busca empilhada no mobile corrigiram sem mudar contratos.
20/20testes dirigidos desktop/mobile apósCSS (10novos+10regressões pertinentes),
incluindo caixa dos controles, busca legível, axe/zoom/teclado/respostas tardias.
Capturas atualizadas e observadas pelo coordenador; persona só recebeu brief.
TypesWeb/lintafetadoPASS. Revisão estática dirigida desteCSS/fixture ainda pendente.

Reinício do executor preservou arquivos e logs, mas interrompeu `test:authz`
global: INCONCLUSIVO, nãoPASS.18/18BFFquestionários separados continuam válidos
para código inalterado. BuildWebfinal e suíte90integral do HEAD ficam gates a
comprovar (buildlocal será tentado; CIoficial deve executar tudo). Não aumentar
timeouts nem modificar segurança/dependências/workflows para contornar ambiente.
Nenhum lockfile/dependência alterado. Main inspecionada só em leitura aindaaté1086,
sem colisão observada de1087. Sem PR08 duplicada, merge, deploy ou DDLexterno.

### 08 C6 — checkpoint final local para PR Draft

Código congelado `1f490bebe829bbe5945623b181d80e26a521dcc9`. BuildWeb otimizado
Next16.4.5/Node22.21.1 terminouPASS, incluindoTypeScript; typecheck/lintWeb afetado
PASS. Types/buildbackend+artefato no pósP2 tambémPASS. Re-reviewR4dirigida até
1f490be favorável, sem novos achados: validou o reflow e o isolamento EXATO de
GET/notificacoes, sem esconder leiturasclínicas/outrosGETs/mutações. R4 é estática,
não execução independente de testes nem inspeção visual do revisor.

|Gate|Evidência local válida e limite|
|---|---|
|Módulo backend/registroTypeORM|220PASS;52SKIPPED na execução unitária histórica0794da6; não somar119focados novamente|
|PostgreSQL/RLS/runtime|49/49QSTP05 no92821c7 +4/4CSVlegado separado =53provas; incluiRED/GREENP2, concorrência, microssegundos, limites, histórico e rollbackdosíndices|
|BFFquestionários|18/18 em código0794da6 inalteradoaté1f490be|
|Browser integral|89/90 no código anterior aoCSS;1FAIL devido ao poll independente, não promover a90/90 por inferência|
|Browser dirigido final|20/20 desktop/mobile apósCSS e isolamento do poll, incluindo10novos e10regressões;8/8invariantes do poll aprovadas antes e dentro desse escopo|
|Authzglobal local|INCONCLUSIVO: reinício do executor encerrou o processo antes da conclusão; nãoPASS|
|CI/scanners HEADfinal|PENDING: aguardar checks oficiais do HEAD documental enviado; sem herdar verde dos pais|
|Builds/types/lint/linguagem/segredos|PASS nos respectivos escopos e código registrado; PowerShellpreflight/screenreadermanualSKIPPED (não executados neste ambiente)|
|UXB/C/D|Papel profissional explícito somentebrief; pacienteN/Ajustificado; hipótesesP2 embacklog sem execução automática; capturas reais observadas pelo coordenador|

Relatórios, manifesto, capturas eR4 em
`docs/agents/ux/reports/QST10-08-BC-2026-11-23/`. Novas rotas registradas no mapa.
Migration1087 só ensaiada em Testcontainers descartável, não aplicadaexternamente.
Rollback de código não remove dados; eventualdown da1087 remove só índices e
exige nova autorização de ambiente/owner. Não executar durante este trabalho.
PR08 deve ficarDraft até CI/regressões integrais exigidos serem comprovados.
Sem Readyautomático/merge/deploy, sem alterações de produção ouFOOD06.

09:fundação independente em`feat/qst10-09-recorrencias`, commitdb4dbbc,
9RED→76GREEN+types; auth/migration/worker/API/UI ainda não implementados. Falta
a decisão explícita sobre autoria/reconfirmação de agendamentos antigos; ver
`tasks/questionarios-09-recorrencias-handoff.md` nessa branch.10nãoiniciada,
respeitando a base dependente planejada. Não inferir resposta por tempo decorrido.

### 08 C7 — corrigir falha do Backend no CI

CI45298755171/job138125746097, HEAD250edd2: únicoFAIL na suíte completa era o
spec1086 exigir que a1086 fosse a última migration. A inclusão legítima1087
invalidou essa hipótese; a aplicação de migrations no PostgreSQL deCI passou,
mas o gate Testcontainers/RLS posterior foiSKIPPED pela falha da suíte.

RED local Node22.21.1:1FAIL/4PASS reproduziu a mesma linha doCI antes da correção.
Teste1086 agora exige existência única de1085/1086 e a ordem imediata1085→1086;
não fixa o fim da lista. Novo spec1087 protege sua unicidade e ordem1086→1087,
sem proibir próximas migrations. Assertivas de RLS, duplicatas, transação e
rollback da1086 foram mantidas. Nenhuma migration, configuração, workflow,
dependência, permissão ou código de produção foi alterado para obter verde.

GREEN focado:28/28 em1086/1087/registroTypeORM. Suíte completa local:471suítesPASS,
18SKIPPED;5603testesPASS,388SKIPPED,0FAIL (5991total,188,988s). Gates condicionais
não habilitados no perfil local não contam como validação; oCI tem suas próprias
configurações de integração. Não somar28novamente nem herdar oPASS de um commit
anterior. Typecheckbackend,diffcheck e scannerlocal de segredosPASS.

A correção é restrita a testes/registro de evidências. Runtime permanece o de
1f490be; provas PostgreSQL/R4 anteriores mantêm seus escopos e limitações, não
substituem oCI do novoHEAD. Enviar uma vez e manterPR590Draft; aguardarBackend,
Testcontainers/RLS e demais checks do novoHEAD, semmerge/deploy/migrationexterna.
