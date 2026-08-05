# OctaClin - Mapa de rotas e permissoes

Atualizado apos a Fase 108. Este arquivo documenta o estado atual de papeis, permissoes e rotas para evitar regressao ao refinar autorizacao.

## Papeis

| Papel | Destino inicial | Escopo | Uso atual |
| --- | --- | --- | --- |
| `SuperAdmin` | `/dashboard` | `tenant_total` | Operacao/admin interno e acesso total operacional |
| `Professional` | `/dashboard` | `pacientes_responsaveis` | Profissional clinico |
| `Collaborator` | `/dashboard` | `operacional_delegado` | Colaborador operacional |
| `Patient` | `/portal` | `proprio_paciente` | Paciente no portal |
| `Client` | `/cliente` | `conta_cliente` | Gestor da conta SaaS |

## Permissoes atuais por papel

### Client

- `cliente.acessar`
- `cliente.assinatura.ler`
- `cliente.usuarios.ler`
- `cliente.usuarios.convidar`
- `cliente.usuarios.desativar`
- `cliente.convites.gerenciar`
- `cliente.configuracoes.gerenciar`
- `agenda.financeiro.ler`

### Patient

- `portal.acessar`
- `portal.agenda.ler_propria`
- `portal.questionarios.responder`
- `portal.comunicacoes.ler_proprias`
- `portal.materiais.ler`
- `portal.perfil.gerenciar`

### Collaborator

- `console.acessar`
- `dashboard.ler`
- `pacientes.listar`
- `pacientes.ler`
- `questionarios.ler`
- `agenda.consultas.ler`
- `agenda.consultas.criar`
- `comunicacoes.mensagens.ler`
- `comunicacoes.mensagens.enviar`
- `materiais.ler`

### Professional

Inclui permissoes de `Collaborator` e adiciona:

- `pacientes.gerenciar`
- `questionarios.gerenciar`
- `profissionais.ler`
- `comunicacoes.canais.gerenciar`
- `comunicacoes.templates.gerenciar`
- `automacoes.gerenciar`
- `ia.executar`
- `mobile.operar`
- `gamificacao.gerenciar`
- `materiais.gerenciar`
- `agenda.financeiro.ler`

### SuperAdmin

Inclui permissoes de `Professional` e adiciona:

- `operacoes.auditoria.ler`
- `operacoes.outbox.reprocessar`
- `profissionais.gerenciar`

## Rotas web principais

| Rota web | Perfil esperado | Permissao de menu/uso |
| --- | --- | --- |
| `/login` | Publica | N/A |
| `/esqueci-senha` | Publica | N/A |
| `/recuperar-senha` | Publica com token | N/A |
| `/primeiro-acesso` | Publica com token de paciente | N/A |
| `/formularios/[token]` | Publica com token | N/A |
| `/dashboard` | SuperAdmin, Professional, Collaborator | `dashboard.ler` |
| `/agenda` | SuperAdmin, Professional, Collaborator | `agenda.consultas.ler` |
| `/pacientes` | SuperAdmin, Professional, Collaborator | `pacientes.listar` |
| `/pacientes/[id]` | SuperAdmin, Professional, Collaborator | `pacientes.ler` |
| `/profissionais` | SuperAdmin, Professional | `profissionais.ler` |
| `/questionarios` | SuperAdmin, Professional, Collaborator | `questionarios.ler` |
| `/comunicacoes` | SuperAdmin, Professional, Collaborator | `comunicacoes.mensagens.ler` |
| `/automacoes` | SuperAdmin, Professional | `automacoes.gerenciar` |
| `/ia` | SuperAdmin, Professional | `ia.executar` |
| `/mobile` | Redireciona para `/operacoes`; APIs preservadas para Patient, Professional e SuperAdmin | `mobile.operar` |
| `/gamificacao` | SuperAdmin, Professional | `gamificacao.gerenciar` |
| `/operacoes` | SuperAdmin | `operacoes.auditoria.ler` |
| `/portal` | Patient | `portal.acessar` |
| `/portal/agenda` | Patient | `portal.acessar` |
| `/portal/checkins` | Patient | `portal.acessar` |
| `/portal/plano` | Patient | `portal.acessar` |
| `/portal/formularios` | Patient | `portal.acessar` |
| `/portal/mensagens` | Patient | `portal.acessar` |
| `/portal/perfil` | Patient | `portal.acessar` |
| `/portal/privacidade` | Patient | `portal.acessar` |
| `/portal/mais` | Patient | `portal.acessar` |
| `/cliente` | Client | `cliente.acessar` |

## Controllers backend principais

| Controller | Prefixo | Papeis atuais |
| --- | --- | --- |
| Auth | `/auth` | Publico/autenticado conforme rota |
| Health | `/health` | Publico |
| Cliente | `/cliente` | `Client` + permissoes `cliente.*` por acao |
| Portal paciente | `/portal` | `Patient` |
| Pacientes | `/pacientes` | `SuperAdmin`, `Professional`, `Collaborator` + `pacientes.listar`/`pacientes.ler`/`pacientes.gerenciar` |
| Convites paciente | `/pacientes/.../convites-acesso` | `SuperAdmin`, `Professional`, `Collaborator` para criacao; publico para ativacao |
| Profissionais | `/profissionais` | `SuperAdmin`, `Professional` + `profissionais.ler`; mutacoes com `profissionais.gerenciar` |
| Questionarios | `/questionarios`, `/categorias-pergunta`, `/agendamentos-questionario` | `SuperAdmin`, `Professional`, `Collaborator` + `questionarios.ler`/`questionarios.gerenciar` |
| Formularios publicos | `/formularios` | Publico com token |
| Agenda | `/agenda` | `SuperAdmin`, `Professional`, `Collaborator` + `agenda.consultas.ler`/`agenda.consultas.criar` |
| Financeiro da agenda | `/agenda` (pagamento, recebimentos, pacotes) | Pagamento e pacotes: `SuperAdmin`, `Professional`, `Collaborator` + `agenda.consultas.criar`. Recebimentos: `SuperAdmin`, `Professional`, `Client` + `agenda.financeiro.ler` |
| Comunicacoes | `/comunicacoes` | `SuperAdmin`, `Professional`, `Collaborator` + permissoes de mensagens/canais/templates |
| Materiais | `/materiais` | `SuperAdmin`, `Professional`, `Collaborator` + `materiais.ler`/`materiais.gerenciar` |
| Webhook WhatsApp | `/comunicacoes/webhooks/whatsapp` | Publico validado por token/assinatura |
| Automacoes | `/automacoes` | `SuperAdmin`, `Professional` + `automacoes.gerenciar` |
| IA | `/ia` | `SuperAdmin`, `Professional` + `ia.executar` |
| Mobile | `/mobile` | Redireciona para Operacoes; backend permite `SuperAdmin`, `Professional` e `Patient` com escopo proprio |
| Gamificacao | `/gamificacao` | `SuperAdmin`, `Professional` + `gamificacao.gerenciar` |
| Operacoes | `/operacoes` | `SuperAdmin` |

## Rotas BFF sensiveis recentes

| BFF | Backend | Observacao |
| --- | --- | --- |
| `/api/cliente/resumo` | `/cliente/resumo` | Resumo real da conta do cliente |
| `/api/cliente/assinatura/interesse` | `/cliente/assinatura/interesse` | POST exige `cliente.assinatura.ler`; registra solicitacao comercial manual de upgrade/revisao |
| `/api/cliente/configuracoes` | `/cliente/configuracoes` | GET/PATCH exigem `cliente.configuracoes.gerenciar` |
| `/api/cliente/perfil-empresa` | `/cliente/perfil-empresa` | GET/PATCH exigem `cliente.configuracoes.gerenciar`; PATCH audita `cliente.perfil_empresa.atualizar` |
| `/api/cliente/usuarios` | `/cliente/usuarios` | GET exige `cliente.usuarios.ler`; POST exige `cliente.usuarios.convidar` |
| `/api/cliente/usuarios/[id]` | `/cliente/usuarios/:id` | DELETE exige `cliente.usuarios.desativar` |
| `/api/cliente/usuarios/convites` | `/cliente/usuarios/convites` | GET exige `cliente.convites.gerenciar` |
| `/api/cliente/usuarios/convites/historico` | `/cliente/usuarios/convites/historico` | GET exige `cliente.convites.gerenciar` |
| `/api/cliente/usuarios/convites/historico/exportar.csv` | `/cliente/usuarios/convites/historico/exportar.csv` | GET exige `cliente.convites.gerenciar` |
| `/api/cliente/usuarios/[id]/convite/reenvio` | `/cliente/usuarios/:id/convite/reenvio` | POST exige `cliente.convites.gerenciar` |
| `/api/cliente/usuarios/[id]/convite` | `/cliente/usuarios/:id/convite` | DELETE exige `cliente.convites.gerenciar` |
| `/api/operacoes/assinaturas/solicitacoes` | `/operacoes/assinaturas/solicitacoes` | GET exige `SuperAdmin`; lista solicitacoes comerciais pendentes/concluidas |
| `/api/operacoes/assinaturas/plano` | `/operacoes/assinaturas/plano` | POST exige `SuperAdmin`; aplica plano manualmente no tenant atual |
| `/api/agenda/consultas` | `/agenda/consultas` | GET exige `agenda.consultas.ler`; POST exige `agenda.consultas.criar`; cria consulta, valida conflito e sincroniza Google quando configurado |
| `/api/agenda/consultas/[consultaId]` | `/agenda/consultas/:consultaId` | PATCH/DELETE exigem `agenda.consultas.criar`; remarcam/cancelam consulta e sincronizam Google quando configurado |
| `/api/agenda/consultas/[consultaId]/pagamento` | `/agenda/consultas/:consultaId/pagamento` | POST exige `agenda.consultas.criar`; registra valor, forma e status de pagamento; recusa consulta cancelada e consulta de pacote; backend audita |
| `/api/agenda/financeiro/recebimentos` | `/agenda/financeiro/recebimentos` | GET exige `agenda.financeiro.ler` (`SuperAdmin`, `Professional`, `Client`); fecha o periodo com recebido, pendente e quebra por profissional; `Professional` so ve o proprio escopo; backend audita a leitura |
| `/api/agenda/pacotes` | `/agenda/pacotes` | GET exige `agenda.consultas.ler`; POST exige `agenda.consultas.criar`; lista e cria pacotes de sessao do paciente |
| `/api/agenda/pacotes/[pacoteId]` | `/agenda/pacotes/:pacoteId` | DELETE exige `agenda.consultas.criar`; cancela o pacote sem apagar historico |
| `/api/pacientes/[id]/prontuario` | `/pacientes/:id/prontuario` | GET exige sessao operacional com `pacientes.ler`; backend audita leitura sensivel do prontuario |
| `/api/pacientes/[id]/evolucoes` | `/pacientes/:id/evolucoes` | GET exige `pacientes.ler`; POST exige `pacientes.gerenciar`; backend audita listagem e criacao de anotacoes privadas |
| `/api/pacientes/[id]/tarefas-acompanhamento` | `/pacientes/:id/tarefas-acompanhamento` | GET exige `pacientes.ler`; POST exige `pacientes.gerenciar`; backend audita listagem e prescricao de tarefas |
| `/api/pacientes/[id]/tarefas-acompanhamento/[tarefaId]` | `/pacientes/:id/tarefas-acompanhamento/:tarefaId` | PATCH exige `pacientes.gerenciar`; backend audita alteracao de status da tarefa |
| `/api/materiais` | `/materiais` | GET exige `materiais.ler`; POST exige `materiais.gerenciar`; backend audita criacao |
| `/api/materiais/pacientes/[pacienteId]` | `/materiais/pacientes/:pacienteId` | GET exige `materiais.ler` e `pacientes.ler`; POST exige `materiais.gerenciar` e `pacientes.gerenciar`; backend audita envio ao paciente |

## Resultado da Fase 95

- `Client` nao acessa rotinas clinicas.
- `Patient` continua isolado no portal.
- `Collaborator` atua como operador delegado: agenda, mensagens e leitura/listagem, sem gestao clinica avancada.
- `Professional` mantem gestao clinica completa.
- Backend tem `@Permissoes(...)` e `GuardaPermissoes`.
- BFF do cliente valida permissao antes de proxyar.
- Middleware web usa permissoes da sessao para bloquear rotas operacionais.
- UI esconde menus e acoes sem permissao.
- Pendente para fases futuras: testes negativos cross-tenant mais amplos nos modulos ainda nao cobertos.

## Regra de atualizacao

Sempre que uma rota, permissao ou papel mudar, atualizar este arquivo no mesmo commit da fase.
