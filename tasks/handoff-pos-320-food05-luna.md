# FOOD05 — checkpoint de backend/API e próxima etapa de interface

## Modelo e autorização

Desenvolvimento autorizado em Sol médio. Próxima troca recomendada: **GPT 6 Luna
alto para T10–T13 de interface**, com revisão posterior em Sol médio dos caminhos
R4, cópia/modelos e gates finais. A troca depende da ação manual do proprietário;
não presumir que ocorreu. M01–M08 continuam essenciais, sem redução de escopo.

Branch `docs/pos320-food05-planning`, worktree física
`/workspace/octaclin/.worktrees/pos320-food04-planning`. PR446 Draft. Ler o estado
real atualizado em [execução](execucao-pos-320-food05.md), não inferir conclusão da
feature a partir dos testes focados. Não executar produção/infra/migrations externas.

## Contratos já implementados para a interface

- `lib/equivalencias-plano-api.ts`: tipos públicos, preview POST cancelável e
  preferências GET/PUT pessoais; nunca enviar ator, fatos confiáveis ou tenant.
- Rotas reais Next usam `[id]`: `/api/pacientes/:id/planos-alimentares/:planoId/equivalencias/previa`.
  Preferências: `/api/profissionais/me/preferencias-equivalencia`.
- Prévia recebe `{versaoId,rascunhoRevisaoEsperada,documentoEdicao,itemChave,
  nutriente,alternativas,politica}`. Até20 alternativas e96KiB no pedido inteiro.
- `principal`/`alternativa` expõem descrição/preparo/base/fonte e dados disponíveis.
  `comparacaoIndividual` e `impacto` são cenários independentes fornecidos pelo
  motor. Não somar alternativas nem recalcular nutrientes no navegador.
- Para sugestão nova, omitir `porcaoGramas` e medida aplicada da candidata; uma
  porção enviada é ajuste explícito. Medida caseira escolhida explicitamente
  volta a usar FOOD01 e mostra gramas/resíduo efetivos; não inventar conversões.
- Resultado `indisponivel` tem motivo por linha; calculável não implica aplicável.
  Resíduos podem ser `<0.00000001`/`-<0.00000001`: não passar isso cegamente a Number.
- Comando só na alternativa: `equivalencia:{acao:'calcular'|'recalcular',
  aplicacaoId:UUIDnovo,anteriorAplicacaoId?(obrigatório em recalcular),
  fingerprintEsperado:fingerprintDaLinha,nutriente,politica,porcaoEfetiva}`.
  Atualizar também a porção do item ao valor escolhido; não mudar o principal.
- ACK devolve `{aplicacaoId}`, não repetir comando nos autosaves. Mapas profissionais
  `equivalenciasAplicadas`/`equivalenciasEstado` vêm separados do documento.
  Preservar referência na conversão formulário↔documento e no merge do ACK/PA07.
- Nova alternativa deve ter preferência/liberação falsas. Backend recusa comando
  novo com flags positivas; decisões de alternativa já salva são preservadas.
  Quem abre plano legado pode precisar salvar o documento antes de converter uma
  alternativa existente com flags legítimas; não desligá-las silenciosamente.
- Omissão não desvincula; null não resolve contexto ativo. Resolver explicitamente
  com `{acao:'desvincular',aplicacaoId:UUIDnovo,anteriorAplicacaoId,
  fingerprintEsperado:fingerprintResolucao}`. Preserva porção e registro interno.
- Mudança semântica salva marca revisão pendente, sem recalcular; estado só resolve
  via recálculo confirmado ou desvinculação. Revisar/publicar bloqueiam pendência.
- `equivalenciasEstado:'indisponivel'` exige erro/ação bloqueada, não tratar como
  mapa vazio. Históricos publicados usam snapshots materializados, sem recálculo.
- Medidas salvam referência explícita. Ao mudar para gramas, seguir o editor atual
  (`medidaCaseira:null`, limpar referência local), evitando manter conversão antiga.
- Preferências: schema1, gramas0–3 casas, nutrientes0–4, passo1/0.1/0.01/0.001,
  modo compacto/detalhado e gramas com/sem medida. CAS `revisaoEsperada`; formatação
  não altera porção persistida. Resíduo não nulo não pode parecer igualdade.

## Trabalho restante — não declarar FOOD05 concluída

1. T10 painel compartilhado e preferências, debounce/AbortSignal, resposta tardia,
   tabela desktop/cartões mobile, teclado/axe. Usar dados sintéticos.
2. T11 integração com editor, autosave60s, posse PA07, dirty/ACK, limites20/96KiB,
   cancelar sem efeitos. Acrescentar campo/tipo na serialização editorial Web.
3. T12 usar o mesmo painel na FOOD04, porções só na aplicação, origem preservada,
   seleção parcial, duplicata e recálculo explícitos; biblioteca não muda.
4. T13 indicadores e detalhe histórico. Antes de encerrar T07/T13, concluir a
   rastreabilidade em cópias entre planos e modelos: **não transportar contexto
   interno como capability e não remover FOOD05 silenciosamente na cópia**.
   Nova versão do mesmo plano já conserva o envelope; outros caminhos precisam
   de contrato/prova de origem e destino autorizados, remap de chaves e testes.
   Se exigir novos contratos de backend, retomar Sol médio antes de alterá-los.
5. T14 matriz PostgreSQL completa, regressões FOOD04 e CI; prova local atual é
   parcial. T15–T18 UI completa, revisão distinta final, governança/CI e entrega.

Todas as oito melhorias precisam de interface e testes antes da conclusão.
Checklist detalhado em [T01–T18](todo-pos-320-food05.md). Não habilitar entrega
parcial para pacientes nem remover Draft por conta dos testes de fundação.

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
