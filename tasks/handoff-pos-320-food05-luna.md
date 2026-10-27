# Checkpoint D15–D18 — atualizado em 27/10/2026

O proprietário autorizou correções delimitadas D15/D16. O usuário confirmou a
troca manual para **Luna alto**; continuar nessa configuração até nova instrução.

- D15: cópia agora nasce `revisao_pendente` explicitamente; identidade nova,
  fingerprint recalculado, cálculo/ator original e cadeia cifrada preservados.
- D16: validação completa nas cinco fronteiras, incluindo campos conhecidos
  opcionais de catálogo, null/não finitos, profundidade12 e limite96KiB reutilizado
  do editor. Edição valida o snapshot atual antes de arquivá-lo. Erros400/503
  genéricos, sem gravações em rejeição. Modelos legados válidos continuam arrays.
- D17: autorização sobre paciente original permanece obrigatória; bloqueio de
  modelos FOOD05 e mensagem atual devem continuar. **Não implementar aplicação
  de equivalências por modelo nem apagar proveniência para contornar o bloqueio.**
- D18: direção futura de artefato matemático genérico com novo cálculo no destino;
  proposta técnica e autorização próprias exigidas antes de implementar. B1–B5
  do parecer são referência de riscos, não autorização para executar D18.
- T07 continua parcial; A04/A05 e gates de integração/revisão não são concluídos
  por D15/D16. Não reescrever snapshots históricos já publicados ou aplicações
  existentes para simular que a regra D15 existia anteriormente.

Evidências RED/GREEN e situação dos comandos em
[execução](execucao-pos-320-food05.md). Nenhuma migration/deploy/merge externo.

---

# FOOD05 — checkpoint de UI individual/FOOD04 e etapas restantes

## Modelo e autorização

Desenvolvimento autorizado; configuração atual Luna alto confirmada pelo usuário.
M01–M08 continuam essenciais, sem redução de escopo.

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

Antes de escrever o T07 de modelos, ler a
[revisão de arquitetura e riscos](revisao-arquitetura-t07-food05.md).
Ela define B1–B5 e registra os achados estáticos A01–A07; não substitui testes
de implementação ou revisão independente. Não remover a reautorização de origem
por inferência a partir do escopo compartilhado de um modelo.

T10/T11/T12 têm uma integração inicial agora exercitada com dados sintéticos. O
painel individual e o grupo FOOD04 passam no desktop/mobile nos caminhos descritos
no registro de execução. Isso não encerra os itens completos nem os gates.

1. T10 completar revisão de interface e matriz: tabela/card responsivo conforme
   especificação, teclado/axe abrangente, estados tardios/erro/sem medida e
   preferências M08, sem regressão do editor.
2. T11 verificar em testes dedicados autosave60s, posse PA07/retomada, dirty/ACK,
   limites20/96KiB e cancelamento/replay após mudanças de revisão.
3. T12 ampliar grupo: conflitos de duplicatas/porções, seleção parcial, cancelamento,
   referências caseiras, histórico original e regressões FOOD04.
4. T13: o rascunho já consome a projeção profissional allowlisted; exibe estado,
   detalhe reproduzível, revisão pendente, recálculo seletivo em prévia/confirmar
   e desvinculação explícita que mantém a porção. Testes sintéticos desktop/mobile
   cobrem esses fluxos. Ainda falta segurança contra o estado da projeção indisponível
   em outras telas/versões e a revisão completa de regressão/contrato.
   T07 agora preserva FOOD05 em cópias de refeição/plano salvo: o cliente transmite
   apenas paciente/plano/versão e chaves editoriais; o backend revalida autorização
   da origem, resolve snapshots cifrados (rascunho ou publicação), remapeia as chaves,
   gera nova identidade e conserva o cálculo como `revisao_pendente`. Testes cobrem
   origem sem acesso, cópia de rascunho/publicada, remapeamento e não liberação.
   Gravar/aplicar como modelo segue bloqueado: o modelo não tem aplicação server-side
   que preserve a proveniência sem expor IDs de pacientes a usuários da clínica.
   Projetar esse contrato antes de remover o bloqueio. T07/T13 permanecem abertos.
   Evidência local anterior: serviço129/129 PASS; focais FOOD05 30 PASS; BFF62/62;
   helpers de cópia14/14; PG descartável7 PASS/67 SKIPPED (sem vector/Timescale);
   Playwright de cópia + bloqueio de modelo Desktop2/2 e Mobile2/2; build,
   typecheck e lint focado executados. No HEAD atual, Backend NestJS com
   PostgreSQL/RLS, Web, scanners e governança passaram; Demo local smoke ainda
   está em execução. R4 independente continua pendente.
5. T14 matriz PostgreSQL completa, regressões FOOD04 e CI; prova local atual é
   parcial. T15–T18 regressões/acessibilidade/segurança completa, revisão distinta,
   governança/CI e entrega.

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

## Handoff — T07-A/A04/A05 e decisão FOOD05-MDL (27/10/2026)

PR #446 aberta em `docs/pos320-food05-planning`, Draft. HEAD inicial deste ciclo `c7f19227`; alterações de runtime/documentação abaixo ainda locais até commit/push. Configuração de raciocínio Luna alto autorizada, sem solicitação de troca.

### Decisão de escopo

T07-A (cópias clínicas entre planos/refeições) é obrigatório na FOOD05 principal. T07-B (D18, A06, modelos matemáticos compartilháveis) passa para FOOD05-MDL e não é implementado. D17 mantém bloqueio backend+UI de cópia por modelo. D15/D16 são reconhecidos como corrigidos tecnicamente. FOOD05 só conclui com T07-A e demais requisitos/gates; T07 integral segue dividido. R4 independente ainda precisa revisar.

### Alterações locais

- Backend: UUID exato e revisão editorial esperada para cópia de draft; versão publicada usa UUID exato; bloqueios ordenados por paciente e plano com destino em escrita e origens em leitura.
- Web: referência transmite UUID/revisão, verifica novamente draft ao confirmar; cópia de plano completo também compara identidade/revisão.
- Testes: A05 service 4 selecionados PASS; A04 helper 3/3 PASS com RED/GREEN reproduzido pela sequência antiga de inserção. A prova PostgreSQL foi tentada, mas o hook `beforeAll` excedeu 180s ao subir a imagem HA; nenhuma asserção do caso foi executada. O pull de tag alternativa falhou por falta de espaço local.
- Arquivos: serviço/DTO e specs de planos, helper de ordenação+spec, RLS integração, BFF/edição/copiar refeição/duplicar plano e specs web; planos/checklist/parecer/ledger/handoff/roadmap.

### Pendente antes de avançar

1. Manter A04/T14 BLOCKED até o CI ou novo ambiente descartável executar o caso PostgreSQL/RLS. A tentativa local bloqueou antes do teste; não remover dados/imagens para liberar espaço.
2. Rodar focused service + DTO, testes de cópia Web e typecheck/lint/build afetados.
3. Rodar regressões Food04/PA07 e CI no HEAD final; registrar statuses reais.
4. Solicitar revisão R4 independente focada em A04/A05 e caminhos vizinhos; não declarar esta revisão como independente.
5. Atualizar PR #446, sem retirar Draft.

Não rodar migrations externas, deploy, merge ou ativação. Não começar FOOD05-MDL.


**Achado A04 adicional:** lock de paciente destino precisa ser write desde a aquisição ordenada inicial; não adquirir todos read e promover depois. A prova PG usa pacientes distintos com o mesmo profissional, e seu resultado continua pendente.

### Resultado da revisão independente A04/A05 — 27/10/2026

O revisor independente não encontrou vulnerabilidade confirmada, mas identificou
que a concorrência anterior não era controlada e não havia rollback pós-escrita;
em A05 faltava corrida PostgreSQL de edição da origem. Os cenários foram então
reforçados com barreira detectada via `pg_stat_activity`, falha injetada após
persistir versão e edição concorrente da origem. A04/A05 continuam BLOCKED até que
PostgreSQL/RLS real execute essas novas provas e ocorra revisão R4 do estado final.

### Estado consolidado após correção do fixture — 27/10/2026

HEAD `643076ba124dc3f45998b1b4e8ed008f68f73091`, PR #446 aberta e Draft. A revisão independente estática específica dos deltas A04/A05 revisou também a correção dos fixtures e não encontrou achados adicionais; o revisor não executou testes. O CI desse HEAD iniciou a suite com PostgreSQL/RLS real; consultar seu resultado final antes de atualizar os gates. Até a prova controlada passar, manter A04/A05, T07-A e T14 como BLOCKED. T07-B/D18/A06 continuam transferidos à FOOD05-MDL, com D17 bloqueando cópias por modelo no backend e na interface.
