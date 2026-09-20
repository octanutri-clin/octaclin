# OctaClin Product & Feature Audit

Data: 2026-09-17 · Base: `main` em `84e9104` · Escopo: produto e funcionalidades (não é auditoria de segurança).

**Convenção de evidência.** `[F]` = fato observado no código, com arquivo e linha. `[H]` = hipótese de produto,
derivada dos fatos mas não provada por eles. Nenhuma recomendação aqui foi implementada — este documento é
diagnóstico e priorização, não autorização de execução.

**Método.** Mapa estrutural levantado diretamente (módulos, controladores, entidades, rotas BFF, jobs), leitura
em primeira mão das superfícies críticas (dashboard clínico, prontuário, agendamento público, portal do
paciente, portal do cliente, operações, materiais) e três explorações dirigidas por agente nos domínios
clínico, nutricional/IA e comunicações/automações. Onde um achado veio de agente, ele foi conferido contra o
código antes de entrar aqui; onde a conferência corrigiu o achado, o texto registra a versão corrigida.

---

## 1. Executive Summary — as 10 conclusões

1. **O problema do OctaClin não é falta de funcionalidade; é ativação.** `[F]` 85 entidades, 33 controladores,
   209 rotas BFF, 31 páginas, 9 jobs. O prontuário tem 6 áreas e 15 abas (`octaclin-web/components/pacientes/estrutura-prontuario.ts:20-35`).
   Há capacidade construída e paga que não chega ao usuário final.

2. **Toda a priorização clínica do produto roda sobre um número que ninguém calcula.** `[F]` `score_risco`
   nasce `'0'` (`servico-pacientes.ts:131`), só muda por digitação manual num campo numérico do formulário
   (`octaclin-web/components/cadastros/formulario-paciente.tsx:279`) e **não existe nenhuma rotina de cálculo no
   repositório**. Ainda assim ele decide o nível de risco do dashboard (`servico-dashboard-clinico.ts:394-400,955-957`),
   os filtros da lista de pacientes (`servico-pacientes.ts:563-571`), o alvo do recall
   (`automacoes/dominio/recall-inatividade.ts:124`) e o status exposto na API pública (`servico-api-publica.ts:83`).
   É o achado de maior alavancagem da auditoria.

3. **O motor de automações é uma vitrine.** `[F]` A interface oferece 4 gatilhos e 3 ações
   (`painel-automacoes.tsx:384-387,477-479`); só `paciente.inativo` tem executor, e o worker **apenas grava as
   ações como "planejadas", sem despachar nenhuma** (`processador-automacoes.ts:43-51`). O profissional cria,
   salva e ativa uma automação que nunca faz nada.

4. **O sistema sabe muito e age quase nada.** `[F]` Pelo menos oito eventos de domínio são emitidos e
   registrados (check-in respondido, formulário respondido, confirmação de consulta por WhatsApp, falha de
   envio, mensagem recebida, consulta concluída, tarefa concluída, solicitação pública) e **um único** deles
   aciona automação. A confirmação que o paciente manda pelo WhatsApp é gravada em
   `consulta.notificacoes.confirmacaoPaciente` e **exibida** no painel da agenda (`painel-agenda.tsx:196`),
   mas não muda o status da consulta nem alimenta fila, filtro ou automação: ninguém consegue perguntar
   "quem ainda não confirmou amanhã?" (`servico-webhook-whatsapp.ts:292-325`).

5. **O paciente registra e ninguém é avisado.** `[F]` `registrarCheckin` não emite notificação, evento ou
   alerta — o check-in vira uma linha da timeline. Adesão declarada (0-100), sintomas e humor entram no banco e
   morrem ali.

6. **A comunicação é unidirecional.** `[F]` Não existe rota de envio de mensagem no portal do paciente
   (`octaclin-web/app/api/portal/paciente/` tem checkins, consultas, formularios-respondidos, lgpd, perfil,
   plano-alimentar, tarefas — e nada de mensagens); a seção "Mensagens" do portal só lista `mensagensRecentes`
   (`portal-paciente.tsx:1384`). A clínica fala; o paciente não responde dentro do produto.

7. **Não existe modelo de expediente.** `[F]` O agendamento público oferece horários livres 24 h por dia, 7
   dias por semana, por 30 dias, subtraindo apenas ocupações já existentes
   (`servico-agendamento-publico.ts:496-517`, janela em `:39`). Não há entidade de disponibilidade/jornada em
   lugar nenhum do backend. `[H]` Na prática isso obriga o profissional a bloquear manualmente todas as horas
   em que não atende, ou a não usar o link público.

8. **O dono da clínica tem painel de assinatura, não de operação.** `[F]` O `resumo` do portal do cliente
   devolve conta, plano, limites, uso e contagem de usuários — nada de pacientes, agenda, no-show ou retenção
   (`servico-portal-cliente.ts:192-237`). E o painel de Operações, que tem auditoria, falhas de comunicação e
   LGPD, é inteiramente `@Papeis('SuperAdmin')` (`controlador-operacoes.ts:62`): a clínica não enxerga a própria
   trilha nem as próprias solicitações LGPD.

9. **O padrão certo já existe no produto — em um módulo só.** `[F]` Questionários tem biblioteca de perguntas
   reutilizáveis, modelos, duplicação, versionamento, matriz longitudinal, leitura clínica, export e
   agendamento recorrente (`controlador-questionarios.ts:67-347`). Plano alimentar, condutas terapêuticas,
   evolução clínica e materiais — exatamente onde o trabalho manual é maior — não têm nenhum desses recursos.
   Não é preciso inventar padrão novo: é preciso replicar o que já foi resolvido.

10. **A IA está com o trilho de conformidade pronto e sem motor.** `[F]` Revisão humana obrigatória por
    contrato, auditoria sem conteúdo clínico, rate limit por tenant, cache por hash — tudo construído
    (`servico-ia.ts`). O provider é uma heurística local de contagem de palavras em Python, o reconhecimento
    alimentar **nunca recebe a imagem** (o backend envia só o sha256 e um texto de contexto,
    `servico-ia.ts:159-162`), a flag `ia.clinica` está desligada por padrão
    (`infraestrutura/feature-flags/servico-feature-flags.ts:6`) e o resultado não alimenta nenhum fluxo.

---

## 2. Current Product Map

Inventário por domínio, com estado aparente. "Robusto" aqui significa: coberto por teste, com regra de negócio
explícita e sem lacuna funcional evidente.

### Clínico — paciente e prontuário
| Funcionalidade | Estado | Nota |
| --- | --- | --- |
| Prontuário 360 (6 áreas, 15 abas) | Robusto | `estrutura-prontuario.ts`; navegação por área/aba com permissão por aba |
| Linha do tempo paginada | Robusto | `UNION ALL` de 14 fontes com cursor e filtro (`servico-pacientes.ts:960-1190`) |
| Resumo do prontuário | Funcional, básico | Próxima ação + próxima consulta + contexto operacional + contadores + gráfico antropométrico |
| Antropometria | **Robusto — melhor peça do domínio** | 4 protocolos, limites de plausibilidade, append-only com snapshot de fórmula |
| Evoluções clínicas | Funcional, básico | Só POST/GET; sem edição, sem template, texto livre |
| Condutas terapêuticas | Funcional, básico | Versionamento completo; campos de revisão/validade sem consumidor |
| Exames laboratoriais | Parcial | Só listar/criar; marcador é texto livre; sem faixa de referência, sem série |
| Evolução fotográfica | Parcial | Consentimento versionado robusto; sem comparação lado a lado; upload com UI inacabada |
| Documentos clínicos emitidos | Robusto | Modelos por tenant, variáveis auto-preenchidas, append-only. Só 3 tipos |
| Perfil de cadastro do paciente | Funcional, com dados órfãos | origem/categoria/tags/próxima revisão coletados e não usados |
| Dashboard clínico | Robusto na agregação, subutilizado na exibição | 7 filas + alertas; métricas calculadas e nunca exibidas |
| Filtros salvos / importação CSV / duplicidade | Funcionais, com UI | Filtros limitados a 4 critérios |

### Agenda, consultas e financeiro
| Funcionalidade | Estado | Nota |
| --- | --- | --- |
| Agenda e feed | Robusto | Feed unificado com bloqueios manuais e externos |
| Criação de consulta | Funcional, básico | 16 campos no DTO; sem recorrência; sem duplicação |
| Desfecho / cancelamento / remarcação | Robusto | Auditado, com origem de cancelamento gravada |
| Agendamento público | Funcional, com lacuna estrutural | Sem modelo de expediente: oferta 24/7 |
| Teleconsulta | Funcional, mínimo | Link colado à mão e validado; sem geração de sala |
| Lembrete 24 h | Robusto | Job a cada 5 min, idempotente, e-mail + WhatsApp, respeita preferências |
| Recall de inatividade | **Robusto** | Simulação obrigatória com lista nominal antes de ativar |
| Financeiro (recebimentos, pacotes, performance, comparação, export) | Robusto | Entregue nas fases 209 e 263 |
| Google Calendar | Robusto | Conexão, sincronização, watch com renovação, revogação no desconectar |

### Nutricional
| Funcionalidade | Estado | Nota |
| --- | --- | --- |
| Plano alimentar versionado | Robusto no domínio, básico na ergonomia | 3 fórmulas versionadas, hash de conteúdo, alerta de divergência |
| Substituições + escolha do paciente | **Robusto ponta a ponta** | Opt-in explícito, trilha append-only, profissional vê as escolhas |
| Modelos de plano | Funcional, básico | Sem edição; sem seed inicial |
| Receitas nutricionais | Funcional, básico | CRUD completo; sem categorias; não chega como receita ao paciente |
| Base de composição (TACO, 583 alimentos) | Robusto na governança, parcial na cobertura | Carga por script ops manual, não por migration |

### Engajamento do paciente
| Funcionalidade | Estado | Nota |
| --- | --- | --- |
| Portal do paciente | Funcional | Agenda, plano, formulários, check-ins, tarefas, privacidade, mensagens (leitura) |
| Check-ins e diário | Funcional na coleta, morto no consumo | Não dispara nada |
| Gráfico de evolução do paciente | Funcional, mínimo | Só peso, dentro da seção de check-ins |
| Questionários e formulários | **Robusto** | Biblioteca, modelos, duplicação, versões, matriz longitudinal, recorrência |
| Materiais educativos | Funcional, com métrica morta | `visualizadoEm` é exibido e **nunca gravado** |
| Gamificação e comunidade | Ilha opt-in | Desligada por padrão (`servico-gamificacao.ts:55-56`) |
| Mobile (Expo) | Bloqueado | `mobile.sync` é feature flag desligada; distribuição em NO-GO |

### Comunicação, automação, integração
| Funcionalidade | Estado | Nota |
| --- | --- | --- |
| Entrega de mensagem (outbox + fila + fallback) | **Robusto** | Idempotência por chave, degradação sem Redis |
| WhatsApp Cloud API | Robusto | Só modo template |
| E-mail | Robusto | SMTP + Gmail API |
| Push | **Stub que finge sucesso** | `adaptador-push-placeholder.ts:9-15`, e é o default do roteador |
| Templates de mensagem | Funcional, básico | "Aprovado" é checkbox manual; sem edição; sem biblioteca inicial |
| Central de falhas | **Robusto** | Reprocesso individual, filtro por origem/canal/período |
| Notificações in-app | Funcional, básico | 5 tipos, sem preferência por usuário, por polling |
| Motor de automações | **Vitrine** | 1 de 4 gatilhos executa; nenhuma ação é despachada |
| API pública v1 + webhooks | **Robusto** | HMAC, backoff, SSRF, documentada — mas só papel `Client` |

### Gestão, conta e plataforma
| Funcionalidade | Estado | Nota |
| --- | --- | --- |
| Portal do cliente (conta) | Funcional | Assinatura, limites, usuários, convites, perfil, modelos de documento |
| Integrações (chave/webhook) | Robusto | Fora do alcance do papel `Professional` |
| Operações (auditoria, LGPD, falhas, flags, tenants) | Robusto | **100% SuperAdmin** |
| LGPD (consentimento, exportação, retenção, eliminação, tombstone) | Robusto | Fase 261 |
| Auth, MFA, sessões, primeiro acesso | Robusto | Fases 40-41, 259 |
| Feature flags | Mínimo | Só duas flags conhecidas, ambas desligadas |

---

## 3. Existing Features — Improvement Opportunities

| Funcionalidade | Situação atual | Problema | Melhoria | Impacto | Esforço | Prior. |
| --- | --- | --- | --- | --- | --- | --- |
| Score de risco | Campo numérico digitado à mão, default 0 | Toda a triagem opera sobre dado inexistente | Calcular a partir de sinais que já existem (consultas, faltas, check-ins, tarefas, formulários) | Alto | M | **P0** |
| Motor de automações | Gatilhos e ações na UI sem executor | Automação "ativa" que não faz nada | Executar as 3 ações já oferecidas e ligar os 3 gatilhos órfãos | Alto | M | **P0** |
| Canal push | Stub que retorna sucesso | Mensagem aparece entregue sem ter sido | Remover da UI ou implementar de fato | Médio | P | **P0** |
| Check-in do paciente | Coletado, sem consumidor | Profissional não sabe que houve sinal ruim | Notificar/alertar por limiar configurável | Alto | P | **P1** |
| Agendamento público | Oferta 24/7 | Paciente marca 3 h da manhã de domingo | Modelo de expediente por profissional | Alto | M | **P1** |
| Resumo do prontuário | Operacional + gráfico de peso | Falta a leitura clínica que o profissional precisa em 10 s | Delta desde a última consulta, objetivo, adesão, últimos exames alterados | Alto | M | **P1** |
| Dashboard clínico | Métricas calculadas e não exibidas | Dado pronto no DTO e invisível na tela | Exibir concluídas/faltas/canceladas/reagendadas e comparar com período anterior | Médio | P | **P1** |
| Exames laboratoriais | Lista por coleta, marcador texto livre | Sem série, sem "está alterado?" | Catálogo de marcadores + faixa de referência + série por marcador | Alto | M | **P1** |
| Materiais educativos | `visualizadoEm` exibido, nunca gravado | Coluna que mente | Marcar leitura no portal | Médio | P | **P1** |
| Evolução clínica | Texto livre sem estrutura | Redigitação a cada consulta | Template por profissional + pré-preenchimento com dados da consulta | Alto | M | **P1** |
| Confirmação por WhatsApp | Exibida por consulta, sem efeito derivado | Não dá para saber quem não confirmou | Fila/filtro de não confirmadas | Médio | P | **P1** |
| Plano alimentar | Sem duplicação entre pacientes | Montar do zero a cada paciente | "Duplicar de outro paciente" e "salvar como modelo" a partir do plano | Alto | M | **P1** |
| Condutas terapêuticas | Validade gravada sem alerta | Conduta vence em silêncio | Alerta de conduta vencida no dashboard | Médio | P | **P1** |
| Lista de pacientes | Sem ação em massa | Uma a uma | Seleção múltipla para envio de formulário/material/mensagem | Médio | M | **P2** |
| Portal do paciente | Mensagem só leitura | Paciente não responde | Resposta assíncrona com SLA e trilha | Alto | M | **P2** |
| Painel do cliente | Só assinatura | Dono não gerencia a operação | Painel de operação da clínica | Alto | M | **P2** |
| Comparação antropométrica | Só as duas últimas | Não compara 1ª × atual | Comparação entre quaisquer duas avaliações + meta | Médio | P | **P2** |
| Evolução fotográfica | Uma foto por vez | Sem antes/depois | Comparação lado a lado por protocolo de pose | Médio | P | **P2** |
| Perfil de cadastro | Tags/origem/categoria dentro de blob cifrado | Segmentação impossível sem migration | Campo pesquisável protegido + filtro | Médio | M | **P3** |
| Notificações in-app | Sem preferência, por polling | Fadiga de notificação | Preferência por usuário + digest | Médio | M | **P2** |
| Templates de mensagem | Sem biblioteca inicial | Clínica nova começa vazia | Conjunto inicial + edição + preview | Médio | P | **P2** |
| Modelos de plano | Sem edição | Corrigir exige recriar | `PUT` de modelo | Baixo | P | **P2** |
| API pública | Só papel `Client` | Nutricionista não alcança | Rever papel/permissão | Baixo | P | **P3** |
| Catálogo TACO | Carga manual por script | Ambiente novo nasce vazio | Carga versionada no provisionamento | Médio | M | **P3** |

---

## 4. Quick Wins

Critério: valor claro, esforço pequeno, risco baixo, sem migration pesada e sem decisão de produto pendente.

1. **Exibir os indicadores que o dashboard já calcula.** `[F]` `concluidas`, `reagendadas`, `canceladas`,
   `faltas` existem no DTO (`dtos-dashboard-clinico.ts:40-44`) e não aparecem em `painel-dashboard.tsx`.
   Dado pronto, só falta renderizar.
2. **Marcar material como visualizado.** `[F]` A coluna `visualizado_em` existe desde a migration 600, é
   mapeada em três DTOs e exibida — e nenhum código a grava. Uma rota no portal resolve.
3. **Alerta de conduta terapêutica vencida.** `[F]` `validadeFim` é gravado e exibido; nenhuma query o usa.
   O dashboard já tem infraestrutura de fila e alerta.
4. **Comparação antropométrica entre quaisquer duas avaliações.** `[F]` `compararAvaliacoes` já existe e é
   chamada só para as duas últimas (`servico-pacientes.ts:1265-1273`). É expor o que já foi escrito.
5. *(Reclassificado — **não** é quick win.)* Filtro por tag/origem/categoria: ver seção 3 e PB-10. `[F]` Os
   campos vivem dentro de `perfil_cadastro_paciente.operacao_criptografada`, um `bytea` único
   (`perfil-cadastro-paciente.orm.ts:17-18`), então não há como filtrar em SQL sem migration e sem uma decisão
   sobre campo pesquisável protegido. Movido para a onda de estrutura.
6. **Remover ou implementar o canal push.** `[F]` `adaptador-push-placeholder.ts:9-15` retorna sucesso sem
   enviar, e é o ramo default do roteador. Enquanto existir assim, a central de falhas mente.
7. **Fila de consultas não confirmadas.** `[F]` A confirmação já é gravada em jsonb e exibida por consulta
   (`painel-agenda.tsx:196`); falta poder filtrar/contar quem **não** confirmou — hoje é olhar uma a uma.
8. **`PUT` de modelo de plano alimentar.** `[F]` O controlador tem GET/POST/GET:id/DELETE e não tem edição.
9. **Alerta de check-in com adesão baixa.** `[F]` `adesaoPlano` (0-100) já é coletada; um limiar simples
   gera a primeira automação com efeito real.
10. **Comparação lado a lado na evolução fotográfica.** `[F]` `protocoloCriptografado` (a pose) existe
    exatamente para alinhar fotos equivalentes, e a UI mostra uma por vez.
11. **Biblioteca inicial de templates de mensagem.** `[F]` Nenhum seed cria template fora de demo/staging;
    toda clínica nova começa sem nenhum.
12. **Ações em massa na lista de pacientes** (enviar formulário / material para os selecionados).
    `[F]` Hoje não há seleção múltipla.
13. **Duplicar consulta / "repetir este agendamento".** `[F]` Não existe recorrência nem duplicação; criar
    uma consulta são 16 campos.
14. **Expor o endpoint de versão do plano que já existe.** `[F]` `obterVersaoPlanoAlimentar` está em
    `lib/plano-alimentar-api.ts:334` e nenhum componente chama.
15. **Unificar a timeline do resumo com a do histórico.** `[F]` O resumo usa 7 fontes e o histórico 14
    (`servico-pacientes.ts:783-796` × `:960-1190`) — a mesma tela mostra dois prontuários diferentes.

---

## 5. Major Feature Improvements

### 5.1 Score de risco calculado (substituir o campo manual)
- **Funcionalidade atual** `[F]`: campo numérico 0-100 digitado no formulário do paciente; default 0; nenhuma
  rotina de recálculo.
- **Problema** `[F]`: alimenta dashboard, filtros, recall e API pública. Como quase ninguém preenche, a fila
  "sem retorno" acaba ordenada apenas por `statusAdesao`, que também é manual.
- **Melhoria**: calcular periodicamente a partir de sinais que o banco já tem — dias desde a última consulta
  concluída, faltas no período, tarefas vencidas, formulários pendentes, check-ins não respondidos, adesão
  declarada, falha de comunicação. Manter o campo manual como **override explícito e auditado**, nunca
  sobrescrevendo silenciosamente o julgamento clínico.
- **Experiência desejada**: o profissional abre o dashboard e a fila já está ordenada por risco real; ao abrir
  o paciente, vê **por que** ele está em risco (os fatores que pesaram), não só um número.
- **Benefício**: profissional (triagem confiável), clínica (retenção), paciente (é procurado antes de sumir).
- **Complexidade** média · **Risco** médio (é sinal clínico exibido ao profissional; exige explicabilidade e
  não pode virar recomendação automática) · **Dependências**: backend, banco (coluna de fatores/última
  apuração), produto (definir pesos), job.
- **Evidência**: `servico-pacientes.ts:131,335,563-571`; `formulario-paciente.tsx:271,279`;
  `servico-dashboard-clinico.ts:394-400,955-957`; `recall-inatividade.ts:124`; `servico-api-publica.ts:83`.

### 5.2 Ligar o motor de automações ao que já existe
- **Atual** `[F]`: `regras_automacao` com gatilho/condições/ações em jsonb; UI com 4 gatilhos e 3 ações; worker
  que só registra `acoesPlanejadas`; único efeito real é o recall, que ignora `regra.acoes` e sempre envia
  template (`servico-recall-inatividade.ts:321-333`).
- **Problema** `[F]`: a promessa da tela não existe no backend. `notificar_profissional`, `enviar_template` e
  `criar_tarefa` não têm nenhuma implementação fora do frontend.
- **Melhoria**: implementar as três ações (todas têm destino pronto: notificações in-app, outbox de
  comunicações, `acompanhamento-tarefa`) e dar executor aos gatilhos `checkin.atrasado`,
  `questionario.respondido` e `paciente.risco_alto` — todos já têm o dado necessário no banco.
- **Experiência desejada**: "quando o check-in atrasar 7 dias, criar tarefa para mim e mandar template X" —
  criada na tela, simulada com lista nominal (padrão que o recall já implementa muito bem) e executando de fato.
- **Benefício**: profissional (para de lembrar manualmente), clínica (processo em vez de disciplina individual).
- **Complexidade** média · **Risco** médio (mensagem automática a paciente; exige o mesmo teto de frequência e
  opt-out que o recall já respeita) · **Dependências**: backend, job, produto (limites de disparo).
- **Evidência**: `painel-automacoes.tsx:384-387,477-479`; `processador-automacoes.ts:43-51`;
  `avaliador-regras.ts:19-25`; `servico-recall-inatividade.ts:72-116,321-333`.
- **Estado da remediação em 2026-09-19**: a fundação confiável,
  `notificar_profissional` e `criar_tarefa` foram integrados nos PRs `#269`,
  `#270` e `#271`; a migration `1048` foi verificada em staging e produção. O
  `enviar_template` foi integrado no PR `#272` (merge `716e38e` em `main`,
  20/20 checks verdes, merge humano) com canal e template explícitos,
  políticas obrigatórias do paciente, limite de frequência, idempotência e
  outbox. Com isso o PB-02 está concluído. O PB-03 (gatilhos reais) foi
  concluído em 2026-09-20 pela Fase 267: o Incremento 267.1 fecha o contrato
  de `gatilho` numa união discriminada, cria a fundação durável de disparo
  (execução e outbox na mesma transação do evento de origem, identidade
  determinística, publicação exclusiva pelo outbox) e liga
  `questionario.respondido` de fato — o primeiro dos três gatilhos órfãos a
  sair da vitrine. O Incremento 267.2 liga `paciente.risco_alto` ao recálculo
  diário de prioridade de acompanhamento da Fase 265, reutilizando a mesma
  fundação sem alterá-la: dispara na entrada em faixa alta (baixa/média ->
  alta, ou primeiro cálculo já em alta), nunca em `alta -> alta` nem por
  override manual do profissional, e o contexto durável carrega somente o
  tipo do evento — nunca score, fatores ou justificativa. O Incremento 267.3
  liga `checkin.atrasado` numa rodada periódica própria (diária, por
  tenant), com contrato fechado de três parâmetros
  (`diasSemCheckin`/`intervaloMinimoDias`/`limitePorExecucao`, defaults de
  produto 7/7/100), simulação nominal com motivos fechados de exclusão e a
  Web substituindo o campo livre que existia para este gatilho pelos
  parâmetros reais — o terceiro e último gatilho órfão sai da vitrine. Com
  os três incrementos, nenhum dos quatro gatilhos do motor de automações
  permanece "vitrine": todos executam de fato. O PB-03 foi concluído em
  2026-09-20 pela Fase 267.

  O PB-05 (alerta de check-in com adesão baixa), último item obrigatório da
  Onda 2, foi implementado pela Fase 268: contrato fechado
  `{ tipo: 'checkin.adesao_baixa', limiarAdesao: inteiro de 1 a 100 }`
  (default 50, o mesmo corte que a fórmula de prioridade de acompanhamento
  da Fase 265 já usa para `adesao_declarada_baixa`, mantendo os dois sinais
  de "adesão baixa" do produto consistentes entre si). Dispara por check-in
  individual — não por rodada — quando a adesão declarada no portal do
  paciente fica abaixo do limiar de uma regra ativa do profissional
  responsável, reutilizando o núcleo por-regra já extraído em `checkin.atrasado`
  porque a elegibilidade depende do limiar próprio de cada regra. O
  contexto durável carrega somente o tipo do evento, nunca a adesão
  declarada nem qualquer outro conteúdo do check-in. Com o merge desta
  fase, a Onda 2 do audit (PB-01 -> PB-02 -> PB-03 -> PB-05) fica completa.

### 5.3 Resumo clínico do paciente (os primeiros 10 segundos)
- **Atual** `[F]`: a aba Resumo traz próxima ação, próxima consulta, contexto operacional (último atendimento,
  plano publicado, tarefa vencida, falha de comunicação), seis contadores e um gráfico de evolução
  antropométrica com seletor de métrica (`prontuario-paciente.tsx:1106-1203`).
- **Problema** `[F]`: o DTO do resumo não tem nenhuma medida clínica (`dtos.ts:371-410`) e `indicadoresRecentes`
  se limita a `'adesao' | 'sintomas'`. O gráfico mostra a série, mas a leitura — quanto mudou desde a última
  consulta, em relação a quê — fica por conta do profissional.
- **Melhoria**: bloco de leitura clínica com delta desde a última consulta e desde o início, objetivo do plano
  vigente (já existe em `plano_alimentar_versao.objetivos_criptografados`), adesão declarada recente, exames
  fora da faixa e condutas vencendo.
- **Complexidade** média · **Risco** baixo (só agrega dado já autorizado; manter o gate por permissão de aba).
- **Dependências**: backend, frontend; depende de 5.4 para a parte de exames.

### 5.4 Exames laboratoriais estruturados
- **Atual** `[F]`: só listar e criar (`controlador-exames-laboratoriais.ts:18-32`); nome do marcador é texto
  livre por coleta; `referencia` e `metodo` viajam no payload cifrado e são exibidos como texto.
- **Problema** `[F]`: o sistema nunca compara valor × faixa de referência, e "Vit D" e "Vitamina D" nunca se
  cruzam — não há série por marcador, só lista cronológica de coletas.
- **Melhoria**: catálogo de marcadores por tenant (com unidade e faixa), vínculo do resultado ao marcador,
  destaque de alterado e série temporal por marcador.
- **Complexidade** média · **Risco** médio (é interpretação de exame; o destaque deve ser factual — "fora da
  faixa informada" — e nunca diagnóstico) · **Dependências**: backend, banco (migration), frontend, produto.

### 5.5 Painel de operação da clínica
- **Atual** `[F]`: o dono vê assinatura, limites, uso e usuários (`servico-portal-cliente.ts:192-237`) e a tela
  de recebimentos com performance por profissional (fase 263). Operações — auditoria, LGPD, falhas — é
  exclusivamente SuperAdmin (`controlador-operacoes.ts:62`).
- **Problema** `[F]`: quem administra a clínica não tem visão de ocupação de agenda, no-show, novos pacientes,
  retenção nem carga por profissional, embora todos esses dados existam em `agenda_consultas` e `pacientes`.
- **Melhoria**: painel de operação com taxa de ocupação, no-show por profissional, pacientes novos × ativos ×
  em risco, e trilha de auditoria **do próprio tenant** (hoje só o operador do SaaS enxerga).
- **Complexidade** média a grande · **Risco** médio (expor auditoria à clínica é decisão de produto e de LGPD:
  define quem pode ver ação de quem) · **Dependências**: backend, frontend, produto, jurídico.

### 5.6 Expediente e agenda inteligente
- **Atual** `[F]`: sem modelo de disponibilidade; slots 24/7 por 30 dias menos ocupações; sem recorrência.
- **Melhoria**: jornada por profissional (dias, faixas, intervalo), duração padrão por tipo de atendimento,
  recorrência ("toda quarta às 9 h por 8 semanas") e sugestão de retorno com base no intervalo praticado.
- **Complexidade** média · **Risco** baixo a médio · **Dependências**: backend, banco, frontend.

---

## 6. New Feature Opportunities

**A. Quick wins** — ver seção 4.

**B. Evoluções naturais**
- Biblioteca de condutas/orientações reutilizáveis, no molde da biblioteca de perguntas que já existe.
- Template de evolução clínica por profissional, com pré-preenchimento do peso/IMC registrados na mesma consulta.
- Vincular evolução, avaliação, conduta e exame à consulta de origem — hoje só `documento-emitido` tem
  `consulta_id` `[F]`, então não é possível responder "o que foi decidido na consulta de 12/03".
- Mais tipos de documento clínico (atestado, encaminhamento) sobre o motor que já valida variáveis.

**C. Diferenciais de produto**
- **Preparação automática de consulta**: 30 minutos antes, o sistema monta o que mudou desde o último encontro
  (peso, adesão, check-ins, formulários respondidos, escolhas de substituição, mensagens) — todo o dado já
  existe e hoje exige abrir cinco abas.
- **Adesão real ao plano**, cruzando plano publicado × escolhas registradas × adesão declarada. `[F]` Hoje o
  profissional só vê a lista bruta de trocas, item a item.
- **Resposta do paciente dentro do produto**, com SLA visível para a clínica.

**D. Automação** — ver seção 7.

**E. Inteligência e dados** — ver seção 11.

**F. Paciente** — ver seção 8.

**G. Gestão da clínica** — ver seção 10.

**Descartados nesta rodada** (avaliados e não recomendados agora): wearables (nenhuma base de integração
contínua no produto; custo alto e valor não comprovado antes do piloto); pagamentos online (Fase 227 já
existe no roadmap como não bloqueador — não reabrir); assinatura digital de documentos (o motor de documentos
é append-only e suficiente para o piloto); chatbot de atendimento (contraria a diretriz de IA no fluxo, não
como conversa).

---

## 7. Automation Opportunities

Ordenadas por "o dado já existe" → "o efeito não existe".

| Evento que o sistema já conhece | O que acontece hoje `[F]` | O que poderia acontecer |
| --- | --- | --- |
| Check-in respondido com adesão baixa | Nada | Tarefa + alerta no dashboard |
| Check-in atrasado | Gatilho existe na UI, sem executor | Mensagem ao paciente + fila de atenção |
| Formulário respondido | Notificação in-app + webhook | Resumo ao profissional; item de revisão pré-consulta |
| Confirmação de consulta (WhatsApp) | Gravada e exibida por consulta; sem efeito derivado | Fila de não confirmadas + follow-up automático |
| Falta registrada | Registrada no desfecho | Reagendamento proativo; contagem no score de risco |
| Conduta vencendo | Data gravada, sem consumidor | Alerta de revisão |
| Próxima revisão do perfil (`proximaRevisaoEm`) | Coletada e nunca lida | Tarefa automática |
| Plano publicado | Versão criada | Notificar paciente que há plano novo |
| Material enviado e não visualizado | Não há registro de visualização | Lembrete após N dias |
| Paciente sem consulta futura | Existe fila no dashboard | Sugestão de reagendamento em lote |

`[F]` A infraestrutura de execução já está pronta: outbox transacional com idempotência, fila com poller,
preferências de canal e janela de horário do paciente respeitadas por todos os envios, e o padrão de
simulação-antes-de-ativar do recall. **Falta o executor, não a fundação.**

---

## 8. Patient Experience

`[F]` O que já existe e é bom: portal com agenda, plano, formulários, check-ins, tarefas e privacidade;
gráfico de evolução de peso; preferências de comunicação editáveis pelo próprio paciente (canal, opt-out,
janela de horário) — respeitadas por todos os fluxos de envio; exportação LGPD e solicitações pelo portal.

Lacunas observadas:
1. **Sem canal de resposta** `[F]` — o paciente lê e não escreve.
2. **Progresso restrito a peso** `[F]` — nenhuma outra métrica, nenhuma meta, nenhum marco.
3. **Registrar não gera retorno** `[F]` — check-in não produz nenhum sinal de que alguém viu.
4. **Sem lembrete de plano/tarefa** `[F]` — só existe o lembrete de consulta de 24 h.
5. **Gamificação desligada** `[F]` — badges, desafios e círculos existem no banco e por padrão ninguém vê.
   `[H]` Ligar sem repensar o propósito clínico tende a gerar ruído; a decisão é de produto, não técnica.
6. **Materiais sem confirmação de leitura** `[F]`.

---

## 9. Professional Experience

Onde o tempo se perde hoje, com evidência:

1. **Texto livre sem template em quatro lugares** `[F]`: evolução clínica, conduta terapêutica, observação
   antropométrica e corpo do relatório de alta. Nenhum deles tem modelo, clonagem ou pré-preenchimento.
2. **Redigitação de dado que o sistema já tem** `[F]`: peso e IMC estão em `avaliacoes_antropometricas` e
   precisam ser reescritos na evolução; marcadores de exame são redigitados a cada coleta.
3. **Montar contexto exige navegar** `[F]`: resumo, antropometria, exames, condutas e histórico são cinco abas,
   cada uma com carregamento sob demanda.
4. **Plano alimentar do zero** `[F]`: não há duplicação entre pacientes; modelos existem mas não podem ser
   editados e nenhuma clínica nasce com biblioteca.
5. **Sem ação em massa** `[F]` na lista de pacientes.
6. **Lembrar manualmente dos follow-ups** `[F]`: a única automação com efeito é o recall de inatividade.
7. **Paciente com condição especial fica sem caminho** `[F]`: `possuiCondicaoEspecial: true` recusa o cálculo
   com mensagem explícita — "o calculo automatico nao e seguro e nao esta disponivel nesta fase"
   (`servico-planos-alimentares.ts:317-321`). **Isto é uma trava de segurança clínica deliberada e correta, e
   não deve ser removida.** O gap de produto não é a trava: é que **não existe caminho alternativo** — o
   profissional recebe uma recusa e nenhuma rota manual para seguir com esse paciente. `[H]` Em clínica de
   nutrição essa população é frequente; oferecer entrada manual com a fórmula desativada (mantendo o bloqueio
   do cálculo automático) resolveria sem tocar na decisão de segurança.

O que já é muito bom e **não deve ser mexido**: antropometria, documentos clínicos, substituições com escolha
do paciente, linha do tempo paginada, recall com simulação, central de falhas, entrega de mensagem.

---

## 10. Clinic Management

1. **Sem painel de operação** `[F]` — o resumo do cliente é de assinatura.
2. **Auditoria inacessível ao tenant** `[F]` — `user_action_log` só é consultável pelo SuperAdmin.
3. **LGPD operada pelo SaaS, não pela clínica** `[F]` — as rotas de solicitação/retenção estão em Operações.
4. **Sem visão de carga por profissional** `[F]` — a única quebra por profissional existente é financeira
   (fase 263); não há ocupação, no-show nem produtividade clínica.
5. **Onboarding sem trilho** `[F]` — não há wizard nem checklist; uma clínica nova sobe sem templates de
   mensagem, sem modelos de plano, sem catálogo de alimentos carregado e sem materiais.
   `[H]` Esse é provavelmente o maior risco de ativação no piloto: o produto vazio parece menos capaz do que é.
6. **Integrações fora do alcance do nutricionista** `[F]` — chave de API e webhook exigem papel `Client`.

---

## 11. Data & Intelligence

O que já é coletado e pode virar valor **sem construir subsistema novo**:

| Dado existente | Onde está | Valor possível |
| --- | --- | --- |
| Faltas, cancelamentos e origem do cancelamento | `agenda_consultas` + DTO do dashboard | No-show por profissional/horário; score de risco |
| Adesão declarada no check-in | `resposta_checkin` | Tendência de adesão; alerta de queda |
| Escolhas de substituição | `plano_alimentar_escolha_paciente` | O que o paciente realmente troca; ajuste do próximo plano |
| Série antropométrica | `avaliacoes_antropometricas` | Comparação arbitrária, meta, projeção simples |
| Respostas longitudinais | Matriz longitudinal (já existe) | Cruzar com antropometria |
| Intervalo entre consultas | `agenda_consultas` | Sugestão de retorno; previsão de evasão |
| Tempo de resposta a formulário | `envios_questionario` | Engajamento |
| Uso de plano/limites | `tenant_configuracao` | Expansão comercial |

`[F]` Nenhum módulo de dashboard consulta plano alimentar hoje; a agregação financeira da fase 263 é o único
lugar do produto que calcula indicador derivado.

---

## 12. AI Opportunities

Critério aplicado: só entra o que resolve problema real, tem fallback determinístico e cabe no trilho de
revisão humana que já existe.

**Estado atual** `[F]`: dois endpoints atrás de flag desligada; provider é heurística local de palavras-chave;
reconhecimento alimentar não recebe a imagem; `transcricao_midia` não tem escritor; o resultado não alimenta
fluxo nenhum; a tela é um console de teste que imprime JSON cru.

**1. Preparação pré-consulta (recomendado)**
- Problema real: montar o contexto do paciente hoje exige cinco abas.
- Por que IA: a seleção do que importa entre 14 fontes heterogêneas é julgamento, não regra fixa. Uma regra
  determinística consegue **listar** o que mudou — e essa é justamente a versão 1 recomendada.
- Dados: prontuário já autorizado ao profissional. Risco clínico: médio (omissão importa mais que erro).
- Revisão humana: sim, é insumo, nunca conduta. Fallback: o resumo determinístico da seção 5.3.
- Custo: 1 chamada por consulta. LGPD: PHI sai do ambiente — exige a mesma classificação já documentada.
- Auditável: sim, o padrão de `servico-ia.ts` registra o rastro sem o conteúdo.
- **Recomendação**: construir primeiro a versão determinística; IA só se ela se mostrar insuficiente.

**2. Estruturar exame em PDF/foto (recomendado, alto valor)**
- Problema real `[F]`: marcador é texto livre redigitado a cada coleta.
- Por que IA: extrair marcador/valor/unidade/faixa de laudos com layout livre é exatamente o que regra não faz.
- Risco: alto se o valor entrar direto no prontuário — por isso revisão obrigatória item a item, que o
  contrato atual já força.
- Fallback: digitação manual (o fluxo de hoje). Custo: por laudo. Auditável: sim.

**3. Rascunho de orientação/evolução (talvez)**
- Ganho real de tempo, risco médio-alto de conteúdo clínico incorreto. Só com rótulo de rascunho e assinatura
  explícita do profissional. `[H]` Template determinístico provavelmente entrega 70% do ganho com 0% do risco.

**4. Busca semântica no prontuário (explorar)**
- Valor claro; depende de volume que o produto ainda não tem.

**Onde NÃO usar IA**: cálculo nutricional (já é determinístico, versionado e auditável — trocar por modelo
seria regressão); score de risco (deve ser explicável e reproduzível; use fórmula); triagem de risco clínico
sem profissional no circuito; qualquer geração de conduta, prescrição ou diagnóstico; chatbot aberto a
paciente.

**Conclusão de IA**: o trilho está pronto e o motor não existe. `[H]` O maior ganho não é plugar um provider
melhor — é parar de tratar IA como módulo e colocá-la em dois pontos do fluxo (pré-consulta e exame), depois
de esgotar a versão determinística de cada um.

---

## 13. 10X Opportunities

1. **Da triagem manual à fila real** — hoje o dashboard ordena por um campo que ninguém preenche; passaria a
   ordenar por comportamento observado. Muda o que o profissional faz ao abrir o sistema de manhã.
2. **Preparação de consulta em 30 segundos** — o que hoje são cinco abas vira um bloco pronto.
3. **Automação que executa** — a diferença entre "o sistema me lembra" e "eu preciso lembrar" é a diferença
   entre software de gestão e planilha cara.
4. **Plano em minutos, não em meia hora** — duplicar + modelo editável + biblioteca inicial.
5. **Exame estruturado** — de texto redigitado a série comparável com destaque de alterado.
6. **O paciente deixa de ser só destinatário** — responder, ver progresso além do peso, saber que foi visto.

---

## 14. Technical Dependencies

- **Migrations necessárias** (R4 pela regra do projeto, exigem procedimento fora de banda): catálogo de
  marcadores de exame; expediente por profissional; fatores do score de risco; vínculo `consulta_id` nas
  entidades clínicas.
- **Sem migration**: exibir indicadores do dashboard, comparação antropométrica, alerta de conduta vencida,
  filtros por tag, duplicação de plano, `PUT` de modelo, ações das automações (usam tabelas existentes).
- **Decisão de produto pendente**: pesos do score de risco; o que a clínica pode ver da própria auditoria;
  ligar ou não gamificação; caminho para paciente com condição especial; SLA de resposta ao paciente.
- **Decisão jurídica/LGPD**: exposição de auditoria ao tenant; envio de PHI a provider de IA; retenção de
  laudo estruturado.
- **Infra/terceiros**: provider de IA real; push (hoje stub); ClamAV ainda pendente (issue #234).
- **Restrições a preservar**: RLS forçada em toda tabela com `tenant_id`; escopo por profissional em todas as
  leituras; criptografia campo a campo do conteúdo clínico; auditoria que registra o rastro sem o conteúdo;
  migrations somente fora de banda.

---

## 15. Proposed Product Backlog

| ID | Proposta | Tipo | Valor | Esforço | Risco | Dependências |
| --- | --- | --- | --- | --- | --- | --- |
| PB-01 | Score de risco calculado com override auditado | Correção | Alto | M | Médio | backend, banco, job, produto |
| PB-02 | Executar as 3 ações das automações | Correção | Alto | M | Médio | backend, job |
| PB-03 | Ligar gatilhos `checkin.atrasado`, `questionario.respondido`, `paciente.risco_alto` | Automação | Alto | M | Médio | backend, PB-02 |
| PB-04 | Remover ou implementar canal push | Correção | Médio | P | Baixo | backend, frontend |
| PB-05 | Alerta de check-in com adesão baixa | Automação | Alto | P | Baixo | backend, PB-02 |
| PB-06 | Exibir indicadores já calculados no dashboard | Quick win | Médio | P | Baixo | frontend |
| PB-07 | Marcar material como visualizado | Quick win | Médio | P | Baixo | backend, frontend |
| PB-08 | Alerta de conduta vencida | Quick win | Médio | P | Baixo | backend, frontend |
| PB-09 | Comparação antropométrica arbitrária | Quick win | Médio | P | Baixo | backend, frontend |
| PB-10 | Campo pesquisável protegido para tag/origem/categoria + filtro | Evolução | Médio | M | Médio | backend, banco, produto (proteção de dado) |
| PB-11 | Fila/filtro de consultas não confirmadas | Quick win | Médio | P | Baixo | backend, frontend |
| PB-12 | Unificar timeline do resumo com a do histórico | Correção | Médio | P | Baixo | backend |
| PB-13 | Duplicar plano alimentar / salvar como modelo | Evolução | Alto | M | Baixo | backend, frontend |
| PB-14 | Caminho manual para paciente com condição especial (mantendo o bloqueio do cálculo automático) | Correção | Alto | M | Médio | backend, frontend, produto |
| PB-15 | Template de evolução clínica com pré-preenchimento | Evolução | Alto | M | Baixo | backend, frontend |
| PB-16 | Resumo clínico do paciente | Evolução | Alto | M | Baixo | backend, frontend |
| PB-17 | Catálogo de marcadores + faixa de referência + série | Evolução | Alto | M | Médio | backend, banco, produto |
| PB-18 | Expediente por profissional | Evolução | Alto | M | Baixo | backend, banco, frontend |
| PB-19 | Recorrência e duplicação de consulta | Evolução | Médio | M | Baixo | backend, frontend |
| PB-20 | Comparação lado a lado de fotos | Quick win | Médio | P | Baixo | frontend |
| PB-21 | Ações em massa na lista de pacientes | Evolução | Médio | M | Médio | backend, frontend |
| PB-22 | Biblioteca inicial de templates de mensagem | Quick win | Médio | P | Baixo | backend, produto |
| PB-23 | Biblioteca de condutas/orientações reutilizáveis | Evolução | Alto | M | Baixo | backend, frontend |
| PB-24 | Vínculo `consulta_id` nas entidades clínicas | Evolução | Médio | M | Médio | backend, banco |
| PB-25 | Preparação pré-consulta (determinística) | Diferencial | Alto | M | Baixo | backend, frontend, PB-16 |
| PB-26 | Painel de operação da clínica | Gestão | Alto | G | Médio | backend, frontend, produto |
| PB-27 | Auditoria do próprio tenant para a clínica | Gestão | Médio | M | Médio | backend, produto, jurídico |
| PB-28 | Resposta do paciente com SLA | Paciente | Alto | G | Médio | backend, banco, frontend, produto |
| PB-29 | Onboarding guiado da clínica (conteúdo inicial) | Gestão | Alto | M | Baixo | backend, frontend, produto |
| PB-30 | Extração assistida de exame laboratorial | IA | Alto | G | Alto | IA, backend, jurídico, PB-17 |

---

## 16. Suggested Roadmap

Sequência por dependência técnica, não por valor aparente.

**Onda 1 — pequenos incrementos, sem migration** (PB-04, PB-06, PB-07, PB-08, PB-09, PB-11, PB-12)
Tudo usa tabela existente e resolve incoerência visível: dado calculado e não exibido, coluna que nunca é
escrita, endpoint sem tela. Entrega percepção de qualidade rápida e não bloqueia nada.

**Onda 2 — a fundação da inteligência** (PB-01 → PB-02 → PB-03 → PB-05)
Nesta ordem obrigatoriamente: o score precisa existir antes de o gatilho `paciente.risco_alto` significar
algo, e o executor de ações precisa existir antes de qualquer gatilho novo. É a onda que transforma o produto
de registro em acompanhamento.

**Onda 3 — devolver tempo ao profissional** (PB-13, PB-14, PB-15, PB-23, PB-16, PB-25)
Templates e duplicação primeiro, resumo clínico depois, preparação pré-consulta por último — ela consome o
resumo. PB-14 entra aqui porque toca o mesmo fluxo de plano e exige decisão de produto antes do código.
Nenhuma depende da Onda 2, podem correr em paralelo se houver capacidade.

**Onda 4 — estrutura** (PB-10, PB-17, PB-18, PB-19, PB-24)
Exige migration e, portanto, o procedimento fora de banda com role owner. Agrupar as migrations reduz o número
de janelas operacionais.

**Onda 5 — projetos maiores** (PB-26, PB-27, PB-21, PB-29)
Painel de operação depende de indicadores que as ondas anteriores já terão normalizado. Auditoria para a
clínica exige decisão jurídica antes de qualquer código.

**Explorações futuras** (PB-28, PB-30)
Resposta do paciente exige decisão de produto sobre SLA e responsabilidade clínica. Extração de exame exige
provider real, decisão LGPD e o catálogo de marcadores (PB-17) pronto.

---

## Fatos que contrariam suposições comuns — registro explícito

Para evitar retrabalho de quem ler este documento depois:

- **Timeline unificada do paciente já existe** e é boa (14 fontes, cursor, filtro). Não propor de novo.
- **Command palette já existe** (`components/app/paleta-comandos.tsx`) — navegação e busca de paciente.
- **Filtros salvos já existem**, com allowlist de 4 critérios.
- **Questionários já têm** biblioteca, modelos, duplicação, versionamento, recorrência e matriz longitudinal.
- **Export CSV já existe** em agenda, financeiro, respostas, auditoria, outbox e convites.
- **Comparação com período anterior já existe** no financeiro (fase 263).
- **Gráfico de evolução já existe** no prontuário (métrica selecionável) e no portal (peso).
- **Webhooks e API pública já existem** e são maduros.
- **Preferências de comunicação do paciente já existem** e são respeitadas.
- **PWA, offline, MFA, sessões, LGPD, importação CSV e duplicidade de paciente já existem.**

---

## 17. Plano operacional — Fase 264 (pronto para execução)

Esta seção é o **handoff de engenharia**. Foi escrita para ser executada por outro modelo (Sonnet 5 ou
Opus 4.8) sem precisar refazer a investigação: cada incremento traz o gap com evidência, os arquivos exatos,
o contrato que muda, o teste que deve falhar primeiro e o critério de aceite.

**Escopo da fase**: a Onda 1 do roteiro — sete incrementos que transformam dado que o sistema **já calcula ou
já grava** em algo visível e acionável. Nenhum deles exige migration, nenhum altera contrato de autorização,
nenhum cria dado sensível novo. É deliberadamente a fase de menor risco e maior relação valor/esforço.

**Fora de escopo nesta fase** (não antecipar): score de risco calculado, executor de ações de automação,
expediente, catálogo de marcadores de exame, painel de operação da clínica, qualquer migration. Essas entram
nas ondas 2 a 5 e dependem de decisões registradas na seção 14.

### Regras de execução (valem para todos os incrementos)

1. **Um incremento = uma branch = uma PR.** Nunca push direto em `main`. Nomear `feat/fase264-<slug>` ou
   `fix/fase264-<slug>`.
2. **TDD obrigatório**: escrever o teste que falha (RED) antes da implementação, e registrar na PR que ele
   falhou pelo motivo certo. Comportamento novo sem teste negativo não fecha.
3. **Escopo mínimo**: não refatorar o que está ao redor, não renomear, não "aproveitar a viagem". Se aparecer
   um defeito fora do incremento, registrar e seguir.
4. **Sem migration nesta fase.** Se um incremento parecer exigir DDL, **pare** — o desenho está errado ou o
   item não pertence à Fase 264.
5. **Preservar as fronteiras existentes**: RLS por tenant, escopo por profissional em toda leitura,
   criptografia campo a campo, auditoria que registra o rastro sem o conteúdo clínico, BFF chamando o backend
   por `requisitarBackendAutenticado`/`exigirPermissaoBff`.
6. **Antes do push, sempre**: `git diff --check`, `pnpm security:secrets`, typecheck dos projetos tocados e os
   testes listados no incremento. Declarar PASS/FAIL/NA na PR, com o motivo de cada NA.
7. **Preencher o template de PR** (`.github/PULL_REQUEST_TEMPLATE.md`) sem marcar como executada nenhuma
   validação que não rodou.

---

### 264.1 — Dashboard clínico exibe os indicadores que já calcula

- **Gap** `[F]`: `concluidas`, `reagendadas`, `canceladas` e `faltas` existem em
  `dtos-dashboard-clinico.ts:38-44`, são preenchidos pelo serviço e **não têm nenhuma ocorrência** em
  `octaclin-web/components/dashboard/painel-dashboard.tsx` (que hoje renderiza 5 cartões, linhas 254-258).
- **Mudança**: só frontend. Nenhuma alteração de backend, DTO ou permissão.
- **Arquivos**: `octaclin-web/components/dashboard/painel-dashboard.tsx`;
  `octaclin-web/tests/visual/console-regression.spec.mjs` (mock do dashboard).
- **Desenho**: acrescentar um cartão "Desfechos do período" com concluídas / faltas / canceladas /
  reagendadas. Manter o padrão `Metrica` já usado; não inventar componente novo.
- **TDD**: no mock existente do dashboard em `console-regression.spec.mjs`, incluir os quatro campos e
  asseverar que os valores aparecem na tela — o teste falha hoje porque nada os renderiza.
- **Validações**: `pnpm --dir octaclin-web typecheck`; o cenário Playwright do console; `git diff --check`;
  `pnpm security:secrets`.
- **Aceite**: os quatro números aparecem para o profissional, respeitando o filtro de período já existente
  (hoje/7/30), sem nova chamada de rede.

### 264.2 — Unificar a linha do tempo do resumo com a do histórico

- **Gap** `[F]`: `obterProntuario` monta a timeline com 7 fontes (`servico-pacientes.ts:783-796`) enquanto a
  timeline paginada usa 14 (`:960-1190`). A mesma tela mostra dois prontuários diferentes: antropometria,
  exames, documentos, fotos, anexos e financeiro só aparecem na aba Histórico.
- **Mudança**: backend. Fazer o resumo consumir a mesma fonte de verdade da timeline paginada (primeira
  página), em vez de manter uma segunda montagem divergente.
- **Arquivos**: `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`;
  `servico-pacientes.spec.ts`.
- **Cuidado**: a timeline paginada aplica filtro por permissão e por escopo de profissional. A unificação
  **não pode** afrouxar isso — o teste negativo abaixo é obrigatório.
- **TDD**: (a) teste que um paciente com avaliação antropométrica passa a ter esse evento no resumo — falha
  hoje; (b) teste negativo garantindo que um evento gateado por permissão **não** aparece para quem não tem a
  permissão.
- **Validações**: typecheck backend; `servico-pacientes.spec.ts`; `pnpm test:guardas-controladores`.
- **Aceite**: resumo e histórico mostram o mesmo conjunto de tipos de evento, com a mesma regra de permissão.

**Atualização (execução do incremento)**: a investigação inicial mostrou que uma troca ingênua de
`obterProntuario` para `listarLinhaDoTempoPaginada` removeria `descricao` de eventos que o resumo já
enriquecia (mensagem, resposta de formulário, registro de hábitos), então a unificação exigiu desenho
adicional (seleção canônica → projeção por superfície → enriquecimento em application layer), não apenas
a troca de chamada descrita acima. O desenho final implementado extraiu a consulta SQL única já usada pelo
Histórico para um método privado (`selecionarEventosProntuarioCanonicos`), compartilhado por Resumo e
Histórico, e o Resumo passou a enriquecer os eventos retornados usando as entidades que já buscava (sem
consulta adicional ao banco), preservando o enriquecimento anterior. O Histórico permanece com o mesmo
comportamento e a mesma SQL de antes. Ver decisão registrada em `CHECKLIST_FASES_FUTURAS_PRODUCAO.md` e
`STATUS_ATUAL_PROJETO.md`.

### 264.3 — Marcar material educativo como visualizado

- **Gap** `[F]`: `envio_material_paciente.visualizado_em` existe desde a migration
  `1720000000600-CriarMateriaisEducativos.ts:36`, é mapeado em três DTOs e exibido — e **nenhum código o
  grava** fora dos seeds. O controlador de materiais tem apenas listar, criar, listar-por-paciente e enviar
  (`controlador-materiais.ts:22-60`).
- **Mudança**: rota nova no **portal do paciente** (quem visualiza é o paciente), BFF e UI.
- **Arquivos**: `controlador-portal-paciente.ts` (rota nova), `servico-portal-paciente.ts`;
  `octaclin-web/app/api/portal/paciente/materiais/[envioId]/visualizacao/route.ts` (novo);
  `octaclin-web/components/portal/portal-paciente.tsx`; specs correspondentes.
- **Contrato**: `PATCH /portal/paciente/materiais/:envioId/visualizacao` → marca `visualizadoEm` **uma única
  vez** (idempotente: se já houver valor, não sobrescrever) e devolve o envio atualizado.
- **Cuidado**: o envio precisa pertencer ao paciente autenticado — teste negativo obrigatório para envio de
  outro paciente (deve dar 404, não 403, seguindo o padrão do módulo).
- **TDD**: (a) marca e persiste; (b) segunda chamada não altera a data; (c) envio de outro paciente é
  rejeitado.
- **Validações**: typecheck backend e web; specs do portal; `pnpm --dir octaclin-web test:authz`;
  `pnpm test:guardas-controladores`.
- **Aceite**: o profissional passa a ver, na aba Materiais do prontuário, quais materiais foram abertos.

### 264.4 — Alerta de conduta terapêutica vencida

- **Gap** `[F]`: `conduta_terapeutica_versao.validade_fim` é gravado
  (`conduta-terapeutica-versao.orm.ts:13`) e exibido, mas nenhuma query o usa: o dashboard não consulta essa
  tabela.
- **Mudança**: backend (nova fila/alerta no dashboard) + frontend (exibição).
- **Arquivos**: `servico-dashboard-clinico.ts` (agregação e `montarAlertas`),
  `dtos-dashboard-clinico.ts`, `painel-dashboard.tsx`, specs.
- **Regra**: considerar apenas a **versão publicada e não arquivada** de condutas do escopo do profissional,
  com `validade_fim` anterior a hoje. Reaproveitar o mecanismo de ocultação de alerta por 24 h que já existe
  (`TIPOS_ALERTA_OCULTAVEIS`) — incluir o tipo novo ali.
- **TDD**: (a) conduta vencida entra no alerta; (b) conduta arquivada ou ainda válida não entra; (c) conduta
  de outro profissional não aparece para quem tem escopo restrito.
- **Validações**: typecheck; spec do dashboard; `pnpm test:guardas-controladores`.
- **Aceite**: o profissional vê no dashboard as condutas vencidas e consegue ocultar o alerta por 24 h como
  nos demais.

### 264.5 — Comparação antropométrica entre quaisquer duas avaliações

- **Gap** `[F]`: `compararAvaliacoes` já existe (`dominio/antropometria.ts:513`) e é chamada **apenas** para
  as duas últimas avaliações (`servico-pacientes.ts:1265-1273`, campo `deltaUltimas`).
- **Mudança**: backend (parâmetros para escolher as duas avaliações) + frontend (seletor).
- **Arquivos**: controlador/serviço de antropometria em `modulos/pacientes`,
  `octaclin-web/components/pacientes/aba-antropometria.tsx`, specs.
- **Contrato**: aceitar dois identificadores de avaliação na listagem/consulta e devolver o comparativo; sem
  eles, manter exatamente o comportamento atual (`deltaUltimas`) — **compatibilidade obrigatória**, a tela
  atual não pode quebrar durante o rollout.
- **TDD**: (a) comparação entre a 1ª e a atual devolve o delta correto; (b) sem parâmetros, o resultado é
  idêntico ao de hoje; (c) avaliação de outro paciente é rejeitada.
- **Validações**: typecheck; specs de domínio e serviço de antropometria.
- **Aceite**: o profissional escolhe duas datas e vê a variação entre elas, não só entre as duas últimas.

### 264.6 — Fila de consultas não confirmadas

- **Gap** `[F]`: a confirmação do paciente por WhatsApp é gravada em
  `consulta.notificacoes.confirmacaoPaciente` (`servico-webhook-whatsapp.ts:292-325`) e exibida por consulta
  (`painel-agenda.tsx:196`), mas não existe forma de perguntar **quem não confirmou**.
- **Mudança**: backend (filtro/contagem sobre o jsonb, sem migration — Postgres consulta
  `notificacoes->'confirmacaoPaciente'`) + frontend (filtro na agenda e contador).
- **Arquivos**: `servico-agenda.ts` (feed/consulta), `dtos.ts` da agenda, `painel-agenda.tsx`, specs.
- **Regra**: "não confirmada" = consulta futura, em status ativo (`agendada`/`reagendada`), sem
  `confirmacaoPaciente`. **Não** alterar o campo `status` da consulta — isso exigiria mudar o CHECK do banco e
  está fora do escopo da fase.
- **TDD**: (a) consulta sem confirmação entra na fila; (b) consulta confirmada não entra; (c) consulta
  cancelada ou passada não entra.
- **Validações**: typecheck; specs da agenda; cenário Playwright da agenda.
- **Aceite**: o profissional filtra a agenda do dia seguinte por "não confirmadas" e age em lote manualmente
  (o disparo automático fica para a Onda 2).

### 264.7 — Canal push: parar de reportar entrega falsa

- **Gap** `[F]`: `AdaptadorPushPlaceholder` devolve `idExterno: push-local-<uuid>` **sem enviar nada**
  (`adaptadores/adaptador-push-placeholder.ts:8-16`) e é o ramo **default** do roteador
  (`processador-notificacoes.ts:108-113`: qualquer tipo que não seja `whatsapp` nem `email` cai nele). A
  mensagem é registrada como entregue.
- **Decisão de produto necessária** — duas opções, com recomendação:
  - **(A, recomendada)** Remover `push` do catálogo de canais selecionáveis na UI e trocar o default do
    roteador por falha explícita (`canal não suportado`), de modo que nada seja marcado como entregue sem
    envio. Custo baixo, remove a mentira do sistema.
  - **(B)** Implementar push de verdade. Exige provider, credenciais e device token — não cabe na Fase 264.
- **Se a decisão for (A) — arquivos**: `processador-notificacoes.ts` (default explícito),
  `octaclin-web/components/comunicacoes/painel-comunicacoes.tsx` (remover a opção do seletor), specs.
- **TDD**: (a) canal desconhecido resulta em falha registrada com motivo, **não** em sucesso; (b) canal
  existente configurado como `push` não marca a mensagem como enviada.
- **Cuidado**: verificar se existe canal `push` já cadastrado em algum tenant antes de mudar o
  comportamento — se existir, a mudança transforma "sucesso silencioso" em "falha visível", que é o objetivo,
  mas precisa ser comunicado no corpo da PR.
- **Validações**: typecheck; specs de comunicações; `pnpm audit:redacao-auditoria`.
- **Aceite**: nenhuma mensagem aparece como entregue sem ter sido enviada.

### Ordem sugerida de execução

`264.1` → `264.2` → `264.4` → `264.5` → `264.3` → `264.6` → `264.7`

Racional: começa pelos dois de exibição pura (risco quase nulo, valor imediato e nenhuma dependência), segue
pelos dois que mexem em agregação clínica já existente, depois os dois que criam rota nova, e fecha com o de
comunicação — que depende da decisão de produto e é o único que muda comportamento de entrega.

### Decisões de produto pendentes nesta fase

| Decisão | Bloqueia | Recomendação |
| --- | --- | --- |
| Push: remover ou implementar | 264.7 | Remover agora (opção A); implementar quando houver provider |
| Alerta de conduta vencida deve considerar quantos dias de tolerância | 264.4 | Zero dias: vencida é vencida; ajustar depois com uso real |
| Fila de não confirmadas cobre quantas horas à frente | 264.6 | 48 h, alinhado ao lembrete de 24 h que já existe |

### Definition of Done da Fase 264

A fase fecha quando: os sete incrementos estiverem em `main`; cada um com teste negativo próprio; nenhuma
migration criada; `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`, `STATUS_ATUAL_PROJETO.md` e este documento
atualizados com o que foi entregue e o que não foi; e os gates de governança (`guardas-controladores`,
`redacao-auditoria`, `actions-imutaveis`, `confiabilidade`, `security:secrets`) passando.
