# Fase 64 - Matriz de acesso e permissoes

## Objetivo

Preparar o OctaClin para login unificado com experiencias separadas entre console profissional e portal do paciente.

## Entregue

- Matriz central de permissoes por papel:
  - `SuperAdmin`
  - `Professional`
  - `Collaborator`
  - `Patient`
- Escopo de dados por papel:
  - tenant completo
  - pacientes responsaveis
  - operacional delegado
  - proprio paciente
- Destino inicial por papel para o login unificado:
  - `SuperAdmin`: `/operacoes`
  - `Professional`: `/agenda`
  - `Collaborator`: `/agenda`
  - `Patient`: `/portal`
- Retorno de `papel`, `permissoes`, `escopoDados` e `destinoInicial` no login e na renovacao de token.
- Endpoint autenticado `GET /auth/permissoes`.
- BFF expondo `GET /api/auth/permissoes` e incluindo permissões na sessao publica.
- Menu do console filtrado pelas permissoes da sessao.
- Protecao do middleware para `/agenda` e `/portal`.
- Esqueleto minimo de `/portal` para o perfil `Patient` nao cair em rota inexistente antes da fase de UI do cliente.

## Decisao de produto

`Patient` nao recebe permissao de console. O portal do paciente tera rotas e escopos proprios, sempre restritos aos dados do proprio paciente.

## Validacao

- Teste unitario da matriz de permissoes.
- Typecheck backend e frontend.
- Build backend e frontend.
- Suite completa backend.
