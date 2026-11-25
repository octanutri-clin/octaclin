# Registro de execução — plan-questionarios-10-prs.md

## Integração da PR02 #584 — checkpoint25/11/2026

Preparação autorizada pelo proprietário após a revisão da cadeia584–592.
HEAD remoto anteriorb2a59f83 preservado como ancestral; main855a35d2 (já com
#583) integrada explicitamente na branch de trabalho da própriaPR, sem rebase
ou forcepush. Worktreeisolada, sem alterar592/Claude/branches de terceiros.

Conflito documental resolvido preservando integralmente os dois registros: a
resolução/integração de583 e a entrega02. Os registros seguintes são históricos;
seus estados antigosDraft/CIpendente/regressãoemexecução não são o estado atual.

A conciliação automática do componente preserva as abasEnvios/Resumo da02 e as
distribuiçõesQPRO09 da main. A integração revelou incompatibilidade de testes:
o helperQPRO09 esperava distribuições visíveis na aba inicialEnvios. REDfocal
1FAIL/1interrompido/12NOTRUN, conteúdo encontrado porém oculto. Correção mínima
de teste abreResumo explicitamente e verificaEnvios como inicial após trocar
paciente/questionário, antes de reabrirResumo. Todas as assertions antigas de
expansão, dados, zero, rede, teclado/foco eaxe preservadas. Sem ajuste funcional,
redução de asserts, timeout ou retries. Primeiro start do servidor foi chamado
no cwd inadequado; falha de setup corrigida, não conta comoRED.

GREENfocal14/14 desktop/mobile (QPRO09+QST10-01/02). TypecheckWeb,lintafetado e
linguagemPASS Node22.21.1/Next16.4.5 compatível com manifesto, sem reinstalação
ou lockfile alterado. Regressão completa de leitura:82/82PASS desktop/mobile, sem retries, incluindo
os14focais (não somar reexecuções). Teclado/foco/axe/texto200% e contratos de
consulta, busca, CSV, contexto e distribuições preservados.

Buildglobal/backend/RLS/leitor de tela manual:SKIPPED nesta validação local de
integração visual, sem mudança de contratos/API/persistência; CI do novoHEAD
continua obrigatório e não herda21SUCCESS/1SBOMSKIP doHEADanteriorb2a59f83.
UX e revisão estática anteriores01–05 permanecem ligadas ao artefato que
examinaram, sem alegar nova execução independente da integração atual.

BaseGitHub será alterada para main antes do push para validar o novoHEAD com a
base correta. Nenhum autoMerge habilitado. Nenhum merge daPR, escrita emmain,
deploy ou operação externa executado. Depois doCI, o proprietário decide o
merge;585 só deve ser retargetada após584 efetivamente entrar na main.

## Histórico preservado

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

## PR01 #583 — atualização da base e resolução de conflito

Integração explícita de main00810d9 na branch da própriaPR, mantendoHEADanterior
19c94939 como ancestral, sem rebase/forcepush ou alteração de outrasworktrees.
Conflito único: ambas as branches acrescentaram testes no final do mesmoarquivo.
Preservados integralmente o arquivo de testes da main(QPRO09distribuições) e o
bloco originalQST10-01, sem reduzir assertions. Produção conciliada automaticamente;
a diferença funcional diante da main permanece somente a variação neutra.

Validação local Node22.21.1:10/10Playwright desktop/mobile(QPRO09+QST10-01),
typecheckWeb,lintafetado,sintaxe,diffcheck e scannerlocal de segredosPASS.
Sem novos comportamentos ou testes inventados comoRED. Buildglobal/suíteintegral
localNOTRUN: checks oficiais do novoHEAD devem validar a integração completa.
Arquivos gerados pelo Next no ambiente local restaurados à versão do índice;
regras AGENTS intactas. Nenhuma migration, merge da PR, deploy ou escrita emmain.
CI anterior19c94939 é evidência histórica; novoHEAD aguardará seus próprioschecks.

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
