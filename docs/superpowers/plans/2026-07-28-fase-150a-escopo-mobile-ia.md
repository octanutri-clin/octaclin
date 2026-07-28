# Fase 150A - Escopo de dados em Mobile e IA

> Execucao orientada por testes. Cada tarefa deve manter o isolamento por tenant e retornar `NotFoundException` para recursos fora do escopo, sem revelar sua existencia.

**Objetivo:** eliminar acesso horizontal a dados clinicos nos modulos Mobile e IA, usando a identidade autenticada como fonte de autoridade.

**Contrato de acesso:**

- `Patient`: somente o paciente vinculado ao proprio `usuarioId`.
- `Professional`: somente pacientes cujo `profissionalResponsavelId` corresponde ao perfil profissional autenticado.
- `SuperAdmin`: todos os pacientes do tenant.
- `Collaborator`: somente endpoints ja delegados pelo contrato de papeis/permissoes; quando o endpoint o admite, conserva a visao operacional atual do tenant.
- IDs enviados em DTOs nunca ampliam o escopo da sessao.

## Task 1 - Politica compartilhada de escopo de paciente

**Arquivos:**

- Criar: `octaclin-backend/src/infraestrutura/seguranca/escopo-recursos-paciente.ts`
- Criar: `octaclin-backend/src/infraestrutura/seguranca/escopo-recursos-paciente.spec.ts`

**Passos:**

1. Escrever testes que falhem para resolucao de escopo de `Patient`, `Professional`, `SuperAdmin` e `Collaborator`.
2. Escrever testes que falhem ao tentar acessar paciente de outro profissional ou outro vinculo de usuario.
3. Implementar uma politica que:
   - resolva o filtro de `pacienteId` ou `profissionalResponsavelId`;
   - valide um `pacienteId` recebido contra tenant, arquivamento e escopo;
   - use sentinela quando o perfil autenticado nao possuir vinculo.
4. Executar a nova suite e o typecheck.

## Task 2 - Aplicar escopo ao Mobile

**Arquivos:**

- Alterar: `octaclin-backend/src/modulos/mobile/apresentacao/controlador-mobile.ts`
- Alterar: `octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.ts`
- Alterar: `octaclin-backend/src/modulos/mobile/aplicacao/servico-mobile.spec.ts`
- Criar ou alterar: teste do controlador Mobile, se necessario para provar propagacao do usuario autenticado.

**Passos:**

1. Escrever testes que falhem para listagens de diario, midia e acompanhantes fora do escopo.
2. Escrever testes que falhem para escrita direta e sincronizacao em lote com `pacienteId` nao autorizado.
3. Propagar `UsuarioAutenticado` do controlador a todos os metodos do servico.
4. Aplicar o filtro compartilhado nas listagens e validar cada escrita antes de persistir ou gerar URL de upload.
5. Garantir que o paciente autenticado nao consiga escolher outro `pacienteId`.
6. Executar testes Mobile e typecheck.

## Task 3 - Aplicar escopo a IA

**Arquivos:**

- Alterar: `octaclin-backend/src/modulos/ia/apresentacao/controlador-ia.ts`
- Alterar: `octaclin-backend/src/modulos/ia/aplicacao/servico-ia.ts`
- Alterar: `octaclin-backend/src/modulos/ia/aplicacao/servico-ia.spec.ts`
- Criar ou alterar: teste do controlador IA, se necessario para provar propagacao do usuario autenticado.

**Passos:**

1. Escrever testes que falhem para listagens de sentimento e reconhecimento fora do escopo profissional.
2. Escrever testes que falhem antes de chamar o provedor externo quando o paciente nao estiver autorizado.
3. Propagar `UsuarioAutenticado` do controlador e aplicar a politica compartilhada.
4. Garantir que cache de reconhecimento tambem inclua `pacienteId`, evitando reutilizacao entre pacientes.
5. Sanitizar erros do provedor para nao devolver corpo externo ao cliente.
6. Executar testes IA e typecheck.

## Task 4 - Regressao, documentacao e encerramento

**Arquivos:**

- Criar: `fase-150a-escopo-mobile-ia.md`
- Alterar: `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`
- Alterar: `RESUMO_FASES_CONCLUIDAS.md`
- Alterar: `STATUS_ATUAL_PROJETO.md`
- Alterar: `MAPA_ROTAS_PERMISSOES.md`, se o contrato documentado precisar de precisao adicional.

**Passos:**

1. Executar testes direcionados, typecheck e build do backend.
2. Executar toda a suite do backend.
3. Executar validadores de documentacao e autorizacao existentes.
4. Revisar o diff como seguranca e confirmar ausencia de mudancas na integracao Google Agenda.
5. Atualizar checklist, resumo e status com evidencias reproduziveis.
6. Criar um unico commit da Fase 150A.
