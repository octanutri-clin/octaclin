# OctaClin — Roadmap Pós-Fase 320: Ondas de Implementação com PRs Individuais

> Documento operacional para execução pelo Codex.
>
> **Princípio central:** cada recurso ou melhoria deste roadmap deve ser implementado em **um Pull Request individual**, com escopo pequeno, revisável e reversível. As PRs são agrupadas em **ondas de implementação** apenas para organizar dependências e sequência de trabalho.
>
> Versão reconciliada em **2026-10-22** com o roadmap canônico `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md` e os PRs integrados mais recentes. Os status são registros históricos e DEVEM ser revalidados na data de cada nova execução.

---

## MARCO OBRIGATÓRIO — Handoff da Fase 320 registrado; Onda 0 iniciada

> **Handoff formal:** a Fase 320 recebeu `NO-GO` para ingestão/uso da TBCA nesta rodada por falta de autorização documentada de direitos. O catálogo permanece com TACO, USDA e IBGE. O usuário autorizou formalizar o handoff e iniciar a Onda 0 nesta PR, começando apenas por `FND02`; isso não libera ingestão TBCA nem autoriza implementar os demais IDs do backlog. A sequência de fases funcionais 321+ será definida separadamente; os IDs `PA01`, `ANT05` etc. são IDs de PRs deste backlog, não números de fase ou de PR GitHub.
>
> **Fase condicional NÃO é sinônimo de funcionalidade entregue.** Quando o gate de uma fase negar o escopo, registrar `NO-GO` e somente retomar o recurso pós-320 mediante nova decisão explícita. Mesmo quando a fase estiver integrada, verificar código, migration, deploy e uso operacional como dimensões distintas.

**Fonte prioritária:** [Roadmap canônico das Fases 302–320](https://github.com/octanutri-clin/octaclin/blob/main/docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md). Consultar também `docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, `STATUS_ATUAL_PROJETO.md`, `RESUMO_FASES_CONCLUIDAS.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `AGENTS.md` e as ADRs/planos relevantes.

### Checklist de handoff 320 → pós-320

- [x] Revisar na `main` e no GitHub o estado das fases **302–320** e seus PRs; base desta PR `bd4e436b`, 2026-10-14. Gates e limites permanecem descritos no checklist e roadmap canônicos.
- [x] Registrar resultado documentado para 313/314/316/317/318/319/320; integração, gates e relatos de validação operacional estão diferenciados no checklist atualizado.
- [ ] Confirmar decisões clínicas e referências de **gestação (313)** e **pediatria (314)**; caso gate negado, não criar motor clínico por este roadmap sem novo aceite.
- [ ] Confirmar decisão de privacidade/provider para **exames assistidos (316)** e **IA (318)**; nunca contornar gate por mudança de ferramenta.
- [ ] Confirmar decisão de produto, opt-in e segurança da **gamificação (317)**; `APP04` não está automaticamente aprovado.
- [ ] Confirmar resultado `GO/NO-GO` da **busca semântica (319)**; não exigir infraestrutura de embeddings por padrão.
- [x] Direitos da TBCA: `NO-GO` nesta rodada; nenhum dado importado, catálogo TACO/USDA/IBGE preservado. Reavaliar só após autorização escrita e revisão de escopo de uso/redistribuição.
- [x] Separar fatos de merge dos relatos de aplicação/validação externa; nenhuma migration foi consultada ou aplicada nesta PR.
- [x] Manter os IDs do backlog classificados por cobertura/condição; esta PR inicia FND02 por autorização explícita e não autoriza demais itens.
- [x] Autorização do proprietário para o handoff e início da Onda 0 recebida em 2026-10-14.

### Cruzamento oficial das fases 302–320

| Fase | Entrega canônica | Reflexo em nosso backlog pós-320 |
|---|---|---|
| **302** | Autosserviço LGPD da clínica | Toda nova função segue tratamento dos pedidos/retensão vigente; não recriar fluxo LGPD. |
| **303** | Credenciais e integrações profissionais | `OPS07` preserva escopos API/webhook, carteira e papel; não duplicar controles. |
| **304** | Adesão, check-ins, escolhas de troca e histórico do plano | `APP01–04`, `FOOD04–05`, `PA04` **estendem** o domínio existente, sem inventar consumo real. |
| **305** | Leitura longitudinal conjunta de questionários, antropometria e consultas | `QST03`, `ANT01–04`, `OPS06` só acrescentam lacunas provadas; não recriar timeline. |
| **306** | Indicadores agregados de retorno/evasão | `OPS06` não reimplementa indicadores já entregues nem expõe identificadores desnecessários. |
| **307** | Progresso compartilhável no portal, métricas selecionáveis e marcos | `ANT03` é **residual condicional**; `APP05–06` só ampliam o que não estiver disponível. |
| **308** | Exames fora da faixa no resumo clínico | Não duplicar resumo no `QST07` ou `AI` futuro; o PR #385 foi confirmado integrado no GitHub em 09/10, apesar de o arquivo do roadmap ainda o descrever como aberto. |
| **309** | Preferências de notificações internas/digest | `APP07`, `OPS06`, `DOC10` respeitam preferências e alertas obrigatórios. |
| **310** | Receitas categorizadas e envio explícito ao paciente | `FOOD07` só implementa metadados/filtros **residuais**; `FOOD08` é biblioteca pública entre clínicas, escopo distinto e posterior. |
| **311** | Instalação opt-in do kit genérico e verificação de catálogos | Não recriar onboarding/seed; `FOOD02` reutiliza TACO/USDA/IBGE, mas alimento personalizado é novo. |
| **312** | Encaminhamento e possível atestado sob gate jurídico | `DOC01–02/08` evoluem **aparência**, sem atribuir validade de assinatura nem competência profissional inexistente. |
| **313** | Avaliação/classificação antropométrica gestacional condicionada à fonte | `ANT07` só complementa histórico, curva, lote e seleção permitida, depois de auditar o motor entregue ou NO-GO. |
| **314** | Avaliação pediátrica etária, escores/percentis condicionados à validação | `ANT05` só lacunas complementares; `ANT06` é UX de curvas/zoom quando houver base aprovada. |
| **315** | Remoção controlada de `score_risco` legado | Nenhum PR pós-320 pode ressuscitar o campo nem confundir prioridade operacional com score clínico. |
| **316** | Extração assistida de exames PB-30, condicionada a gates de PHI/provider | `AI05` **arquivado/supersedido**, sem PR; pós-320 somente melhoria residual aprovada separadamente. |
| **317** | Decisão/piloto de gamificação e comunidade | `APP04` depende de resultado explícito de produto/clínica, opt-in e avaliação de efeitos. |
| **318** | Decisão/piloto IA pré-consulta e rascunho | `AI01–04` dependem do resultado; evitar duplicar POCs ou gerar conduta/prescrição autônoma. |
| **319** | Avaliação/piloto de busca semântica clínica | Nenhuma ferramenta vetorial/embeddings será adotada automaticamente; preservar tenant/PHI. |
| **320** | Decisão de direitos e possível importação TBCA | `FOOD01–06` usam fontes aprovadas; TBCA somente com autorização documentada. |

### Evidência de estado na data de reconciliação

- Fases 298, 306, 307 e 308: PRs #356, #383, #384 e #385 integrados em código; **não equivale a deploy nem aplicação da migration 1064**.
- A descrição da Fase 308 em `docs/product` estava defasada diante do [PR #385](https://github.com/octanutri-clin/octaclin/pull/385) integrado. Antes da onda pós-320, priorizar fatos mais recentes da `main` e PRs.
- Fases 309–320 foram reconciliadas com o estado mais recente documentado no checklist. Merges não provam deploy ou aplicação de migration; gates específicos continuam separados.

---

## 1. Como o Codex deve usar este arquivo

Quando for solicitado algo como:

> Leia `docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md` e implemente o próximo item autorizado.

o Codex deve:

1. Ler este arquivo inteiro antes de alterar código.
2. Ler `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md`, `docs/product/OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, `AGENTS.md`, `CLAUDE.md` (se existir), `STATUS_ATUAL_PROJETO.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `RESUMO_FASES_CONCLUIDAS.md`, documentos de autorização e os planos de fase relevantes. Arquivos ausentes devem ser registrados como tal, não presumidos.
3. Confirmar o **handoff pós-Fase 320** neste documento e atualizar a branch local a partir da `main`. Sem autorização explícita para o próximo item, somente auditar e produzir relatório, **não criar PR**.
4. Fazer uma **auditoria curta do estado real da `main`** antes de cada PR.
5. Não confiar cegamente no status deste documento se a `main` tiver avançado.
6. Se o critério de aceite já estiver completamente atendido na `main`, **não reimplementar**.
7. Implementar **uma PR por vez**.
8. Nunca misturar dois IDs deste roadmap na mesma PR, salvo se este arquivo declarar explicitamente que uma PR é apenas integração de uma implementação pré-existente.
9. Criar a PR seguinte somente quando a anterior não for uma dependência ainda não integrada. A autorização atual inicia FND02; as ondas e itens seguintes não começam automaticamente.
10. Manter compatibilidade com dados existentes e migrations já aplicadas.
11. Preservar isolamento multi-tenant, escopo por profissional, RLS/FORCE RLS, autorização server-side, auditoria, LGPD, criptografia e minimização de PHI/PII.
12. Implementar comportamento novo com testes antes ou junto da implementação.
13. Rodar os testes focados da área e os gates transversais aplicáveis antes de abrir a PR.
14. Atualizar a documentação de estado/fase somente com fatos comprovados.
15. Não declarar execução em produção, staging ou banco externo sem evidência real.
16. Não aplicar migration externa sem autorização explícita.
17. Não habilitar provider externo, envio real, feature flag global ou comportamento irreversível sem autorização explícita.
18. Evitar dependência nova quando o projeto já possui primitive equivalente.
19. Preservar acessibilidade: teclado, foco visível, alvos mínimos, labels, contraste e alternativa a drag-and-drop.
20. Qualquer cálculo clínico novo deve registrar fórmula, versão, fonte e premissas utilizadas.

### Convenção de branches

Usar preferencialmente:

`feat/roadmap-<ID>-<slug-curto>`

Exemplo:

`feat/roadmap-PA01-reordenar-refeicoes`

### Convenção de título da PR

`[<ID>] <nome curto do recurso>`

Exemplo:

`[PA01] Reordenar refeições por drag-and-drop`

---

# 2. Regras gerais de arquitetura

## 2.1 Não duplicar domínios existentes

Antes de criar tabela, serviço, rota ou componente novo, verificar se o recurso deve evoluir:

- `planos-alimentares`
- `questionarios`
- `pacientes`
- `agenda`
- `materiais`
- `comunicacoes`
- `gamificacao`
- `ia`
- `clientes`
- `mobile`
- `portal-paciente`

Preferir extensão do domínio existente a um sistema paralelo.

## 2.2 Backend continua sendo autoridade

Cálculos nutricionais, equivalências, permissões, visibilidade do paciente, classificação factual, estado de revisão e decisões persistidas não podem depender somente do frontend.

## 2.3 Dados clínicos

- Não gravar PHI/PII em `localStorage`.
- Não colocar conteúdo clínico em logs, auditoria genérica ou analytics.
- Não expor dados apenas porque a UI esconde um botão.
- Não criar URL pública persistente de arquivo clínico.
- Usar URLs assinadas/temporárias quando necessário.

## 2.4 PRs com migration

Uma PR pode conter a migration necessária **somente para aquele recurso**.

Obrigatório:

- migration aditiva quando possível;
- RLS e FORCE RLS quando a tabela for tenant-aware;
- FK composta por tenant quando aplicável;
- testes da migration;
- inventário TypeORM atualizado;
- rollback documentado;
- sem aplicação em ambiente externo sem autorização.

---

# 3. Recursos que já existem e NÃO devem ser recriados

Os seguintes recursos são baseline do produto. Não abrir PR para “implementar” novamente:

| Recurso já existente | Situação |
|---|---|
| Painel de macros persistente durante a montagem do plano | Já implementado |
| Limite de até 50 substitutos por grupo | Já implementado |
| Biblioteca/área de materiais educativos | Já implementada |
| Navegação de retorno ao paciente nos fluxos principais | Já existente |
| Proteção contra saída com alterações não salvas nos editores principais | Já existente |
| Marcadores bioquímicos personalizados | Já existentes |
| Evolução fotográfica com protocolos, consentimento e comparação | Já existente |
| Relatórios financeiros/performance básicos da clínica | Já existentes |

Esses recursos podem ser **evoluídos** por PRs listadas abaixo, mas não substituídos. **Adicionar também as entregas das Fases 302–320 efetivamente integradas**, conforme a matriz de reconciliação acima; nenhuma `NO-GO` deve entrar nessa lista como entregue.

---

# 4. ONDA 0 — Reconciliação e fundações pendentes

Objetivo: após o handoff da Fase 320, criar primitives compartilhadas ainda ausentes. A Fase 298 já concluiu os modelos versionados; a antiga `FND01` está encerrada, sem nova PR.

---

## [FND01] RESOLVIDO — Fase 298 / PR #356 — NÃO EXECUTAR

**Estado:** `ARQUIVADO / JÁ ENTREGUE`. A edição versionada de modelos foi integrada na `main` pelo [PR #356](https://github.com/octanutri-clin/octaclin/pull/356), com histórico cifrado, restauração e proteção de concorrência. O status anterior deste backlog, que dizia “pendente de integração”, tornou-se incorreto.

**Ação do Codex:** nenhuma PR `FND01`; usar como baseline. Modelos **independentes de refeição** e biblioteca de grupos de substituição são melhorias distintas, analisadas em `FOOD04` e PR específica somente após confirmar lacuna.

---

## [FND02] Primitive compartilhada de proteção contra alterações não salvas

**Reconciliação em 2026-10-14:** integrada pela PR #411, presente na main
auditada para PA02. O registro de execução abaixo pertence ao handoff original;
não inferir deploy/validação operacional da integração.

**Origem:** item 39, já existente parcialmente como implementação repetida em fluxos diferentes.

**Execução:** iniciada nesta PR como primeiro item da Onda 0, por autorização do proprietário em 2026-10-14. Ver o handoff de implementação em `tasks/plan-pos-320-fnd02.md`; status final depende dos testes indicados ali e dos checks da PR.

**Status atual:** proteção existe em plano, questionários e outros editores.

**Objetivo:** consolidar o comportamento em hook/componente reutilizável para evitar novas implementações divergentes.

**Escopo:**
- abstrair `beforeunload`;
- confirmação interna de navegação quando aplicável;
- API simples para `dirty/saved`;
- migrar somente os fluxos já protegidos.

**Não fazer:**
- autosave;
- trava entre abas.

**Aceite:**
- nenhum fluxo existente perde proteção;
- testes de navegação/descarte permanecem verdes;
- nova primitive documentada.

---

# 5. ONDA 1 — Editor de plano alimentar: produtividade

Objetivo: tornar a montagem do plano mais rápida sem alterar ainda o motor nutricional.

---

## [PA01] Reordenar refeições por drag-and-drop

**Reconciliação em 2026-10-14:** integrada pela PR #414, main `2d2edcf`.
O arraste já existe no editor e permanece baseline da PA02; não reimplementar.

**Origem:** item 4.

**Status atual:** reordenação por botões ↑/↓ já existe.

**Implementação sugerida:**
- adicionar drag-and-drop no frontend;
- persistir usando o mesmo campo `ordem`;
- preservar botões ↑/↓ e teclado como alternativa acessível;
- não criar nova regra de ordenação no backend.

**Aceite:**
- arrastar refeição altera ordem;
- salvar e recarregar preserva ordem;
- teclado continua funcional;
- nenhuma regressão em mobile.

---

## [PA02] Copiar, colar e duplicar refeições

**Reconciliação em 2026-10-14:** RESIDUAL CONFIRMADO na main `2d2edcf`.
Implementação integrada pelas PRs #415/#416, main `5b47fb1`. D01–D03
confirmadas pelo proprietário: ambos os escopos autorizados, acrescentar/criar e
origem salva. Dois P2 corrigidos com RED/GREEN e revisão cruzada. Cinco workflows
do HEAD corretivo `38c3596` SUCCESS; CI `38583138559`, todos os jobs SUCCESS.
Evidências no handoff e no relatório R4; não inferir deploy do merge/CI.
Handoff em [plan-pos-320-pa02.md](../../tasks/plan-pos-320-pa02.md).
Referências: catálogo/mapa inverso e sugestão44 recomendam código interno;
nenhum repositório PA02 no JSON. Não criar dependência por analogia com outro ID.

**Origem:** itens 44 e parte do item 4 da segunda lista.

**Status atual:** já é possível duplicar plano de outro paciente e inserir receita/refeição pronta.

**Implementação sugerida:**
- `Duplicar refeição`;
- `Copiar refeição`;
- `Colar em...`;
- permitir destino em outra refeição/plano autorizado;
- gerar IDs/chaves novos;
- copiar estrutura e nutrientes dos itens;
- não copiar cálculos/metas clínicas do paciente de origem.

**Aceite:**
- duplicar dentro do mesmo plano;
- copiar para outro plano autorizado;
- nenhuma referência de ID da origem é reutilizada indevidamente;
- rascunho publicado não é alterado diretamente.

---

## [PA03] Exibir macros no cabeçalho de refeições colapsadas

**Planejamento confirmado em 2026-10-14:** base `5b47fb1`, implementação ainda
não iniciada. D01: somente editor do profissional. D02: todas as refeições
recolhidas inicialmente, com controle individual/global sem persistir preferência.
D03: indicador afetado mostra `—` e aviso de dados incompletos; os demais
permanecem calculáveis; refeição vazia mostra “Sem alimentos”.
Catálogo/mapa/JSON/matriz PA03 recomendam código interno; não há repositório
externo candidato deste ID. Handoff
[plan-pos-320-pa03.md](../../tasks/plan-pos-320-pa03.md) e checklist
[todo-pos-320-pa03.md](../../tasks/todo-pos-320-pa03.md).
Preservar ausência real de densidades, arredondamento por porção, foco/required
em campos recolhidos e trava PA02. Nenhuma mudança de portal/PDF/API/schema.

**Origem:** item 46.

**Status atual:** há resumo total do plano, mas não subtotal no cabeçalho da refeição.

**Implementação sugerida:**
- calcular subtotal da refeição no frontend para feedback imediato;
- backend continua autoridade no save;
- exibir `kcal · P · C · G` quando a refeição estiver colapsada.

**Aceite:**
- subtotal atualiza ao editar itens;
- resultado após save coincide com cálculo persistido;
- ausência de nutriente não vira zero silenciosamente quando a regra atual não permite.

---

## [PA04] Resumo de macros na lista de planos alimentares

Integrada pela PR #418 em 2026-10-14; estado observado no checklist vigente.

**Origem:** item 48.

**Status atual:** listagem utiliza DTO leve sem refeições completas.

**Implementação sugerida:**
- acrescentar totais da versão relevante ao DTO de resumo;
- não carregar árvore completa de refeições/itens;
- indicar claramente se o resumo é do rascunho ou da versão publicada.

**Aceite:**
- lista mostra energia, P/C/G;
- sem N+1;
- paginação permanece funcional.

---

## [PA05] Preferências de exibição das refeições

Planejamento específico em [plan-pos-320-pa05.md](../../tasks/plan-pos-320-pa05.md).
D01–D03 confirmadas: configurações profissional/paciente separadas, persistidas
por versão para todas as refeições; paciente acessa liberadas mesmo recolhidas.
Portal e PDF paciente usam projeção permitida. Implementação autorizada e entregue
na branch PA05; revisão R4 estática concluída após correções. Gates finais e
integração pela PR permanecem sujeitos às evidências do checklist PA05.

**Origem:** item 18.

**Status atual:** existem configurações pontuais, mas não configuração ampla.

**Implementação sugerida:**
- configuração por plano para exibir/ocultar:
  - horário;
  - macros;
  - medidas caseiras;
  - orientações;
  - substituições;
  - modo compacto;
- separar configuração profissional da projeção para paciente.

**Aceite:**
- preferências persistem;
- não mudam conteúdo clínico;
- versão publicada mantém snapshot coerente.

---

## [PA06] Autosave, ativação e cálculo combinado do plano alimentar

**Planejamento em 2026-10-15:** base `eae74b1e`, PA05 integrada pela PR #419;
checks aplicáveis do HEAD `9e12271b` PASS, sem inferir migration externa/deploy.
Análise de código identificou revisão CAS limitada a saves com preferências e
recarga integral após escrita. PA06 precisa de revisão geral com transição
segura de legados e preservação de edições feitas durante request. D01–D03
confirmadas: ligado por padrão, ciclo de 60 segundos, alimentos válidos salvos mesmo com
formulário incompleto e saída protegida. D04/D05 confirmadas: on/off direto
oculta do paciente e exclui dos macros, sem nova revisão só para reexibir;
linhas incompletas preservadas. D06–D08: on/off no plano e refeição e cálculo
combinado dos planos/refeições selecionados, incluindo calorias/macros/micros;
desativados ficam fora do cálculo. D09/D10 confirmadas: todos os ativos publicados
no portal, sem arquivados/excluídos/desativados; soma só da publicação atual salva,
nunca rascunhos/histórico. Seleção de cálculo não filtra o acesso do paciente.
Ampliação organizada em três PRs por recurso: autosave parcial, ativação e
cálculo combinado/micros; sem implementar IDR/UL de FOOD06. Só R013/R014 foram
consultados, com versões/licenças/fontes no plano; sem biblioteca nova prevista.
Atualização em 2026-10-16: autosave integrado por #420; ativação/portal plural
integrados por #421 (`011ea87d`). Terceira entrega com backend local implementado e
checkpoint T08c validado; T08d UI/BFF aguarda troca manual para Luna alto. D11–D13
confirmadas: seleção vazia, plano inclui refeições ativas, OFF mantém seleção/ON
reinclui e preparar nova versão TACO com micros, preservando histórico. TACO v2
preparada e carga idempotente provada somente em PostgreSQL descartável; CI
integral e revisão R4 final pendentes. Evidências em
`docs/governance/EVIDENCIAS_PA06_CALCULO_2026-10-16.md`.
Plano detalhado de cálculo/cobertura/fontes:
[plan-pos-320-pa06-calculo.md](../../tasks/plan-pos-320-pa06-calculo.md).
Sem IDR/UL/TBCA ou execução externa nesta rodada. Handoff
[plan-pos-320-pa06.md](../../tasks/plan-pos-320-pa06.md) e checklist
[todo-pos-320-pa06.md](../../tasks/todo-pos-320-pa06.md).

**Origem:** item 16.

**Status atual (fechamento 2026-10-16):** PA06 integrada por #420/#421/#422,
merge final `62a50104`; CI do HEAD `5eac6eab`, run38934810307, e scanners SUCCESS.
SBOM provenance SKIPPED. Histórico acima preserva checkpoints anteriores.
TACO v2 preparada; carga e verificação operacional externas separadas.

**Dependência:** FND02.

**Implementação sugerida:**
- habilitado por padrão, verificação a cada 60 segundos sem reiniciar o ciclo por tecla;
- gravar alterações, sem PUT repetido quando nada mudou;
- rascunho parcial preserva alimentos válidos sem exigir completude clínica;
- estados `Alterado`, `Salvando`, `Salvo`, `Falha ao salvar`;
- usar versão esperada/conflito otimista;
- sem `localStorage` para PHI.

**Aceite:**
- controle de autosave, se mantido, não se confunde com visibilidade ao paciente;
- on/off de plano e refeição oculta e exclui de energia/macros/micros, sem
  arquivar/excluir ou exigir nova revisão para reexibir;
- agregação considera seleção explícita, estado ativo e publicação atual salva
  de cada plano, sem versões históricas/rascunhos;
- portal dá acesso a todos os planos ativos publicados, respeitando o estado
  das refeições; nenhuma rota libera desativados/arquivados/excluídos;
- nunca publica automaticamente;
- falha não apaga rascunho local em memória;
- conflito exige ação do usuário.

---

## [PA07] Trava/aviso de edição simultânea entre abas

**Origem:** item 10.

**Estado reconciliado em 2026-10-17:** integrada pela PR #423, merge
`d36b12e7`. CI38975905269 do HEAD `2b9a8074` SUCCESS, incluindo Demo e PR
Gate; scanners SUCCESS. SBOM provenance SKIPPED conforme workflow; revisão
independente não executada. Não inferir deploy. Evidências/limites no
[relatório](../governance/RELATORIO_PA07_2026-10-16.md),
[plano](../../tasks/plan-pos-320-pa07.md) e
[checklist](../../tasks/todo-pos-320-pa07.md).

**Implementação sugerida:**
- `BroadcastChannel` para aviso de edição concorrente no mesmo navegador;
- versão do servidor continua sendo proteção real;
- outra aba pode ficar read-only ou exigir retomada explícita;
- não usar a trava local como mecanismo de segurança.

**Aceite:**
- duas abas do mesmo recurso recebem aviso;
- nenhuma sobrescreve silenciosamente a outra;
- outro dispositivo é protegido pelo versionamento server-side.

---

# 6. ONDA 2 — Alimentos, substituições, receitas e micronutrientes

Objetivo: aproveitar a evolução do catálogo multifonte e transformar o editor em ferramenta nutricional mais completa.

---

## [FOOD01] Medidas caseiras personalizadas por alimento

**Integrada em 2026-10-17 pela PR #424**, merge `95e9f33d` confirmado.
CI39029460553 de `faeb603b` SUCCESS, inclusive Backend, Web, Demo e PR Gate;
CodeQL/Semgrep/Trivy/Dependency Review SUCCESS. Migration1075 só ensaiada em
banco descartável nesta entrega; aplicação/deploy externos não verificados.
D01–D03 preservadas: pessoal/clínica, pessoal por padrão; peso explícito em g;
alterações da biblioteca não atualizam itens existentes. R017 somente inspiração.
[Plano](../../tasks/plan-pos-320-food01.md),
[checklist](../../tasks/todo-pos-320-food01.md) e
[relatório](../governance/RELATORIO_FOOD01_2026-10-17.md).
Rollback deve preservar leitor compatível com FOOD01. Não inclui FOOD02/densidades.

**Origem:** item 14.

**Base anterior à entrega:** unidade textual livre no item do plano.

**Implementação sugerida:**
- entidade de medida caseira;
- alimento;
- nome;
- quantidade equivalente;
- unidade base;
- origem `pessoal`/`clinica`;
- CRUD;
- RLS/tenant quando aplicável.

**Aceite:**
- profissional cria medida;
- medida reaparece na busca do alimento;
- conversão para gramas/ml é determinística.

---

## [FOOD02] Cadastrar alimento reutilizável dentro do editor do plano

**EM IMPLEMENTAÇÃO — checkpoint backend em 2026-10-17**, base `95e9f33d`.
D01–D03 confirmadas: pessoal/clínica com pessoal por padrão e edição pelo
criador; por100g ou porção em gramas; aplicações existentes preservadas.
Catálogo público permanece separado. Reutilizar FOOD01 com identidade custom,
snapshots e controles de autosave/abas. R047/R064 examinados; R015/R016/R042
triados; sem pacote novo, câmera ou API externa. Não depende de TBCA.
T01–T05 backend implementados:494 focados,34 PG/29 filtrados e build/typecheck
PASS; migration1076 só descartável. UI/BFF/CI pendentes.
[Handoff Luna](../../tasks/handoff-pos-320-food02-luna.md).
[Plano](../../tasks/plan-pos-320-food02.md) e
[checklist](../../tasks/todo-pos-320-food02.md). Backend/RLS Sol médio; Luna alto
somente após checkpoint e troca manual; revisão final Sol médio.

**Origem:** item 24.

**Situação após Fases 299/311/320:** TACO, USDA e IBGE já compõem o catálogo multifonte; 311 prevê verificação/ativação do kit e 320 é a decisão específica sobre direitos da TBCA. **O cadastro de alimento personalizado não depende da aprovação da TBCA.**

**Implementação residual:**
- Auditar busca multifonte e cadastro manual do editor após 320;
- inserir ação `Criar alimento` na busca, reutilizando autorização/tenant;
- persistir origem `custom`, escopo pessoal/clínica, medidas e composição informada;
- nunca gravar `custom` como se fosse TACO/USDA/IBGE/TBCA;
- mostrar fonte e limitações da composição;
- se Fase 320 for `NO-GO`, manter TBCA completamente ausente.

**Aceite:** alimento customizado aparece na busca autorizada; não contamina índices de fontes públicas; versão de plano publicado permanece imutável; teste negativo de tenant e fonte.

---

## [FOOD03] Favoritar substitutos

**Origem:** item 30.

**Status atual (2026-10-22):** concluída pela PR #438 (`9f13b80a`). Migration 1077 aplicada e conferida em staging e produção; deploy automático do backend/Web nos dois ambientes está `live`, com `/health` e `/login` respondendo HTTP 200. Revisão R4 foi confirmada pelo proprietário. Evidências e limites em `tasks/plan-pos-320-food03.md`.

**Planejamento técnico atualizado em 2026-10-22:** `tasks/plan-pos-320-food03.md`.
O contrato separa a preferência privada do profissional do campo `preferida`
existente no snapshot de substituição do plano, que afeta a apresentação ao
paciente. FOOD02 (#425/#426) foi integrada. Favoritos devem usar identidade
persistente de catálogo/alimento personalizado quando disponível, ser isolados
por tenant+profissional e ordenar o seletor sem alterar publicação, macros,
escolhas ou planos existentes. A autorização de implementação foi dada em
2026-10-22; o teste RLS em PostgreSQL descartável e regressões são gates antes
de encerrar a PR.

**Implementação sugerida:**
- favorito por profissional;
- vinculado ao alimento/substituto canônico quando possível;
- ordenar favoritos antes dos demais resultados.

**Aceite:**
- favoritar/desfavoritar;
- isolamento por profissional;
- não altera plano já publicado.

---

## [FOOD04] Grupos reutilizáveis de substituições

**Planejamento ativo (2026-10-22):** main `9e1984a2`, após merge #440.
[Plano e gaps](../../tasks/plan-pos-320-food04.md) e
[tarefas/checkpoints](../../tasks/todo-pos-320-food04.md).
D01–D03 aprovadas e ampliadas para D01–D08 pelo proprietário: grupos pessoais
  e compartilhados, administração específica e continuidade institucional,
  duplicação independente, descrição/categoria/etiquetas, favoritos/filtros,
  aplicação seletiva/porções/dedup, arquivo/restauração e proveniência cifrada.
  Undo local seguro incluído; sem implementação ou PR FOOD04 nesta etapa.
Referência específica: primitives/código atual, sem repositório externo recomendado.

**Origem:** itens 49 e parte do 17.

**Status atual:** substituições são ancoradas diretamente ao item principal.

**Implementação sugerida:**
- biblioteca de grupos reutilizáveis;
- origem pessoal/clínica;
- aplicar a múltiplos alimentos;
- ao publicar plano, gerar snapshot para não mudar retrospectivamente.

**Aceite:**
- mesmo grupo aplicável a itens diferentes;
- criar, editar, duplicar, arquivar e restaurar conforme matriz de permissões;
- seleção parcial e porções personalizadas, sem repetir principal ou duplicata
  exata; divergência de porções exige decisão explícita;
- preservar alternativas anteriores; novas sem preferência ou liberação automática;
- editar biblioteca não altera cópias aplicadas, rascunhos ou versões publicadas;
- autosave, RLS, CAS, snapshots, cálculos e histórico do plano preservados.

**Complementares propostos, sem execução antecipada:** FOOD04-C01 avisos de
incompatibilidade, dependentes de cadastro estruturado e regras clínicas validadas
(hoje não demonstrados); FOOD04-C02 aplicação simultânea em múltiplos destinos;
FOOD04-C03 undo persistente e histórico navegável/diff da biblioteca. Auditoria e
rastreabilidade essenciais continuam na PR principal. Equivalência automática
permanece exclusivamente FOOD05.

---

## [FOOD05] Equivalência automática por nutriente-alvo

**Origem:** item 45.

**Status atual:** há composição nutricional e substituições, mas não equivalência automática por nutriente selecionado.

**Dependência:** catálogo nutricional confiável.

**Implementação sugerida:**
- escolher energia, proteína, carboidrato, gordura ou outro nutriente suportado;
- calcular porção equivalente no backend;
- tratar nutriente zero/ausente;
- mostrar diferenças dos demais nutrientes antes de aplicar.

**Aceite:**
- cálculo reproduzível;
- fonte do alimento preservada;
- usuário revisa antes de inserir;
- nenhum nutriente ausente é presumido como zero.

---

## [FOOD06] IDR/DRI e UL de micronutrientes

**Origem:** item 47.

**Status atual:** alimentos já suportam micronutrientes, mas plano não cruza ingestão com referências.

**Implementação sugerida:**
- tabela de referências versionadas;
- idade;
- sexo;
- condição fisiológica quando suportada;
- valor de referência;
- UL;
- fonte bibliográfica;
- análise factual da ingestão total.

**Aceite:**
- mostrar ingestão, referência, percentual e UL quando existente;
- deixar `não disponível` quando faltarem dados;
- não converter referência em diagnóstico;
- fonte/versionamento visíveis.

---

## [FOOD07] Metadados adicionais de receitas — SOMENTE GAP RESIDUAL DA FASE 310

**Origem:** item 19.

**Status esperado após 320:** a Fase **310** já contempla **categorias pesquisáveis** e **entrega explícita da receita revisada ao paciente**. Esses componentes **não** podem ser recriados por esta PR se entregues.

**Escopo residual possível, condicionado à auditoria:**
- tags livres além de categorias, **apenas se não existirem**;
- porções, tempo de preparo e instruções estruturadas, apenas onde ainda faltarem;
- filtros úteis não presentes na 310;
- preservar cópia, versionamento, retirada do portal e trilha de leitura entregues pela 310.

**Aceite:** evidência de gap funcional, retrocompatibilidade de receitas antigas, isolamento do acervo, sem publicar receitas automaticamente. **Se a Fase 310 já atender o objetivo integralmente, marcar `JÁ COBERTO` e não abrir PR.**

---

## [FOOD08] Biblioteca pública de receitas entre organizações

**Origem:** item 71.

**Status atual:** receitas podem ser pessoais ou compartilhadas com a clínica.

**Dependência:** conclusão/reconciliação da Fase 310 e `FOOD07` somente se realmente necessária; não publicar conteúdo da clínica automaticamente.

**Implementação sugerida:**
- escopo `publica`;
- publicação voluntária;
- autoria;
- versão;
- tags;
- favoritos;
- copiar para biblioteca própria;
- moderação/report;
- remover qualquer vínculo com paciente.

**Aceite:**
- nenhuma receita pública contém identificador de paciente;
- usuário não edita diretamente receita de outro autor;
- reutilização cria cópia/snapshot próprio.

---

# 7. ONDA 3 — Antropometria, pediatria, gestação e composição corporal

Objetivo: ampliar o acompanhamento longitudinal clínico.

---

## [ANT01] Relação cintura-estatura

**Origem:** item 29.

**Status atual:** domínio antropométrico já calcula outros indicadores.

**Implementação sugerida:**
- cálculo derivado;
- registro no snapshot da avaliação;
- série longitudinal;
- fonte/versionamento da regra quando houver classificação.

**Aceite:**
- cálculo reproduzível;
- avaliações antigas permanecem imutáveis.

---

## [ANT02] Copiar última antropometria como base

**Origem:** item 26.

**Implementação sugerida:**
- botão `Usar última avaliação como base`;
- copiar somente medidas selecionáveis;
- não copiar resultados derivados;
- recalcular tudo na nova avaliação.

**Aceite:**
- usuário vê quais campos serão copiados;
- data/protocolo/autor não são herdados indevidamente.

---

## [ANT03] Visibilidade antropométrica adicional — GAP RESIDUAL APÓS FASE 307

**Origem:** item 64.

**Situação atual comprovada:** Fase 307/PR #384 introduziu **seleção explícita por avaliação** para compartilhar IMC, percentual de gordura e massa magra, além da curva de peso já existente; também inclui marcos de metas opt-in. A migração 1064 deve ser verificada por ambiente.

**Escopo possível:** apenas melhorias comprovadamente não cobertas (por exemplo, controles adicionais de métricas ou preferência de visualização), **sem enfraquecer o padrão privado, modificar dados anteriores silenciosamente ou criar segunda política de visibilidade**.

**Aceite:** testes comprovam que nenhuma métrica não autorizada sai do backend; sem acesso a outro paciente/tenant. **Se a Fase 307 resolver o pedido, marcar `JÁ COBERTO` e não abrir PR.**

---

## [ANT04] Bioimpedância estruturada

**Origem:** item 25.

**Implementação sugerida:**
- entidade própria;
- data;
- equipamento/protocolo;
- massa gorda;
- massa magra;
- água;
- gordura visceral;
- demais campos opcionais;
- anexo do relatório original;
- série temporal.

**Aceite:**
- campos desconhecidos ficam ausentes;
- unidade explícita;
- histórico imutável.

---

## [ANT05] Evolução complementar pediátrica — SOMENTE GAP APÓS FASE 314

**Origem:** item 6.

**Situação planejada:** a **Fase 314** já cobre referência por idade/sexo, percentis/escores e cálculo reproduzível, condicionados a validação clínica/legal.

**Escopo residual:** após o resultado da 314, verificar se ainda falta visualização de séries e curvas pediátricas com pontos históricos, fontes/versionamento na UI, filtros ou exportações apropriadas. **Não criar segundo motor de percentis/escores**, nem reutilizar tabelas de referência sem validar direitos/protocolo.

**Se a 314 for `NO-GO`:** manter a classificação etária bloqueada e pedir nova decisão clínica explícita antes de implementar qualquer cálculo. Se a 314 já cumprir tudo, marcar `JÁ COBERTO` e não abrir esta PR.

**Aceite:** séries corretas sobre motor aprovado, limites etários respeitados, cálculos reproduzíveis, testes de fronteira e ausência de classificação para dados incompletos.

---

## [ANT06] Zoom e navegação em curvas de crescimento

**Origem:** item 1.

**Dependência:** Fase 314 aprovada e integrada; `ANT05` somente se houver lacuna de base visual/curvas confirmada.

**Implementação sugerida:**
- zoom temporal;
- seleção de período;
- pan quando aplicável;
- reset;
- tooltip;
- tabela acessível alternativa.

**Aceite:**
- zoom não altera dados;
- teclado e leitor de tela continuam utilizáveis.

---

## [ANT07] Acompanhamento gestacional longitudinal — SOMENTE GAP APÓS FASE 313

**Origem:** item 7.

**Situação planejada:** a Fase **313** já trata a regra/classificação antropométrica gestacional, após validação clínica, considerando idade gestacional e dados necessários.

**Escopo residual possível:**
- histórico de pesos e ganhos por semana;
- inserção de pesos em lote;
- apresentação da curva permitida pela referência aprovada;
- seleção de referência apenas se suportada/aprovada clinicamente;
- nunca voltar a classificar gestantes com faixas de IMC adulto.

**Se a 313 for `NO-GO`:** não implementar inferência ou classificação alternativa por meio desta PR. Necessária nova decisão explícita.

**Aceite:** registro/visualização separados do motor validado, fonte e versão visíveis, dados ausentes não geram classificação, snapshots preservados.

---

## [ANT08] Evolução fotográfica — UX avançada

**Origem:** item 58, evolução de recurso já existente.

**Status atual:** comparação fotográfica já existe.

**Implementação sugerida:**
- slider antes/depois;
- sobreposição;
- zoom;
- alinhamento visual assistido;
- guia de enquadramento para novas capturas.

**Não fazer:** inferir diagnóstico ou composição corporal automaticamente nesta PR.

---

# 8. ONDA 4 — Questionários, anamnese e prontuário

Objetivo: tornar formulários e registros clínicos mais reutilizáveis e analisáveis.

---

## [QST01] Expandir/recolher respostas de questionários

**Origem:** item 33.

**Implementação sugerida:**
- accordion;
- `Expandir tudo`;
- `Recolher tudo`;
- preservar navegação por teclado.

---

## [QST02] Link permanente reutilizável de questionário

**Origem:** parte do item 41.

**Status atual:** links públicos pertencem a envios individuais e possuem ciclo próprio.

**Implementação sugerida:**
- criar conceito separado de link reutilizável;
- nunca substituir o envio individual identificado;
- configurar se exige identificação;
- rate limit;
- revogação/rotação;
- validade opcional.

**Aceite:**
- link pode receber múltiplas submissões conforme configuração;
- cada resposta recebe identidade/origem apropriada;
- link revogado deixa de aceitar respostas.

---

## [QST03] Gráficos e relatórios de questionários

**Origem:** parte do item 41.

**Status atual:** já existe matriz longitudinal tabular e CSV; a **Fase 305** também unificou a leitura temporal de questionários, antropometria e consultas. Não recriar esse cruzamento.

**Implementação sugerida:**
- gráficos apenas para perguntas numericamente estáveis;
- série longitudinal;
- filtros paciente/período/questionário;
- resumo factual;
- exportação continua disponível.

**Aceite:**
- pergunta textual não é convertida em métrica artificial;
- gráfico tem tabela acessível equivalente.

---

## [QST04] Recordatório alimentar calculável

**Origem:** item 66.

**Status atual:** recordatório pode existir como formulário, sem cálculo nutricional estruturado.

**Dependência:** catálogo alimentar.

**Implementação sugerida:**
- entidade/estrutura de recordatório;
- itens alimentares e quantidades;
- cálculo de energia/macros/micros;
- vínculo opcional com resposta de anamnese;
- revisão humana antes de consolidar.

---

## [QST05] Páginas/deep links dedicados para anamnese e prontuário

**Origem:** item 23.

**Implementação sugerida:**
- subrotas/deep links;
- reutilizar componentes e APIs;
- não criar segundo prontuário paralelo.

---

## [QST06] Modal/painel lateral de prontuário e anamnese em outras telas

**Origem:** item 67.

**Dependência recomendada:** QST05.

**Implementação sugerida:**
- painel lateral reutilizável;
- abrir no editor do plano, agenda e outras telas;
- leitura primeiro;
- edição somente quando permissão e contexto permitirem;
- deep link para tela completa.

---

## [QST07] Modelos compostos de prontuário/consulta

**Origem:** item 22.

**Status atual:** existem modelos de evolução/texto clínico.

**Implementação sugerida:**
- template composto por seções;
- evolução;
- avaliação;
- conduta;
- observações;
- origem pessoal/clínica;
- aplicação em rascunho, nunca em registro final automaticamente.

---

# 9. ONDA 5 — Diário, hábitos e app/portal do paciente

Objetivo: melhorar adesão e experiência do paciente.

---

## [APP01] Habit Tracker configurável

**Origem:** item 5.

**Status atual:** Registro de hábitos/diário rápido já existe.

**Implementação sugerida:**
- tipos configuráveis;
- água;
- sono;
- atividade;
- refeição;
- glicemia;
- suplemento;
- customizado;
- unidade;
- meta;
- frequência.

---

## [APP02] Filtro por paciente na fila consolidada de diário

**Origem:** item 51.

**Implementação sugerida:**
- visão consolidada;
- filtros server-side por paciente, período, tipo, status de revisão e profissional;
- manter escopo por carteira.

---

## [APP03] Revisão em lote dos registros do diário

**Origem:** item 2.

**Dependência:** APP02.

**Observação:** a implementação atual exige rastreabilidade de leitura individual.

**Implementação sugerida:**
- seleção explícita;
- ação em lote somente para registros apresentados/revisáveis;
- auditoria de IDs abrangidos;
- diferenciar `revisado` de `comentado`.

---

## [APP04] Streak de hábitos e diário — CONDICIONAL AO RESULTADO DA FASE 317

**Origem:** item 52. **Dependência:** APP01 e decisão clínica/de produto da Fase 317.

**Situação planejada:** Fase 317 avalia gamificação/comunidade, benefícios, possíveis danos, opt-in e propósito. Pode terminar em `NO-GO`.

**Implementação residual permitida apenas se aprovada:** sequência por dia/semana, fuso, critérios, grace period opcional e badges ligados aos hábitos existentes, **sem ranking clínico ou exposição entre pacientes**.

**Aceite:** consentimento/opt-in quando aplicável, saída simples, métricas de benefício/dano e testes contra incentivo a registros falsos. **Se a 317 não aprovar o modelo, não abrir a PR.**

---

## [APP05] Central de documentos e prescrições para download

**Origem:** item 53.

**Status atual:** plano pode ser impresso/salvo em PDF.

**Implementação sugerida:**
- área única para plano, orientações, documentos e materiais permitidos;
- download explícito;
- autorização e URLs temporárias.

---

## [APP06] Macronutrientes por refeição no app, configuráveis

**Origem:** item 54.

**Implementação sugerida:**
- setting server-side por plano;
- ocultar/mostrar;
- opção totais e/ou por refeição;
- DTO do portal respeita a configuração.

---

## [APP07] Thread de conversa em registro do diário/refeição

**Origem:** item 56.

**Status atual:** conversa bidirecional portal-clínica já existe.

**Implementação sugerida:**
- contextualizar conversa por `registroHabitoId/logDiarioId`;
- replies;
- lido/não lido;
- notification;
- reutilizar infraestrutura da conversa existente.

---

## [APP08] Compartilhamento de registro do diário em Stories

**Origem:** item 55.

**Dependência recomendada:** APP01.

**Implementação sugerida:**
- gerar card;
- compartilhamento nativo;
- remover dados sensíveis por padrão;
- nunca publicar automaticamente.

---

## [APP09] Internacionalização do app/portal do paciente

**Origem:** item 57.

**Implementação sugerida:**
- infraestrutura i18n;
- `pt-BR` como fallback;
- `en`;
- `es`;
- datas;
- números;
- unidades;
- mensagens de erro;
- templates relevantes.

**Aceite:**
- nenhuma string crítica do portal fica hardcoded fora do catálogo definido para i18n.

---

# 10. ONDA 6 — Agenda, financeiro, equipe e gestão

Objetivo: evoluir as ferramentas operacionais da clínica.

---

## [OPS01] Agenda — busca rápida

**Origem:** parte do item 50.

**Status atual:** agenda possui filtros/período, mas não busca ampla conforme solicitado.

**Implementação sugerida:**
- busca por paciente;
- tipo de atendimento;
- profissional quando autorizado;
- período;
- server-side.

---

## [OPS02] Agenda — título personalizado e cores

**Origem:** parte do item 50.

**Status atual:** link público e tipos de atendimento já existem.

**Implementação sugerida:**
- título opcional;
- cor por tipo/profissional/configuração;
- nunca usar cor como único indicador de estado;
- preservar sincronização Google.

---

## [OPS03] Ocultar valores financeiros visualmente

**Origem:** item 11.

**Implementação sugerida:**
- toggle visual;
- dashboard;
- paciente;
- financeiro;
- preferência local de interface sem alterar autorização;
- dados continuam acessíveis somente a quem tem permissão.

---

## [OPS04] Financeiro detalhado

**Origem:** item 8.

**Status atual:** pagamentos, pacotes, recibos e relatórios já existem.

**Implementação sugerida:**
- receitas/despesas;
- categorias;
- contas a receber/pagar;
- competência/caixa;
- inadimplência;
- fluxo de caixa;
- exportação.

**Observação:** dividir em nova onda futura se o escopo ficar grande demais; esta PR deve permanecer revisável.

---

## [OPS05] Aniversariantes do mês no dashboard

**Origem:** item 62.

**Implementação sugerida:**
- widget opcional;
- carteira do profissional;
- próximos aniversários;
- exposição mínima da data.

---

## [OPS06] Dashboard de estatísticas ampliado — SOMENTE GAP PÓS-306

**Origem:** item 59, evolução do módulo de métricas existente.

**Situação:** a Fase 263 já entregou receita, consultas concluídas, comparecimento e ticket. A Fase **306** integrou intervalo observado de retorno, pacientes sem próxima consulta, faltas por horário e tempo de resposta a formulários, com denominadores explícitos.

**Implementação residual possível:** indicadores ainda ausentes (por exemplo, segmentação agregada por novos/ativos/inativos, adesão mensurada sem inferências e filtros adicionais), somente com métricas bem definidas e protegidas.

**Aceite:** nunca duplicar indicadores 263/306, nem alterar seus denominadores sem revisão; agregados autorizados, sem vazamento entre profissionais/tenants; registrar definições e janelas.

---

## [OPS07] Permissões individuais por usuário

**Origem:** item 61.

**Status atual:** organização, convites, papéis e matriz de permissões já existem.

**Implementação sugerida:**
- papel base;
- overrides `allow/deny`;
- cálculo de permissão efetiva server-side;
- preview do acesso;
- auditoria;
- revogar sessões após alteração relevante.

---

## [OPS08] Comentários transversais em registros

**Origem:** item 63.

**Implementação sugerida:**
- `recursoTipo + recursoId`;
- thread;
- autor;
- timestamp;
- permissões;
- conteúdo cifrado quando clínico;
- auditoria sem conteúdo;
- não substituir observações clínicas próprias.

---

# 11. ONDA 7 — Documentos, PDFs, materiais e rich text

Objetivo: melhorar apresentação, documentação e reutilização de conteúdo.

---

## [DOC01] Assinatura gráfica e carimbo em documentos

**Origem:** item 20.

**Status atual:** documentos já têm identidade profissional/conselho; a Fase 312 planeja encaminhamento e avaliação de atestado sob gate jurídico. Assinatura gráfica não valida assinatura certificada nem competência profissional.

**Implementação sugerida:**
- upload de assinatura;
- carimbo gerado;
- opção de exibição;
- armazenamento privado;
- distinguir claramente representação visual de assinatura digital certificada.

---

## [DOC02] Gerador de carimbo profissional

**Origem:** item 31.

**Dependência recomendada:** DOC01.

**Implementação sugerida:**
- nome;
- profissão;
- conselho;
- número;
- estado quando aplicável;
- preview;
- variações simples de layout.

---

## [DOC03] Leitor nativo de PDF

**Origem:** item 28.

**Implementação sugerida:**
- viewer autenticado;
- PDF.js ou equivalente;
- URL temporária;
- sem cache persistente de PHI;
- download separado.

---

## [DOC04] Filtro de campos no PDF de antropometria

**Origem:** item 32.

**Implementação sugerida:**
- medidas;
- gráficos;
- resultados;
- observações;
- fotos quando permitido;
- preview.

---

## [DOC05] Padronizar nomes de arquivos PDF

**Origem:** item 37.

**Implementação sugerida:**
- helper central;
- paciente;
- tipo;
- data;
- versão quando necessário;
- sanitização;
- evitar caracteres inválidos e PII excessiva em contexto compartilhável.

---

## [DOC06] Rich text seguro com tabelas

**Origem:** item 38.

**Implementação sugerida:**
- listas;
- negrito/itálico;
- tabelas;
- estrutura serializada segura;
- sanitização;
- migração compatível com texto simples existente.

---

## [DOC07] Links clicáveis em orientações e textos

**Origem:** item 60.

**Dependência:** DOC06.

**Implementação sugerida:**
- hyperlinks;
- `https` por padrão;
- sanitização;
- `rel` seguro;
- preview/edição amigável.

---

## [DOC08] Personalização visual dos PDFs/documentos

**Origem:** item 65.

**Status atual:** identidade da clínica e templates já existem.

**Implementação sugerida:**
- logo;
- cor principal;
- cabeçalho;
- rodapé;
- margens;
- layout aprovado;
- preview;
- tema por tenant.

---

## [DOC09] Guia de logo para documentos

**Origem:** item 35.

**Dependência:** DOC08.

**Implementação sugerida:**
- dimensões recomendadas;
- fundo transparente;
- proporção;
- preview real;
- safe area;
- mensagens de validação.

---

## [DOC10] Reordenar materiais de apoio

**Origem:** item 43.

**Status atual:** materiais podem ser enviados e visualizados, mas sem ordem configurável.

**Implementação sugerida:**
- campo de ordem no vínculo quando necessário;
- drag-and-drop;
- botões ↑/↓;
- ordem refletida no portal.

---

# 12. ONDA 8 — Cálculo energético, atividade física e projeções

Objetivo: expandir o motor de cálculo com regras versionadas e testáveis.

---

## [CALC01] Catálogo clínico/popular de atividades e METs

**Origem:** item 3.

**Implementação sugerida:**
- nome clínico;
- nome popular;
- sinônimos;
- categoria;
- intensidade;
- MET;
- fonte;
- versão;
- busca em português.

---

## [CALC02] Novas equações de gasto energético

**Origem:** item 68.

**Status atual:** Mifflin-St Jeor 1990, Harris-Benedict revisada 1984 e FAO/OMS/UNU 1985.

**Implementação sugerida:**
- Anjos et al. (2014);
- versão FAO/WHO desejada;
- Henry & Rees;
- Ten Haff;
- fonte e população de aplicabilidade;
- testes contra valores de referência.

**Obrigatório antes de codificar:** confirmar a publicação/fórmula exata de cada equação.

---

## [CALC03] Atividade física estruturada e cálculo avançado de gasto

**Origem:** item 69.

**Dependências:** CALC01 e, quando necessário, CALC02.

**Implementação sugerida:**
- modalidade;
- duração;
- frequência;
- MET;
- gasto diário/semanal;
- sugestões de FA mais transparentes;
- registrar premissas.

---

## [CALC04] VO₂, MET diário e METy

**Origem:** parte do item 69.

**Implementação sugerida:**
- PR separada para não misturar com atividade básica;
- definir protocolo;
- unidades;
- população;
- fonte;
- limites;
- não estimar quando dados necessários não existirem.

---

## [CALC05] Calculadora de estimativa de perda de peso / VENTA

**Origem:** item 70.

**Implementação sugerida:**
1. validar metodologia e referência científica;
2. documentar entradas e premissas;
3. implementar motor separado da prescrição;
4. projetar trajetória;
5. mostrar intervalo/limitações quando metodologicamente aplicável.

**Não fazer:** apresentar resultado como previsão garantida.

---

# 13. ONDA 9 — IA clínica aplicada

Objetivo: usar a infraestrutura de IA existente para reduzir trabalho repetitivo sem automatizar decisões clínicas finais.

---

## [AI01] Resumo pré-consulta assistido por IA — GATE PÓS-318

**Origem:** item 42. **Dependência:** resultado da Fase 318.

**Situação planejada:** Fase 318 compara a preparação determinística PB-25 e os modelos existentes com piloto de IA para pré-consulta, podendo decidir `NO-GO`.

**Escopo residual possível:** incorporar apenas lacunas comprovadas, com citações internas de origem, revisão humana e sem salvar automaticamente. Não reconstruir piloto/funcionalidade entregue na 318.

**Aceite:** finalidade/base legal, provider/localidade, retenção, qualidade e omissões aprovados; `NO-GO` bloqueia esta PR até nova decisão.

---

## [AI02] Síntese de anamnese assistida por IA — GATE PÓS-318

**Origem:** item 42. **Dependência:** resultado da Fase 318.

**Escopo residual:** sumarização de anamnese e respostas somente se houver ganho adicional comprovado em relação ao fluxo determinístico e piloto da 318; revisão humana, autoria e proveniência.

**Aceite:** sem diagnósticos/conduta automática, sem persistência sem aceite humano, sem envio externo de PHI não aprovado. `NO-GO` da 318 implica não abrir a PR.

---

## [AI03] Rascunho de retorno semanal

**Origem:** item 42.

**Gate obrigatório:** respeitar finalidade, provider/PHI e decisão de IA da Fase 318; se a 318 for `NO-GO` para rascunhos, exigir nova autorização específica. Não incluir envio automático.

**Implementação sugerida:**
- usar registro semanal/hábitos;
- gerar rascunho de mensagem;
- nunca enviar automaticamente;
- revisão humana obrigatória.

---

## [AI04] Organização assistida de prontuário — GATE PÓS-318

**Origem:** item 42.

**Escopo residual:** sugerir tópicos e agrupamentos **sem mover, alterar ou apagar conteúdo original**, reutilizando templates existentes e respeitando a decisão da Fase 318; confirmar antes de persistir.

**Aceite:** provenance, revisão humana, permissões por paciente/tenant, nenhum fluxo autônomo clínico. Se a decisão de IA da 318 vetar uso, não abrir PR.

---

## [AI05] RESOLVIDO PELO ESCOPO DA FASE 316 — NÃO EXECUTAR

**Origem:** item 42. **Estado deste ID:** `RESERVADO / SUPERSEDIDO PELO ROADMAP CANÔNICO`.

A extração assistida de exames (PDF/imagem → rascunho de marcador, valor, unidade e faixa, confirmação item a item) pertence à **Fase 316**, condicionada a gates jurídicos, PHI/provider, retenção, antimalware e disponibilidade operacional. **Não abrir PR `AI05`**, mesmo se 316 terminar `NO-GO`: nesse caso o veto deve ser respeitado. Melhorias residuais requerem aprovação e novo ID pós-320.

---

## [AI06] Reconhecimento alimentar integrado ao diário/plano

**Origem:** evolução da infraestrutura de IA já existente.

**Status atual:** reconhecimento alimentar por imagem já possui base técnica.

**Implementação sugerida:**
- integrar resultado ao fluxo clínico real;
- permitir correção;
- nunca adicionar automaticamente alimento ao plano;
- registrar revisão humana.

---

# 14. Mapa de recursos já resolvidos ou absorvidos por outras PRs

Este mapa evita abrir PR duplicada para itens do levantamento original.

| Recurso original | Tratamento neste roadmap |
|---|---|
| Macros sempre visíveis | Baseline já existente |
| Limite de 50 substitutos | Baseline já existente |
| Área de conteúdo | Baseline; evolução em DOC10 |
| Botão voltar ao paciente | Baseline |
| Alerta ao sair sem salvar | Baseline; consolidação em FND02 |
| Parâmetros bioquímicos personalizados | Baseline; evolução pode entrar junto de futuros modelos de exame |
| Avaliação física por fotos | Baseline; melhoria ANT08 |
| Página de estatísticas | Baseline; evolução OPS06 |
| Link permanente/relatórios/gráficos/envio em massa de questionários | QST02 + QST03; envio em massa já existe |
| Assinatura/carimbo | DOC01 + DOC02 |
| Inserir tabelas + links em textos | DOC06 + DOC07 |
| Novas equações + melhorias no gasto energético | CALC02 + CALC03 + CALC04 |
| Duplicação de refeições | PA02 |
| Reutilização de substituições | FOOD04 |
| Equivalência por nutriente | FOOD05 |
| IDR/UL | FOOD06 |
| Modelos de plano | **Fase 298 já integrada**, `FND01` arquivado sem PR |
| Modelo de refeição/grupo | FOOD04 e eventual PR específica pós-320; não reimplementar edição de modelos da Fase 298 |

---

# 15. Ordem de execução recomendada

A ordem padrão **só poderá ser iniciada após a conclusão formal da Fase 320**, reconciliação de gaps e autorização do usuário. IDs condicionais podem ser `NO-GO`/`JÁ COBERTO` e devem ser pulados sem PR. Sequência candidata:

1. **Onda 0 — Fundações**
2. **Onda 1 — Plano alimentar / produtividade**
3. **Onda 2 — Alimentos e substituições**
4. **Onda 3 — Antropometria**
5. **Onda 4 — Questionários e prontuário**
6. **Onda 5 — App, diário e hábitos**
7. **Onda 6 — Operação da clínica**
8. **Onda 7 — Documentos/PDF**
9. **Onda 8 — Cálculos**
10. **Onda 9 — IA clínica**

Ondas independentes podem ser executadas em paralelo somente quando:

- não alterarem o mesmo contrato;
- não dependerem da mesma migration;
- não dependerem de PR ainda não integrada;
- a revisão/merge puder acontecer sem criar branches encadeadas difíceis de reconciliar.

---

# 16. Checklist padrão de cada PR

Cada PR deste roadmap deve responder:

- [ ] O código atual foi auditado antes da implementação?
- [ ] O recurso não estava já completamente implementado?
- [ ] Escopo restrito a um único ID do roadmap?
- [ ] Backend faz autorização real?
- [ ] Tenant e escopo profissional preservados?
- [ ] RLS/FORCE RLS revisados se houve tabela nova?
- [ ] Dados sensíveis permanecem cifrados/minimizados?
- [ ] Auditoria não contém conteúdo clínico?
- [ ] Testes de unidade/integração adicionados ou atualizados?
- [ ] Teste de regressão web/mobile adicionado quando há mudança de UI?
- [ ] Acessibilidade testada?
- [ ] `typecheck` passou?
- [ ] `lint` passou?
- [ ] build aplicável passou?
- [ ] gates de autorização/segurança aplicáveis passaram?
- [ ] migration testada, se existir?
- [ ] nenhuma migration externa foi aplicada sem autorização?
- [ ] documentação de estado atualizada com fatos comprovados?
- [ ] rollback/impacto descrito na PR?

---

# 17. Critério para considerar um item concluído

Um ID só pode ser marcado como concluído quando:

1. o handoff 320→pós-320 está aprovado e o comportamento está integrado à `main`;
2. testes aplicáveis estão verdes;
3. nenhuma pendência necessária para o uso normal ficou escondida;
4. documentação relevante foi reconciliada;
5. migration, se houver, está apenas no código até autorização explícita para aplicação externa;
6. a PR não depende de branch não integrada para funcionar.

Implementação apenas em branch deve ser registrada como:

`IMPLEMENTADO — AGUARDANDO INTEGRAÇÃO`

e não como concluída.

---

# 18. Como executar uma onda com Codex

Prompt sugerido:

> Leia integralmente `docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md`, `docs/pos-320/01_Catalogo_GitHub_OctaClin`, `docs/pos-320/02_Matriz_71_Sugestoes_OctaClin.md`, `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md`, `AGENTS.md`, os documentos de segurança e os arquivos canônicos de status da `main`. Quero executar a próxima onda autorizada. O handoff da Fase 320 já foi registrado com NO-GO para ingestão TBCA nesta rodada; FND02 está sendo executado como primeira atividade da Onda 0. Para qualquer ID futuro, audite primeiro a `main` e classifique-o como `JÁ COBERTO`, `RESIDUAL CONFIRMADO`, `CONDICIONAL` ou `NO-GO`. Implemente apenas IDs `RESIDUAL CONFIRMADO` e autorizados, **individualmente, um ID por PR**, respeitando dependências e a ordem revisada com o usuário. Ignore `FND01`/`AI05` (arquivados), não contorne gates condicionais e não reimplemente escopos das Fases 302–320. Não agrupe vários IDs de produto numa PR. Antes de cada PR, confirme pelo código que ela ainda é necessária. Use TDD para comportamento novo, preserve tenant/RLS/LGPD/autorização e execute todos os gates aplicáveis. Não aplique migrations em ambientes externos, não habilite providers externos e não faça ações irreversíveis sem minha autorização. Ao terminar cada PR, informe: ID, branch, arquivos principais, migrations, testes executados, resultado dos gates, riscos remanescentes e link/número da PR se ela tiver sido aberta.

---

# 19. Observação final

Este roadmap é **posterior à Fase 320** e descreve produto e sequência; não autoriza automaticamente mudanças clínicas sensíveis, integrações externas, migrations em produção ou alteração de políticas de segurança.

Quando uma PR envolver:

- fórmula clínica;
- curva de referência;
- classificação;
- limite nutricional;
- interpretação de exame;
- exposição de dado ao paciente;

o Codex deve tratar fonte, versão, população aplicável e limitações como parte obrigatória da implementação.
