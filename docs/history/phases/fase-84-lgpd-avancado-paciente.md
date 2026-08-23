# Fase 84 - LGPD avancado do paciente

## Entregue

- O portal do paciente ganhou exportacao LGPD em JSON com perfil, consultas, formularios, mensagens e historico de privacidade do paciente autenticado.
- Criado o endpoint backend `GET /portal/paciente/lgpd/exportacao` e a rota BFF `GET /api/portal/paciente/lgpd/exportacao`.
- O paciente agora pode abrir solicitacoes LGPD de `retificacao` ou `exclusao`, com protocolo unico `LGPD-*`.
- Criado o endpoint backend `POST /portal/paciente/lgpd/solicitacoes` e a rota BFF `POST /api/portal/paciente/lgpd/solicitacoes`.
- As solicitacoes ficam registradas no historico LGPD usando `consentimentos_lgpd` com tipo `solicitacao_lgpd_*` e metadados de protocolo, status, canal e detalhes.
- As acoes sensiveis registram auditoria operacional em `portal.paciente.lgpd.exportar_dados` e `portal.paciente.lgpd.solicitacao_registrar`.
- A interface de Privacidade ganhou acoes `Baixar meus dados` e `Enviar solicitacao LGPD`, cobertas por regressao visual em desktop e mobile.

## Decisoes

- A exportacao reaproveita o resumo autenticado do portal para preservar o isolamento por `tenantId` e `usuarioId`.
- A rota BFF mantem a sessao HttpOnly no servidor e nao expoe token de backend no navegador.
- A solicitacao de exclusao fica como protocolo recebido, sem apagar dados automaticamente, porque pode exigir retencao legal e avaliacao operacional.
- O registro inicial usa a tabela LGPD existente para entregar rastreabilidade sem introduzir migration nesta fase.

## Validacao

- `pnpm --dir octaclin-backend test -- servico-portal-paciente.spec.ts --runInBand`
- `pnpm --dir octaclin-backend typecheck`
- `pnpm --dir octaclin-web typecheck`
- `pnpm --dir octaclin-web build`
- `playwright test --grep "primeiro acesso|portal do paciente"`

## Proxima fase

Fase 85: painel operacional para atendimento das solicitacoes LGPD, com fila interna, status de tratamento e responsavel pela conclusao.
