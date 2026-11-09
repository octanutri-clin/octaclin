# FOOD06 — roadmap de conclusão (reconstrução)

Proposta sobre base137aa547; ordem por dependências, valor e possibilidade de
comprovação. Não é autorização de novo escopo ou de operação. Todos M01–M12
continuam obrigatórios. [Critérios](food06-pendencias-por-criterio.md) e
[bloqueios](food06-bloqueios-compartilhados.md) definem cada fechamento.

## Frente1 — fatos independentes de DRI numérica

| Incremento/prioridade | Dependências | Entrega e encerramento | Testes/risco |
| --- | --- | --- | --- |
| I01 P1: fontes factuais M01 | B03/B08; B05 | Projeção por nutriente nas saídas existentes; concluir incremento e reavaliar C1/C2/C3, sem encerrar M01 por presunção | FT01–FT20 aplicáveis, legados, catálogo alterado, allowlists, revogação, PDF real se conteúdo mudar; risco de fonte inventada e histórico reescrito |
| I02 P2: aceite integrado M02 | I01 apenas para origem compartilhada; B05 | Reconciliar C1/C2 e preservar PASS C3; fonte/preparo, receitas fracionárias, alternativas escolhidas, repetições e seleção | Suítes existentes exatas antes de adicionar casos; prova PG quando necessária e browser paginado/negações; risco de dupla contagem |
| I03 P1/P2: causas coerentes M03 | I01, B05; B02 só no científico | Mensagens/ações derivadas de motivos backend nas saídas, incluindo indisponibilidade científica explícita | Canários de logs/projeções e respostas por motivo; sem diagnosticar ou inferir elegibilidade |

M01/M02 podem receber proposta de fechamento antes da DRI se todos os próprios
critérios e gates estiverem comprovados. M03 precisa demonstrar a completude do
catálogo/integração; não presumir candidata só por ter ajuda M09.

## Frente2 — referências e rastreabilidade científica

Consolidar B01 com proprietário/jurídico e B02 com engenharia/clínica. Preservar
CL01–CL08, fontes/versões/populações/unidades/formas e condições do protocolo.
Não importar/ativar tabelas ou percentuais enquanto os gates aplicáveis estiverem
abertos. Preparar uma sequência revisável: manifesto autorizado → contrato versionado
→ elegibilidade/matemática → saídas M04/M05/M06/M07/M08/M10 → regressões.

P1: resolver dependência compartilhada antes de múltiplas implementações parciais.
Encerramento: referência reproduzível, direitos/atribuição, histórico e atualização
sem reescrita, equivalência semântica e negativos clínicos. Sem nova decisão clínica
ou jurídica por inferência. B07 exige provas próprias além de um dataset permitido.

## Frente3 — prévia, consulta e cenários

1. P1: mapear critérios restantes M04/M11, preservando a seleção factual já entregue.
2. P1: tratar B04 em contrato próprio aprovado para individualização. Consulta genérica
   atual continua distinguida de sugestão compatível com paciente.
3. P1: implementar M12 por incrementos: composição temporária determinística;
   comparação de cenários; confirmação via revisão/fingerprint/CAS/PA07 existentes.
   Exigir testes de cancelamento, contexto/paciente, tardio, replay e rollback.
4. P2: matriz de integração FOOD04/05/07/PA06: descobrir capacidades reais da base,
   proteger dependências ausentes; não criar um segundo motor ou ativação incompleta.

Reutilizar seletor/soma PA06, `compararCenariosFactuais`, writer M04 e porcionamento
existente. Uma chamada de comparação antes/depois não entrega toda a M12. Não
expandir o incremento I01 para implementar esta frente.

## Frente4 — aceite transversal

Para cada incremento, rastrear requisito→código→teste→commit. Reusar evidência
equivalente que não tenha sido invalidada; executar lacunas pequenas antes de gates
globais. Segurança/RLS, CAS/idempotência/rollback, desktop/mobile, teclado/zoom,
PDF real, tecnologias assistivas aplicáveis, UX A/B/C e revisão R4 têm evidências
distintas. Não somar suítes sobrepostas ou chamar revisão estática de execução.

P2: ao aproximar fechamento das melhorias, consolidar CI do HEAD final e revisões
independentes do escopo integral. Critérios não cobertos ficam BLOCKED/NOT RUN;
Backlog não pode esconder requisito obrigatório. P0 verificado tem precedência;
nenhum novo P0 foi demonstrado por esta reconstrução documental.

## Frente5 — liberação operacional

B06 permanece separado: conferir estado real/schema/ledger/roles/RLS, backups e
compatibilidade de envelopes/leitores/escritores; propor sequência segura de
migrations e serviços, ativação, smokes, interrupção e rollback. Nenhuma dessas
operações é autorizada por este roadmap. Não usar referências operacionais antigas
do chat como estado atual de produção nem assumir ausência/presença de migration.

## Próxima tarefa única

**I01 — completar rastreabilidade factual por micronutriente**, delimitada no
[handoff](food06-handoff-proxima-execucao.md). Já tem autorização de implementação
no histórico do proprietário, mas não é executada por esta reconstrução. O Claude
deve confirmar posse da worktree/HEAD e capacidade do ambiente antes de retomar.
