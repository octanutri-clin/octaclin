# Fase 110 - Automacoes de lembrete e confirmacao de consulta

Data: 2026-07-22

## Objetivo

Automatizar lembretes de consulta por email/WhatsApp e registrar confirmacoes simples recebidas pelo WhatsApp, mantendo rastreabilidade operacional e reprocessamento pelo outbox existente.

## Entregas

- Servico de lembretes de agenda para consultas agendadas na janela de 23h a 25h futuras.
- Envio por email e WhatsApp usando templates mapeados pelo evento `agenda.consulta.lembrete`.
- Montagem de parametros WhatsApp Meta por `conteudo.parametros`, reaproveitando o padrao da Fase 109.
- Idempotencia por `consulta.notificacoes.lembrete24h.status`, evitando reenvio quando o lembrete ja foi processado.
- Processador cron a cada 5 minutos para percorrer tenants ativos e acionar lembretes.
- Webhook WhatsApp reconhecendo respostas simples de confirmacao, como `Confirmo`, e marcando `consulta.notificacoes.confirmacaoPaciente`.
- Tela `/agenda` mostrando status de lembrete 24h e confirmacao do paciente.
- Tela `/comunicacoes` com eventos de template para lembrete e confirmacao.

## Decisoes

- A fase usa `agenda_consultas.notificacoes` e `payload.automacoes` para logs sem criar migracao nova.
- Reprocessamento de falha de envio continua pelo outbox de comunicacoes ja existente.
- Confirmacao automatica inicial e textual: `confirmo`, `confirmado`, `confirmada`, `sim`, `ok` e `pode confirmar`.
- Cancelamento e reagendamento por resposta livre ficam registrados como mensagem recebida no inbox, mas acoes automaticas mais fortes ficam para fases futuras para evitar alterar agenda sem confirmacao operacional.

## Arquivos principais

- `octaclin-backend/src/modulos/automacoes/aplicacao/servico-lembretes-agenda.ts`
- `octaclin-backend/src/modulos/automacoes/aplicacao/processador-lembretes-agenda.ts`
- `octaclin-backend/src/modulos/comunicacoes/aplicacao/servico-webhook-whatsapp.ts`
- `octaclin-backend/src/modulos/automacoes/modulo-automacoes.ts`
- `octaclin-web/components/agenda/painel-agenda.tsx`
- `octaclin-web/components/comunicacoes/painel-comunicacoes.tsx`

## Validacoes

```powershell
pnpm --dir octaclin-backend test --runInBand servico-lembretes-agenda.spec.ts processador-lembretes-agenda.spec.ts servico-webhook-whatsapp.spec.ts servico-agenda.spec.ts
pnpm --dir octaclin-backend typecheck
pnpm --dir octaclin-web typecheck
powershell -ExecutionPolicy Bypass -File .\validar-preflight.ps1 -DocsOnly
```

## Pendencias para fases futuras

- Criar automacoes de lembrete com janelas configuraveis por tenant/profissional.
- Transformar respostas de cancelamento/remarcacao em fluxo assistido, com aprovacao operacional antes de alterar a agenda.
- Exibir historico completo de automacoes por consulta em uma area detalhada.
