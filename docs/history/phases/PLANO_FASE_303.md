# Fase 303 — integrações para profissionais autorizados

## Objetivo e risco

Permitir que um profissional da clínica gerencie chaves de API e webhooks do
próprio tenant depois de receber autorização explícita do gestor `Client`.
Gestão de credenciais, autorização e isolamento entre tenants são superfícies
R4. A API pública `/v1`, os escopos das chaves e os payloads de webhook mantêm
seus contratos atuais.

## Decisões de produto

- O gestor da clínica concede e revoga diretamente o acesso na área Equipe; não
  haverá fila de solicitações nesta fase.
- O gestor define a lista exata de escopos API permitidos e a lista exata de
  eventos de webhook permitidos para cada profissional. Cada lista pode ser
  concedida ou revogada independentemente.
- O profissional só pode criar credenciais com escopos/eventos concedidos e só
  pode listar, rotacionar ou revogar credenciais próprias cujos conjuntos
  estejam integralmente contidos na concessão atual. Entregas são filtradas
  pelos eventos concedidos. `Client` mantém a gestão de todo o tenant.
- Chaves profissionais usam a carteira atual do titular para a API pública;
  assinaturas profissionais só recebem eventos de pacientes dessa carteira.
- Concessões são versionadas. Reduzir uma lista não apaga chaves ou assinaturas,
  mas interrompe o uso das credenciais profissionais que excedam a concessão
  atual. A restauração da concessão pode permitir novo uso; revogação
  definitiva da credencial é uma ação separada do gestor.
- Só profissionais ativos do mesmo tenant podem receber essas autorizações.
- Cada operação autorizada revalida que o usuário continua ativo e com papel
  `Professional`; uma sessão ou concessão velha não basta.
- `Client` mantém o acesso atual à gestão completa via
  `cliente.configuracoes.gerenciar`; nenhum profissional recebe o papel `Client`
  nem permissões de administração da conta.
- Permissões concedidas não entram em claims de sessão nem são armazenadas em
  cookie. O backend consulta a concessão ativa em cada operação para que a
  revogação tenha efeito imediato, inclusive sem novo login.

## Estado atual observado e gaps

1. `ControladorGestaoIntegracoes` aceita apenas `Client` e exige
   `cliente.configuracoes.gerenciar`; não há rota de gestão para profissionais.
2. `permissoes.ts` deriva permissões fixas do papel e o JWT replica essa matriz.
   Acrescentar uma permissão ao papel `Professional` isoladamente daria acesso a
   toda a categoria e não permitiria concessão individual nem revogação
   imediata.
3. Chaves, webhooks e entregas são recursos de tenant inteiro com RLS. Autorizar
   acesso individual sem também restringir a consulta por tenant abriria risco
   cross-tenant; restringir apenas no BFF seria insuficiente.
4. A UI e o BFF atuais existem somente em `/cliente/integracoes` e exigem a
   permissão estática do cliente. O profissional precisa de uma superfície
   autenticada própria, mas o BFF não será fonte de autorização da concessão.
5. Operações de criação, rotação, revogação e reprocessamento já geram auditoria
   operacional. Novas concessões/revogações precisam identificar gestor, usuário
   alvo e capacidade, sem registrar segredo, URL assinada ou corpo de evento.
6. O destino do webhook é validado com resolução DNS. Um profissional sem
   autorização não pode acionar essa validação antes de ser negado.
7. `listarEntregas` retorna a entidade ORM sem projeção, incluindo `payload`,
   `tenantId`, identificadores internos e texto `ultimoErro` vindo do receptor.
   Isso amplia a exposição ao abrir a mesma gestão para profissionais.
8. A mudança de papel/desativação já revoga sessões, mas não encerra concessões
   novas. Uma concessão antiga não pode voltar a valer caso a conta seja
   posteriormente reativada ou volte ao papel `Professional`.
9. A API pública transforma toda chave em contexto `Client`, e webhooks fazem
   fan-out para o tenant inteiro. Só limitar quem gerencia credenciais deixaria
   um profissional acessar outros pacientes. Identidade da credencial, consultas
   por referência externa, agenda e fila de entregas exigem escopo de carteira.

## Desenho e escopo de implementação

### Persistência e domínio

- Adicionar entidade e migration 1063 para concessões por tenant e profissional,
  com conjuntos permitidos de escopos API ou eventos webhook, registrando quem
  concedeu, quando e quem revogou/quando.
- Manter histórico append-oriented: revogação ou substituição encerra a
  concessão; nova autorização cria novo registro. Índice único parcial impede
  duas concessões ativas do mesmo domínio para profissional/tenant.
- Conjunto vazio revoga o domínio correspondente. Ao reduzir uma lista, encerrar
  a concessão anterior e criar a versão seguinte na mesma transação; conjunto
  idêntico é idempotente.
- Usar FK composta para tenant e usuários alvo/gestor; checar que o alvo tem
  papel `Professional` e está ativo antes de conceder.
- Ao desativar o usuário ou mudar seu papel para fora de `Professional`, encerrar
  as concessões ativas e revogar suas chaves/desativar suas assinaturas na mesma
  transação, registrando o motivo; mudança futura de volta para `Professional`
  exige nova aprovação e credenciais novas.
- Ativar e forçar RLS com política por `app.tenant_id`; consultas e mutações
  usam `ExecutorTenant`. A migration é aditiva e não será executada contra
  staging ou produção neste trabalho. O `down` preserva concessões após uso;
  rollback de aplicação é por versão anterior/forward fix.

### Autorização e backend

- Preservar as rotas e permissões existentes para `Client`.
- Expor rotas profissionais dedicadas para leitura/criação/rotação/revogação de
  chaves e leitura/gestão de webhooks/entregas.
- Exigir papel `Professional` mais concessão ativa apropriada no backend. A
  identidade e o tenant vêm do JWT validado; body, query e headers não escolhem
  tenant.
- Vincular de forma imutável cada chave ou assinatura profissional ao usuário
  titular. No uso da chave, revalidar usuário e escopos concedidos, executar
  como `Professional` e filtrar pacientes e consultas pela carteira atual.
  Referências externas reutilizadas não podem revelar paciente/consulta fora
  da carteira. O gestor conserva suas credenciais de tenant inteiro.
- Para assinatura profissional, conferir concessão ativa e responsabilidade
  atual pelo paciente ao criar a entrega e imediatamente antes do envio
  externo. Sem paciente identificável ou sem vínculo, não enviar.
- Validar a concessão antes de qualquer validação de destino com efeitos de
  rede e revalidá-la dentro da transação tenant-aware da operação. A leitura
  bloqueante da concessão e a mutação administrativa devem serializar
  revogação concorrente com operação em andamento.
- Adicionar rotas do gestor para listar profissionais elegíveis e conceder ou
  revogar capacidades. Somente gestor com `Client` e
  `cliente.configuracoes.gerenciar` pode administrá-las.
- Respostas continuam sendo DTOs mínimos: nunca expor hash da chave, segredo
  cifrado, material integral após a criação, payload interno ou entidade ORM.
- Projetar também as entregas existentes para DTO allowlist e não devolver texto
  bruto de erro do receptor; conservar apenas status HTTP e dados operacionais
  necessários à ação de reprocessar.
- Auditar concessão, revogação e gestão de credenciais com IDs opacos e
  capacidade. Gravações da concessão/revogação e suas linhas de auditoria devem
  ser atômicas na mesma transação; a trilha segue redação e retentativa
  existentes. Não registrar segredo, token, URL temporária ou PHI.

### BFF e interface

- Criar BFF profissional autenticado que encaminha somente rotas allowlist ao
  backend. Ele exige sessão; a decisão final de capacidade permanece no NestJS.
- Respostas BFF/servidor com dados de gestão de integração usam
  `Cache-Control: private, no-store`.
- Reutilizar o componente e os tipos de gestão atuais onde possível; incluir a
  superfície no console profissional e manter a área de Equipe do portal do
  cliente como controle de concessão/revogação.
- Mostrar as capacidades separadamente, estado atual, autor e data da concessão,
  e confirmação clara antes de revogar. A tela profissional explica quando o
  gestor ainda não concedeu acesso.
- Preservar segredo de chave/webhook em memória apenas para a apresentação única;
  não persistir em `localStorage`, URL, telemetria ou logs.
- Cobrir estados de carregamento, vazio, erro, sucesso, foco e acessibilidade;
  não alterar o design geral dos portais.

### Documentação

- Atualizar `API_PUBLICA_V1.md` para descrever os dois canais de autorização,
  grants por tenant e escopo efetivo, sem alterar endpoints `/v1`.
- Atualizar esta matriz de plano, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`,
  `STATUS_ATUAL_PROJETO.md`, `RESUMO_FASES_CONCLUIDAS.md` e a matriz de
  confiabilidade junto da implementação; marcar Fase 303 concluída no código
  somente após merge confirmado e manter operação externa separada.
- Avançar a sequência para Fase 304, sem criar PR documental separado.

## Plano de execução e aceite

1. Adicionar testes falhando para matriz do domínio, capacidade desconhecida,
   papel/alvo não elegível, escopos fora do grant, ausência/revogação,
   redução de escopos, recursos incompatíveis e acesso a tenant alheio.
2. Implementar migration, entidade, política RLS, índices/FKs e registro no
   `opcoes-typeorm.ts`; provar registro e contratos da migration.
3. Implementar serviço de concessão/revogação administrativa com autorização,
   validação de alvo, idempotência/conflict e auditoria sanitizada.
4. Implementar autorização profissional e rotas dedicadas cobrindo cada
   capacidade nos serviços, incluindo rechecagem transacional e negativa antes
   da validação DNS.
5. Adicionar BFF e UI do gestor/profissional; confirmar que clientes continuam
   usando o fluxo atual e profissionais sem grant recebem negação segura.
6. Adicionar testes de integração PostgreSQL/RLS para tenant A/B, grants,
   revogação, mudança de papel/desativação e recursos de integração; usar banco de teste descartável e dados
   sintéticos. Se a infraestrutura PostgreSQL não estiver disponível, marcar
   esse gate `SKIPPED` e manter a prova CI correspondente pendente.
7. Executar suites focadas, typecheck, lint, build web/backend quando
   aplicável, `git diff --check`, `pnpm security:secrets` e preflight
   proporcional; revisar diff e dependências.
8. Abrir PR com código e reconciliação documental na mesma branch. Não aplicar
   migration externamente nem declarar staging/produção validado.

## Revisão de gaps do plano

- **Revogação e sessões já abertas:** resolvido consultando a concessão no
  backend por operação, sem depender da expiração do JWT/cookie.
- **Revogação concorrente com mutação:** resolvido com autorização revalidada e
  bloqueada na mesma transação da operação; revogação aguarda ou precede a
  operação, sem janela entre check e uso.
- **Escopo residual do `Client`:** mantido inalterado; a nova concessão só
  alcança profissional ativo do mesmo tenant e o conjunto de escopos/eventos
  aprovado para cada domínio.
- **Concessão sobrevivendo a mudança de papel/desativação:** resolvido
  encerrando concessões e credenciais profissionais na transação de mudança de
  acesso. Nova aprovação não ressuscita segredos antigos.
- **Privilégio excessivo por domínio ou escopo:** resolvido com conjuntos
  autorizados independentes; a concessão precisa cobrir por inteiro os escopos
  de uma chave ou os eventos de uma assinatura para permitir sua gestão.
- **Validação de URL como efeito antes de auth:** resolvido por precheck de
  autorização no backend antes do DNS e rechecagem transacional antes de gravar.
- **BFF como falsa fronteira de segurança:** resolvido mantendo allowlist e
  sessão no BFF, com autorização autoritativa e tenant derivados no backend.
- **RLS e integridade relacional:** cobertos por RLS forçada, FK composta,
  índice parcial e integração PostgreSQL; teste unitário sozinho não será
  apresentado como prova de RLS.
- **Conta ativa ou papel mudou depois da concessão:** resolvido com validação
  do usuário no uso e revogação transacional das concessões e credenciais
  profissionais ao mudar papel ou desativar conta.
- **Segredos e trilha:** cobertos por retorno de segredo uma única vez, DTOs
  existentes, auditoria sanitizada e testes de ausência de material secreto.
- **Entrega de webhook retornada como entidade ORM:** resolvido por DTO
  allowlist para clientes e profissionais, sem payload, tenant ou erro bruto do
  endpoint receptor.
- **Auditoria parcialmente desacoplada da concessão:** resolvido gravando evento
  de concessão/revogação na mesma transação da autorização e preservando o
  retry/outbox de auditoria definido pelo projeto.
- **Cache acidental de dados de integração:** resolvido com `private, no-store`
  nas rotas profissionais e no BFF.
- **Credencial profissional após redução de concessão:** a chave é negada e a
  entrega profissional não é enviada quando o conjunto ou a carteira deixam
  de ser permitidos. O registro permanece para auditoria e pode ser revogado
  definitivamente pelo gestor.
- **Idempotência e dados de outra carteira:** consultas e pacientes encontrados
  por referência externa são autorizados antes do retorno; criação e
  cancelamento de consulta verificam a responsabilidade atual pelo paciente.
- **Entrega pendente após transferência ou revogação:** a fila revalida
  responsabilidade e evento concedido antes da conexão externa; entrega sem
  autorização passa a falha sem envio.
- **Migrations/rollback:** migration 1063 registrada e aditiva, aplicada fora de
  banda pelo operador após confirmar alvo. Como o novo runtime lê as colunas
  adicionadas em chaves e assinaturas, aplicar e verificar 1063 em cada ambiente
  antes de ativá-lo nesse ambiente. Se o merge disparar deploy automático,
  coordenar a migration antes do merge ou pausar esse deploy.
- **Rollback após emissão de credenciais profissionais:** o runtime anterior
  interpreta chaves profissionais como credenciais de clínica. Antes de voltar
  a ele, revogar todas as chaves vinculadas a profissional e desativar suas
  assinaturas, por tenant, com trilha operacional e confirmação do resultado.
  O processador antigo não envia por assinatura desativada. Preservar colunas
  e histórico; não executar `migration:revert`.
- **Contrato público e payload de webhook:** ficam invariantes; teste de
  regressão verifica endpoint `/v1`, escopos e formato do evento existentes.

## Skills e validações

- Modelo/esforço: GPT-6 Sol High.
- Skills: `planning-and-task-breakdown`, `test-driven-development`,
  `nestjs-best-practices`, `typeorm`, `database-migration`,
  `security-review`, `api-and-interface-design`,
  `vercel-react-best-practices`, `playwright-best-practices` e `fechar-fase`.
- Revisão independente de authz/RLS deve ser solicitada quando viável; se não
  houver outro agente, registrar essa limitação sem chamar auto-revisão de
  independente.
