# FOOD06 M11/M04/M12 — contrato de restrições alimentares, versão 3 (decisões complementares de 2026-11-12)

**Status:** CONTRATO PROPOSTO v3, **delta sobre o v2** (`tasks/food06-m11-restricoes-contrato-v2.md`, PR #524, mergeada). Nada foi implementado por esta PR: só documento.
Onde o v3 não diz o contrário, **vale o v2**. B04 e M11-C2 **continuam abertos**: as decisões de produto estão tomadas, mas a validação clínica, jurídica e de privacidade não ocorreu.

- Base: `main` em `6907e0f9` (2026-11-12). Tema R4 (saúde, autorização, tenant); esta entrega R2 (documento).
- Fonte das decisões: documento "Decisões complementares FOOD06 T8" do proprietário (2026-11-12), mais as correções do proprietário ao plano (Q3 sem reautenticação; registro profissional não é critério do sistema).
- Autorização vigente: posso implementar em dados sintéticos; **o proprietário mergeia todas as PRs**; **nenhuma migration em ambiente real, deploy ou agendamento externo** sem autorização específica; nenhum conteúdo clínico é publicado.
- Dados: só exemplos sintéticos.

## 1. Princípio de projeto

Atender o nutricionista **autônomo**, sem equipe administrativa ou clínica de apoio, a clínicas pequenas e a equipes maiores, sem sacrificar a proteção do paciente. Consequências fixas:
nada exige segundo profissional; nada permite ignorar silenciosamente uma alergia confirmada; nada presume validação clínica, jurídica ou regulatória por esta aprovação; ausência de dado nunca é ausência de risco.

## 2. O que muda em relação ao v2

| Item | v2 | v3 (decisão de 2026-11-12) |
| --- | --- | --- |
| **D7-a** rótulo no portal | "Correção solicitada" (ambíguo) | O texto acompanha **autoria e estado**: "Você pediu uma correção" (só se o paciente pediu); "Sua equipe de atendimento está revisando esta informação"; "Sua solicitação está sendo analisada"; "Sua informação foi atualizada"; "Sua solicitação foi analisada e não houve alteração"; "Sua informação foi atualizada parcialmente". Sempre há uma **explicação objetiva** do resultado, sem anotação clínica interna. Nunca sugerir que uma restrição foi removida quando só se pediu revisão. |
| **Q2** vencimento | Proposta C9 | **Aprovado.** Restrição confirmada **nunca vence por prazo**; os 180 dias valem para a **reconfirmação da avaliação** (especialmente "sem restrições"). Vencida, gera pendência e **nunca** transforma conflito conhecido em ausência de conflito. Reconfirmação não é exigida a cada ajuste de quantidade ou troca rotineira. |
| **Q3** inativar alergia | Só `Professional` habilitado, com motivo (Q3 em aberto) | **Aprovado.** Somente `Professional` com a permissão clínica: **caixa de confirmação em dois passos**, motivo obrigatório (registro incorreto, informação clínica revisada, solicitação fundamentada, outro), **justificativa protegida**, auditoria imutável, **reavaliação das prévias e aplicações afetadas**. **Sem reautenticação** (decisão do proprietário, para não quebrar a fluidez). Vale para **toda alergia e doença celíaca confirmadas, qualquer gravidade** (extensão aprovada ao aprovar o plano: a gravidade é opcional e nunca reduz proteção). Não exige segundo profissional; política de dupla revisão é opcional para equipes. Alergia **não** é inativada porque o paciente quer comer o alimento. A inativação **não apaga** o histórico. |
| **Q6** habilitado | "Professional + permissão nova" (proposta) | **Aprovado.** `Professional` **com permissão específica de confirmação clínica**, independente das permissões genéricas de pacientes, e acesso autorizado ao paciente. `Professional` sem a permissão registra pendência; `Collaborator` registra pendências e lê só o que criou; `Patient` informa e solicita correção; `SuperAdmin` sem acesso clínico implícito. O autônomo se habilita por um **fluxo administrativo auditado, na sessão atual**. O sistema **não verifica conselho profissional**: a pessoa é responsável pelos dados que informa. |
| **Q8** preferência | Proposta | **Aprovado.** Sem confirmação; o paciente informa e edita. Pode influenciar **apresentação e ordenação** de sugestões, **depois** do filtro de segurança. Nunca gera conflito, nunca bloqueia, nunca vira alergia, nunca se sobrepõe a restrição confirmada, nunca declara um alimento seguro. |
| **Q9** curadoria | Aberta | **Modelo híbrido.** Nível 1 (local): o profissional corrige dado do seu atendimento, informa composição declarada com fonte, pede reavaliação ou substitui o alimento; **isso não altera o catálogo global nem declara ausência de alérgeno sem evidência**. Nível 2 (global OctaClin): mantenedora, revisão técnica, versionamento com origem, evidência, revisor, data, versão e histórico. Metas internas: **1 dia útil** (crítico), **3** (comum), **5** (conclusão com documentação), **não** SLA comercial. Classificação pendente **nunca** libera uma aplicação bloqueada por decurso de prazo. |
| **Q10** reconfirmação | Aberta | **Aprovado.** Registro mínimo: paciente, profissional, data e hora, **meio** (presencial, teleconsulta, portal, contato documentado), resultado da declaração, revisão da avaliação. É uma **atestação**: o sistema não consegue verificar que a pergunta ocorreu. Permitido manter a pendência sem criar declaração falsa de ausência. Sem dado pessoal desnecessário em logs. |
| **Q11** paciente | Aberta | **Aprovado com ampliação.** Resumo compreensível: restrições confirmadas e ativas; declarações do próprio paciente pendentes; registros da equipe aguardando conferência; solicitações e resultados; data da última confirmação; convite para atualizar respostas antigas do questionário (sem converter em restrição). Textos: "Restrição registrada no seu acompanhamento", "Informação enviada por você", "Anotado pela equipe de atendimento; ainda será conferido", "Solicite uma correção se alguma informação estiver desatualizada". O paciente **não altera** restrição confirmada. Sem códigos técnicos, sem motivação religiosa, sem justificativas internas; respeitar representantes legais. |
| **Q4** privacidade | Aberta | **Processo aprovado, não a homologação.** Matriz de tratamento (finalidade, categoria, controlador e operador, base legal por operação, acesso, retenção, compartilhamento, medidas, direitos do titular). Dado de saúde sob o art. 11 da LGPD; **não** usar "tutela da saúde" para finalidade comercial, analítica ou administrativa. **Minimizar a motivação religiosa: o campo `razao` sai da v1** do contrato; o motor usa só a restrição necessária. Retenção sem prazo arbitrário. |
| **Q5** questionário | Aberta | **Remediação estrutural aprovada.** Auditoria do fluxo (inclui `respostas_rascunho`), proteção dos fluxos **novos** como condição de ativação, plano **próprio** de migração do histórico; **não migrar dado real** nem alterar banco externo sem autorização. Não afirmar vazamento comprovado só pela ausência de cifragem de aplicação. |
| **Q1** validação clínica | Aberta | **Processo aprovado.** Taxonomia versionada com separação alergia, intolerância, doença celíaca, outras condições, escolha e preferência; lista regulatória como ponto de partida **após verificar a versão vigente**; cada regra com identificação, evidência, versão e revisão; regras de alergia, celíaca, contaminação e tolerância passam por validação clínica. **Até lá:** sem mapeamento presumido, sem IA declarando ausência, silêncio de tabela ou rótulo não é ausência, sem regra clínica ativa, sem anúncio de compatibilidade. |
| **Q7** monitoramento | Aberta | **Aprovado.** Mantenedora, inicialmente o proprietário, delegável. Verificação **mensal**, revisão **trimestral**, avaliação extraordinária em até **5 dias úteis**, com registro de norma, versão, data, responsável, impacto e decisão, e distinção entre proposta, consulta pública, norma publicada e norma vigente. Ver `docs/governance/REGISTRO_REGULATORIO_ALERGENICOS.md`. |

### 2.1 Consequências técnicas no desenho (v2 → v3)

1. **Mapeamento com origem.** `MapeamentoAlimentoAlvo` ganha `origem` (`global` | `local_profissional`). O que **restringe** (`contem`, `pode_conter`) vale sempre, venha de onde vier. O que **libera** (`nao_contem_confirmado`) de origem local exige evidência documental, cobertura suficiente e autor, e o motor devolve `sem_conflito_registrado` com ação **`exige_confirmacao`** e selo "informado pelo profissional; não validado globalmente": **nunca `permitido` silencioso**. O que é "evidência suficiente" depende da Q1.
2. **Dois textos por pedido.** A solicitação do paciente guarda a **explicação ao paciente** (campo próprio, visível) separada da **justificativa interna** (protegida, nunca exibida).
3. **Registro de reconfirmação** (Q10) como entidade própria, com o meio e o resultado.
4. **Sem `razao`** em `RestricaoPaciente` na v1 (Q4).
5. **Permissão por usuário** (Q6) não existe hoje: as permissões derivam só do papel (`obterPermissoesPorPapel`). É um mecanismo de autorização novo (concessão por usuário, integração no guard, fluxo de habilitação), **PR própria (R4) antes da P2**.
6. **Máquina de estados da solicitação** (D7-a): estados internos `aberta`, `em_revisao`, `em_analise`, `aceita`, `recusada`, `parcial`; o portal mostra **textos por chave**, sem expor o estado interno. Para o paciente, `em_revisao` e `em_analise` podem compartilhar um texto (proposta de simplificação, a decidir na revisão de UX). A variante neutra de "equipe de atendimento" para quem atua sozinho ("seu atendimento") é proposta, não alteração do texto do proprietário.
7. **Inativação protegida** (Q3) como transição com pré-condições (motivo, justificativa, confirmação em dois passos), invalidando prévias pela **impressão** do motor (a revisão da restrição entra na impressão).

## 3. Bloqueios de **desenvolvimento** × bloqueios de **ativação**

**Bloqueiam o desenvolvimento** (e como saem):

| ID | Bloqueio | Saída |
| --- | --- | --- |
| DEV-1 | P1b é R4 (dado de saúde, RLS, cifragem, DDL) | Trocar para **Opus** e pedir revisão cruzada; ensaio só em PostgreSQL descartável. |
| DEV-2 | Q6: não existe permissão por usuário | PR própria de autorização (R4, Opus) **antes** da P2. |
| DEV-3 | P2 depende da P1b e do DEV-2 | Ordem: P1b, DEV-2, P2. |
| DEV-4 | Nenhuma migration em ambiente real sem autorização | Ensaio local; aplicar só com autorização por ambiente, banco, branch e role. |

Fora disso, **nada** bloqueia escrever código com dados sintéticos: o motor recebe taxonomia, mapeamento e regra como **entrada** e, sem eles, devolve `indeterminado`.

**Bloqueiam a ATIVAÇÃO** (nenhuma flag clínica liga sem eles):

| ID | Bloqueio | Quem fecha | Condição objetiva |
| --- | --- | --- | --- |
| ATV-1 | **Q1:** taxonomia, mapeamentos, regras de aplicar (alergia, celíaca, contaminação, tolerância), gravidade e política dos 180 dias não validados | Responsável clínico | Validação documentada por versão; sem isso, o sistema segue inerte. |
| ATV-2 | **Q4:** matriz de tratamento, base legal por operação, retenção, controlador e operador | Jurídico e privacidade | Avaliação documentada. |
| ATV-3 | **Q5:** proteção dos **novos** fluxos de dado sensível e plano do histórico | Engenharia e privacidade | Auditoria entregue; fluxos novos com cifragem de aplicação provada; plano de migração aprovado em separado. |
| ATV-4 | **Q7:** vigência da RDC 727/2022 e das normas citadas | Mantenedora | Registro regulatório com a versão vigente confirmada em fonte oficial. |
| ATV-5 | **Q9:** operação da curadoria global (quem, fila, metas) | Proprietário | Responsável nomeado e fila funcionando. |
| ATV-6 | Pacientes **representados** (menores, representantes legais) sem modelo no portal | Produto e privacidade | Regra documentada e testada, ou exclusão explícita desses pacientes da exibição. |
| ATV-7 | Textos do paciente e do profissional (D7-a, Q11, selos) sem teste de compreensão | UX com pessoas reais | Teste de compreensão, teclado e leitor de tela. |
| ATV-8 | Migrations em staging e produção; flags | Proprietário | Autorização específica por ambiente. |
| ATV-9 | Revisão R4 integral e UX etapas B e C | Revisão independente | Relatórios registrados. |

## 4. Matriz final: decisão ou requisito

Legenda de **estado:** DECIDIDO (produto) / PENDENTE (validação) / PROPOSTO. "PR" é a PR responsável pela alteração; **PR-D** é domínio puro, **PR-E** a auditoria do Q5, **P1b**, **Auth** (concessão por usuário), **P2**, **P3** e **P4** as fases do plano.

| Decisão | Estado atual | Implementação existente | Alteração necessária | Validação pendente | Risco | Evidência de teste | PR | Condição objetiva de aprovação |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **D7-a** rótulos do portal | DECIDIDO | Nenhuma (portal não mostra restrições) | Máquina de estados da solicitação e textos por chave; explicação ao paciente como campo próprio | Teste de compreensão (ATV-7) | Médio: texto que sugira remoção ou proteção automática | Nenhuma ainda; planejado: transições válidas e nenhuma chave expõe estado interno | PR-D (estados), P1b (campo), P3 (tela) | Cada estado tem texto próprio sem jargão e nenhum estado interno chega ao portal (teste de contrato) |
| **Q2** vencimento | DECIDIDO | **Motor (#526):** restrição confirmada não vence; a avaliação vence e remove só o `sem_conflito_registrado` | Nenhuma no motor; pendência de reconfirmação na interface | Política dos 180 dias (Q1) | Baixo | `restricoes-alimentares.spec.ts`: "restrição confirmada vencida continua gerando conflita"; 24 mutações detectadas | #526 (feito); P3 (aviso) | Teste continua verde e a interface mostra a pendência sem bloquear a edição |
| **Q3** inativar alergia | DECIDIDO (sem reautenticação) | Nenhuma transição de inativação; a impressão do motor já invalida prévias quando a revisão muda | Transição protegida: confirmação em dois passos, motivo, justificativa cifrada, auditoria imutável, invalidação | Política de dupla revisão opcional (futuro) | **Alto:** é a saída do bloqueio de alergia | Planejado: sem motivo, sem confirmação ou sem permissão não inativa; prévia antiga deixa de valer; histórico preservado | PR-D (pré-condições), P2 (API), P3/P4 (tela) | Inativar alergia ou celíaca de qualquer gravidade só com as quatro exigências, e prévias afetadas invalidadas |
| **Q6** habilitado | DECIDIDO | Permissões só por papel; MFA por papel no login | Concessão por usuário, guard e fluxo de habilitação do autônomo; `Collaborator` lê só o que criou | Nenhuma de especialista; sem verificação de conselho (decisão) | **Alto:** muda autorização | Planejado: `Professional` sem a permissão não confirma; `SuperAdmin` sem acesso clínico; tenant e carteira alheios | **Auth** (R4), P2 | Matriz de papéis da v2 §4.7 passa em teste negativo e positivo; permissão nunca concedida só pelo papel |
| **Q8** preferência | DECIDIDO | **Motor:** preferência é `sem_efeito_clinico`, nunca bloqueia | Ordenação de sugestões só depois do filtro de segurança | Nenhuma | Baixo | Spec: "preferência nunca produz conflito, bloqueio ou revisão" (cartesiano) | #526 (motor), P3 | Preferência nunca altera `acaoAplicar` nem resultado de restrição confirmada |
| **Q9** curadoria híbrida | DECIDIDO | Mapeamento **sem origem** no motor | Campo `origem`; liberação local exige evidência e vira `exige_confirmacao`; `PedidoCuradoria` | **Q1:** o que é evidência suficiente; operação da curadoria (ATV-5) | **Alto:** liberar alergia por dado local fraco | Planejado: local que restringe vale; local que libera nunca `permitido`; mutação "local libera sem evidência" detectada | PR-D (motor), P1b (tabela), P2 | Nenhum caminho local converte bloqueio em `permitido`, e a evidência é obrigatória |
| **Q10** reconfirmação | DECIDIDO | O motor recebe `venceEm`; não calcula os 180 dias | Registro de reconfirmação com meio e resultado; validador | Política dos 180 dias (Q1) | Médio: atestação não verificável | Planejado: campos obrigatórios; não cria "sem restrições" sem resultado; pendência mantida sem falsa declaração | PR-D (validador), P1b (tabela), P2 | Reconfirmação sem os seis campos é recusada; log sem dado pessoal |
| **Q11** o que o paciente vê | DECIDIDO | Nenhuma | Projeção mínima por allowlist; textos por chave; convite sobre questionário antigo | Representantes legais (ATV-6); compreensão (ATV-7) | Alto: PHI no portal | Planejado: nenhum código, motivo religioso ou justificativa interna no DTO; outro paciente e tenant negados | P2 (DTO), P3 (tela) | DTO do portal só com os campos listados; canários ausentes |
| **Q1** validação clínica | PROCESSO aprovado; **PENDENTE** | Motor **inerte**; guarda que recusa regra de alergia que não impeça | Nenhuma de código; conteúdo versionado entra só depois de validado | Responsável clínico (ATV-1) | **Alto:** conteúdo errado causa dano | Spec: sem regra, nunca conflita nem impede (cartesiano); 24 mutações | #526 (motor) | Validação documentada por versão antes de qualquer regra ativa |
| **Q4** LGPD | PROCESSO aprovado; **PENDENTE** | Nenhuma matriz; classificação de dados em `docs/agents/DATA_CLASSIFICATION.md` | Matriz de tratamento (esqueleto nesta PR); sem campo `razao` | Jurídico e privacidade (ATV-2) | Alto | n/a (documento) | PR-C (esqueleto) | Matriz preenchida e assinada por quem tem competência |
| **Q5** questionário | PROCESSO aprovado; **PENDENTE** | `resposta_valores.valor` e `respostas_rascunho` em `jsonb` sem cifragem de aplicação (**verificado**); cifragem em repouso do provedor **não verificada** | Auditoria; proteção dos fluxos novos; plano do histórico | Privacidade (ATV-3) | Alto (condição de ativação) | n/a (auditoria de leitura) | **PR-E** | Auditoria entregue, fluxos novos protegidos e testados, migração histórica com plano próprio |
| **Q7** regulatório | DECIDIDO | Nenhuma | Registro regulatório e rotina mensal, trimestral e extraordinária | Vigência da RDC 727/2022 (ATV-4) | Médio | n/a (documento) | PR-C | Registro com a versão vigente confirmada em fonte oficial e responsável nomeado |

## 5. Critérios de aceite novos (somam-se aos 20 do v2 §5.2)

| # | Critério | Teste |
| --- | --- | --- |
| 21 | Restrição local que **libera** exige evidência e nunca devolve `permitido` silencioso | Propriedade sobre `origem` × evidência × cobertura |
| 22 | Restrição local que **restringe** vale sempre | Mapeamento local `contem` impede igual ao global |
| 23 | Inativar alergia ou celíaca (qualquer gravidade) exige permissão, confirmação em dois passos, motivo e justificativa; invalida prévias; preserva o histórico | Negativos de cada exigência; a impressão da prévia antiga muda |
| 24 | Solicitação do paciente nunca altera restrição confirmada; cada estado tem texto próprio | Máquina de estados; contrato do DTO do portal |
| 25 | A reconfirmação registra paciente, profissional, data e hora, meio, resultado e revisão, sem dado pessoal em log | Validador e canários |
| 26 | `Professional` sem a permissão clínica não confirma; permissão não é concedida só pelo papel | Teste de autorização (Auth) |
| 27 | Nenhuma preferência influencia a ordenação **antes** do filtro de segurança | Teste de M11 (P3) |
| 28 | Nenhum texto do paciente expõe estado interno, código técnico ou motivação religiosa | Teste de contrato e canário |

## 6. Plano e pausa

PR-C (esta) → PR-D (domínio puro) → PR-E (auditoria do Q5) → **PAUSA para a troca do modelo (Opus)** → P1b → Auth → P2 → P3 → P4. O proprietário mergeia cada uma.
Detalhe das fases, rollback e provas: v2 §6. Nada é aplicado em ambiente real sem autorização específica.

## 7. Fatos verificados neste ciclo e o que não foi

**Verificado (leitura):** as permissões derivam só do papel (`modulos/auth/dominio/permissoes.ts`, `obterPermissoesPorPapel`); existem MFA e reautenticação (`1720000001037-CriarMfaEReautenticacao`, `ReautenticarDto`),
que o Q3 **não** usa por decisão do proprietário; o rascunho do questionário (`respostas_rascunho`) também guarda `valor`; o motor (#526) já cobre Q2, Q8 e a inércia sem regra validada.
**Não verificado:** cifragem em repouso do provedor; vigência atual da RDC 727/2022; Lei 10.674/2003; qualquer exigência jurídica; se há janela de "reautenticado recentemente" (irrelevante após a decisão do Q3).
