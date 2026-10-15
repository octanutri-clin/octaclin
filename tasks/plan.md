# Handoff atual — PA06: primeira entrega local validada, PR Draft/CI

## Estado do trabalho

Worktree `/workspace/octaclin/.worktrees/pos320-pa06-planejamento`, branch
`feat/pos320-pa06-autosave`, base `eae74b1e` (#419). T01–T06 backend/núcleo e
T07–T08 interface agora implementados localmente. A UI integra CAS e coordenador
de 60 s, preserva a edição local durante ACK, usa a materialização canônica para
totais após salvar, distingue conflito/incerteza/acesso negado e oferece
“Salvar e sair” sem flush no cleanup. Sem dependência nova, migration externa,
merge, deploy ou ativação. O escopo on/off/múltiplos planos/micronutrientes segue
nas entregas posteriores.

Plano: `tasks/plan-pos-320-pa06.md`; checklist: `tasks/todo-pos-320-pa06.md`.
Evidências: `docs/governance/EVIDENCIAS_PA06_NUCLEO_2026-10-15.md`.

## Implementação T01–T08

- Migration1073 aditiva na versão existente: contador geral, adesão protegida,
  snapshot editorial cifrado e revisão materializada.1072 não alterada. Down recusa
  apagar dados; rollback deve preservar backend compatível com proteção CAS.
- PUT `/pacientes/:id/planos-alimentares/:planoId/rascunho/edicao` com
  `{rascunhoIdEsperado, rascunhoRevisaoEsperada, documento}`. Geração/revisão
  obrigatórias; documento estruturalmente válido pode ter campos clínicos pendentes.
  Cap96KiB no documento; HTTP100KiB já existente. DTOs explícitos, sem PHI em log.
- Toda escrita/revisão/publicação avança contador geral; após adesão, clientes
  antigos sem CAS recebem409. Revisão PA05 de preferências preserva semântica própria.
- Retorno profissional de rascunho: `rascunhoRevisao`, `edicaoEstado` e
  `documentoEdicao`; quatro estados: legado,pendente,materializada,indisponivel.
  Pendência/ilegibilidade suprime materialização antiga e bloqueia revisão/publicação/
  prévia; publicada depende somente da materialização imutável, sem documento cru.
- Observações vazias gravam NULL real. GET de detalhe/rascunho/versão protege
  composição dos filhos com locks compartilhados de escopo; writers usam exclusivos.
- `lib/coordenador-edicao-plano.ts`:60s fixos, um request, última solicitação
  pendente; ACK confirma somente assinatura enviada sem substituir documento local.
  Manual e timer usam mesma fila. Off/IME/cópia suspendem; erros pausam sem retry.
  Cleanup encerra timer/aborta fetch, sem prometer desfazer commit no servidor.
- BFF de edição e API cliente prontos; revisão/publicação encaminham CAS.
  `lib/edicao-plano.ts` contém o contrato editorial de transporte, sem import do
  backend/Buffer no cliente.
- UI implementada no editor profissional e no guard de saída do prontuário. O
  último ACK confirmado é mostrado; totais usam a materialização retornada pelo
  servidor e não sobrescrevem valores/foco/caret/IME. Conflito/resultado incerto
  mantém a tela e exige reconciliação explícita. Nenhuma alteração de portal.

## Próxima ação e modelo — integração Sol autorizada

Troca manual para GPT-6.1 Sol médio já realizada. Integração em andamento:
revisão cruzada estática da UI, correções RED/GREEN, regressões, builds/gates e
preparação da PR Draft. Não solicitar novamente troca nem inferir CI verde.
Percentuais têm texto editorial cru opcional, cifrado no documento v1 e separado
da conversão para basis points; documentos anteriores continuam compatíveis.
Sem arredondamento para tornar prescrição inválida válida.

### T07/T08 — contrato de implementação executado por Luna

1. Ler Web AGENTS e guia Next instalado antes de editar. Reutilizar editor atual,
   sessão/BFF, chaves de PA02, subtotal/colapso PA03, lista PA04 e preferências PA05.
   Não implementar botões de ativação, soma combinada ou micros nesta PR.
2. Usar documentoEdicao como fonte do formulário ao reabrir se legível; mapear
   legado pelo formulário existente e gerar chaves uma única vez, sem zerar vazio.
   Guardar documento inteiro, inclusive linhas pendentes. Estado indisponivel exige
   erro/reconferência explícita, nunca restauração silenciosa de dados antigos.
3. Instanciar coordenador por contexto paciente/plano/geração; iniciar/cleanup em
   efeito com dependências estáveis. Atualizar documento por alterar(), sem recriar
   timer a cada tecla/ACK. Usar refs para envio/notificação atuais. StrictMode não
   pode duplicar timer ou causar save no cleanup. Sem localStorage/sessionStorage/
   IndexedDB/CacheStorage, logging do documento ou fetch em render.
4. Autosave default ON; cada tick60s checa dirty, não debounce; nenhum envio só por
   abrir, foco, blur, reconexão ou desmontagem. Exibir estados e último ACK de modo
   acessível. Dados pendentes salvos não significam cálculo/revisão/publicação aptos.
5. Manual deve chamar salvarManual() da mesma fila. Transport envia snapshot/CAS
   via salvarEdicaoPlanoAlimentar; devolve ao coordenador id+rascunhoRevisao do ACK.
   Não chamar caminho clínico antigo sem CAS nem resetar formulário com resposta A
   quando houve edição B. Não perder chaves, foco, seleção/caret ou composição IME.
   Pré-validar formato/cap96KiB, sem exigir metas/avaliação clínica para guardar.
6. Revisar/publicar: coordenar fila e bloquear edição durante transição explícita;
   usar CAS atual após ACK. Revisão incrementa contador: rebaselinar de forma
   explícita após sucesso, sem recriar ciclo em cada autosave; publicar encerra
   contexto do rascunho.409/resultado incerto exige reconferência, não retry/overwrite
   por simples avanço do baseline. Preservar edição local enquanto resolve erro.
7. Bloquear envios durante cópia/IME com configurar({suspenso:true}); liberação
   não faz flush imediato. Off cancela pedidos não iniciados, não desfaz request.
8. Saída interna dirty: salvar e sair / continuar / descartar com confirmação;
   falha ou conflito não permite sair como salvo. Fechar/refresh usa beforeunload
   nativo, sem prometer save. Guardar contexto até decisão; ignorar ACK após troca.
9. Ajustar fixtures sintéticas de api-demo-local e Playwright para novo contrato;
   não mexer no runtime backend além de defeito demonstrado. Cobrir59999/60000,
   dirty sem primeiro save, save A+edição B, manual simultâneo, off, cópia/IME,
   400/401/403/404/409/422/5xx/rede, troca de plano/paciente e saída. Desktop/mobile,
   teclado/aria-live, regressões PA02–PA05 e nenhuma mudança implícita no portal.
10. Não abrir outra PR. Manter mesma branch, atualizar evidências/checklist reais;
    finalização Sol inclui testes integrais, revisão R4 e CI do HEAD.

## Verificações locais e pendências

As contagens e os comandos realmente executados ficam no relatório de evidências.
Núcleo focado GREEN; PostgreSQL15 real com RLS/barreiras GREEN. Fixture alternativa
omite Timescale/pgvector e não substitui gate integral de CI. Núcleo: backend
238/238, PG12/12, BFF29/29, coordenador/nutrição33/33; backend/Web typecheck,
backend build e lint alvo sem erros. UI: proteção de saída4/4; Playwright focado
de saída/autosave2/2, PA02/PA03 cinco cenários em desktop/mobile10/10 e PA05
conflito/preferences2/2; Web typecheck PASS. ESLint encerra sem erro, com12 avisos
de hooks preexistentes nos componentes alterados. Um timeout inicial por servidor
Next local antigo foi corrigido reiniciando o servidor; uma divergência do subtotal
local versus ACK foi corrigida para usar o snapshot canônico e passou em desktop/
mobile. Web build, suíte visual/regressão integral, `test:authz` integral, revisão
R4 integrada e CI ainda pendentes. Não inferir estado de staging/produção ou
aplicação1072/1073 por merge.

O handoff PA05 abaixo é histórico. Pendências de CI nele foram encerradas pelos
checks do HEAD final acima; não representam bloqueios atuais de implementação.
Preservado para rastrear decisões, falhas RED/GREEN e limites operacionais.

## Handoff anterior — PA05: integração Sol e T09

Worktree `/workspace/octaclin/.worktrees/pos320-pa05-planejamento`, branch
`feat/pos320-pa05-preferencias`, base `64f54b88` (#418). Implementação autorizada
em 2026-10-14; UI entregue por Luna alto e retorno manual ao Sol confirmado.

- [Contrato e handoff detalhado Luna](plan-pos-320-pa05.md);
  [T00–T09](todo-pos-320-pa05.md);
  [evidências backend](../docs/governance/EVIDENCIAS_PA05_BACKEND_2026-10-14.md).
- D01–D03 mantidas: dois conjuntos, snapshot por versão e liberadas recolhidas.
  R014/R041 apenas referências; nenhuma nova dependência.
- Revisão R4 independente estática final PASS após quatro achados corrigidos
  com RED: escolha atual escondida, limite ignorado, prévia obsoleta após edição
  e medidas nas alternativas profissionais. Relatório:
  [REVISAO_R4_PA05_2026-10-14.md](../docs/governance/REVISAO_R4_PA05_2026-10-14.md).
- Backend, DTOs, cifra/CAS, clone/hash/publicação, projeção paciente e BFF/tipos
  entregues. Refinamento comprovado: revisão1 para snapshot herdado; zero só
  legado. Isso impede que perda do snapshot pareça ausência legítima.
- T07–T08 implementados: formulário versionado com CAS/reconferência de snapshot,
  prévia profissional, preview de rascunho somente leitura, portal e impressão/PDF
  pela projeção paciente, substituições recolhidas conforme preferência e falha
  segura sem reutilizar conteúdo antigo.
- Verificações locais Luna: typecheck Web PASS; Playwright PA05 focado 6/6 PASS;
  regressões direcionadas de portal/cópia 6/6 PASS desktop/mobile; lint focado sem
  erros (avisos de hooks/refs no componente profissional). Sem build/CI integral,
  revisão R4 ou PR. A tentativa ampla de 38 casos foi interrompida por timeouts
  com servidor Next órfão; os casos relevantes passaram após reinício limpo.
- PostgreSQL 15 local descartável: provas PA05 reais com RLS/concorrência PASS.
  Fixture omite extensões Timescale/pgvector fora do escopo; gate integral
  Testcontainers padrão será validado no CI. ENOSPC anterior não é aprovação.
- [PR única #419](https://github.com/octanutri-clin/octaclin/pull/419), Draft.
  Próxima ação: validar CI do HEAD final; regressões PA02/PA03 38/38 PASS.
  CI inicial `38653741126` falhou na interação PA04/PA05;
  reprodução RED e correção GREEN real 3/3 sem enfraquecer asserções PA04.
  UI conjunta 50/50 + teclado/a11y 4/4, Web/backend typecheck/build PASS.
  Autorização BFF ampla local PASS. CI `38654959106`, HEAD `4eafd661`: Backend
  2.923 testes PASS, PostgreSQL/RLS 66/66 PASS, Redis 2/2 PASS, Web/Governança PASS;
  Demo/PR Gate pendentes. Nova regressão visual reproduzida: seletor parcial
  “Horário” escolhia a checkbox “Horários”; correção exige nome exato e preserva
  a asserção do horário da refeição. Não houve alteração de runtime nesse ajuste.
- PR única preparada inicialmente como Draft para validar CI; migração1072
  somente na fixture local. Não
  aplicar em staging/produção, nem fazer merge/deploy. Autorrevisão não substitui
  revisão independente. Outros checkouts/alteração next-env.d.ts preservados.

PA04 integrada pela PR #418, main `64f54b88`, checks aplicáveis PASS; estado de
produção não inferido. Registro anterior preservado a seguir.

---

# Handoff histórico — PA04: checkpoint anterior ao merge

PA03 integrada pela PR #417, main `6f0be7d`; conteúdo idêntico ao HEAD aprovado
`a013555`. Cinco workflows SUCCESS e dez jobs do CI `38608333870` SUCCESS,
incluindo Web, Backend, Demo e PR Gate. Não inferir deploy pelo merge.

PA04 — resumo de macros na lista de planos. Worktree isolada, base main
`6f0be7d`, implementação em `feat/pos320-pa04-resumos-macros`.

- [Plano e gaps](plan-pos-320-pa04.md); [checklist T00–T08](todo-pos-320-pa04.md).
- D01–D03 confirmadas: ambas as versões separadas, totais dos alimentos
  previstos salvos e somente console profissional.
- Referências específicas PA04 recomendam código interno; nenhum repositório
  externo indicado ou biblioteca nova necessária.
- Implementado: projeção permitida dos snapshots salvos, duas consultas em lote,
  trava compartilhada do paciente, resumo de rascunho/publicada e paginação25.
  Nenhuma migration ou mudança em portal/impressão.
- PASS local: typecheck e build backend/Web; testes focados backend 44/44; BFF
  26/26; Playwright R4 4/4 em desktop/mobile; lint focado 0 erros/10 avisos de
  hooks existentes; secrets, sintaxe e diff checks PASS.
- PostgreSQL real BLOCKED por `ENOSPC` no Testcontainers. A imagem
  `timescale/timescaledb-ha:pg15` foi puxada, mas a inicialização esgotou os
  8,7 GB disponíveis sob Docker VFS; o hook expirou e os 64 casos de integração
  não executaram. A imagem de teste foi removida após a tentativa. Revisão R4
  independente estática confirmou as correções sem executar testes; as
  regressões R4 locais passaram posteriormente.
- PR Draft #418 aberta para executar os gates em CI; checagens remotas pendentes
  neste checkpoint. Nenhuma migration, staging, produção, deploy ou ativação.
- Sem PR/CI. Nenhuma migration, staging, produção, deploy ou ativação.

---

# Handoff histórico — PA03: integrada pela PR #417

Fechamento confirmado em 2026-10-14: merge `6f0be7d`; CI `38608333870`,
Semgrep, CodeQL, Trivy e Dependency Review SUCCESS. Estado Draft/CI pendente
abaixo pertence ao handoff anterior e foi superado por este checkpoint.

Base auditada em 2026-10-14: main `5b47fb1`, merge #416. Worktree isolada
`/workspace/octaclin/.worktrees/pos320-pa03-planejamento`, branch
`feat/pos320-pa03-subtotais-refeicoes`. O proprietário autorizou implementação em
2026-10-14; código e testes locais validados, incluindo build e visual 48/48
mais complementos 4/4. PR [#417](https://github.com/octanutri-clin/octaclin/pull/417)
Draft aberta; CI do HEAD pendente. Sem migration/backend.

- Contratos, gaps G01–G07 e arquivos:
  [plan-pos-320-pa03.md](plan-pos-320-pa03.md).
- T00–T06 e checkpoints:
  [todo-pos-320-pa03.md](todo-pos-320-pa03.md).
- D01–D03 confirmadas: somente editor do profissional; todas as refeições
  recolhidas na carga; subtotais parciais com aviso. Referências específicas
  PA03 recomendam código interno, sem dependência externa.
- Prioridades: preservar ausência de nutrientes, arredondamento por porção,
  identidade/estado, validação de campos recolhidos e trava PA02 colagem/save.
- Implementação executada em modelo Luna; revisão Sol autorizada pelo
  proprietário. Revisão cruzada independente corrigiu um P2 de overflow com
  RED/GREEN. Relatório `docs/governance/REVISAO_R4_PA03_2026-10-14.md`.
- #416 mergeada: HEAD `38c3596`, todos os workflows SUCCESS; CI
  `38583138559` SUCCESS. O registro PA02 abaixo preserva o checkpoint anterior;
  seus itens pendentes de integração/CI foram resolvidos conforme o relatório R4.
- Uma PR Draft PA03 reunirá documentação/código após T05 local; seus checks
  encerram T05 remoto. Nenhuma migration, merge, deploy ou ativação autorizada.

---

# Handoff histórico — PA02: implementação autorizada

Em 2026-10-14 o proprietário autorizou a análise e, após responder D01–D03,
autorizou a implementação da PA02. Main auditada: `2d2edcf`, merge #414/PA01,
com FND02/#411 integrado. A PR #415 já foi mergeada; correções na PR Draft #416. Revisão cruzada R4 fechou dois P2
com RED/GREEN. CI do HEAD corrigido deve ser conferido.

- Contratos, gaps, referências e continuidade:
  [plan-pos-320-pa02.md](plan-pos-320-pa02.md).
- T00–T05 e checkpoints:
  [todo-pos-320-pa02.md](todo-pos-320-pa02.md).
- Branch ativa `fix/pa02-copia-revisao-r4`, main `50a9590` (#415), checkout
  `/workspace/octaclin/.worktrees/pos320-pa02-planejamento`.
- Catálogo/mapa e JSON78 conferidos: PA02 recomenda código interno, sem
  biblioteca nova. D01–D03 confirmadas pelo proprietário em2026-10-14:
  ambos os escopos autorizados, acrescentar/criar e origem salva entre planos.
- Implementação disponível nesta branch: duplicação local por refeição,
  seleção paginada de origem salva, revalidação da versão/acesso no momento da
  cópia e colagem como refeição nova ou acréscimo não destrutivo.
- Evidências e limitações em `todo-pos-320-pa02.md`; a revisão cruzada passou após correções, e CI deve validar o
  HEAD corrigido. A PR permanece Draft até isso ocorrer. Não declarar autorização de uso operacional além da implementação
  técnica; merge/deploy seguem fora da autorização.
- A entrega original reuniu documentos/código na PR #415. O followup #416
  tornou-se necessário após constatar que a original já estava mergeada.

---

# Handoff histórico — Fase 320 encerrada; Onda 0/FND02 iniciada

Em 2026-10-14, por autorização do proprietário, a Fase 320 foi registrada como
`NO-GO` nesta rodada para ingestão/uso da TBCA. O catálogo TACO/USDA/IBGE foi
preservado. Handoff formal: [`plan-fase-320.md`](plan-fase-320.md) e
[`PLANO_FASE_320.md`](../docs/history/phases/PLANO_FASE_320.md).

A Onda 0 começa nesta PR somente com FND02 (consolidação da proteção contra
saída com alterações não salvas), descrita em
[`plan-pos-320-fnd02.md`](plan-pos-320-fnd02.md). Nenhuma outra sugestão das
ondas está autorizada automaticamente. Não há migration TBCA, ativação,
deploy ou alteração de ambiente externo nesta tarefa.

Base da branch de entrega: `bd4e436b` (`origin/main`, 2026-10-14). Estado dos
gates pós-320 e histórico das Fases 314/315/318 no checklist vigente.

---

# Handoff histórico — Fase 318: planejamento e análise de gaps

Branch `feature/fase-318-ia-rascunhos`, worktree
`/workspace/octaclin/.worktrees/docs-fase-318-planejamento`, base main8ea67a08
(merge407). Checkout principal e sua alteração em next-env.d.ts preservados.

## Autorização e próxima ação

Em2026-10-13 o proprietário autorizou prosseguir com implementação técnica,
mocks, fixtures e testes sintéticos conforme o contrato preparado. Branch
feature/fase-318-ia-rascunhos; gates clínicos/contratuais continuam bloqueados.
Nenhuma chamada paga, envio de dados reais, migration externa, merge, deploy ou
ativação está autorizado. Uma PR de entrega técnica, Draft enquanto houver gates.
Não abrir PR documental isolada; integrar estes documentos à futura PR única.

## Decisões e contratos

D01: pré-consulta e rascunho de evolução, sem orientação nesta fase.
D02 revisada: API externa com chave própria do nutricionista; OpenAI, chave individual
não compartilhada e integração habilitada pela clínica confirmadas. Substitui local CPU; nenhuma chamada paga
ou transferência clínica autorizada ao agente. Pesquisa/testes somente sintéticos.
D03: apenas responsável atual gera/confirma no console; manual legado preservado.
D04: contexto mínimo selecionado e revisão jurídica/privacidade pela equipe;
revisão ainda não concluída. D05: rascunho somente na tela, limpar ao sair/trocar.
D06: proprietário/equipe revisarão30casos, ainda não executados. D07: catálogo
aprovado com padrão econômico e limites. Sem pergunta de produto pendente.


- [Plano, evidências, limites e gates](../docs/history/phases/PLANO_FASE_318.md).
- [T00–T12, arquivos, dependências e critérios](todo-fase-318.md).
- [Contrato técnico BYOK](../docs/product/CONTRATO_OPENAI_BYOK_FASE_318.md).
- [30casos para revisão humana](../docs/product/CORPUS_REVISAO_FASE_318.md).
- Modelos/baseline reais: fases271/272/274 e código pacientes/IA/FastAPI.
- Gate legado ia.clinica não libera318; não copiar persistência/ORM do legado.
- Inferência fora de lock; contexto/identidade revalidados no retorno e
  confirmação, inclusive transferência A→B→A e resposta tardia.
- Prévia com fontes/datas/limites; revisão humana não é assinatura digital.
- Evolução privada/cifrada, título180/conteúdo6000; não prometer replay seguro
  sem desenhar/testar contrato idempotente; não alterar manual por consequência.
- Termos/privacidade da API OpenAI, preços e qualidade clínica não presumidos.
- Adaptador OpenAI no backend; não repassar BYOK ao FastAPI legado.
- PoC pode concluir NO-GO; baseline permanece caminho completo para profissional.

## Continuidade

316 permanece stand-by. 317 integrada407/CI main38324741937 PASS consultado nesta
rodada; ativação global não executada pelo agente, preflight processo/providers
pendente. Aceites/autorização já recebidos mantidos. Não habilitar flags aqui.
314 classificadores permanecem bloqueados; medidas factuais autorizadas não são
protocolo de IA. Handoff313 antigo preservado em plan-fase-313.md.

## Modelos e execução

GPT-6.1 Sol médio para análise/contratos/segurança e integraçãoR4. Luna alto pode
preparar fixtures e UI com contrato fechado; não recomendado sozinho para fase
inteira. Se houver transição, avisar modelo alvo e pausar para troca manual.
Não houve troca nem delegação. Execução futura nativa, sem reabrir planejamento
por preferência; novas decisões só para lacunas demonstradas.

## Histórico das verificações do planejamento

Inspeção de Git/worktrees/diff, contratos/código e GitHub407/CI main. No planejamento não rodados
benchmarks/testes de implementação318; CI317 não prova318. Diff/secrets/links documentais conferidos ao concluir; consulta de páginas públicas
OpenAI200, sem chamadasAPI. Nenhum resultado clínico ou modelo ratificado pelo agente.

## Execução técnica — estado atual

Backend318, credenciais cifradas/CAS, gates, fontes, adaptador, prova efêmera,
confirmação transacional/idempotente e auditoria implementados. Migration1071
aditiva cobre invalidação monotônica em pacientes/profissionais/usuários;1070
intocada. BFF allowlist e UI no prontuário/integrações/configuração da clínica.
Ledger: `docs/history/phases/reviews/fase-318/EXECUCAO.md`. Testes de fornecedor
exclusivamente mock; nenhum modelo ou contrato ratificado. Gates G01/G02/G05
BLOCKED. Terminar provas/CI e revisão antes de concluir T11; T12 exige autorização.

## Followup após408 — correções de uso e piloto ainda bloqueado

Base4aeb5297. Usuário pediu revisão do500 Metas e Adesão, clareza da tela de
Integrações, identificação de profissional e backlog de Perfil. Desenvolvimento
e testes das correções autorizados; nenhum deploy/flag/migration externa executado.

- SQL legado badges: Raw gerava BadgeOrm.regraConquista sem quoting; PostgreSQL
  reportou missing FROM-clause. Teste gera SQL TypeORM sem conectar ao banco: RED,
  correção mantém tenant/exclusão317, GREEN. Prova real nova só CI descartável.
- Estado cadastral OpenAI deriva de direitos===true no backend e projeção BFF.
  UI não infere permissão de estado ausente; não muda aprovação contratual/global.
- Drawer mostra IDs já recebidos pelo DTO profissional autorizado; sem novo
  acesso, inferência por nome, armazenamento de dados pessoais ou edição de perfil.
- Perfil completo: pendência documentada e ligada ao roadmap, sem escopo novo.
- Piloto sintético continua exigindo isolamento server-side e alvo comprovado;
  não ativar direitos/catálogo clínicos para contornar o cadastro bloqueado.

Finalizar regressões, navegador desktop/mobile, build/typecheck/lint, revisão
R4 com autoria e PR única de followup. APIs/código só são considerados corrigidos
em produção após revisão/merge/deploy próprio, não por testes locais.

## Continuidade técnica do piloto após409

Branch feature/fase-318-revisao-sintetica, baseb9535170. IDs do titular recebidos
por canal da sessão; não versionados. Grant/flag/revisão de custódia continuam
pendentes, sem dados reais ou chamadas pagas. Implementação do corpus30casos,
composição factual, serviço/prova/quota, BFF fechado, chave individual reutilizada
e UI de revisão sintética. Nenhuma migration. R4 e evidências no ledger
`docs/history/phases/reviews/fase-318/PILOTO_SINTETICO_EXECUCAO.md`.
Checkout ativo para entrega: /tmp/octaclin-f318-entrega por ENOSPC do disco
principal; worktree original preservada, sem novo escritor nela. Não fazer
merge/deploy/configuração externa/ativação sem autorização correspondente.

## Fase 319 — pesquisa técnica concluída com NO-GO

PoC sintética v4 concluída; decisão NO-GO para E5/MiniLM. Resultados e artefatos
v3/v4 preservados em `research/fase319/`; plano e relatório em
`docs/history/phases/PLANO_FASE_319.md` e `docs/history/phases/reviews/fase-319/`.
G01/G02/G03 bloqueados, G04 skipped, G05 bloqueado/não executado; T05–T10 não
iniciadas. Sem runtime/índice clínico. A Fase 320 é a etapa seguinte, com ingestão
TBCA sujeita a direitos comprovados.


## Fechamento da integração Sol

Commit de UI e correções `c7071d2d`; código local validado sem achados R4 estáticos
abertos. Web/backend builds e typecheck PASS; backend integral329 suítes/2907 testes
PASS (6 suítes/113 testes SKIPPED), DTO final22/22, PostgreSQL focado12 PASS/31
SKIPPED, BFF29/29, nutrição/coordenador38/38, saída4/4 e cópia7/7. Playwright final
82/82 em desktop/mobile no build de produção local. Governança/secrets PASS.

Próxima ação: publicar/acompanhar uma PR Draft da branch atual e os checks do HEAD.
Authz integral local em execução no checkpoint, sem PASS presumido. Banco integral
com extensões, Demo e scanners continuam gates do CI. Não marcar T09/T10 completos
antes do resultado final; não iniciar ativação/agregação dentro desta PR.
Detalhes/comandos/R4/limites nas evidências. Sem merge/deploy/migration externa.
