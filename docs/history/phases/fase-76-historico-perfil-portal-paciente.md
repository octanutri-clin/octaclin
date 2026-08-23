# Fase 76 - Historico e perfil do portal do paciente

## Entregue

- O payload autenticado do portal agora inclui `perfil` do paciente.
- O perfil retorna contato, data de nascimento, profissional responsavel e ultimo check-in.
- O portal agora lista historico de formularios respondidos.
- Cada formulario respondido mostra questionario, data de finalizacao e score quando disponivel.
- O resumo do portal ganhou contador de formularios respondidos.
- A tela `/portal` ganhou secoes de perfil e historico sem sair do dashboard do paciente.

## Decisoes

- O escopo continua derivado do `usuarioId` do token do paciente.
- Dados de perfil sao somente leitura nesta fase.
- Historico de formularios usa `respostas_checkin` quando disponivel e cai para `respondidoEm` do envio como fallback.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-paciente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-backend test --runInBand`
- `pnpm --dir octaclin-web test:questionarios-preview`
- `pnpm --dir octaclin-web test:authz`
- `pnpm --dir octaclin-backend build`
- `pnpm --dir octaclin-web build`

## Proxima fase

Fase 77: detalhamento do formulario respondido no portal, com leitura das respostas por pergunta para o paciente.
