# Fase 111 - Preferencias de comunicacao por paciente

Data: 2026-07-22

## Objetivo

Permitir que o paciente controle opt-in/opt-out, canal preferido e janela de horario para comunicacoes, e fazer com que automacoes de agenda respeitem essas preferencias antes de enviar lembretes.

## Entregas

- Contrato do portal do paciente ampliado com `canalPreferido` e `horarioPermitido`.
- Edicao das preferencias no portal autenticado do paciente.
- Persistencia das preferencias dentro do contato criptografado do paciente, preservando compatibilidade com contatos antigos.
- Lembretes de consulta respeitando opt-in/opt-out de email e WhatsApp.
- Lembretes usando apenas o canal preferido quando o paciente escolher email ou WhatsApp.
- Lembretes ignorados fora da janela de horario permitida pelo paciente, com motivo registrado em `consulta.notificacoes.lembrete24h`.
- Testes cobrindo atualizacao de perfil, preservacao das preferencias em LGPD, canal preferido e horario permitido.

## Decisoes

- As preferencias foram mantidas em `paciente.contatoCriptografado`, pois fazem parte dos dados sensiveis de contato e evitam migracao imediata.
- Pacientes sem preferencia salva usam padrao retrocompativel: email e WhatsApp ativos, canal `qualquer`, horario 08:00-20:00 em `America/Sao_Paulo`.
- Quando `canalPreferido` e `email` ou `whatsapp`, a automacao envia apenas pelo canal escolhido se ele estiver ativo e com destino disponivel.
- Quando o horario atual esta fora da janela permitida, a automacao registra `fora_horario_preferido` e nao dispara mensagem.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/dtos.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-portal-paciente.spec.ts`
- `octaclin-backend/src/modulos/automacoes/aplicacao/servico-lembretes-agenda.ts`
- `octaclin-backend/src/modulos/automacoes/aplicacao/servico-lembretes-agenda.spec.ts`
- `octaclin-backend/src/modulos/automacoes/modulo-automacoes.ts`
- `octaclin-web/lib/portal-api.ts`
- `octaclin-web/components/portal/portal-paciente.tsx`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-portal-paciente.spec.ts servico-lembretes-agenda.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web build
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Levar as preferencias para uma tela de onboarding mais guiada do paciente.
- Aplicar a mesma politica de preferencia em outros eventos de comunicacao alem dos lembretes de agenda.
- Criar visao operacional para falhas e reprocessamento de comunicacoes na Fase 112.
