# PR lógica09 — domínio iniciado; planejamento liberado pela decisão D09-01

Branch `feat/qst10-09-recorrencias`, base08 `92821c7`; ainda sem PR09.
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
