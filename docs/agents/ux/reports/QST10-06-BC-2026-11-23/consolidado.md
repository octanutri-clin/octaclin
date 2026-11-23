# Consolidação e aprendizado D

|ID|Origem|Funcionalidade/problema|Evidência|Prioridade|Solução/complexidade/segurança|Estado|
|---|---|---|---|---|---|---|
|NUX06-BC01|Nutricionista|Interpretação de nenhuma pendência|Hipótese; texto de ressalva real no mesmo resultado|P2|Ressalva existente/baixa/sem automação clínica|JÁ COBERTO na interface; compreensão real não testada|
|NUX06-BC02|Nutricionista|Reconferir pode sugerir salvar/substituir|Hipótese; nota e versão explícitas no código testado|P2|Nota existente/baixa/sem gravação|JÁ COBERTO na interface; compreensão real não testada|

Sem nova decisão de produto ou pesquisa real autorizada/realizada. Não aumentar
escopo com base nas personas. D: reutilizar invalidação por geração nos próximos
leitores; indisponibilidade histórica deve ser desconhecida, não zero/atual.

RevisãoR4 independente /root/qst06_review_recovery, estática de1b06fafb..ac98a37,
encontrouP2 na identidade por JSON: resultado antigo reaparecia em A→B→A ou
falha ao salvar. Dois testesRED reproduziram. Correção2d08ed4 usa identidade
nova da geração; reavaliação estática favorável, sem novos bloqueantes. Teste
tardio reforçado conforme observação do revisor. Não executou testes próprios.
A regressão62/62 do coordenador cobre o reforço e o salvamento falho.

Limites: sem leitor de tela manual/usuários reais. PostgreSQL é sintético,
não produção/migrations externas. CI do novoHEAD permanece pendente.
