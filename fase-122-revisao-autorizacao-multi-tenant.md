# Fase 122 - Revisao de autorizacao multi-tenant

Data: 2026-07-23

## Objetivo

Reduzir risco de vazamento cross-tenant em operacoes sensiveis, adicionando testes negativos e corrigindo pontos onde IDs relacionados poderiam ser aceitos sem validacao de pertencimento ao tenant.

## Entregas

- Criados testes negativos para impedir criacao de paciente com profissional responsavel de outro tenant.
- Criados testes negativos para impedir atualizacao de paciente para profissional responsavel de outro tenant.
- Criados testes negativos para impedir disparo de mensagem para paciente de outro tenant.
- `ServicoPacientes` passa a validar `profissionalResponsavelId` contra `ProfissionalOrm` com `id`, `tenantId` e `arquivadoEm IS NULL`.
- `ServicoComunicacoes.dispararMensagem` passa a validar `pacienteId` contra o tenant antes de criar mensagem e outbox.
- `ModuloPacientes` declara `ProfissionalOrm` no `TypeOrmModule.forFeature`.
- `TESTES_E_VALIDACOES.md` ganhou bloco especifico para validacao multi-tenant.

## Decisoes

- IDs recebidos da UI ou BFF continuam sendo tratados como dados nao confiaveis.
- A regra de seguranca fica no servico de aplicacao, alem do controller derivar `tenantId` do JWT.
- Quando uma entidade relacionada nao pertence ao tenant atual, a resposta deve ser `NotFoundException`, nao `ForbiddenException`, para nao revelar existencia em outro tenant.
- A revisao desta fase priorizou vinculos de maior risco: paciente-profissional e comunicacao-paciente.

## Arquivos principais

- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`
- `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts`
- `octaclin-backend/src/modulos/pacientes/modulo-pacientes.ts`
- `octaclin-backend/src/modulos/comunicacoes/aplicacao/servico-comunicacoes.ts`
- `octaclin-backend/src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts`
- `TESTES_E_VALIDACOES.md`
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- `RESUMO_FASES_CONCLUIDAS.md`

## Validacoes

```powershell
cd octaclin-backend
.\node_modules\.bin\jest.cmd --runInBand src/modulos/pacientes/aplicacao/servico-pacientes.spec.ts src/modulos/comunicacoes/aplicacao/servico-comunicacoes.spec.ts
```

## Pendencias para fases futuras

- Expandir a suite multi-tenant para materiais, agenda, portal do paciente e operacoes administrativas quando esses fluxos forem alterados.
- Criar auditoria estatica mais ampla para consultas por `id` sem `tenantId` se o volume de entidades crescer.
