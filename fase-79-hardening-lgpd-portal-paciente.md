# Fase 79 - Hardening LGPD do portal do paciente

## Entregue

- O resumo do portal agora retorna o historico recente de consentimentos LGPD do paciente autenticado.
- Adicionado endpoint protegido `POST /portal/paciente/lgpd/consentimentos`.
- O aceite LGPD usa o `usuarioId` do JWT e valida paciente vinculado ao usuario logado.
- O registro salva consentimento em `consentimentos_lgpd` com tipo `portal_paciente_lgpd`, versao e preferencias de contato.
- Preferencias de e-mail e WhatsApp podem ser reaplicadas junto com o aceite LGPD.
- A rota BFF `/api/portal/paciente/lgpd/consentimentos` encaminha o aceite autenticado para o backend.
- O portal ganhou area `Privacidade` com versao atual, ultimo aceite, historico e botao de registro.

## Decisoes

- Foi reutilizada a tabela fundacional `consentimentos_lgpd`; nao houve migration nova.
- A versao atual vem de `OCTACLIN_LGPD_VERSAO` e usa `2026-07` como fallback.
- O historico retornado e limitado aos 10 registros mais recentes do paciente logado.
- O aceite LGPD nao substitui auditoria: o controller tambem registra a acao operacional.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-paciente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`

## Proxima fase

Fase 80: teste visual automatizado do portal do paciente e polimento UI/UX das telas do cliente.
