# Fase 19 - Auditoria de leitura sensivel

## Objetivo

Fechar a lacuna de rastreabilidade aberta pela Fase 18: a API passou a devolver nomes e contatos descriptografados para usuarios autorizados, entao as leituras desses dados tambem precisam deixar trilha operacional.

## Entregas

- Entidade TypeORM `UserActionLogOrm` mapeando a tabela existente `user_action_logs`.
- Servico `ServicoAuditoria` para gravar eventos dentro do contexto RLS do tenant via `ExecutorTenant`.
- Auditoria nos endpoints:
  - `GET /pacientes`
  - `GET /pacientes/:id`
  - `GET /profissionais`
  - `GET /profissionais/:id`
- Eventos gravados com `tenantId`, `usuarioId`, `acao`, `recursoTipo`, `recursoId` quando houver, `ip`, `userAgent` e metadados de paginacao nas listagens.
- Falhas de auditoria ficam isoladas em log interno e nao interrompem o fluxo principal de leitura.

## Acoes

- `pacientes.listar_dados_sensiveis`
- `pacientes.obter_dados_sensiveis`
- `profissionais.listar_dados_sensiveis`
- `profissionais.obter_dados_sensiveis`

## Arquivos principais

- `outputs/octaclin-backend/src/infraestrutura/auditoria/user-action-log.orm.ts`
- `outputs/octaclin-backend/src/infraestrutura/auditoria/servico-auditoria.ts`
- `outputs/octaclin-backend/src/infraestrutura/auditoria/servico-auditoria.spec.ts`
- `outputs/octaclin-backend/src/modulos/pacientes/apresentacao/controlador-pacientes.ts`
- `outputs/octaclin-backend/src/modulos/profissionais/apresentacao/controlador-profissionais.ts`

## Validacao

- `tsc --noEmit`: aprovado.
- `jest --runInBand`: aprovado, 11 suites e 29 testes.
- `nest build`: aprovado.
- `node work/checar-imports-relativos.js`: aprovado, `relative-imports-ok 117`.
- busca por mencoes ao sistema usado como referencia: sem ocorrencias fora do historico de validacao.
