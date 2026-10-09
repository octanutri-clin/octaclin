# Fase 307 - Progresso do paciente além do peso

## Objetivo

Completar a área de progresso do portal do paciente com métricas
antropométricas além do peso e metas escolhidas pelo profissional como marcos.
Cada valor compartilhado exibe unidade, data e origem. A tela descreve dados
registrados; não calcula evolução, alvo, classificação ou recomendação clínica.

## Estado observado e análise de gaps

- O endpoint autenticado do portal resolve o paciente pelo `usuarioId` e
  `tenantId` da sessão, e não por um identificador informado pelo navegador.
- `ServicoPortalPaciente.obterResumoPortal` já consulta avaliações
  antropométricas do paciente vinculado e expõe automaticamente até 24 pontos
  de peso. A UI exibe somente a curva de peso, na área de check-ins.
- Os valores antropométricos e os resultados calculados permanecem
  criptografados no banco. O portal ainda não expõe IMC, percentual de gordura
  ou massa magra, nem há seleção de métricas por avaliação.
- Tarefas de acompanhamento já são listadas no portal do próprio paciente,
  mas o registro não possui uma escolha explícita para destacar uma meta como
  marco de progresso. A descrição da tarefa pode conter contexto clínico e não
  deve ser copiada para a nova seção.
- Não existe rota pública ou endpoint novo necessário. A alteração pode usar o
  fluxo autenticado existente e manter acesso tenant-scoped.

## Contrato e decisões

- Permitir compartilhar por avaliação somente métricas numéricas disponíveis
  de IMC (`kg/m²`), percentual de gordura (`%`) e massa magra (`kg`).
- Peso mantém o comportamento já existente. Resultados calculados não incluem
  faixas, classificações, avisos, composição total ou comparações.
- O profissional seleciona cada métrica no formulário da avaliação. Nenhuma
  métrica nova é compartilhada por padrão. Seleções sem valor calculado são
  ignoradas pelo backend.
- O portal mostra pontos agrupados por métrica, com data da avaliação e origem
  fixa “Avaliação antropométrica”. Não mostra IDs, consulta vinculada, fórmula,
  protocolo, observação ou nota clínica.
- O profissional pode marcar uma tarefa da categoria `meta` como marco de
  progresso. Esse sinalizador começa desligado e não muda o comportamento atual
  do cartão de tarefas. A nova seção exibe apenas título, estado e datas do
  marco; nunca a descrição.
- Marcos compartilhados incluem estados pendente, em andamento e concluído,
  ordenados do mais recente, limitados aos 20 mais recentes. Metas não marcadas
  e outras categorias ficam ausentes; ausência de marcos é mostrada
  explicitamente.
- Não introduzir notificações, compartilhamento externo, novas decisões
  clínicas ou alterações da API pública `/v1`.

## Risco e dados

R4: dados clínicos no portal e controle de compartilhamento. A migration 1064
é aditiva e adiciona uma lista JSONB de métricas autorizadas por avaliação e
um booleano de destaque de progresso por tarefa. Defaults vazios/desligados
preservam o histórico sem compartilhar novos valores ou marcos. Sem backfill,
DDL automático, deploy ou acesso a banco externo; aplicar fora de banda conforme
os runbooks antes de habilitar a versão que usa os novos campos.

Rollback de código é seguro antes de executar migration. Após a migration, a
remoção das colunas é deliberadamente evitada; o rollback funcional consiste em
parar a aplicação da nova versão, mantendo colunas aditivas não utilizadas.

## Tarefas e critérios de validação

1. Registrar primeiro testes de serviço para métricas selecionadas e não
   selecionadas, dados sem valor, escopo de paciente/tenant, e para marcos
   marcados e não marcados; demonstrar RED antes da implementação.
2. Adicionar os campos tipados, validação da lista de métricas permitidas,
   migração 1064 com teste de SQL e rollback seguro, e registro na lista
   explícita do TypeORM.
3. Propagar seleção de métricas pelo DTO e formulário profissional; adicionar
   opção de destaque apenas para categoria meta e persistir a decisão no
   servidor.
4. Projetar pontos de progresso e marcos no resumo do portal autenticado,
   mantendo projeções mínimas e exclusivas do paciente da sessão.
5. Apresentar seções acessíveis e responsivas no portal, com estados carregando,
   falha, vazio e dados disponíveis; atualizar testes visuais e fixtures.
6. Reconciliar roadmap, checklist, status e resumo de fases com o merge da 306
   e o estado observado desta fase.
7. Revisar contratos, tenancy, saída de dados e migration; executar suites
   focadas, typecheck/build adequados, testes de redação, scanner de secrets,
   validação documental e `git diff --check`.

## Aceite

- Só métricas selecionadas pelo profissional e realmente calculadas aparecem;
  pontos mostram valor, unidade, data e origem.
- O portal não expõe métricas não selecionadas, classificações clínicas,
  observações, fórmulas, identificadores ou dados de outro paciente/tenant.
- Só metas explicitamente marcadas pelo profissional aparecem como marcos;
  tarefa não marcada e descrição nunca são reveladas pela nova seção.
- Ausência de métricas ou marcos tem estado vazio claro, sem inferir ausência de
  progresso. Nenhuma comparação ou cálculo de alvo ocorre.
- Migration aditiva está registrada e coberta; nenhuma operação em banco,
  migration em produção ou deploy é executada nesta fase.
- Gates locais e CI aplicáveis passam; resultados `SKIPPED` permanecem
  explicitamente não aprovados.

## Execução

- [x] Planejamento e análise de gaps concluídos.
- [x] Backend, migration e testes implementados.
- [x] UI profissional e portal implementados.
- [x] Documentação de status reconciliada.
- [~] Verificações locais concluídas; a suíte agregada `test:authz` parou ao ler tipos Next gerados durante compilação paralela. Typecheck reexecutado isoladamente passou; revisão independente pendente.
- [ ] PR draft aberta; CI remoto pendente.
