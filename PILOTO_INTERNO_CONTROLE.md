# OctaClin - Controle do piloto interno controlado

Este arquivo acompanha a execucao do piloto interno descrito em `RUNBOOK_PILOTO_INTERNO.md`. Atualize-o a cada rodada real do piloto. Nao registre dados reais de clientes/pacientes nem secrets aqui.

## Status atual

- Status: concluido e aprovado.
- Rodada: 1.
- Data de inicio: 2026-07-23.
- Data de encerramento: 2026-07-23.
- Ambiente: staging (banco unico atual, usado como staging de fato ate a Fase 131 separar producao), tenant `octaclin-staging`.

## Participantes

| Perfil | Responsavel | Contato interno |
| --- | --- | --- |
| Responsavel tecnico | octavioomarostica@gmail.com | octavioomarostica@gmail.com |
| Cliente | octavioomarostica@gmail.com | octavioomarostica@gmail.com |
| Profissional | octavioomarostica@gmail.com | octavioomarostica@gmail.com |
| Paciente | octavioomarostica@gmail.com | octavioomarostica@gmail.com |
| Suporte/operador | octavioomarostica@gmail.com | octavioomarostica@gmail.com |

## Checklist de jornadas executadas

- [x] Cliente convida usuario administrativo e usuario ativa convite.
- [x] Cliente revisa configuracoes, perfil fiscal e assinatura/uso.
- [x] Profissional cadastra paciente e registra evolucao clinica.
- [x] Profissional prescreve plano de acompanhamento e envia material.
- [x] Profissional agenda consulta com email/WhatsApp/Google Calendar.
- [x] Profissional remarca e cancela consulta sincronizada.
- [x] Paciente acessa portal, responde formulario e registra check-in.
- [x] Paciente consulta notificacoes/tarefas e exporta dados LGPD.
- [x] Suporte/operador revisa console operacional e central de falhas.
- [x] Suporte/operador simula atendimento de login/convite.
- [x] `pnpm test:e2e:criticas` executado nesta rodada (2026-07-23, 6/6 testes passaram em desktop e mobile).
- [x] `pnpm seed:staging` aplicado com sucesso em 2026-07-23 (tenant `octaclin-staging`, 5 usuarios, 3 pacientes e demais dados ficticios).
- [x] Validacao manual do escopo por profissional (BUG-004/004b/005): usuario testou como profissional (Marina/Rafael) as abas Pacientes, Agenda, Gamificacao, Automacoes e Questionarios e confirmou que cada profissional so enxerga os proprios dados (2026-07-23).

## Registro de bugs

| ID | Data | Perfil/jornada | Severidade | Descricao | Status |
| --- | --- | --- | --- | --- | --- |
| BUG-001 | 2026-07-23 | Aplicacao de `pnpm seed:staging` | P1 | Constraint `usuarios_role_check` (migration `1720000000000-CriarFundacaoOctaClin`) nunca incluia o papel `Client`, impedindo criar qualquer usuario Client em um banco novo criado do zero pelas migrations. | Corrigido (migration `1720000000700-CorrigeConstraintRoleUsuarios`). |
| BUG-002 | 2026-07-23 | Aplicacao de `pnpm seed:staging` | P2 | Fixture `staging-fixtures.json` usava o `profissionais.id` no campo `tarefas[].profissionalId`, mas a coluna real referencia `usuarios.id` (quem criou a tarefa), causando violacao de FK ao aplicar o seed. | Corrigido (fixture ajustado para usar o `usuarioId` do profissional responsavel). |
| BUG-003 | 2026-07-23 | Acesso inicial nao autenticado (`/` -> `/dashboard`) | P1 | `/dashboard` nao estava na lista `ROTAS_PROTEGIDAS` nem no `matcher` do `middleware.ts`, entao qualquer visitante nao autenticado que abrisse a raiz do site (`app/page.tsx` redireciona sempre para `/dashboard`) caia numa tela quebrada com o erro cru `{"mensagem":"Sessao ausente ou expirada."}` em vez de ser levado ao `/login`. A logica de autorizacao (`decidirAcessoRota`) ja tratava `/dashboard` corretamente; faltava so registrar a rota no middleware. | Corrigido (`/dashboard` adicionado a `ROTAS_PROTEGIDAS` e ao `matcher` de `octaclin-web/middleware.ts`). |
| BUG-004 | 2026-07-23 | Aba Pacientes / Profissionais / Gamificacao do painel do profissional | P0 | Qualquer usuario `Professional` conseguia ver e gerenciar pacientes de outros profissionais (listar, criar atribuindo a outro profissional, ler prontuario/evolucoes/tarefas), reatribuir paciente para outro profissional, ver/criar consultas de agenda de outros profissionais, e criar circulos/desafios de gamificacao para outros profissionais. Os servicos `ServicoPacientes`, `ServicoAgenda` e `ServicoGamificacao` so filtravam por `tenantId`, nunca por profissional responsavel, apesar do escopo `pacientes_responsaveis` ja estar documentado para o papel Professional. | Corrigido: novo helper `resolverProfissionalIdDoUsuario` (`infraestrutura/seguranca/escopo-profissional.ts`) aplicado em listagens/criacoes/leituras/mutacoes dos tres servicos; Professional so ve/gerencia seus proprios pacientes/consultas/circulos/desafios, tenta reatribuir paciente para outro profissional resulta em erro, e acesso a paciente/consulta de outro profissional responde como nao encontrado. 33 testes novos cobrindo o escopo. Frontend: botoes de criar/editar/arquivar profissional escondidos para quem nao tem `profissionais.gerenciar`. Validado manualmente pelo usuario em 2026-07-23 (Marina/Rafael so veem os proprios pacientes/consultas/circulos/desafios). |
| BUG-004b | 2026-07-23 | Seletor de profissional em novo paciente, circulo, desafio, regra de automacao e agendamento | P1 | Mesmo apos o BUG-004, o usuario reportou que o seletor de "profissional" nesses cinco formularios ainda mostrava todos os profissionais do tenant (o Professional conseguia escolher outro colega). Causa: `ServicoProfissionais.listar/obterPorId` so filtravam por `tenantId`; e como pacientes, agenda, gamificacao e automacoes populam esse seletor a partir do mesmo endpoint `GET /profissionais`, a lista completa vazava para todos os formularios de uma vez. | Corrigido aplicando `resolverProfissionalIdDoUsuario` tambem em `ServicoProfissionais`: um Professional agora recebe so o proprio registro em `GET /profissionais`, e `GET /profissionais/:id` de outro profissional responde como nao encontrado. Collaborator/SuperAdmin continuam vendo o time inteiro. Confirmado ao vivo com marina e rafael (cada um so ve a si mesmo); efeito cascateou automaticamente para os cinco formularios sem precisar alterar cada componente de frontend. Validado manualmente pelo usuario em 2026-07-23. |
| BUG-005 | 2026-07-23 | Questionarios, materiais, comunicacoes e automacoes | P1 | Auditoria proativa (pedida pelo usuario apos o BUG-004/004b) confirmou o mesmo padrao de falta de escopo por profissional responsavel em quatro modulos restantes: questionarios (criar/listar/atualizar/duplicar questionario, perguntas, agendamentos, envios manuais e leitura clinica), materiais (enviar/listar materiais de um paciente sem checar se o paciente e do profissional), comunicacoes (listagem de mensagens expondo conversas de pacientes de outros profissionais) e automacoes (criar/listar regra e solicitar avaliacao sem checar dono da regra). | Corrigido aplicando `resolverProfissionalIdDoUsuario` nos quatro modulos, seguindo o mesmo padrao do BUG-004. Canais e templates de comunicacao permanecem tenant-wide de proposito (sao configuracao compartilhada, nao dado clinico). 26 testes novos; suite completa do backend (204 testes) permanece verde. Validado manualmente pelo usuario em 2026-07-23 (Automacoes e Questionarios inclusos na checagem manual de escopo). |

## Decisao de aceite

- Status: concluido.
- Criterios de sucesso atendidos: sim — todas as jornadas manuais executadas, `pnpm test:e2e:criticas` passou (6/6), nenhum bug P0/P1 permanece aberto (BUG-004 P0 e BUG-001/003/004b/005 P1 todos corrigidos e validados), BUG-002 (P2) corrigido, console operacional sem alerta critico nao tratado.
- Criterios de bloqueio observados: nenhum.
- Decisao: **aprovado**.
- Aprovado por: octavioomarostica@gmail.com.
- Data da decisao: 2026-07-23.

## Proximo passo

Piloto interno controlado aprovado. Todas as jornadas manuais (cliente, profissional, paciente, suporte/operador) foram testadas e aprovadas, incluindo a validacao do escopo por profissional (BUG-004/004b/005) em Pacientes, Agenda, Gamificacao, Automacoes e Questionarios. Liberado o inicio da Fase 131 - Producao isolada de staging.
