# FOOD06 P2 — plano de carteira delegada e vínculo do portal

## Decisões do proprietário

Em 2026-11-13, o proprietário escolheu **planejar delegação explícita de
carteira para Collaborator** e **planejar unicidade no banco para vínculo ativo
do paciente com tratamento de duplicatas**. As escolhas autorizam planejamento;
não autorizam aplicar migration, consultar dados reais, sanear duplicatas, ativar
funcionalidade ou efetuar deploy. Na sequência, decidiu que o profissional titular
concede e revoga acesso à carteira inteira e que uma conta pode representar vários
pacientes ativos da mesma clínica. Também decidiu que a equipe da clínica registra
o vínculo de representação e verifica a autorização. Esta nota é proposta técnica,
não schema aplicado.

## Carteira delegada

Propor entidade tenant-scoped que vincule colaborador ativo a profissional ativo,
com concessão e revogação auditáveis, histórico preservado e RLS FORCE. Leituras e
escritas de pendências devem validar, na mesma transação e sob locks, usuário,
delegação vigente e profissional responsável atual do paciente. Colaborador só
lê restrições de sua autoria conforme Q6; delegação não confere confirmação clínica.
O profissional titular administra a delegação de toda a própria carteira.
Ainda exigem definição segura a expiração, o efeito de revogação/troca de carteira
e a experiência de usuário; nenhuma delegação concede confirmação clínica.

Pelo menos: testes positivos, outro tenant, outro profissional/paciente, papel ou
ator inativo, delegação ausente/revogada e revogação/reatribuição concorrente;
auditoria sem conteúdo clínico; ordem global de locks e rollback comprovados.

### Proposta para implementação e implantação

- A delegação identifica tenant, profissional titular, colaborador, autor,
  datas de concessão/revogação e revisão; índices e FKs compostas devem impedir
  concessões ativas repetidas e vínculos entre tenants, sem apagar o histórico.
- O alcance é calculado pela carteira atual sob lock do paciente; não materializar
  uma lista de pacientes no momento da concessão. Revogação, arquivamento, mudança
  de papel e troca de responsável exigem releitura transacional e testes de corrida.
- Conceder e revogar devem verificar o titular ativo no servidor e auditar sem
  conteúdo clínico; o colaborador mantém somente os poderes previstos no contrato.
- Migration aditiva, RLS/FORCE RLS e privilégios mínimos precisam de teste em banco
  descartável. Para rollback, desativar consumidores preservando histórico; qualquer
  remoção de tabela com dados exige procedimento e decisão específicos. Aplicação
  fora de banda somente após confirmar ambiente, branch e role owner autorizada.
- A experiência precisa expor o alcance dinâmico e distinguir sucesso de falha
  de revogação. Nenhuma interface está aprovada ou implementada por este plano.

## Vínculo do paciente no portal

A unicidade de `(tenant_id, usuario_id)` entre pacientes ativos é incompatível
com a decisão de permitir múltiplos representados e não deve ser aplicada.
Planejar identidade única de cada vínculo ativo conta–paciente, modelo explícito
de representação e seleção de paciente, com autorização verificada no servidor
para cada solicitação. Não presumir que vínculo múltiplo é duplicata ou eliminá-lo
automaticamente. Enquanto a seleção e a representação não estiverem protegidas,
os fluxos P2 de paciente permanecem fechados.

### Proposta técnica do vínculo

- Cada concessão identifica tenant, conta representante e paciente específico,
  com unicidade apenas para o mesmo par ativo; pode haver vários pacientes para
  uma conta. As FKs devem vincular todos ao mesmo tenant e o histórico de
  verificação e revogação deve ser preservado.
- A revisão R4 preliminar recomenda entidade separada: não preencher
  `pacientes.usuario_id` de vários representados com a mesma conta para simular
  representação. O portal legado usa `findOne` sem seleção em vários fluxos;
  o fluxo de gestação, por outro lado, nega vínculos ambíguos. Inventariar também
  exportações, notificações e cache antes de permitir acesso pelo portal existente.
  Esta revisão não demonstra vazamento ocorrido nem substitui teste de integração.
- O registro da equipe deve associar o agente que verificou a autorização e o
  instante da verificação; o formato e a retenção de evidências devem respeitar
  as regras já aprovadas. Documentos e identificadores sensíveis não entram em
  logs ou auditoria livre. Não permitir auto-outorga pelo representante; guardar
  eventuais documentos apenas em armazenamento protegido aprovado.
- A requisição seleciona um paciente, mas o servidor resolve o tenant pela
  credencial e comprova, sob transação, a associação ativa daquele par. ID enviado
  pelo cliente é apenas seletor, nunca prova de autorização. Na revogação ou troca
  concorrente, o acesso deve falhar fechado segundo ordem de locks testada; token
  emitido antes da revogação não mantém acesso após ela ser efetivada.
- O modelo de permissão atual dá `pacientes.gerenciar` a Professional e não a
  Collaborator ou Client. O escopo exato de quem verifica deve ser integrado ao
  controle existente, sem transformar a decisão sobre a equipe em privilégio
  implícito para todos os seus papéis; SuperAdmin não ganha acesso clínico apenas
  pela atividade administrativa. Testar outro tenant, outra carteira, vínculo
  revogado ou inexistente, seleção trocada e múltiplos representados.
- Exercitar criação e reativação concorrentes do mesmo par, troca de responsável,
  revogação contra leitura e escrita nas duas ordens, e JWT anterior à revogação.
  Não copiar consentimentos entre pacientes nem concedê-los automaticamente ao
  representante; cada fluxo deve verificar seu próprio escopo de consentimento.

O portal existente usa consultas `findOne` por tenant e usuário em diversos pontos
de `servico-portal-paciente.ts`. Isso não demonstra exposição real, mas não define
seleção determinística nem autorização de representação para múltiplos pacientes.
Inventariar e revisar esses fluxos antes de habilitar representação múltipla;
não presumir que o contrato de P2 corrige automaticamente o portal existente.
Busca textual inicial nos módulos `pacientes` e `auth` não encontrou modelo
nomeado de representante legal; isso não é inventário completo nem prova de
ausência em todo o sistema. A equipe da clínica registra o vínculo e verifica a
autorização, conforme decisão do proprietário; a implementação deve limitar as
permissões aos papéis autorizados existentes, registrar quem verificou e quando,
e revalidar o vínculo vigente em cada operação. A política de evidências, o fluxo
de revogação e os papéis concretos precisam ser confrontados com os controles
existentes antes de disponibilizar acesso, sem inferir uma concessão clínica geral.

Preparar plano distinto para inventariar duplicatas apenas com agregados
sanitizados, revisão de cada caso no ambiente apropriado, decisão de resolução,
backup e tratamento de corrida com criação, reatribuição e reativação. Qualquer
consulta a ambiente real, saneamento ou DDL exige identificação explícita do
alvo, papel, autorização e runbook. Ensaio mutável apenas em banco descartável.
Testar concorrência, reversibilidade/limite com dados existentes, RLS, falha de
migration com duplicatas e boot do runtime sem privilégios de owner.

## UX — avaliação A das novas decisões

Duas perspectivas distintas avaliaram apenas briefing sintético, sem acesso ao
plano ou interface. Nutricionista: explicar antes da concessão que ela cobre a
carteira inteira, distinguir sucesso e falha da revogação e esclarecer se a
carteira é atualizada ao longo do tempo. Paciente: manter pessoa selecionada
identificável antes do envio, permitir troca acessível e tratar revogação durante
a operação sem divulgar dados. Os riscos são hipóteses; exigir testes sintéticos
de escolha, troca, revogação concorrente, teclado e leitor de tela. Não houve
teste com pessoas nem interface avaliada. UX B/C e revisão de segurança continuam
necessárias; estas sugestões não autorizam escopo novo.

## Gates

Enquanto os controles não existirem e não forem provados, Patient e Collaborator
continuam fechados no helper inicial; duas provas estão marcadas TODO. P2 não está
completa. O planejamento não altera permissões, flags, banco ou configuração.
