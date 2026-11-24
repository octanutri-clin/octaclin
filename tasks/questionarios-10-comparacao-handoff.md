# Entrega10 — comparação de dois retornos

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
