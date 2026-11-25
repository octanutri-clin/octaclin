# Entrega10 — comparação de dois retornos

## Estado de correção do smoke — 25/11/2026

HEAD anterior99859abc:19checksSUCCESS,2FAIL(Demo local smoke ePRGate),
1SKIP(SBOMprovenance). Run45533224165/job138936898250. Relatório real do
artefato14987566951:1538testes,1525expected,2unexpected,1flaky,10skipped.
As duas falhas persistentes são o mesmo teste de teclado em desktop/mobile;
o testeP05 de reordenação passou no retry e permanece intermitência histórica.
Etapas posteriores de estados/densidade/linguagem foramSKIPPED, nãoPASS.

Causa reproduzida: Tab apósRecolherTudo chega ao novo checkbox de comparação,
não ao botãoExpandir como o teste legado esperava. RED2/2 local sobre build de
produção. Patch somente no teste: assert foco/seleção/desseleção porEspaço e
contador; depoisTab ao botão e todas as antigas assertions de foco/expandir/axe.
Sem mudança funcional, de timeout, retries, dependência ou workflow.

GREENfocal2/2; regressão ampliada186/186(editor+respostas,desktop/mobile), sem
retry; estados/densidade/linguagem16/16 e gate textual de linguagemPASS. P05
repetido6/6PASS, além da regressão; não reproduzido, não declarado corrigido.
Lint/sintaxeNode22/diff/secretsPASS. Dois comandos iniciais usaram cwd incorreto
na localização da ferramenta; foram setup, nãoRED nemGREEN, e repetidos no cwd
correto antes de registrar resultados. Sem backend/BFF/runtime alterados;
build/types/RLS do código funcional anterior permanecem evidências com seus
commits, não execução nova do patch. R4/UX anteriores continuam limitados ao
artefato que examinaram; não foi alegada revisão independente nova destes testes.

OsPNGde08 gerados pela regressão foram restaurados dos bytes do índice na própria
worktree. Relatório/ordem de integração584–592 e planejamento20fases estão fora
daPRem/workspace/planejamentos, sem novas funcionalidades misturadas neste patch.

NovoCI/scanners: pendentes após push do commit corretivo. Não herdar os19SUCCESS
anteriores nem dizer que186testes equivalem ao smoke completo1538. ManterDraft,
semmerge/deploy/migrationexterna. Descrição daPRregistra HEAD/run posteriores.

## Checkpoints anteriores — histórico, substituído pelo estado acima

## Checkpoint de abertura — código55a420c, 25/11/2026

Interface utilizável implementada e salva em origin, base09cd68dde. PR10 própria
Draft preparada sobre09; a descrição da PR e checks doHEAD passam a registrar
resultados posteriores ao commit deste checkpoint. Sem merge/base implícitos.
PR591Draft OPEN com21SUCCESS/1SKIP(SBOM) conferidos nesta rodada; não são CI10.

| Gate | Resultado e escopo |
| --- | --- |
| Domínio e PostgreSQL | PASS35+63 em bbc7698;49regressões+14novasPG, runtimeNOBYPASS/FORCERLS e barreiras, antes de conteúdo |
| HTTP | PASS10; contrato/DTO/guardas/auditoria |
| BFF específico | PASS26;22regressões+4novos, permissões/origem/limites/projeção |
| Backend completo55a420c | PASS5685testes/479suítes;434testes/20suítesSKIPPED, não aprovados pelo comando padrão |
| Browserdev55a420c | PASS20/20;10cenários×desktop/mobile |
| Browserprodução local55a420c | PASS28/28;20novos+8regressões07/08/organização, nextbuild/start Node22 |
| Webbuild/types/lint/linguagem | PASS; rota nova incluída no artefato |
| Backendbuild/types/artefato | PASS repetido no código55a420c, Node22, artefato dist/main.js verificado |
| R4integral independente | Favorável estática55a420c, sem novos achados; não executou bateria autoral |
| UX | A/D anterior eB/C/D das duas personas registrados; paciente diretoN/A |
| Segurança/governança local | PASSdiff/secrets/redaçãoauditoria/migrationsgovernança; nenhuma migration10 |
| Webtest:authzglobal | PASS, comando completo exit0 em55a420c;69 é só a contagem do último script, não o total global |
| CI10/scanners | NOTRUN antes da abertura; conferirHEADexato daPR, sem herdar verde09 |
| Pessoas reais/leitor de tela manual | SKIPPED: sem sessão humana/tecnologiaassistiva manual; axe/teclado não substituem |

Todas as provas usam fontes sintéticas/ambiente descartável ou navegador com
rotas simuladas. Browser não é provaRLS; PG tem execução própria separada,
selecionada pelo runner oficial no arquivo copia-pergunta.integracao.spec.ts.
Nenhum testeSKIPPED torna-sePASS por proximidade de outra evidência. Sem prova
multiplos processos real por browser; fronteiras têm provas específicas acima.

Sem alteração de schema10, contratos clínicos históricos ou permissões. Reverter
o código específico10 remove a consulta/interface sem transformar ou reescrever
respostas/snapshots/auditorias; o rollback operacional da09/migration1088 herdada
continua separado e exige seu runbook/autorização. Sem operação externa ou FOOD06.

Próxima ação: confirmar checks/scanners doHEAD daPR,
registrar resultados na descrição sem push cosmético, corrigir somente achado
reproduzível. Manter Draft; não iniciar nova entrega, merge ou deploy.

## Checkpoints históricos — não representam o estado vigente

Branch feat/qst10-10-comparacao-retornos, base09cd68dde explícita. SemPR10 ainda.
PR09 é591Draft, semmerge. Runtime09f945fd3 passou R4 estática integral e UXB/C;
rechecagem estática do gatecd68dde favorável. Posteriormente o comando global
Webtest:authz terminouPASS(exit0) na worktree09; PRbody atualizada sem push
cosmético que reiniciasseCI. Não usar69testes do último script como total global.
CI/scanners591 noHEADcd68dde continuam pendentes de comprovação.

## C1 — domínio local, não entrega funcional10

Escopo aprovado no plano-questionarios-10-prs, UXA/D em QST10-09-10-AD-2026-11-23.
Snapshots congelados, IDs estáveis; contexto deve ser mesmo paciente/formulário.
Ordem cronológica só com duas datas válidas/diferentes; caso contrário ordem
explícita de seleção, sem inventar anterior/posterior. Ausência/zero/falso
distintos; diferenças só para definições e parâmetros conhecidos compatíveis.
Metadados visuais seção/ordem/categoria não alteram medição; texto auxiliar/chaves
desconhecidas conservados por precaução. Opções por identidade/conteúdo, não ordem.
Unidades preservadas por lado; nenhuma conversão ou valor clínico implícito.
Anexos só indicadores/contagem, sem transportar referências/capabilities. Arrays
com origem/tipo desconhecidos não são divulgados como alternativas/anexos.

RED funcional28FAIL/1PASS com contrato compilável ainda não implementado; erros
iniciais de tipagem/fixture foram corrigidos e não contaram comoRED. GREEN29/29;
mais4regressões de valores/duplicatas/campos especiais:33/33. Seleção conjunta
63/63PASS (33novos+completude/estados/comandos existentes). Typecheckbackend,
Node22.21.1PASS. Nenhuma API/BFF/UI/persistência/serviço novo disponível ainda.

Próximo C2: reutilizar selecionar/hidratar do leitor08, mantendo autorização
antes de snapshot/valores e sem fallback atual no modo comparação. Exigir sessão/
identidade/permissão atuais após locks, paciente explícito e exatamente2respostas
autorizadas, mesma transação. Reusar verificação do ator09 por helper compartilhado
sem mudar sua política; preservar caminho08. Provar revogação/transferência sob
barreira PostgreSQL/RLS e imutabilidade; sem migration prevista. Depois BFF,
seleção de2 em memória entre páginas, UI comparativa, UXB/C e R4 próprios.

Semmerge/deploy/DDLexterna ou alterações FOOD06/Claude. Não chamarC1 entrega10
concluída. Preservar09 e CI sem integrar alterações silenciosamente.

## C2 — API/leitura autorizada implementada; interface ainda pendente

Novo POSTquestionarios/:id/respostas/comparacao, permissãoquestionarios.ler,
paciente explícito e exatamente2IDs; DTO/pipe rejeitam extras e tipos inválidos.
Selecionar/hidratar08 reutilizados com limites/locks/volume antes dos valores;
modo comparação usa exclusivamente snapshots congelados e não calcula resumos
ou consulta definição atual. Metadados mínimos até autorização atual; depois
identidade/sessão/profissional/paciente/envios/respostas na ordem compartilhada.
Prazo da sessão conferido depois de esperas antes do conteúdo e antes de retornar.
A verificação de ator09 foi extraída sem mudar sua política; modo legado08 intacto.
Auditoria da comparação registra ação/recurso, nunca respostas ou IDsdo par em
metadados; leitura não marca revisado nem altera snapshots/respostas.

TDD:8falhas funcionais com método ainda indisponível; seleções iniciais também
incluíam barreiras sem operação implementada (não sãoRED de concorrência).
GREEN inicial10PG; após3casos adicionais e correção de escopo da fixture:
62/62PG =49regressões07/08/P05 +13novos. Transferência/revogação com barreiras,
expiração enquanto aguarda paciente, contexto cruzado e memória histórica
inalterada comprovados em runtimeNOBYPASS/FORCERLS. Sem schema novo ou banco
externo. Outra seleção após reinício:24PGrecorrências+67serviço+33domínioPASS;
o arquivoPG falhou por erro de escopo dos3testes novos, não por função do produto.
O escopo foi corrigido sem remover assertions, resultando62/62 acima.

HTTP10/10PASS (6antigos+4novos):DTO/guardas/privacidade/auditoria. Uma expectativa
inicial de nenhuma auditoria de negação estava errada; corrigida para exigir as2
entradasauth.autorizacao.negada e nenhuma chamada ao leitor. Não desabilitar
ou omitir auditoria legítima para fazer o teste passar. TypecheckNode22PASS;
redação de auditoria/diff/secretsPASS. Build/backend/revisãoR4 têm estado separado.

Em25/11 oCI591cd68dde concluiu21SUCCESS/1SKIP(SBOMprovenance), inclusive step
RLS/Testcontainers do run45399556076/job138464718545. PRbody atualizada somente,
sem commit cosmético/restartCI; permaneceDraft, semmerge/deploy/operação externa.
PróximoC3: BFF/seleção2 por contexto em memória e interface, sem modelo atual
substituindo histórico, UXB/C sobre UI executada e R4 integral10 antes de concluir.

## Correção P2 R4 e fuso de apresentação

Revisor independente qst10_backend_r4 examinou61c5587 e reproduziu no próprio
fonte a colisão de canonização: objeto{a:1} e array[[a,1]], ouobjeto{} earray[],
viravam mesma assinatura e permitiamdelta. Não houve outro achado concreto no
backend. Primeiro comando independente falhouTS5011; não conta como reprodução.
Repetição comrootDir explícito confirmou. Autor reproduziu2REDfuncionais;
canonização agora etiqueta objeto/array e conserva a distinção, sem modificar
snapshots nem preencher defaults. Acrescentada prova do fuso clínico já resolvido
no servidor:1RED por falta do campo na resposta, agora projetado e incluído no
limite completo do envelope. Nenhum fuso é aceito do navegador.

GREEN98/98 =35domínio+63PG(49regressões+14novas). RechecagemR4 pendente até commit
corretivo; frontend/BFF aindaNOTRUN. Sem nova migration/dependência/operação externa.

## C3 — primeira interface, 25/11

Preservado `bbc7698` em origin. BFF aditivo implementado com sessão/permissão,
origem, corpo de 2 KiB, envelope de 8 MiB, allowlist e erros seguros. Runner
específico 26/26 PASS (22 regressões e 4 novos), sem cálculo paralelo. API usa
POST de consulta, sem alteração clínica; mapa de rotas atualizado.

RED navegador: checkbox de comparação inexistente, página previamente pronta.
GREEN inicial desktop: selecionar em duas páginas e confirmar explicitamente.
Hook no workspace mantém no máximo dois metadados em memória, invalida geração
monotônica ao trocar contexto/remover/cancelar e não usa storage. Tabela de
comparação reutiliza resultado autoritativo e fuso servidor, sem definição atual
como fallback, com causas por campo e datas/versões indisponíveis explícitas.
Typecheck e lint afetados PASS. Dois erros de fixture/seletores iniciais não
contam como RED funcional: texto duplicado, seletor CSS axe inválido e alerta
global ambíguo foram corrigidos sem enfraquecer assertions. Axe encontrou nome
acessível do botão de remoção sem seu texto visível: corrigidos botão e checkbox
para preservar o texto visível; regressão final ainda em execução.

Pendentes neste checkpoint: bateria final desktop/mobile/zoom/axe, build,
authz Web global, regressão backend global, UX B/C e R4 integral. Nenhum desses
gates é PASS por antecipação. Sem migration10, merge/deploy/banco externo.

C3 navegador final dev: 20/20 PASS (10 cenários × desktop/mobile), incluindo
axe, teclado, zoom200%, seleção entre páginas, mudança de questionário/paciente,
zero/falso/ausência/incompatibilidade/anexos, cancelar/remover/retorno tardio,
403 seguro e503 com tentativa explícita. Uma execução anterior parcialmente
interrompida por fixture e outra com rótulo antigo não são aprovação. Sem reduzir
assertions ou ampliar timeouts. B das duas personas registrada em
`docs/agents/ux/reports/QST10-10-BC-2026-11-25/`; paciente direto N/A. R4P2
rechecou3 reproduções no próprio fonte e confirmou a correção de canonização,
sem executarPG/HTTP; a revisão integral10 continua pendente.

## Consolidação antes da abertura

Código55a420c: authzglobalWeb terminou exit0; backendtypes/build/artefato também
confirmados no mesmo código, Node22.21.1. Browserprodução28/28 e UXC/D das duas
personas concluídos. Descrições/limites daR4 e das personas preservados, sem
transformar revisão estática em teste executado. Os dois PNG derivados de08
sobrescritos pelo próprio teste foram restaurados dos bytes do índice, sem
alterar relatórios históricos; capturas10 permanecem nos artefatos locais.

CI10/scanners aindaNOTRUN antes da criação daPR. Próxima ação após abrirDraft:
conferirHEAD/checks exatos e atualizar descrição com resultados, sem push cosmético.
PowerShellpreflightSKIPPED nesteLinux, sem execução declarada. Não há merge,
deploy, novo schema, gravação clínica ou operação externa.
