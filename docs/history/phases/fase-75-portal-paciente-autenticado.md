# Fase 75 - Portal autenticado do paciente

## Entregue

- Adicionado servico `ServicoPortalPaciente` com escopo pelo `usuarioId` do paciente logado.
- Adicionado endpoint protegido `GET /portal/paciente`, permitido apenas para papel `Patient`.
- O backend retorna somente dados do proprio paciente: proximas consultas, formularios pendentes e mensagens recentes.
- Formularios pendentes recebem link assinado para a tela publica de resposta.
- Adicionada rota BFF autenticada em `/api/portal/paciente`.
- A pagina `/portal` deixou de ser placeholder e passou a mostrar o dashboard do paciente.

## Decisoes

- O portal do paciente ficou separado do console profissional por papel e por rota.
- A consulta do backend localiza o paciente pelo `usuarioId` do token, nao por parametro enviado pelo frontend.
- O link de formulario reaproveita o mesmo padrao de token publico assinado usado na coleta de formularios.

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

Fase 76: detalhamento do portal com historico de formularios respondidos e perfil do paciente.
