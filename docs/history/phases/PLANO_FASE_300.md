# Fase 300 — prioridade de acompanhamento nas filas operacionais

## Decisão e escopo

O proprietário confirmou que o dashboard e os filtros devem usar a prioridade
de acompanhamento calculada na Fase 265. O campo `pacientes.score_risco` fica
armazenado apenas para compatibilidade com integrações legadas; a equipe usa
o override auditado da prioridade para ajustar a faixa. A API pública atual
não expõe `scoreRisco`; por decisão do proprietário, continuará sem expor
qualquer prioridade operacional.

Risco **R4**: leitura de dados clínicos com escopo de tenant/profissional.
Não há DDL, carga ou alteração em produção nesta fase. Rollback de código
restaura a interface anterior; as prioridades e os históricos persistidos não
são apagados. A migração/retirada do campo legado exige fase própria.

## Contrato

- A faixa efetiva é `overrideFaixa` somente enquanto `overrideExpiraEm` estiver
  no futuro; nos demais casos é a faixa calculada.
- Sem cálculo real registrado, a interface mostra **Aguardando apuração**.
  A criação de um override pode criar uma linha de estado com score zero antes
  da primeira rodada, portanto uma linha sozinha não prova cálculo. Um evento
  histórico `calculo` é a prova. Um override ativo pode ser exibido mesmo antes
  do primeiro cálculo, com origem explícita.
- A fila do dashboard, o contador de alta prioridade e o painel de operação
  da clínica usam a mesma semântica. `statusAdesao` permanece filtro de situação
  independente e não altera a faixa calculada.
- Filtros de alta/média/baixa usam a faixa efetiva, calculada ou override
  vigente, e preservam o escopo por tenant, carteira, busca e paginação. Sem
  cálculo e sem override vigente não corresponde a nenhuma dessas três faixas.
- O legado `scoreRisco` permanece no DTO de paciente para compatibilidade,
  mas deixa de aparecer como score clínico e de ser enviado pelo formulário Web.
  A fila do dashboard deixa de enviar `scoreRisco` e `nivelRisco`; a API pública
  permanece sem prioridade.
- O GET individual de prioridade mantém os valores legados, mas acrescenta
  `apurado=false` quando não existe evento de cálculo. O prontuário não apresenta
  o default técnico `baixa/0` como resultado clínico; override ativo continua visível.
- A interface identifica origem e instante da última apuração. Não interpreta
  essa prioridade como diagnóstico, gravidade ou risco de vida.

## Plano de execução

1. Criar projeção compartilhada da prioridade, limitada por tenant e IDs de
   pacientes já autorizados, com prova de cálculo e tratamento do override.
2. Aplicar a projeção à listagem e ao detalhe de pacientes; trocar o filtro SQL
   do score manual pela faixa efetiva, sem filtrar em memória após paginação.
3. Aplicar ao dashboard clínico e ao painel agregado da clínica. Contagens e
   alertas de alta prioridade devem coincidir com as filas.
4. Ajustar lista, filtros, formulário e dashboard Web para a nova semântica;
   manter o campo legado fora do formulário e tratar apuração pendente no prontuário.
5. Reconciliar auditoria, checklist e status do projeto junto à entrega;
   corrigir também as afirmações antigas sobre Fases 298–299 e API pública.

## Revisão de gaps antes da implementação

- **Linha criada por override sem job:** consultar histórico de `calculo`, não
  usar existência do estado como prova de apuração.
- **Override vencido:** nunca classificá-lo como vigente; o GET individual
  continua responsável por limpar e auditar a expiração. Leituras em lote não
  devem escrever nem gerar eventos duplicados.
- **Ausência de cálculo:** não classificar como baixa, não computar como alta,
  nem usar o score legado como fallback silencioso.
- **Paginação e filtros salvos:** executar filtro no banco, preservando total
  correto e sem expor pacientes de outro profissional/tenant.
- **API pública:** o diagnóstico da auditoria estava desatualizado; não há
  `scoreRisco` no DTO público atual. Não ampliar sua superfície nesta fase.
- **Recálculo atrasado:** expor `calculadoEm` quando houver cálculo. A rotina
  diária existente e a reconciliação operacional da Fase 265 permanecem a
  fonte da apuração; não calcular por requisição.

## Verificação e aceite

O diff deve preservar tenant e carteira em todas as consultas, não expor
fatores/justificativas em listas nem no portal do paciente, e não criar escrita
ou migration. Revisar casos positivos e negativos de ausência de cálculo,
override válido/vencido, fronteira entre faixas, outro tenant e profissional,
paginação e filtro combinado. Registrar PASS/FAIL/NA/SKIPPED com evidência do
mesmo ciclo, inclusive `git diff --check` e `pnpm security:secrets` antes de
qualquer push. A entrega não autoriza cutover ou prova de produção sem
verificação específica do ambiente.

## Evidência local em 2026-10-01

- **PASS:** Jest backend completo com Node 22.23.2 (248 suites, 2.281 testes;
  4 suites e 41 testes ignorados pelo conjunto); 111 testes focados com Node 22.
- **PASS:** typecheck e build backend/Web com Node 22; lint Web sem erros
  (62 avisos existentes); linguagem Web; autorização BFF; Playwright focado
  de lista, prontuário e painel da clínica; validação documental;
  `git diff --check` e scanner local de secrets.
- **SKIPPED:** prova PostgreSQL/RLS local sem Docker disponível. CI e revisão
  cruzada R4 ainda são gates de merge. Nenhuma ação de produção nesta fase.
