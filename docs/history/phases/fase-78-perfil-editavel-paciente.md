# Fase 78 - Perfil editavel do paciente

## Entregue

- Adicionado endpoint protegido `PATCH /portal/paciente/perfil`.
- O paciente autenticado pode atualizar nome, e-mail, WhatsApp, data de nascimento e preferencias de contato.
- A atualizacao usa o `usuarioId` do JWT e nao aceita `pacienteId` externo no payload.
- A alteracao e auditada com a acao `portal.paciente.perfil.atualizar`.
- O portal do paciente agora possui formulario de edicao no bloco `Meu perfil`.
- A rota BFF `/api/portal/paciente/perfil` encaminha a atualizacao autenticada para o backend.
- A agenda interpreta o contato estruturado salvo pelo portal e respeita opt-out de e-mail/WhatsApp.
- A listagem operacional de pacientes continua exibindo contato legivel, sem JSON bruto.

## Decisoes

- As preferencias foram persistidas no campo criptografado de contato como JSON estruturado para evitar migracao de schema nesta fase.
- Contatos antigos em texto continuam compativeis: e-mail e WhatsApp legados ainda sao lidos.
- Quando a agenda usa contatos do paciente, preferencias desativadas retornam contato ausente para aquele canal.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-paciente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend test -- servico-agenda.spec.ts --runInBand`
- `pnpm --dir octaclin-backend test -- servico-pacientes.spec.ts --runInBand`

## Proxima fase

Fase 79: hardening do portal do paciente com historico de consentimento, preferencias LGPD detalhadas e testes visuais do fluxo do portal.
