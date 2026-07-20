# Fase 65 - Convite e primeiro acesso do paciente

## Objetivo

Permitir que o profissional gere um convite seguro para o paciente ativar o acesso ao portal, definir senha e registrar aceite LGPD.

## Entregue

- Tabela `convites_paciente_acesso` com token armazenado somente como hash.
- Token de ativacao com contexto de tenant para respeitar RLS mesmo em endpoint publico.
- Endpoint autenticado `POST /pacientes/:id/convites-acesso`.
- Endpoints publicos:
  - `GET /pacientes/convites-acesso/:token`
  - `POST /pacientes/convites-acesso/ativar`
- Ativacao cria usuario `Patient`, vincula `pacientes.usuario_id` e registra `consentimentos_lgpd`.
- BFF para criar, validar e ativar convites.
- Tela publica `/primeiro-acesso?token=...`.
- Botao de convite na lista de pacientes com copia do link para area de transferencia quando permitido pelo navegador.

## Variaveis novas

Backend:

- `OCTACLIN_WEB_URL`: origem web usada para montar o link de ativacao.

Web:

- `OCTACLIN_BACKEND_URL`: backend usado pelo BFF publico antes de existir sessao.

## Decisoes

- Convite expira em 7 dias.
- Paciente que ja possui `usuarioId` nao recebe novo convite de primeiro acesso.
- A ativacao exige `aceiteLgpd=true`.
- O fluxo ativa a conta e direciona o paciente para login; login automatico fica para uma fase posterior se decidirmos simplificar ainda mais a experiencia.

## Validacao

- Teste unitario de convite e ativacao.
- Suite completa backend.
- Typecheck backend e web.
- Build backend e web.
