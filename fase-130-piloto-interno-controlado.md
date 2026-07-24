# Fase 130 - Piloto interno controlado

Data: 2026-07-23

## Objetivo

Criar a estrutura operacional para um piloto interno controlado antes do go-live real, permitindo testar o OctaClin com poucos usuarios ficticios/autorizados, registrar problemas e definir criterios claros de aceite antes de avancar para producao isolada.

## Entregas

- Criado `RUNBOOK_PILOTO_INTERNO.md` com participantes, perfis a testar (cliente, profissional, paciente, suporte/operador), jornadas obrigatorias, criterios de sucesso, criterios de bloqueio, forma de registrar bugs e processo de decisao de aceite.
- Criado `PILOTO_INTERNO_CONTROLE.md` como arquivo vivo de acompanhamento da rodada atual do piloto: participantes, checklist de jornadas, registro de bugs e decisao de aceite.
- Adicionado validador documental `scripts/test-piloto-interno.mjs`.
- Adicionado script raiz `pnpm test:piloto`.
- `RUNBOOK_PILOTO_INTERNO.md` e `PILOTO_INTERNO_CONTROLE.md` incluidos na lista de documentos obrigatorios do `validar-preflight.ps1`.
- `CHECKLIST_GO_LIVE.md` ganhou secao "Piloto interno" ligando o aceite do piloto a liberacao de clientes reais.
- `PREFLIGHT_PRODUCAO.md` ganhou linha de area "Piloto interno" e "Proximo passo recomendado" atualizado.
- `TESTES_E_VALIDACOES.md` ganhou secao de validacao do piloto interno.
- Ajustado `scripts/scan-secrets.mjs` para ignorar os diretorios `.agents` e `skills`, evitando falso-positivo do scanner de secrets em exemplos de documentacao de terceiros vendorizados pelo marketplace de skills (ex.: URLs de banco de exemplo em `docker.md`/`gitlab.md`).

## Escopo nao incluido

- Nenhum cliente real de consultoria foi convidado nesta fase.

## Rodada 1 - execucao real (2026-07-23)

Apos a estrutura entregue, a primeira rodada real do piloto comecou nesta mesma fase:

- `pnpm test:e2e:criticas` executado: 6/6 testes passaram (desktop e mobile).
- Massa de staging aplicada com `pnpm seed:staging` contra o banco Neon unico do projeto (hoje rotulado "producao" no console, mas usado como staging de fato ate a Fase 131 separar os ambientes; o usuario confirmou explicitamente o uso e a ausencia de clientes reais nele).
- Dois bugs reais foram encontrados e corrigidos durante a aplicacao do seed (detalhes e severidade em `PILOTO_INTERNO_CONTROLE.md`, tabela de bugs):
  - **BUG-001 (P1):** a constraint `usuarios_role_check`, criada em `1720000000000-CriarFundacaoOctaClin.ts`, nunca incluiu o papel `Client`, apesar de o tipo TypeScript de `UsuarioOrm.role` incluir `'Client'` desde a Fase 89. Qualquer banco Postgres criado do zero pelas migrations falhava ao inserir um usuario Client. Corrigido pela nova migration `1720000000700-CorrigeConstraintRoleUsuarios.ts`, que amplia a constraint para incluir `'Client'`.
  - **BUG-002 (P2):** o fixture `staging-fixtures.json` usava `profissionais.id` no campo `tarefas[].profissionalId`, mas a coluna `acompanhamento_tarefas.profissional_id` referencia `usuarios.id` (o controlador `controlador-pacientes.ts` grava ali o `usuario.usuarioId` de quem criou a tarefa, nao o perfil profissional). Corrigido ajustando o fixture para usar o `usuarioId` correto do profissional responsavel.
- Subimos backend (`http://localhost:3001`) e web (`http://localhost:3000`) locais apontando para o banco de staging ja seedado, para o usuario comecar as jornadas manuais.
- **BUG-003 (P1):** ao testar o acesso inicial (`/` -> `/dashboard`), o usuario recebeu a tela quebrada `{"mensagem":"Sessao ausente ou expirada."}` em vez de ser levado ao login. Causa raiz: `octaclin-web/middleware.ts` nao incluia `/dashboard` em `ROTAS_PROTEGIDAS` nem no `matcher`, entao a rota nunca passava pela checagem de autenticacao (a logica de permissao em `lib/server/autorizacao-rotas.ts` ja suportava `/dashboard` corretamente, so faltava registrar a rota no middleware). Corrigido adicionando `/dashboard` a `ROTAS_PROTEGIDAS` e ao `matcher`; validado via curl que visitante nao autenticado agora recebe redirect 307 para `/login?redirect=%2Fdashboard` e que uma sessao autenticada continua acessando `/dashboard` normalmente.
- Adicionado botao "Sair" no `ConsoleShell`, no portal do cliente e no portal do paciente (nenhum tinha logout visivel fora do painel de operacoes), para permitir alternar entre as contas ficticias durante o piloto.
- **BUG-004 (P0):** ao testar a aba Pacientes como profissional, o usuario relatou que qualquer `Professional` conseguia ver e gerenciar pacientes, consultas de agenda e circulos/desafios de gamificacao de **outros** profissionais do mesmo tenant, alem de poder escolher qualquer profissional ao criar um paciente novo. Investigacao confirmou que `ServicoPacientes.listar/criar/obterPorId/atualizar/arquivar` (e as leituras de prontuario/evolucoes/tarefas), `ServicoAgenda.listarConsultas/criarConsulta/remarcarConsulta/cancelarConsulta` e `ServicoGamificacao.listarCirculos/criarCirculo/listarDesafios/criarDesafio` filtravam apenas por `tenantId`, nunca pelo profissional responsavel — apesar do escopo `pacientes_responsaveis` ja estar documentado para o papel Professional desde a Fase 95. Backend do endpoint de criar/excluir profissional ja estava correto (testado diretamente via curl: 403 para Professional); o problema era so a falta de escopo nos tres modulos acima.
  - Corrigido com um helper compartilhado `resolverProfissionalIdDoUsuario` em `octaclin-backend/src/infraestrutura/seguranca/escopo-profissional.ts`, aplicado nos tres servicos: Professional so ve/cria/atualiza dados dos seus proprios pacientes/consultas/circulos/desafios; tentar reatribuir um paciente para outro profissional agora falha com 403; acessar paciente/consulta de outro profissional responde como nao encontrado (mesmo padrao de tenant isolation da Fase 122). Collaborator e SuperAdmin continuam com visao tenant-wide (`operacional_delegado`/`tenant_total`), sem mudanca de comportamento.
  - Frontend: `ListaProfissionais` agora esconde o formulario de criar/editar e os botoes de editar/arquivar quando a sessao nao tem `profissionais.gerenciar` (so cosmetico, o backend ja bloqueava, mas a UI mostrava controles que sempre falhavam).
  - 33 testes novos cobrindo o escopo (16 em `servico-pacientes.spec.ts`, 10 em `servico-agenda.spec.ts` e 7 em `servico-gamificacao.spec.ts`), sem quebrar nenhum teste existente.
- **BUG-004b (P1):** apos o BUG-004, o usuario testou de novo e confirmou que o seletor de profissional em cinco formularios (novo paciente, novo circulo, novo desafio, nova regra de automacao, novo agendamento) ainda mostrava todos os profissionais do tenant. Causa: `ServicoProfissionais.listar/obterPorId` tambem so filtravam por `tenantId`; como pacientes/agenda/gamificacao/automacoes populam esse seletor a partir do mesmo `GET /profissionais`, a lista completa vazava simultaneamente para os cinco formularios. Corrigido aplicando o mesmo `resolverProfissionalIdDoUsuario` em `ServicoProfissionais`: Professional agora recebe so o proprio registro em `GET /profissionais` e `GET /profissionais/:id` de outro profissional responde como nao encontrado; Collaborator/SuperAdmin mantem visao do time inteiro. Validado ao vivo: marina e rafael (profissionais ficticios de staging) cada um so ve a si mesmo. Como os cinco formularios ja consumiam esse mesmo endpoint, o efeito cascateou sem alterar nenhum componente de frontend.
- **BUG-005 (P1):** o usuario pediu uma auditoria proativa dos modulos restantes que ainda nao tinham sido revisados quanto ao mesmo padrao (comunicacoes, materiais, questionarios, automacoes). Confirmado o mesmo problema em todos os quatro:
  - **Questionarios:** `criarQuestionario`/`criarQuestionarioAPartirModelo` aceitavam qualquer `profissionalId` enviado; `listarQuestionarios` retornava todos os questionarios do tenant; `atualizarQuestionario`, `duplicarQuestionario`, `adicionarPergunta`, `listarPerguntas`, `atualizarPergunta`, `reordenarPerguntas`, `criarAgendamento`, `criarEnvioQuestionarioManual`, `listarRespostasQuestionario` e `obterLeituraClinicaQuestionario` nao verificavam se o questionario pertencia ao profissional autenticado.
  - **Materiais:** `enviarMaterialParaPaciente` e `listarMateriaisPaciente` nao verificavam se o paciente informado era responsabilidade do profissional autenticado (a biblioteca de materiais em si continua tenant-wide de proposito, e o envio/status por paciente e que precisava do escopo).
  - **Comunicacoes:** `listarMensagens` retornava mensagens de pacientes de qualquer profissional do tenant (canais e templates continuam tenant-wide de proposito, sao configuracao compartilhada, nao dado clinico).
  - **Automacoes:** `criarRegra`/`listarRegras` aceitavam/retornavam qualquer `profissionalId`; `solicitarAvaliacao` nao verificava se a regra pertencia ao profissional autenticado.
  - Corrigido aplicando o mesmo `resolverProfissionalIdDoUsuario` nos quatro modulos, seguindo exatamente o padrao do BUG-004 (forcar profissional proprio ao criar, filtrar ao listar, tratar recurso de outro profissional como nao encontrado). 26 testes novos; suite completa do backend (43 suites, 204 testes) permanece verde, assim como typecheck e testes de autorizacao do web.
- Jornadas manuais (cliente, profissional, paciente, suporte/operador navegando de fato na aplicacao) e a definicao de participantes internos continuam em andamento, acompanhadas em `PILOTO_INTERNO_CONTROLE.md`.

## Validacoes

```powershell
git diff --check
pnpm security:secrets
pnpm test:piloto
pnpm test:staging-fixtures
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-backend test --runInBand
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web test:authz
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Observacoes

- Nenhum teste de integracao automatizado cobre a constraint `usuarios_role_check` contra Postgres real (os specs Jest existentes usam repositorios mockados); o Docker Compose local (`docker-compose.yml`) nao estava disponivel neste ambiente de execucao para validar a migration antes de aplica-la no banco compartilhado. Fica como lacuna conhecida para uma fase futura de hardening de testes de integracao.
- `pnpm --dir octaclin-web test:authz` cobre `decidirAcessoRota` (a logica de permissao), mas nao cobre a lista `ROTAS_PROTEGIDAS`/`matcher` do proprio `middleware.ts` — foi exatamente essa lacuna que deixou o BUG-003 passar despropercebido. Vale considerar, em fase futura, um teste que garanta que toda rota mapeada em `permissoesRotasOperacionais` (`lib/server/autorizacao-rotas.ts`) tambem esteja em `ROTAS_PROTEGIDAS` no middleware.
- O padrao de escopo do BUG-004/BUG-004b (filtrar por profissional responsavel, nao so por tenant) agora cobre todos os modulos que tocam pacientes/profissionalId: pacientes, agenda, gamificacao, profissionais, questionarios, materiais, comunicacoes e automacoes (BUG-005). Nenhum modulo pendente identificado ate o momento; se surgir um novo modulo com `profissionalId` ou vinculo a paciente, aplicar o mesmo helper `resolverProfissionalIdDoUsuario`.
- A Fase 131 - Producao isolada de staging so deve iniciar apos as jornadas manuais serem executadas e o aceite do piloto ser registrado em `PILOTO_INTERNO_CONTROLE.md`.
