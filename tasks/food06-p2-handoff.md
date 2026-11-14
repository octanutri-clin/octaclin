# FOOD06 P2 — preparação e handoff

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
  atestação global de `pendencia_mantida`, com concessão clínica e carteira,
  avaliação e revisão existentes, cifra, auditoria transacional e chave idempotente;
  não altera nem renova a avaliação. Sem provider, rota ou flag. Testes com mocks
  e typecheck passaram; revisão R4 estática não demonstrou vazamento. Provas
  PostgreSQL adicionadas para grant ausente, idempotência concorrente, carteira e
  tenant, rollback de auditoria e ausência de escrita em falha de cifra, mas ainda
  não executadas localmente. Prova de lock da chave entre pacientes distintos usa
  barreira explícita; outra prova aguarda duas chamadas do serviço em pacientes
  distintos, usando conexão pg separada porque o pool runtime tem duas conexões.
  A entidade de reconfirmação foi registrada no DataSource sintético. As provas
  aguardam execução no CI; revisão estática não substitui PostgreSQL.
  Faltam reconfirmações individuais, demais resultados, criação/renovação da
  avaliação, concorrência com escrita da avaliação, HTTP e CI do commit final.
