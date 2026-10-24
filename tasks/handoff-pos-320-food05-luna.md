# Estado atualizado — implementação autorizada, ainda em Sol médio

A autorização “Pode seguir, sol médio” substitui a restrição operacional do
planejamento original abaixo. O histórico é preservado para rastreabilidade.
Ler primeiro [execução](execucao-pos-320-food05.md) e [handoff ativo](plan.md).
T01–T05 têm focados PASS; T06/T07 em integração local. T08–T18 não concluídos.
Uma PR funcional escolhida; PR446 segue Draft, sem entrega funcional declarada.
Não trocar de modelo sem avisar e pausar para o proprietário.

---

## Handoff original de planejamento — estado operacional supersedido

# FOOD05 — handoff de planejamento, sem execução autorizada

## Estado

Branch `docs/pos320-food05-planning`, base main2f24fcb1, worktree física
`/workspace/octaclin/.worktrees/pos320-food04-planning`. Root/main antigo com
alteração preexistente não foi tocado. Branch inclui cherry-pick47ed21f2 do registro
operacional FOOD04 (origem43345453); nenhuma mudança de runtime foi escrita.

O proprietário aprovou D01–D14/M01–M08 e autorizou **somente planejamento**.
Aguarda revisão do plano e autorização expressa de implementação. Não interpretar
“escopo aprovado” como aceite das propostas numéricas/de autorização ainda apresentadas.

## Ler nesta ordem

1. [Plano completo](plan-pos-320-food05.md), em especial seções4–8 e12.
2. [T01–T18](todo-pos-320-food05.md),3 PRs sugeridas, M01–M08 todas essenciais.
3. [Referências específicas](referencias-pos-320-food05.md), não revisitar outros repositórios.
4. [Operação FOOD04](../docs/governance/EVIDENCIAS_ROLLOUT_FOOD04_2026-10-24.md).

## Decisões técnicas recomendadas para revisão do proprietário

- Razões BigInt/half-up no motor existente, saída aplicada compatível/versionada;
  sem depender de biblioteca decimal em produção ou inferência externa.
- Passo1g padrão/opções até0,001g; defaults pessoais no plano, diferença visual
  não altera valores persistidos. M05 usa passo/domínio e razão10x/0,1x como aviso
  objetivo de praticidade, não limiar clínico.
- Alvo calculável com macros incompletos pode ser conferido; aplicação respeita
  materialização atual completa, sem zeros inventados.
- Revisão pendente exige resolução antes de próxima revisão/publicação, sem
  bloquear rascunho ou alterar versão publicada anterior.
- Novo fluxo somente para Professional responsável; legado SuperAdmin permanece.
-3 PRs ou1 funcional; não liberar writer FOOD05 por API antes da integração completa.

## Contratos que não podem ser reinventados na execução

- Um alvo por operação,4 alvos; individual e FOOD04 usam o mesmo backend/painel.
- Prévia não escreve. Edição/seleção cancelada não altera documento/dirty/contexto.
- Grupos e principal não mudam; simulações de alternativas são independentes,
  não uma refeição com todas elas. Novas substituições não liberadas ao paciente.
- Snapshot cifrado1/2/3, dados canônicos autoritativos e projeções por allowlist.
- Comando novo gera UUID novo, ACK consome comando e devolve referência; próximo
  autosave não calcula novamente. Referência alterada semanticamente fica pendente.
- Omitir campo preserva contexto, null não remove vínculo; desvinculação explícita
  deixa resolução interna que impede ressuscitar vínculo. Recalcular exige nova
  identidade/anterior esperado. T06 é o gate desse contrato.
- Casas visuais não mudam parâmetros nem geram pendência falsa. Fontes globais
  editadas não recalculam snapshots antigos; nova aplicação reautoriza.
-20 alternativas/item,96KiB, PA07/ACK/AbortSignal e autosave60s preservados.

## Segurança e operação

FOOD04 #441 mergeada;1078 staging aplicada/validada no último registro.
Produção BLOCKED HTTP402/quota e último backend update_failed. **Não** alterar
plano/cobrança/quota/infra, executar migration produtiva ou deploy sem nova
regularização e autorização específica. Não inferir estado externo do tempo/CI.
Nenhum acesso Neon/Render, teste de runtime ou dado real nesta rodada de planejamento.

## Revisão documental e evidências

Agente distinto `food05_plan_builder_check`, somente leitura, conferiu plano e
contratos relacionados. Achou uma lacuna no ciclo comando→ACK→autosave; matriz
normativa integrada em seção6/T06. Reavaliou delta e não apontou incompatibilidade
importante remanescente. Não é revisão de implementação, segurança R4 concluída
ou auditoria humana externa; nenhuma suite executada pelo revisor.

Verificações desta rodada: base/status/diff, leitura de fontes/contratos, referências
GitHub específicas, cobertura documental/link e secret scan. Resultados finais no
relatório de planejamento; G01–G05 NOT RUN, G06 BLOCKED. Não inventar PASS de código.

## Modelo e próxima ação

Sol médio concluiu o planejamento na configuração atual, sem elevar raciocínio.
Aguardar revisão/autorização. Depois: Sol médio para aritmética/snapshot/segurança;
Luna alto é suficiente para tarefas FE/DTO bem definidas. Antes de qualquer troca
manual, avisar e pausar; não alterar modelo silenciosamente.
