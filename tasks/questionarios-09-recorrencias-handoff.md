# PR lógica09 — domínio iniciado; execução de worker/API ainda bloqueada

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

Decisão de produto/segurança pendente enviada por pergunta: agendamentos antigos
não preservam o criador. Guardar autor nos novos e exigir reconfirmação dos
legados é recomendação, não regra implementada/autorizada por silêncio. Revalidar
autor/carteira no worker depende desse contrato. Não atribuir autor retroativo
nem trocar a política tenant-wide de equipe pela carteira do dono do questionário.
Continuar itens independentes; não escrever migration/worker de autoria antes da
resposta. Não merge/deploy/migrationexterna. Preservar FOOD06 do Claude.

Próximo: incorporar o checkpoint final08 explicitamente à base dependente;
registrar a decisão recebida; TDD de schema/CAS/locks e reautorização antes de
serviço/API/console. A04/FOOD06 e trabalhos de outras branches não são tocados.
