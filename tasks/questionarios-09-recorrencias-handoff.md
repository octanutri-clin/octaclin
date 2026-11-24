# PR lógica09 — backend em validação; console e revisão final pendentes

Branch `feat/qst10-09-recorrencias`, base08 atualizada por `5bacefc`; ainda sem PR09.

Estado atual: implementação09 local concluída no código f945fd3, com R4 integral
estática e UXB/C favoráveis. Gates locais abaixo; authzglobalWeb em execução e
CI novoHEAD pendente. ManterDraft, sem aceite global/merge/deploy.

## Histórico C1 — substituído pelos checkpoints seguintes
Plano canônico: [dez entregas](plan-questionarios-10-prs.md).

C1: estados factual ativo/pausado/encerrado/inativo_legado; uma execução única
não é presumida pela data passada. Retomada de pausa explícita calcula próxima
ocorrência estritamente futura, sem catch-up nem mutação do objeto original.
Reutilizado o mesmo resolver CronExpressionParser do serviço, extraído sem
alterar as regras dos leitores/escritores atuais. Sem migration/API/worker/UI
novos nesta etapa. Não considerar a09 implementada funcionalmente.

TDD Node22.21.1:9REDfuncionais;GREEN76/76 (9novos+67regressões do serviço).
Typecheckbackend,diffcheck e scannerlocal de segredosPASS. Banco/CI/R4/UXB-C
NOTRUN para09 (não houve alteração de fronteira nem persistência nestaetapa).

## Decisão vigente — D09-01 aprovada

O proprietário escolheu **exigir reconfirmação dos antigos** após retirar
expressamente a resposta anterior de adiamento. Antigos sem ator comprovável
não geram novos envios até pessoa autorizada reconfirmar; envios, links, rascunhos
e respostas existentes são preservados. Nos novos, registrar ator autorizado e
revalidar acesso a cada geração. Não atribuir autoria retroativa.

Reconfirmar autorização não desfaz pausa deliberada nem reativa envio encerrado.
Não estreitar escopo de equipe à carteira do dono do questionário por inferência.
A referência do ator atual não é um campo de criador histórico presumido.
A política já está aprovada; não pedir a mesma confirmação novamente. Ver plano
canônico para etapas/commits C2a–C5 e riscos de FKs/retenção/auditoria a mapear.

A implementação de schema/API/worker/UI continuaNOTRUN, nãoBLOCKEDpor falta de
resposta. Gates de segurança continuam obrigatórios. Sem merge/deploy ou migration
externa, sem alterar trabalhos FOOD06 ou PRs já revisadas.

Próximo: incorporar o checkpoint final08 explicitamente à base dependente;
aplicar a decisão D09-01; TDD de schema/CAS/locks e reautorização antes de
serviço/API/console. A04/FOOD06 e trabalhos de outras branches não são tocados.

## C2a — estrutura aditiva implementada (checkpoint local)

Base08 incorporada por merge normal `5bacefc`, preservando os commits e a
correção do registro de migrations. Migration1088 livre na base inspecionada,
registrada uma vez após1087; exige aplicação deliberada fora de banda, não foi
executada em ambiente externo. Novos campos: revisão positiva, pausa explícita e
referência opcional ao usuário da autorização atual. Legados continuam sem ator;
não existe backfill de autoria. FK composta impede ator de outro tenant. Exclusão
do usuário limpa apenas a referência (PostgreSQL15), preservando tenant e agenda;
o worker deve bloquear ator ausente na C3. Isto não concede permissão nova.

Rollback pré-uso transacional/READ COMMITTED, com lock exclusivo e leitura sem
RLS para detectar qualquer uso; recusa remover controles após autorização,
revisão alterada ou pausa. Não é um procedimento autorizado para banco externo.

Node22.21.1: baseline10/10PASS; REDfuncional2/2 por ausência dos controles ORM;
GREEN11/11:2ORM+1registro+8PostgreSQL15 descartável (runtimeNOBYPASSRLS,
FORCERLS, FKtenant, legado, constraints, CAS, remoção do ator, rollback/up).
A prova de CAS aqui é sequencial; concorrência controlada de worker/pausa fica
NOTRUN até C3b. Não confundir o schema com entrega funcional da09. API, worker,
console, UXB/C, R4 e CI do delta continuam pendentes. Próximo: C2b.

## C2b/C3 — comandos e worker (checkpoint local posterior)

Serviço/API adicionam lista por questionário+paciente, páginas de25, comandos
pausar/retomar/reconfirmar com confirmação explícita e revisão CAS. A criação
mantém cron/data única e registra o ator atual. Validar todos os campos fornecidos,
mesmo quando cron e data coexistem; limites120/80 e fuso IANA. Resposta mínima
não expõe ator interno nem tenant/sessão. Reconfirmação não retoma pausa, não
reabre encerrado e não gera catch-up. Envios/rascunhos anteriores permanecem.

Autorização atual na mesma transação: questionário→identidade ativa/permissão
compartilhada por papel→sessão HTTP→profissional ativo→paciente/carteira→agenda.
Worker não depende de sessão interativa. Lê no máximo100 candidatos por lote,
sem acumular locks entre agendas, relê revisão/ator/estado/vencimento após espera.
Envio+avanço+auditoria são atômicos. Conflitos recuperáveis não repetem cegamente.
Ator ausente não gera. Acesso invalidado remove somente autorização atual por CAS
exato e audita o bloqueio; assim agendas bloqueadas não monopolizam o lote. A
reconfirmação concorrente não é sobrescrita. Autoria histórica não é preenchida.
A expiração anterior é executada separadamente; não segura locks de envios durante
locks de geração. Não é uma reescrita do fluxo público de respostas.

Provas: RED funcional3/3 no worker anterior (legado, inativação, transferência
produziam1envio); GREEN124/124 =22integraçãoPG+8migrationPG+67regressõesserviço+
13domínio+14DTO. Barreiras reais observadas em pg_stat_activity:worker×worker,
pausa×worker nas duas ordens, carteira/revogação antes do lock. Testes verificam
persistência, auditoria única, revisão stale, preservação do rascunho e rollback
após insert. Ambiente PostgreSQL15 descartável/runtimeNOBYPASSRLS/FORCERLS.
REDDTO2/14 por campos mutuamente presentes sem validação/limites; GREEN14/14.
Erros iniciais de fixture/compilação foram corrigidos e não contam como RED.

Buildbackend e gate de redação de auditoriaPASS. Typecheck e artefato de produção
registrados após a execução final. R4 ainda não executada para este checkpoint;
UI/BFF e UXB/C NOTRUN, CI novoHEAD NOTRUN. Sem migration externa ou merge.
Próximo: revisão independente do backend e C4(console/BFF/testesdesktop-mobile).

## Rechecagem R4 do backend — correção do relógio e conferência de futuro

Revisor independente `/root/qst09_backend_r4` examinou976bd1d, executou30/30
PG (22controle+8migration) e confirmou1P2: cron de minuto após espera usava o
horário inicial e podia gravar próxima já vencida. RED real adicional com barreira:
início12h, liberação12h03m30s, próximo12h01 (inválido). Correção usa relógio depois
da espera/escrita para última/próxima execução, sem catch-up. Observação de fuso
null preexistente corrigida normalizando uma vez antes de calcular e persistir.

GREEN91/91 (24PGcontrole+67serviço) após correção; GREEN3/3 da projeção de próxima
ocorrência informativa (RED3/3 antes). O console recebe data futura calculada pelo
mesmo motor ou ausência explícita; envio único vencido/encerrado não recebe data
inventada. Conferência informativa não é reserva nem substitui a revisão CAS ou
a revalidação ao confirmar. Rechecagem independente do delta ainda pendente.

## C3b — limpeza do harness após falha sob carga

Preservada tentativa independente5PASS/2FAIL/20SKIPPED: timeoutJest no cenário
worker×worker e TRUNCATE seguinte aguardando operação anterior pendente. A
limpeza agora rastreia workers/comandos, libera barreiras e aguarda as promessas
antes do próximo teste; sem aumentar timeouts, enfraquecer asserts ou transformar
falhas emPASS. Nova execução autoral limpa35/35PASS (24PGcontrole+8PGmigration+
3projeção), Node22/PostgreSQL15/runtimeFORCERLS. Rechecagem independente do
harness/entrega integral continua pendente. Backend completo no código f0d9769:
5645PASS,420SKIPPED,0FAIL (6065total,477suítesPASS/20SKIP). Não repetir integral
por ajuste exclusivo no harness ignorado pelo perfil padrão.

## C4/C5 — estado vigente, substitui pendências locais já comprovadas acima

Código f945fd3; testes/console e BFF versionados. Backend35/35PG/projeção no
harness corrigido, suíte padrão5645PASS/420SKIP, build/artefato/typecheckPASS.
Web: BFF22/22; build final de produção e TypeScriptNode22PASS; lint sem avisos,
linguagemPASS. Playwright final16/16 no build de produção, desktop/mobile, inclui
2casos de criação legada e14novos. Não herdar oPASS de runs anteriores.

R4 integral independente favorável e UXB/C nos relatóriosQST10-09-BC-2026-11-24,
com métodos, falhas anteriores e limitações preservados. Nenhum usuário real nem
leitor de tela manual:SKIPPED, sem ambiente/pessoa de validação. PreflightPowerShell
não executado neste ambienteLinux. CI/scannersnovoHEAD pendentes; authzglobalWeb
iniciada localmente e ainda em execução, nãoPASS. Acompanhar sem alterar códigos
ou configurações apenas para obter verde. Não iniciar liberação operacional.

### Operação/rollback — proposta, nenhuma execução externa

Migration1088 é pré-requisito do runtime novo. SQL aditivo é compatível com
leitores antigos, mas o worker antigo NÃO implementaD09-01; portanto rollback só
de código para worker antigo não é estratégia segura de autorização. Antes de
ativação/rollback externo, exigir autorização própria, contenção controlada do
worker, conferência de schema/ledger/roles/RLS, backup/ensaio adequados, migration
owner fora de banda e implantação coordenada backend/worker antes da interface.
Preservar colunas/dados depois de uso; down recusa perda dos controles. Não
prometer que reverter deploy restaura segurança/persistência. Não foi feita
alteração de serviço,main,Neon,Render,cobrança ou produção.

Próximo: DraftPR09 sobre08 e CI doHEAD, depois entrega10 conforme plano já
aprovado, mantendo09Draft até gates finais e autorização específica de integração.

## Gate oficial PG — lacuna de seleção corrigida após abrirDraft591

A inspeção do runner existente mostrou seleção explícita sem as novas suítes.
Acrescentadas somente controle-agendamentos.integracao e migration1088.integracao
na lista do mesmo runner test:rls:testcontainers, sem workflow/dependência/gate
alterado. RED1 de registro confirmou ausência; GREEN do registro e sintaxeJS
verificados após inclusão. As32provas reais já passaram separadamente, não são
aprovadas pelo teste estático de seleção. OCI do novoHEAD deve executá-las no
step oficial; o resultado de9513c77 não comprova essa seleção posterior.

Este push adicional é necessário para eliminar um falso verde possível; não é
reenvio cosmético. Runtime permanecef945fd3, sem nova alteração funcional.
