# FOOD06 P2 — plano de carteira delegada e vínculo do portal

## Decisões do proprietário

Em 2026-11-13, o proprietário escolheu **planejar delegação explícita de
carteira para Collaborator** e **planejar unicidade no banco para vínculo ativo
do paciente com tratamento de duplicatas**. As escolhas autorizam planejamento;
não autorizam aplicar migration, consultar dados reais, sanear duplicatas, ativar
funcionalidade ou efetuar deploy. Na sequência, decidiu que o profissional titular
concede e revoga acesso à carteira inteira e que uma conta pode representar vários
pacientes ativos da mesma clínica. Esta nota é proposta técnica, não schema aplicado.

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

O portal existente usa consultas `findOne` por tenant e usuário em diversos pontos
de `servico-portal-paciente.ts`. Isso não demonstra exposição real, mas não define
seleção determinística nem autorização de representação para múltiplos pacientes.
Inventariar e revisar esses fluxos antes de habilitar representação múltipla;
não presumir que o contrato de P2 corrige automaticamente o portal existente.
Busca textual inicial nos módulos `pacientes` e `auth` não encontrou modelo
nomeado de representante legal; isso não é inventário completo nem prova de
ausência em todo o sistema. A autoridade para criar e revogar representação e
suas evidências continuam pendentes de decisão e revisão específica.

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
