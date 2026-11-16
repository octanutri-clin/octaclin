# FOOD06 P2 — preparação e handoff

## Estado em 2026-11-16 (Claude Code, Opus): P2a e próximos passos

**Escopo da #536 redefinido como P2a:** serviços clínicos do `Professional` com concessão `restricoes.confirmar`
e contrato HTTP isolado, **sem rota registrada, sem flag e sem bootstrap**. O restante da P2 sai em PRs próprias.

**Revisão R4 integral independente (Claude Code, Opus, distinto do autor Codex)**, com segunda opinião do
subagente `tenant-security-reviewer` (mesma família de modelo; não é revisão humana). Sem achado ALTO e sem
vazamento entre tenants demonstrado. Achados corrigidos nesta PR com TDD (RED → GREEN):

| ID | Sev. | Achado | Correção |
| --- | --- | --- | --- |
| R4-P2a-01 | MÉDIA | `confirmar` e `inativar` não exigiam READ COMMITTED, histórico consistente da avaliação, último evento compatível nem conteúdo igual ao snapshot (os demais escritores exigiam) | Mesmas checagens antes de gravar; `inativar` recusa último evento `criacao`, `rejeicao` e `inativacao`; `confirmar` recusa `confirmacao`, `rejeicao` e `inativacao` |
| R4-P2a-02 | MÉDIA | Rotas de escrita do controlador isolado exigiam só `pacientes.ler` na guarda | Escritas exigem `pacientes.ler` + `pacientes.gerenciar`; consulta segue só com leitura. A autorização clínica real continua no serviço |
| R4-P2a-03 | BAIXA | Corrida em `ux_reconfirmacoes_idempotencia` virava 500 | Vira 409 sem eco |
| R4-P2a-04 | BAIXA | Lock consultivo do registro sem prefixo de namespace | Prefixo `registro:` (o da reconfirmação já tinha `reconfirmacao:`) |
| R4-P2a-05 | MÉDIA (desenho) | Registro de pendência não exige a concessão clínica | **Mantido de propósito** (contrato v3, Q6: `Professional` sem a permissão registra pendência). Exige `Professional` ativo e carteira, na mesma transação |

**Provas:** suíte PostgreSQL/RLS (`pnpm test:rls:testcontainers`) passou **localmente** no container do Claude Code,
com Docker, antes e depois das correções (ver PR). Isso não substitui o CI do HEAD final.

**P2b entregue em PR própria (branch `claude/food06-p2b-exposicao-fechada`, empilhada sobre a #536):** flag
`restricoes.clinicas` (padrão desligada; o endpoint de operações não a liga), controlador registrado em `ModuloRestricoes`
atrás de `GuardaFeatureFlag`, middlewares no `main.ts` (antes e depois do parser), prova com a guarda JWT real
(`controlador-restricoes-clinicas.jwt.http.spec.ts`) e prova PostgreSQL com a flag lida de `tenant_configuracoes`.
**Ligar a flag em qualquer ambiente continua proibido** até ATV-1..9 e autorização do proprietário.

**Próximas PRs da P2 (cada uma R4, o proprietário mergeia):**
1. ~~**P2b — exposição fechada:**~~ (feita; ver acima) flag nova em `FEATURE_FLAGS_CONHECIDAS` (desligada por padrão); middlewares
   no bootstrap (cabeçalhos antes do parser e erro depois dele); registrar o controlador só com a flag;
   prova com a guarda JWT real e o bootstrap real (o spec JWT local do Codex não foi publicado e será recriado);
   canário de log. Antes de expor, decidir permissão de escrita definitiva (R4-P2a-02 é defesa em profundidade).
**P2c entregue em PR própria (branch `claude/food06-p2c-solicitacoes-profissional`, empilhada sobre a P2b) — decisão do
proprietário: só o lado do PROFISSIONAL.** `ServicoSolicitacoesRestricao` (listar, iniciar análise, decidir) com concessão,
carteira, READ COMMITTED, CAS e auditoria; o desfecho responde a todos os itens do pedido e só cita revisões clínicas
posteriores ao pedido; a solicitação nunca altera a restrição. Rotas `solicitacoes/*` atrás da flag. Projeção do portal como
função pura (`dominio/projecao-portal-solicitacao.ts`). **Criar e cancelar pelo paciente e as rotas do portal ficam na P2d.**

2. ~~**P2c — solicitações do paciente (D7-a) e projeção do portal (Q11):**~~ (lado do profissional feito; ver acima) serviços e DTO por allowlist; Patient
   continua sem acesso até a P2d.
3. **P2d — carteiras e vínculos:** delegação da carteira pelo titular ao Collaborator e vínculo de representação
   separado de `pacientes.usuario_id` (vários representados por conta), conforme
   `tasks/food06-p2-plano-carteiras-vinculos.md`. Migrations novas; ensaio só em banco descartável.
   - **P2d-1 (#550, mergeada):** migration 1085 com as duas tabelas vazias (nunca aplicada em ambiente real).
   - **P2d-2 (branch `claude/food06-p2d2-delegacao-colaborador`):** `ServicoDelegacoesCarteira` (listar/conceder/revogar só
     pelo titular Professional ativo; alvo Collaborator ativo do tenant; nunca o próprio titular nem SuperAdmin); cascata ao
     desativar, trocar papel (`servico-usuarios-cliente`) e arquivar profissional (`servico-profissionais`, para restaurar não
     reviver a delegação); `autorizarPendenciaRestricao` aceita Collaborator com delegação vigente do responsável ATUAL,
     provada sob lock (usuários por id → delegação → profissional → paciente) e retorna origem `colaborador`;
     `consultarAutoria` lê só restrições do próprio colaborador. Rotas `colaborador/pacientes/:id/restricoes/{registrar,consultar}`
     e `profissional/delegacoes-carteira/{listar,conceder,:id/revogar}` atrás da flag. Delegação nunca dá ação clínica.
     Revisão R4 (subagente de tenant, mesmo modelo): sem bloqueantes; corrigidos a ordem de locks em `arquivar` e
     `atualizarPapel` (conta antes do perfil) e a autoria da revogação ao arquivar (ator real). Limites declarados:
     encerramento de tenant desativa todos os usuários sem revogar as linhas (terminal; a leitura sob lock nega); o
     invariante "cai se desativado" depende de todo escritor de `usuarios.ativo`/`role` chamar a cascata (hoje todos
     chamam); pendência do colaborador invalida avaliação `sem_restricoes_confirmadas` como a do profissional
     (conservador; **aceito pelo proprietário em 2026-11-16**); sem limite de taxa por colaborador.
   - **P2d-2 (#551, mergeada).**
   - **P2d-3a (branch `claude/food06-p2d3a-vinculos-paciente`):** `ServicoVinculosRepresentacao` (listar/registrar/revogar pela
     equipe do paciente: Professional responsável ou Collaborator delegado, provado por `autorizarPendenciaRestricao`);
     representante é conta `Patient` ativa do tenant, diferente de quem verifica e da conta do próprio paciente; idempotente;
     cascata ao desativar a conta do paciente (`servico-pacientes.desativarContaAcesso`), na alteração de acesso
     (`servico-usuarios-cliente`) e ao arquivar o paciente (restaurar não revive). `autorizarPacientePortal` prova, sob lock
     (usuário → paciente → vínculo), que a conta `Patient` é a do próprio paciente ou tem vínculo vigente; o `pacienteId` é só
     seletor. Seletor `POST portal/restricoes/pacientes/listar` e rotas `pacientes/:id/representantes/*`, atrás da flag.
     Decisões do proprietário: duas PRs na P2d-3; declaração nova do paciente = pendência direta (`declaracao_paciente`);
     resumo Q11 sem observação. A regra de menores/representantes legais (ATV-6) continua de produto e privacidade.
     Revisão R4 (subagente de tenant, mesmo modelo): 1 bloqueante corrigido (paciente eliminado por LGPD ficava acessível:
     agora negado no portal, fora do seletor e com vínculos revogados na eliminação); travas explícitas no registro; repetição
     com outro tipo de verificação = 409. Limites: `pacientes.usuario_id` sem unique (seletor falha fechado com dois "próprios";
     unique fica para migration própria, R4, fora de banda; o portal também falha fechado com conta "própria" de mais de uma
     ficha); a cascata em `servico-usuarios-cliente` não alcança contas Patient (o escritor real é `desativarContaAcesso`);
     encerramento de tenant não revoga vínculos (o portal relê `ativo`).
     **Decisões do proprietário (2026-11-16, depois da revisão):** desativar a conta do paciente também derruba quem o
     representa (`revogarVinculosDoPaciente(..., 'desativacao_conta')`); limites de 100 vigentes já na P2d-3a: delegações por
     titular, representantes por paciente e representações por conta (409 acima; travas consultivas por titular e por
     representante), então nenhuma lista corta sem aviso. Guarda textual `usuarios/infraestrutura/guarda-escritores-acesso.spec.ts`
     exige que todo escritor de `usuarios.ativo`/`role` chame a cascata (exceção nominal: encerramento de tenant).
   - **Correção pelo CI da #552:** `UPDATE ... RETURNING` via `query()` devolve `[linhas, contagem]`; as cascatas de vínculos e
     de delegações (P2d-2, já na `main`) gravavam uma auditoria extra com `recurso_id` nulo por revogação. Helper
     `linhasDeUpdateReturning` falha fechado; provas contam a auditoria por linha (ver `docs/agents/LESSONS_LEARNED.md`).
   - **P2d-3b (a seguir):** declaração, pedidos (criar, cancelar pelo autor, listar) e resumo Q11 no portal; encerra a P2.
   - **Backlog para a P3:** se a tela mostrar o histórico de delegações ou de vínculos (revogados), consulta paginada própria.
     (O limite de 100 vigentes foi antecipado para a P2d-3a.)
   - **PR própria a seguir:** unique parcial em `pacientes (tenant_id, usuario_id) where usuario_id is not null` (migration R4,
     fora de banda, com checagem de duplicatas antes; ensaio só em PostgreSQL descartável).
4. Depois: P3 (telas, UX B/C) e P4 (M04/M12, apply com impressão e invalidação de prévias).


## Incremento: contrato HTTP clínico isolado

- Controlador de consulta, registro profissional, ações clínicas e avaliação/
  reconfirmação global e individual, e middleware para cabeçalhos/erros do parser, foram
  preparados e testados em servidor Nest sintético. Não estão registrados no
  módulo nem no bootstrap; nenhuma rota foi exposta e não existe flag nova.
- Testes HTTP unitários usam JWT e serviços simulados. Prova adicional HTTP com
  controlador e serviços reais sobre PostgreSQL/RLS descartável foi preparada:
  autenticação ainda é sintética e sua execução aguarda CI. Nenhuma das provas
  demonstra JWT real, flag, bootstrap ou rota de produção.
- A revisão cruzada identificou JSON malformado antes do controlador: a proteção
  proposta precisa ser ligada antes e depois do parser ao integrar a rota, com
  teste do bootstrap real. Antes de registrar, implementar gate fechado por flag,
  confirmar ausência de dados clínicos em logs e executar authz/HTTP/R4 completos.
- Uma resposta HTTP com erro pode ocorrer após o serviço ter confirmado uma
  mutação, por falha de projeção ou conexão. O cliente futuro deve recarregar e
  reconciliar a revisão antes de repetir; não presumir que erro significa rollback.

## Incremento: composição NestJS

- `ModuloRestricoes` integra os quatro serviços internos ao módulo de planos,
  importando os módulos existentes de tenant e autorização. Não registra
  controladores nem exporta serviços para outros módulos; nenhuma rota é aberta.
- Teste compila o módulo real de restrições com módulos de tenant e auth
  substituídos por dependências sintéticas e confere a importação pelo módulo
  de planos. Não é prova de bootstrap completo da aplicação nem de HTTP.

## Incremento em andamento: leitura clínica individual

- Serviço interno para Professional com concessão específica: autoriza tenant e
  carteira antes de buscar, compara conteúdo cifrado ao histórico vigente e
  devolve somente projeção explícita; audita sem conteúdo na mesma transação.
- Revisão cruzada não identificou vazamento demonstrado; identificou estados
  incompatíveis com o último evento, agora recusados por matriz dos eventos
  implementados, com testes positivos e negativos. A leitura usa lock do
  paciente e cobre apenas Professional habilitado, não Collaborator ou Patient;
  ainda não há rota ou seleção de paciente do portal.
- Testes de autorização, histórico divergente, falha de auditoria, isolamento e
  disputa com inativação passaram no Backend do CI do HEAD `4c1d3b5c` com
  PostgreSQL descartável. Provas adicionais da serialização com revogação e transferência estão
  preparadas para o próximo CI. Projeção do portal e invalidação de prévias
  permanecem pendentes.

## Incremento em andamento: reavaliação clínica

- Serviço interno permite `ativa` confirmada para `em_reavaliacao` e retorno
  a `ativa`, sem reativar registros inativos; durante a reavaliação a restrição
  continua confirmada. CAS, conteúdo/histórico cifrados e auditoria transacional.
- Revisão cruzada independente não encontrou defeito concreto. Testes locais
  focados e typecheck PASS; testes PostgreSQL preparados para autorização,
  isolamento, rollback e disputa com inativação passaram no Backend do CI
  do HEAD `32d2cfa6`. Testes das duas ordens de disputa com cada resultado de
  reconfirmação individual, com avaliação não informada e confirmada, foram
  preparados e aguardam CI. Não provam a invalidação fim a fim de prévias P4.

## Incremento em andamento: rejeição clínica

- Serviço ainda desconectado: rejeita somente pendência clínica ativa com
  concessão e carteira verificadas, justificativa cifrada, CAS, histórico e
  auditoria na mesma transação; invalida avaliação anterior conservadoramente.
- READ COMMITTED e consistência do histórico são exigidos antes da escrita.
  Revisão cruzada independente não encontrou defeito concreto; identificou a
  necessidade de prova PostgreSQL para isolamento, rollback e concorrência.
- Testes PostgreSQL sintéticos foram adicionados para isolamento, carteira,
  cifra, rollback na segunda auditoria e corrida confirmação/rejeição nas duas
  ordens. Execução local SKIPPED: Docker indisponível; depende de CI no novo HEAD.
  Teste de corrida entre rejeição e declaração de ausência nas duas ordens também
  foi preparado e aguarda execução no CI; não é evidência de aprovação ainda.
- P2 continua incompleta: não ativar rotas, flag ou consumidores clínicos. Ver
  o restante deste histórico e os contratos para demais transições e integração.

- Branch `codex/food06-p2-restricoes`; base `312d6727`, conferida em 2026-11-13.
- Objetivo: serviço e API de restrições (R4), conforme contratos v2/v3; flags
  desligadas e nenhum consumidor clínico novo ativado automaticamente.
- P1b (#531) e Auth-2 (#535) estão na base. A concessão deve ser verificada com
  `ServicoConcessoesPermissao.exigir` no mesmo `EntityManager` transacional da
  ação protegida; também é obrigatório verificar a carteira do paciente.
- Conteúdo clínico deve usar o codec vinculado a tenant, paciente, registro e
  revisão. Ilegível não é ausência. Histórico, auditoria e CAS são obrigatórios.
- A guarda estática `guarda-escrita-restricoes.spec.ts` tem lista de consumidores
  vazia: qualquer inclusão precisa ser nominal e acompanhada das provas de codec.
- A flag de restrições ainda não consta em `FEATURE_FLAGS_CONHECIDAS`; desenhar
  seu gate fechado sem contornar os bloqueios de ativação e sem ativar em ambiente.
- UX etapa A: personas nativas `/root/ux_nutri` e `/root/ux_paciente` receberam
  briefing sintético sobre o contrato na base `312d6727`; sem telas ou teste
  visual. Ambos indicaram testar distinção pendência/confirmada, conflitos de
  revisão e projeção mínima do portal. A interface futura deve tratar recuperação
  de conflito e resultado incerto; isso não autoriza ampliar o escopo de P2.
  Registrar o relatório completo e manifesto conforme `docs/agents/ux/PROCEDIMENTO.md`.
- Instalação congelada local PASS com Node 22/pnpm 11.25. Primeiro incremento:
  `autorizacao-restricao-clinica.ts` e seu spec, ainda sem consumidores. RED
  funcional com stub recusando acesso; GREEN 9/9 para concessão transacional,
  papel, vínculo de profissional e paciente. Typecheck PASS. Testes usam mocks;
  não comprovam RLS, locks concorrentes ou semântica de PostgreSQL.
- Tooling local: Node 12/12 PASS, wrapper `pnpm test:tooling-agentes` FAIL por
  ausência do executável `python3`; CI Linux deve executar a parte Python. Scanner
  de segredos e typecheck PASS. Não foi instalada dependência para contornar isso.
- Revisão estática parcial por `/root/p2_tenant_review`: sem achado reproduzido
  no helper, mas exige PostgreSQL real, runtime não-owner sem BYPASSRLS, outro
  tenant/carteira efetivamente existentes, revogação e reatribuição concorrente,
  `app.tenant_id` e fluxo chamador com tenant da sessão. Sem execução do revisor.
- Incremento posterior: prova P2 adicionada ao inventário RLS integrado, com
  tenant e pacientes sintéticos separados, concessão ausente/revogada, pacientes
  de outra carteira e tenant, e revogação bloqueada durante a transação. A prova
  localmente foi SKIPPED por Docker indisponível. CI da PR #536, run `43432488847`,
  job Backend `131909264184` no HEAD `6fd15558`: PASS na suíte RLS/Testcontainers
  (270/270), incluindo esta prova; suíte geral 5.059 PASS, 181 SKIPPED. São grupos
  sobrepostos, não somar. O CI do HEAD seguinte deve ser conferido separadamente.
- Nenhum SQL externo, migration, deploy, merge ou configuração externa alterada.
- Terceiro incremento: método de inativação ainda desconectado, com motivo fechado,
  confirmação explícita, justificativa cifrada, CAS, histórico/auditoria e
  invalidação conservadora da avaliação. Não prova P4 nem invalidação efetiva de
  prévias. Revisão independente apontou inconsistência entre validadores de texto;
  corrigida com erro 400 genérico e testes sem eco. Atualização contraditória da
  avaliação falha fechado. Prova PostgreSQL de inativação preparada para CI.
  Faltam provas de corrida e rollback em banco para inativação, integração Nest,
  flag e rotas; não ativar nem considerar P2 concluída.
- CI `43451100835` do HEAD `d0e93bf6`: Backend PASS, incluindo confirmação,
  invalidação e rollback em banco; suíte geral 5.068 PASS/181 SKIPPED e etapa
  RLS 270/270 PASS, conjuntos sobrepostos. Não estender esse resultado ao novo HEAD.
- CI `43455691278` do HEAD `14574a47`: Backend PASS; 5.078 testes PASS e 181
  SKIPPED na suíte geral, RLS/Testcontainers 270/270 PASS (conjuntos sobrepostos).
  Inativação positiva e negativas de tenant/carteira foram executadas em banco.
  Incremento posterior adiciona prova de concorrência com barreira, rollback na
  segunda auditoria e atualização de timestamps; CI desse novo HEAD pendente.
  A prova da corrida ausência × restrição e integração do serviço seguem pendentes.
- Segundo incremento em preparação: confirmação transacional da restrição com
  CAS, codec e histórico/auditoria; 29 testes focados PASS, incluindo guarda e
  helper. Serviço ainda sem provider/rota/flag. Revisão independente encontrou
  risco de inconsistência com avaliação global `sem_restricoes_confirmadas`.
  A confirmação agora bloqueia o paciente e invalida a avaliação de ausência para
  `nao_informado`, com revisão e auditoria transacionais. Revisão estática posterior
  considerou o caso sequencial coerente; corrida entre escritores de ausência e
  restrição, rollback em banco e proteção da API continuam obrigatórios.
  Prova PostgreSQL da confirmação e invalidação foi adicionada, mas aguarda CI;
  não há Docker local. Faltam negativas reais e rollback de auditoria/cifra em banco.
  Futuras operações devem manter a ordem concessão/usuário → profissional →
  paciente → avaliação → restrição e reler o estado sob lock. Não expor o serviço
  sem provider Nest correto, flag fechada, DTO, rota e prova HTTP.
- Próxima ação: usar o helper no serviço transacional, implementar os testes e
  operações P2; manter o acesso clínico indisponível até proteção por flag.
- Avanço subsequente: serviço anotado `@Injectable` com dependências runtime;
  teste Nest isolado teve RED/GREEN e revisão independente. A prova usa providers
  e autorização simulados: não comprova boot/wiring do módulo real nem flag/rota.
  Serviço ainda não registrado nem exposto. Necessário smoke com módulo real.
- CI `43456710334` do HEAD `6146314a`: FAIL no preparo sintético da prova de
  rollback porque alteração manual da avaliação não incrementava a revisão; o
  trigger da 1083 recusou, como previsto. Fixture corrigida incrementando revisão;
  CI do novo HEAD necessário para verificar o GREEN em PostgreSQL. Não alterar ou
  desabilitar o trigger para fazer o teste passar.
- CI `43457560352`, job Backend `131995936498`, HEAD `bdae5bbc`: PASS após
  corrigir a fixture; prova de banco inclui concorrência e rollback do incremento.
- Novo helper de pendência permanece desconectado: só Professional ativo no banco,
  com IDs válidos, transação e carteira. Testes locais 9 PASS e 2 TODO, typecheck
  PASS. Patient e Collaborator NEGADOS provisoriamente, não implementados: revisão
  independente detectou corrida de vínculo único do paciente e falta de modelo de
  carteira delegada do colaborador. Não declarar a P2 pronta nem tratar negação
  provisória como decisão de produto. Prova PostgreSQL para Professional adicionada,
  pendente CI; precisa de provas dos outros papéis quando a solução for definida.
- Ordem de trabalho: prosseguir nos itens independentes para Professional e clínica;
  paciente/colaborador aguardam implementação/protocolo e testes de concorrência.
- Decisão do proprietário de 2026-11-13: planejar delegação explícita de carteira
  para Collaborator e unicidade no banco para o vínculo ativo do paciente, com
  tratamento de duplicatas. Essas decisões autorizam planejamento, não aplicam
  migrations nem autorizam saneamento de dados reais. Patient e Collaborator
  continuam fechados até protocolo, revisão R4, provas negativas e procedimento
  de migração/rollback aprovados; continuar itens independentes para Professional.
- Pendente: todas as operações P2, API/DTOs,
  testes negativos de banco e de concorrência,
  provas RLS, UX B/C, revisão R4 independente, gates completos e PR.
- Incremento local: registro profissional idempotente, auditoria e invalidação
  transacionais; sanitização de erros e logger SQL desabilitado globalmente.
  Revisão R4 independente não encontrou vazamento cross-tenant demonstrável no
  fluxo examinado e apontou risco futuro do logger de consultas lentas; o teste
  agora veda a configuração do limiar. Provas PostgreSQL do incremento e canário
  de log aguardam CI; logger e HTTP sintéticos não provam provider nem rota real.
  O plano de delegação e unicidade está em `food06-p2-plano-carteiras-vinculos.md`.
  Desligar logging reduz diagnóstico SQL, descrito no playbook; rollback do código
  reintroduz risco de exposição de parâmetros fora de produção. Nenhuma alteração
  externa de ambiente ou banco foi realizada.
- Decisões adicionais do proprietário: profissional titular concede e revoga
  acesso do colaborador à carteira inteira; uma conta pode representar vários
  pacientes ativos na clínica. Portanto unicidade por `(tenant_id, usuario_id)`
  é incompatível com o produto. Planejar vínculo individual e seleção autorizada;
  `findOne` por conta no portal existente requer revisão antes de habilitar múltiplos
  representados. Decisões e perspectivas UX A estão no plano de carteiras/vínculos.
- Backend do CI `43503848895`, HEAD `2e14b975`: PASS na suíte completa
  (5.115 PASS, 181 SKIPPED, 2 TODO) e na etapa PostgreSQL/Testcontainers
  (271 PASS; grupos sobrepostos); workflow geral ainda em andamento nesta anotação.
  Este resultado não prova P2 completa nem configuração de produção.
- Decisão adicional: equipe da clínica registra a representação e verifica a
  autorização. A solução deve exigir vínculo ativo e seleção autorizada para
  cada paciente; não há liberação implícita de acesso clínico a toda a equipe.
  Os papéis e fluxo de evidência devem respeitar a matriz existente; não inferir
  autorização de Collaborator ou Client apenas pela expressão “equipe”.
- CI `43505519637`, HEAD `db911b7b`: workflow OctaClin CI PASS, incluindo Backend,
  Web, governança, smoke e PR Gate; provenance de SBOM em workflow separado foi
  SKIPPED. O resultado não prova P2 completa, deploy ou estado de produção.
- Reconfirmação: validador de domínio usa snapshot de descritores próprios em
  objeto sem protótipo; rejeita acessores, símbolos e propriedades não enumeráveis.
  Testes RED reproduziram getter próprio aceito e getter herdado executado;
  revisão independente não encontrou defeito material em objetos comuns/JSON.
  Proxy pode executar código durante introspecção; não há demonstração de impacto
  HTTP. O serviço transacional de reconfirmação e suas provas continuam pendentes.
- Incremento seguinte: `ServicoReconfirmacaoRestricao` registra apenas a
  atestações globais de `pendencia_mantida` e `alteracao_informada`, com concessão clínica e carteira,
  avaliação e revisão existentes, cifra, auditoria transacional e chave idempotente;
  não renova a avaliação. Após revisão apontar risco de ausência indevidamente
  válida, uma avaliação confirmada é invalidada para `nao_informado`, com CAS,
  histórico e auditoria na mesma transação; restrições são preservadas. Sem provider,
  rota ou flag. Testes com mocks
  e typecheck passaram; revisão R4 estática não demonstrou vazamento. Provas
  PostgreSQL adicionadas para grant ausente, idempotência concorrente, carteira e
  tenant, rollback de auditoria e ausência de escrita em falha de cifra, mas ainda
  não executadas localmente. Prova de lock da chave entre pacientes distintos usa
  barreira explícita; outra prova aguarda duas chamadas do serviço em pacientes
  distintos, usando conexão pg separada porque o pool runtime tem duas conexões.
  A entidade de reconfirmação foi registrada no DataSource sintético. As provas
  aguardam execução no CI; revisão estática não substitui PostgreSQL.
  O Backend CI `43610602804` do HEAD `5fdd0b74` passou (5.124 PASS, 181 SKIPPED,
  2 TODO na suíte geral; PostgreSQL/Testcontainers 271 PASS, grupos sobrepostos),
  antes desta invalidação e da alteração informada. Faltam provas PostgreSQL do
  novo comportamento, reconfirmações individuais, demais resultados, criação/renovação da
  avaliação, concorrência com escrita da avaliação, HTTP e CI do commit final.
- Renovação global `sem_alteracao` em preparação: exige avaliação
  confirmada e consistente, sem pendências clínicas vigentes; inclui `ativa` e
  `em_reavaliacao`, usa codec paginado para distinguir preferências e falha
  fechado se cifra ilegível. Prazo de 180 dias, revisão, atestação e auditoria
  transacionais. Serviço exige `READ COMMITTED`; outros isolamentos são recusados.
  Provas de banco preparam interleaving real nas duas ordens, verificando PID do
  bloqueador, rejeição de `REPEATABLE READ`/`SERIALIZABLE`, rollback na segunda
  auditoria, preferência e cifra ilegível. Local: 130 testes focados, typecheck,
  auditoria e scanner PASS; revisão estática R4 apontou e levou à correção do caso
  de `em_reavaliacao` e preferências. Não há prova local de PostgreSQL: essas
  provas exigem CI descartável do HEAD resultante. Mantém-se sem rota/provider.
- Backend CI `43611253404` do HEAD `23ffabe6`: 5.133 PASS, 181 SKIPPED, 2 TODO
  na suíte geral e 271 PASS na etapa RLS/Testcontainers (grupos sobrepostos).
  A renovação `sem_alteracao` e as novas provas não estão nesse HEAD.
- Backend CI `43612814094` do HEAD `38f00045`: 5.145 PASS, 181 SKIPPED, 2 TODO
  na suíte geral e RLS/Testcontainers 271 PASS (grupos sobrepostos), incluindo
  renovação e provas de concorrência. Depois foi acrescentada localmente comparação
  da revisão histórica e estado atual, inclusive `vence_em` no PostgreSQL sem
  perder microssegundos, com provas sintéticas específicas aguardando novo CI.
- Avaliação inicial em preparação: `garantirAvaliacaoInicial` exige concessão e
  carteira clínica, lock de paciente e READ COMMITTED; cria apenas `nao_informado`
  com revisão 1 e auditoria ou reusa estado com histórico consistente. Revisão
  R4 estática não encontrou bypass reproduzível; provas PG de criação concorrente,
  rollback, outro tenant/carteira, histórico divergente e isolamento foram
  adicionadas e ainda aguardam CI. Não há provider, rota, flag ou declaração de
  ausência; autorização profissional sem concessão continua negada neste método.
- CI `43613350758`, HEAD `ab7f611f`: workflow OctaClin CI PASS (Backend, Web,
  RLS, smoke e PR Gate); backend 5.147 PASS, 181 SKIPPED e 2 TODO na suíte geral,
  RLS/Testcontainers 271 PASS (grupos sobrepostos). Essa evidência antecede a
  avaliação inicial. Seus testes atuais de espera usam prazos, mas timeout JS não
  cancela operação subjacente; falhas de rede ainda exigem diagnóstico no CI.
- Backend CI `43658631328`, HEAD `87f0ede0`: 5.151 PASS, 181 SKIPPED, 2 TODO
  na suíte geral e RLS/Testcontainers 271 PASS (grupos sobrepostos), incluindo
  avaliação inicial; Web ainda executava ao registrar este resultado.
- Declaração global `sem_restricoes_declaradas` em preparação: exige atestação e
  confirmação explícitas; impede ausência se houver restrição clínica ou escolha
  ativa/em reavaliação pendente ou confirmada, descarta preferências pelo codec e
  falha fechado em cifra ilegível. Usa o mesmo lock, revisão, histórico, prazo,
  isolamento e auditoria da renovação. Revisão R4 estática não demonstrou falsa
  ausência, mas isso não equivale à prova de banco. Provas PG novas cobrem oito
  combinações clínicas, preferência, paginação, rollback e duas ordens da corrida
  ausência × pendência; aguardam CI. A funcionalidade segue sem rota/flag/provider.
- Backend CI `43659962354`, HEAD `4ca8c86e`: 5.154 PASS, 181 SKIPPED e 2 TODO
  na suíte geral; RLS/Testcontainers 271 PASS (grupos sobrepostos). A falha do
  HEAD `ee7269f6` foi causada por inferência incompatível de parâmetros SQL na
  fixture e corrigida no HEAD seguinte. O workflow geral ainda executava ao anotar.
- Reconfirmação individual `sem_alteracao` em preparação: somente restrição
  confirmada e vigente (`ativa` ou `em_reavaliacao`), revisão da avaliação e da
  restrição correntes, conteúdo atual e histórico decifrados e coerentes; não
  renova a avaliação. Replay reautoriza e devolve ACK histórico com escopo e
  revisões, não estado atual. Revisão R4 estática não identificou bypass; provas
  PG de tenant/carteira, conteúdo inválido, rollback, revogação e corrida com
  inativação nas duas ordens aguardam CI. Outros resultados/estados individuais
  não foram implementados e não devem ser considerados liberados pelo contrato.
- Backend CI `43660537270`, HEAD `e6148143`: 5.164 PASS, 181 SKIPPED e 2 TODO
  na suíte geral; RLS/Testcontainers 271 PASS (grupos sobrepostos), incluindo
  reconfirmação individual `sem_alteracao`. Web ainda executava nesta anotação.
- Ampliação individual em preparação: `pendencia_mantida` e `alteracao_informada`
  aceitam restrição clínica/escolha vigente pendente ou confirmada; exigem revisão
  e snapshot coerentes e invalidam avaliação confirmada sem alterar a restrição.
  Invalidação é interpretação conservadora de segurança, não regra expressa de
  produto. A matriz PG cobre 8 combinações e corrida com inativação nas duas ordens
  para os três resultados; revisão R4 estática não encontrou defeito concreto, mas
  PostgreSQL ainda aguarda CI. `sem_alteracao` segue exigindo confirmada vigente.
- A revisão também identificou possível contradição entre linha vigente e evento
  histórico terminal. O serviço agora recusa evento `inativacao` ou `rejeicao`,
  e evento `confirmacao` com linha pendente, sem presumir transições de edição ou
  reavaliação. Essa checagem não comprova toda a cadeia histórica. Provas PG de
  eventos contraditórios e controles de edição/reavaliação foram adicionadas e
  aguardam execução; os controles usam criação pendente rev1, confirmação real rev2
  e edição/reavaliação simulada rev3. ACK de replay continua histórico, não estado
  vigente. 160 testes focados, typecheck, auditoria 24/24 e scanner locais PASS.
