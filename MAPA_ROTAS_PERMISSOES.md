# OctaClin - Mapa de rotas e permissoes

Este arquivo prepara a Fase 94. Ele documenta o estado atual de papeis, permissoes e rotas para evitar regressao ao refinar autorizacao.

## Papeis

| Papel | Destino inicial | Escopo | Uso atual |
| --- | --- | --- | --- |
| `SuperAdmin` | `/operacoes` | `tenant_total` | Operacao/admin interno e acesso total operacional |
| `Professional` | `/agenda` | `pacientes_responsaveis` | Profissional clinico |
| `Collaborator` | `/agenda` | `operacional_delegado` | Colaborador operacional |
| `Patient` | `/portal` | `proprio_paciente` | Paciente no portal |
| `Client` | `/cliente` | `conta_cliente` | Gestor da conta SaaS |

## Permissoes atuais por papel

### Client

- `cliente.acessar`
- `cliente.assinatura.ler`
- `cliente.usuarios.gerenciar`
- `cliente.configuracoes.gerenciar`

### Patient

- `portal.acessar`
- `portal.agenda.ler_propria`
- `portal.questionarios.responder`
- `portal.comunicacoes.ler_proprias`
- `portal.materiais.ler`
- `portal.perfil.gerenciar`

### Collaborator

- `console.acessar`
- `pacientes.listar`
- `pacientes.ler`
- `pacientes.gerenciar`
- `questionarios.ler`
- `questionarios.gerenciar`
- `agenda.consultas.ler`
- `agenda.consultas.criar`
- `comunicacoes.mensagens.ler`
- `comunicacoes.mensagens.enviar`
- `automacoes.gerenciar`
- `ia.executar`
- `mobile.operar`
- `gamificacao.gerenciar`

### Professional

Inclui permissoes de `Collaborator` e adiciona:

- `profissionais.ler`
- `comunicacoes.canais.gerenciar`
- `comunicacoes.templates.gerenciar`

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
| `/agenda` | SuperAdmin, Professional, Collaborator | `agenda.consultas.ler` |
| `/pacientes` | SuperAdmin, Professional, Collaborator | `pacientes.listar` |
| `/profissionais` | SuperAdmin, Professional | `profissionais.ler` |
| `/questionarios` | SuperAdmin, Professional, Collaborator | `questionarios.ler` |
| `/comunicacoes` | SuperAdmin, Professional, Collaborator | `comunicacoes.mensagens.ler` |
| `/automacoes` | SuperAdmin, Professional, Collaborator | `automacoes.gerenciar` |
| `/ia` | SuperAdmin, Professional, Collaborator | `ia.executar` |
| `/mobile` | SuperAdmin, Professional, Collaborator | `mobile.operar` |
| `/gamificacao` | SuperAdmin, Professional, Collaborator | `gamificacao.gerenciar` |
| `/operacoes` | SuperAdmin | `operacoes.auditoria.ler` |
| `/portal` | Patient | `portal.acessar` |
| `/cliente` | Client | `cliente.acessar` |

## Controllers backend principais

| Controller | Prefixo | Papeis atuais |
| --- | --- | --- |
| Auth | `/auth` | Publico/autenticado conforme rota |
| Health | `/health` | Publico |
| Cliente | `/cliente` | `Client` |
| Portal paciente | `/portal` | `Patient` |
| Pacientes | `/pacientes` | `SuperAdmin`, `Professional`, `Collaborator` |
| Convites paciente | `/pacientes/.../convites-acesso` | `SuperAdmin`, `Professional`, `Collaborator` para criacao; publico para ativacao |
| Profissionais | `/profissionais` | `SuperAdmin`, `Professional`; criacao/delete mais restritos a `SuperAdmin` |
| Questionarios | `/questionarios`, `/categorias-pergunta`, `/agendamentos-questionario` | `SuperAdmin`, `Professional`, `Collaborator` |
| Formularios publicos | `/formularios` | Publico com token |
| Agenda | `/agenda` | `SuperAdmin`, `Professional`, `Collaborator` |
| Comunicacoes | `/comunicacoes` | `SuperAdmin`, `Professional`, `Collaborator` |
| Webhook WhatsApp | `/comunicacoes/webhooks/whatsapp` | Publico validado por token/assinatura |
| Automacoes | `/automacoes` | `SuperAdmin`, `Professional`, `Collaborator` |
| IA | `/ia` | `SuperAdmin`, `Professional`, `Collaborator` |
| Mobile | `/mobile` | `SuperAdmin`, `Professional`, `Collaborator`, `Patient` |
| Gamificacao | `/gamificacao` | `SuperAdmin`, `Professional`, `Collaborator` |
| Operacoes | `/operacoes` | `SuperAdmin` |

## Rotas BFF sensiveis recentes

| BFF | Backend | Observacao |
| --- | --- | --- |
| `/api/cliente/resumo` | `/cliente/resumo` | Resumo real da conta do cliente |
| `/api/cliente/usuarios` | `/cliente/usuarios` | Lista/cria usuarios administrativos |
| `/api/cliente/usuarios/[id]` | `/cliente/usuarios/:id` | Desativa usuario |
| `/api/cliente/usuarios/convites` | `/cliente/usuarios/convites` | Lista convites pendentes |
| `/api/cliente/usuarios/[id]/convite/reenvio` | `/cliente/usuarios/:id/convite/reenvio` | Reenvia convite |
| `/api/cliente/usuarios/[id]/convite` | `/cliente/usuarios/:id/convite` | Revoga convite |

## Pontos para Fase 94

- Migrar checagens de algumas rotas de papel para permissao explicita onde fizer sentido.
- Garantir que `Client` nao acesse rotinas clinicas.
- Garantir que `Patient` nao acesse BFF operacional nem cliente.
- Separar melhor `Professional` e `Collaborator`.
- Decidir se `Collaborator` pode gerenciar pacientes ou apenas operar agenda/comunicacoes.
- Decidir se `Professional` pode gerenciar canais/templates ou se isso deve ficar com `SuperAdmin`/`Client`.
- Criar testes negativos cross-role e cross-tenant.
- Atualizar `octaclin-web/lib/server/autorizacao-rotas.ts` se o roteamento mudar.
- Atualizar `octaclin-backend/src/modulos/auth/dominio/permissoes.ts` e `permissoes.spec.ts`.

## Regra de atualizacao

Sempre que uma rota, permissao ou papel mudar, atualizar este arquivo no mesmo commit da fase.
