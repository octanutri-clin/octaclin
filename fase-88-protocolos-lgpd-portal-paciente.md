# Fase 88 - Protocolos LGPD no portal do paciente

## Entregue

- O resumo autenticado do portal agora inclui `lgpd.solicitacoes`.
- O backend consolida eventos de abertura, tratativa operacional e resposta preparada por protocolo.
- A lista do paciente mostra protocolo, tipo, status atual, datas, detalhes, ultima tratativa e ultima resposta.
- Eventos LGPD de outros pacientes sao filtrados antes de montar o payload do portal.
- A lista de consentimentos continua separada dos eventos operacionais de solicitacao.
- A tela `/portal` ganhou o bloco `Meus protocolos LGPD` na area de privacidade.
- Os mocks visuais de portal e primeiro acesso foram atualizados para o novo contrato.

## Decisoes

- O portal reaproveita o endpoint `GET /portal/paciente` para evitar uma segunda chamada apenas para LGPD.
- A resposta preparada fica visivel como resumo, mas nao implica envio automatico ao paciente.
- O historico operacional continua sendo a fonte de verdade dos protocolos; o portal mostra uma visao consolidada e filtrada.
- O status mostrado ao paciente segue os mesmos estados operacionais: recebida, em tratamento, concluida e indeferida.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-paciente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test --grep "portal do paciente|primeiro acesso"`

## Proxima fase

Fase 89: iniciar o portal do cliente com base de autenticacao e separacao de perfis entre profissional, paciente e conta cliente.
