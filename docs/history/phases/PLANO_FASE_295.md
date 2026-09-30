# Fase 295 — resposta segura do paciente com SLA

## Objetivo e decisões aprovadas

Entregar resposta bidirecional no portal autenticado do paciente e uma fila interna para a equipe. O canal é exclusivamente o portal seguro. Cada novo texto do paciente inicia um prazo de resposta configurável por clínica; o padrão é 24 horas corridas e o intervalo permitido é de 1 a 168 horas. A conversa é atribuída ao profissional responsável pelo paciente. Profissionais e colaboradores autorizados da clínica acompanham a fila; mensagens vencidas ficam destacadas em Comunicações sem qualquer envio externo automático.

- O paciente autenticado só acessa a conversa associada ao próprio usuário e tenant, resolvida pelo servidor. IDs recebidos do browser nunca determinam tenant nem titular.
- Um paciente tem uma conversa persistente por tenant. Resposta do paciente muda o estado para `aguardando_clinica` e grava um vencimento imutável para aquele ciclo; resposta da clínica muda para `aguardando_paciente` e remove o vencimento pendente. Uma nova resposta do paciente abre novo ciclo. A equipe pode encerrar; mensagem posterior reabre a conversa.
- Alterar o SLA da clínica afeta mensagens futuras; prazos já calculados permanecem iguais.
- Conteúdo é texto simples, limitado a 5.000 caracteres e cifrado em repouso. Cada paciente pode enviar até cinco mensagens em uma janela móvel de dez minutos; o sexto envio recebe HTTP 429 com orientação para aguardar. A contagem ocorre dentro da transação após bloquear o paciente, protegendo contra concorrência entre instâncias. Não há anexos, WhatsApp, e-mail, automação de resposta ou decisão clínica por IA.
- Respostas clínicas são prontuário/conteúdo clínico e seguem retenção equivalente a 20 anos; exportação LGPD do paciente inclui as mensagens da conversa.

## Skills e risco

Modelo anunciado: **GPT-6 Sol, esforço alto**. Skills aplicadas: planejamento e decomposição, TDD, NestJS, TypeORM/PostgreSQL, segurança e privacidade, JWT, React/Next.js e encerramento/reconciliação de fase. Revisão independente de segurança será solicitada quando viável.

Classificação **R4**: PHI, autenticação/autorização, isolamento por tenant, criptografia, RLS e migration. Sem ação em staging ou produção nesta fase. Migration é aditiva e pode ser revertida somente enquanto não houver conversas; após persistência de dados clínicos, rollback de código deve manter as tabelas e os registros até procedimento autorizado de retenção/eliminação.

## Arquitetura e fatias

1. **Contrato de SLA da clínica**
   - Acrescentar `slaRespostaPacienteHoras` a `tenant_configuracoes.conta_cliente`, default 24, validação inteira 1–168, leitura na tela de configurações e atualização via APIs existentes.
   - Campo opcional no PATCH para compatibilidade com clientes antigos; ao omiti-lo, preservar o valor atualmente salvo. Nunca substituir inadvertidamente por 24.
   - Não armazenar conteúdo de mensagem nas configurações, auditoria ou telemetria.

2. **Persistência tenant-safe**
   - Criar migration TypeORM incremental após a última migration confirmada no branch. Tabelas separadas de conversa e mensagem: conversa única por tenant/paciente, profissional responsável, estado, timestamps de atividade e SLA pendente; mensagens com autor/tipo, conteúdo cifrado e data.
   - `tenant_id` em todas as linhas, chaves estrangeiras compostas que impeçam associação cruzada, unicidade por conversa/paciente e índices para fila por estado, responsável, atividade e vencimento.
   - `ENABLE` e `FORCE ROW LEVEL SECURITY`; política vinculada ao contexto tenant definido pelo servidor. Registrar entidades no TypeORM e no inventário/registro de migrations. Não modificar role runtime nem executar DDL fora de CI/banco descartável.

3. **Domínio e API**
   - Portal do paciente: obter histórico paginado/limitado e enviar texto, identificando o paciente somente pelo `tenantId` e `usuarioId` autenticados.
   - Equipe: listar fila com filtros de estado/atraso e paginação, ler conversa e responder/encerrar. Exigir `comunicacoes.mensagens.ler` e `.enviar` além do escopo de paciente; restringir profissional ao seu escopo existente e colaborador a pacientes autorizados.
   - Revalidar tenant, vínculo paciente/usuário, estado e responsável dentro da transação. DTO estrito, texto não vazio após trim, tamanho máximo de 5.000 caracteres e limite de cinco mensagens por paciente em janela móvel de dez minutos. A contagem usa a trava por paciente existente, é tenant-aware e funciona entre instâncias; rejeição HTTP 429 sem gravar mensagem.
   - Resposta do paciente recalcula `prazo_resposta_em = agora + SLA vigente` na mesma transação que grava a mensagem e atualiza conversa. Resposta da equipe encerra o ciclo pendente. Retorno da equipe não inicia mensagem externa nem entrega por canal externo.
   - A fila classifica atraso comparando o prazo armazenado com relógio do servidor. A data de vencimento é em horas corridas; fuso clínico serve apenas para apresentação.

4. **Interface**
   - Portal: substituir o bloco somente leitura de mensagens recentes por uma conversa segura com histórico, composer, estados de envio/erro e indicação factual de que a resposta aguarda a equipe.
   - Comunicações: adicionar filtro/fila de respostas do portal, badge de atrasadas, responsável e prazo, leitura e resposta/encerramento sem expor a conversa em superfícies sem permissão. Garantir layout responsivo e acessibilidade por teclado.
   - Configurações da clínica: seletor/entrada de horas com default 24, limites claros e feedback de validação. A tela deve preservar configurações já existentes.

5. **Privacidade e ciclo de vida**
   - Cifrar conteúdo com `CriptografiaDadosSensiveis`; descriptografar apenas no serviço autorizado que forma DTOs mínimos. Nunca registrar corpo em logs, auditoria, erros, métricas, notificações ou outbox. Auditoria guarda ação, IDs opacos e resultado mínimo.
   - Incluir mensagens e conversa na exportação LGPD, no escopo do titular autenticado.
   - Integrar o conteúdo com a política clínica de retenção existente (20 anos) e com a decisão de eliminação LGPD: incluir a data da última mensagem clínica no cálculo de guarda; durante `RETENTION_HELD`, preservar mensagens; quando o pedido puder ser concluído sem guarda vigente, excluir conversa e mensagens no mesmo fluxo transacional antes de gravar o tombstone. Sem cascade silencioso de histórico clínico.
   - Não criar nova categoria de retenção com base jurídica presumida; documentar que a classificação como prontuário herda a política clínica vigente e requer validação jurídica se o enquadramento mudar.

## Revisão de gaps antes da execução e mitigação

1. **Armazenar mensagens em `mensagens_notificacao` confundiria prontuário com transporte**, além de acoplar o ciclo de conversa a entregas externas. Mitigação: tabelas próprias de conversa e mensagens, sem despacho para adaptadores.
2. **Vazamento por texto em auditoria/logs/erros ou DTO ORM cru.** Mitigação: cifragem em repouso, DTO explícito, auditoria sem texto e teste que assegure ausência de texto em chamadas de auditoria/log.
3. **IDOR entre pacientes/tenants na API interna ou do portal.** Mitigação: derivar identidade do JWT, validar escopo no servidor em cada consulta e usar FKs compostas/RLS; testes negativos com IDs de outro paciente e tenant e teste PostgreSQL de RLS real.
4. **Corrida entre duas mensagens, resposta simultânea e vencimento.** Mitigação: transação com lock da conversa/ordenação determinística; estado e prazo atualizados junto à mensagem. Testar duplo envio, nova mensagem do paciente e resposta concorrente.
5. **Mudança de SLA poderia reescrever prazo já comunicado.** Mitigação: persistir vencimento calculado em cada novo ciclo; atualização de configuração vale apenas para novos ciclos.
6. **Clientes web antigos enviam PATCH sem o campo novo.** Mitigação: campo opcional e merge seguro com configuração anterior; testar preservar valor customizado.
7. **Histórico pode ficar fora de exportação LGPD, retenção ou exclusão.** Mitigação: exportação explícita e testes; incluir em inventário de retenção clínica; estender o cálculo de último registro clínico com as mensagens; preservar sob `RETENTION_HELD`; excluir conversa e mensagens somente no caminho que conclui a eliminação imediata; testar os dois caminhos e tombstone.
8. **Alerta de atraso poderia enviar contato externo ou depender de cron instável.** Mitigação: consulta determinística da fila em cada acesso e destaque interno após o horário limite; sem canal externo, sem cron e sem alteração em provider.
9. **Abuso de texto livre, flood, XSS e custo de fila.** Mitigação: texto simples sem HTML, limite de tamanho, validação server-side, paginação/limite de frequência, renderização escapada e sem busca textual em conteúdo cifrado.
10. **Migration irreversível após dados reais.** Mitigação: migration aditiva, `down` protegido para recusar remoção quando houver linhas, sem execução em produção nesta tarefa e procedimento de rollback por desativação de rotas mantendo dados.
11. **Atribuição não deve ampliar acesso de colaboradores nem de profissionais.** Mitigação: reusar permissões e resolução de escopo existente; testar profissional fora do escopo, colaborador sem permissão e profissional responsável após mudança de responsável.
12. **Estado atual da documentação está desatualizado após o PR #348.** Mitigação: no mesmo PR da feature reconciliar auditoria completa (especialmente seção 15 e ordem da seção 16), checklist, status atual, matriz de confiabilidade e histórico da Fase 294; não declarar deploy, migração externa ou uso operacional sem evidência direta.
13. **RLS sozinha não impede um vínculo de tenant inconsistente gravado por outro caminho de escrita.** Mitigação: FKs compostas `(tenant_id, registro_id)` entre conversa, paciente, profissional, usuário e mensagem; o `down` desliga filtragem por RLS de modo fail-closed para contar o histórico e aborta se a role não conseguir uma contagem completa.
14. **O limite de tamanho sozinho não evita flood nem mensagens da equipe invisíveis fora da fila inicial.** Mitigação: cinco mensagens por paciente em janela móvel de dez minutos, contadas sob lock transacional, e fila paginada de 100 conversas com filtros server-side para aguardando clínica, aguardando paciente, encerradas, todas e atraso (este último apenas para aguardando clínica).

## Plano de execução e testes

1. Criar testes de domínio/serviço primeiro para SLA default/limites/compatibilidade, autorização e isolamento, transições de estado, prazo corrido, criptografia, paginação, exportação LGPD e eliminação.
2. Implementar migration/entidades e teste de contrato SQL; validar migration contra PostgreSQL descartável e provar RLS sob roles/contexto apropriados no gate disponível.
3. Implementar configuração, serviço e controllers separados para paciente e equipe; testes positivos e negativos com tenant e escopo diferentes.
4. Integrar BFF e UI do paciente, fila de Comunicações e painel de configuração; testes de componente/Playwright nos fluxos principais e falhas de API.
5. Fechar retenção, exportação, eliminação e auditoria; repetir testes focados.
6. Revisar diff, executar gates proporcionais, `git diff --check` e `pnpm security:secrets`; reconciliar documentação na mesma branch; abrir um único PR da Fase 295.

## Definition of Done

- Paciente envia e lê apenas sua conversa; equipe autorizada lê/responde apenas dentro do escopo permitido.
- SLA 24h default e 1–168h validado, configurável por clínica e compatível com PATCH antigo; vencimento corre em horas e novos ciclos usam configuração corrente.
- Limite de cinco mensagens por paciente em janela móvel de dez minutos retorna 429 sem persistir o envio excedente; fila da equipe permite filtrar os quatro estados, aplicar atraso apenas às respostas pendentes da clínica e carregar todas as páginas de até 100 itens.
- Atraso visível na fila interna, sem envio externo.
- Conteúdo cifrado, fora de logs/auditoria/outbox e DTO ORM cru; exportação, retenção e exclusão cobertas.
- Pedido LGPD preserva a conversa se houver guarda clínica vigente e remove o histórico no mesmo fluxo transacional quando a eliminação for permitida.
- Migration incremental com RLS forçada, testes positivos/negativos e validação PostgreSQL aplicável.
- Documentos reconciliados com a evidência atual de PR #348; PR único, branch dedicada, sem deploy nem DDL fora de ambiente de teste explicitamente descartável.

## Gates e rollback

Gates planejados: specs focados de backend e web, typecheck/build relevantes, lint, testes de migration/RLS, testes de interface, `pnpm security:secrets`, `git diff --check` e CI do PR. Cada resultado será rotulado PASS/FAIL/NA/SKIPPED com motivo. O primeiro CI do PR #349 encontrou falhas visuais; revisão externa ainda não ocorreu.

## Evidência local antes do PR — 2026-09-30

- PASS: typecheck backend e web com Node 22.23.3.
- PASS: builds de produção backend (`dist/main.js` validado) e web (Next.js compilou e gerou 160 páginas).
- Nota dos builds: Next.js emitiu avisos de uso de API Node na dependência Edge Runtime e depreciação da convenção `middleware`; sem erros de build.
- PASS: Jest focado — 6 suites passaram, 181 testes passaram; uma suite de integração PostgreSQL/RLS e 16 testes ficaram `SKIPPED` por indisponibilidade do banco descartável local. Isso não comprova RLS real; o gate PostgreSQL do CI continua obrigatório.
- PASS: Playwright de Comunicações/acessibilidade — 13 testes passaram; fluxo visual do portal do paciente enviando mensagem — 1 teste passou.
- PASS: teste estático de política fora de banda — 13 testes passaram; nenhuma migration foi executada contra banco.
- PASS: lint direcionado sem erros. Permaneceram quatro avisos de hooks/variável não usada em telas existentes; o carregamento da conversa não adiciona aviso novo de atualização síncrona de estado no effect.
- PASS: `pnpm security:secrets` e `git diff --check`.
- SKIPPED: integração PostgreSQL/RLS local por falta de harness descartável; CI deve executar a prova real antes do merge.
- PENDENTE: revisão cruzada independente R4 e CI do PR. Sem deploy, DDL, migration de provider ou verificação operacional externa.

## Correção do smoke visual no PR #349 — 2026-09-30

- FAIL observado no primeiro CI: `Demo local smoke` teve dez falhas visuais em desktop/mobile; `PR Gate` falhou em consequência. Backend NestJS e Web Next.js passaram. Os testes focados anteriores não cobriam todos os mocks e viewports do smoke completo.
- Causa: teste do portal usava o título anterior; mock de configurações omitira `slaRespostaPacienteHoras`, deixando o campo obrigatório vazio; mock de reflow devolvia `[]` para a nova fila, provocando erro de renderização. Com contrato correto, o teste também revelou que o botão de atualização ultrapassava o viewport de 320 px a zoom 400%.
- Correção: atualizar os mocks e a asserção, validar o formato da resposta da fila antes de alterar o estado da tela e permitir quebra de linha dos controles. Resposta inválida agora mostra erro local na fila sem derrubar Comunicações.
- PASS local após a correção: 12 testes Playwright focados em desktop/mobile, incluindo os dez cenários que falharam e a regressão para resposta inválida; typecheck e lint direcionado sem erros.
- PENDENTE: nova rodada de CI do PR #349, prova PostgreSQL/RLS no CI e revisão cruzada R4. A execução local não substitui o resultado do smoke remoto.

## Correção de linguagem após o segundo CI — 2026-09-30

- FAIL observado no segundo CI: `Demo local smoke` parou em Linguagem e microcopy por três ocorrências de “Status” no novo filtro de respostas do portal e no seletor Playwright; `PR Gate` falhou em consequência. Backend NestJS e Web Next.js passaram.
- Correção: “Situação” na interface e no seletor do teste, sem alterar o valor técnico do filtro.
- PASS local: `pnpm --dir octaclin-web test:linguagem` (8 testes internos e varredura sem inconsistências) e o cenário Playwright de Comunicações que usa o seletor novo (1 teste).
- PENDENTE: nova rodada do CI no PR #349, inclusive o smoke completo, e revisão cruzada R4.

Rollback antes de persistir conversa: reverter migration e código em conjunto. Depois de persistir mensagens: desligar temporariamente as rotas/UI e manter tabelas/cifras para preservação clínica; não remover dados via `down`. Reversão definitiva exige plano de retenção/eliminações aprovado e autorizado para o ambiente alvo.
