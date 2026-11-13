# FOOD06 P2 — plano de carteira delegada e vínculo do portal

## Decisões do proprietário

Em 2026-11-13, o proprietário escolheu **planejar delegação explícita de
carteira para Collaborator** e **planejar unicidade no banco para vínculo ativo
do paciente com tratamento de duplicatas**. As escolhas autorizam planejamento;
não autorizam aplicar migration, consultar dados reais, sanear duplicatas, ativar
funcionalidade ou efetuar deploy. Esta nota é proposta técnica, não schema aplicado.

## Carteira delegada

Propor entidade tenant-scoped que vincule colaborador ativo a profissional ativo,
com concessão e revogação auditáveis, histórico preservado e RLS FORCE. Leituras e
escritas de pendências devem validar, na mesma transação e sob locks, usuário,
delegação vigente e profissional responsável atual do paciente. Colaborador só
lê restrições de sua autoria conforme Q6; delegação não confere confirmação clínica.
Precisam de decisão de produto/segurança antes de implementar: quem administra a
delegação, se ela abrange toda a carteira ou pacientes específicos, quando expira,
efeito de revogação/troca de carteira e experiência de usuário.

Pelo menos: testes positivos, outro tenant, outro profissional/paciente, papel ou
ator inativo, delegação ausente/revogada e revogação/reatribuição concorrente;
auditoria sem conteúdo clínico; ordem global de locks e rollback comprovados.

## Vínculo do paciente no portal

Avaliar unicidade parcial de `(tenant_id, usuario_id)` em pacientes ativos e com
usuário associado. Verificar antes se o modelo de representantes, menores,
ciclo de vida e reativação permite essa regra; não presumir que duplicata é
erro ou eliminá-la automaticamente. Vínculo ambíguo deve continuar fechado.

Preparar plano distinto para inventariar duplicatas apenas com agregados
sanitizados, revisão de cada caso no ambiente apropriado, decisão de resolução,
backup e tratamento de corrida com criação, reatribuição e reativação. Qualquer
consulta a ambiente real, saneamento ou DDL exige identificação explícita do
alvo, papel, autorização e runbook. Ensaio mutável apenas em banco descartável.
Testar concorrência, reversibilidade/limite com dados existentes, RLS, falha de
migration com duplicatas e boot do runtime sem privilégios de owner.

## Gates

Enquanto os controles não existirem e não forem provados, Patient e Collaborator
continuam fechados no helper inicial; duas provas estão marcadas TODO. P2 não está
completa. O planejamento não altera permissões, flags, banco ou configuração.
