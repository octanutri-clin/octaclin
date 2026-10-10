# Handoff — Fase 313: implementação e evidências

## Estado

Implementação concluída no código; validações locais PASS; PR/checks em preparação. Regras clínicas ratificadas pelo proprietário/equipe.
Risco R4 (dados clínicos, migration, RLS e consentimento).

- Branch: `feature/fase-313-antropometria-gestantes`.
- Worktree: `/workspace/octaclin/.worktrees/feature-fase-313-antropometria-gestantes`.
- Base: `774cf34fab2e9cd26e888e57fbaabfe14295930e`, PR #390 mergeado.
- PR da 313: implementação na branch acima, com evidências em preparação para abertura.
- [Plano/contratos/gaps/rollback](../docs/history/phases/PLANO_FASE_313.md).
- [Ficha para revisão clínica](../docs/product/FICHA_VALIDACAO_CLINICA_FASE_313.md).
- [Parecer recebido, preservado](../docs/product/PARECER_REVISAO_FASE_313.md).
- [Sequência executável T01–T18](todo-fase-313.md).
- [Execução, resultados e limites](../docs/history/phases/EXECUCAO_FASE_313.md).
- [Handoff 312 preservado](plan-fase-312.md); gates residuais em todo-fase-312.md
  permanecem históricos, sem fechamento por inferência de merge.

## Próxima ação exata

Implementação autorizada pelo proprietário em GPT-6.1 Sol médio. Em 2026-10-10,
respondeu “Ficha revisada; equipe/responsável ratifica todas as regras” à ficha
atualizada, incluindo peso habitual, 8s0d, bordas e plausibilidade técnica.
Registrar como confirmação humana relatada, sem afirmar nova revisão clínica
independente deste agente. Concluir abertura/checks da PR nesta branch, conforme T17–T18 e o relatório de execução.

## Escopo fechado

Curvas brasileiras, IMC de referência+ganho semanal; adulta >=18 na avaliação,
feto único e risco habitual confirmado. Medidas sem faixa se fora da população
ou incompletas. Peso pré-gestacional medido/informado, medido até oito semanas
ou habitual como origem própria, conforme decisão adicional nesta conversa.
Condição confirmada por avaliação, snapshot cifrado; bloqueio das interpretações
adultas em novos registros gestantes, preservando medidas/histórico.

Gestações explícitas com abrir/encerrar/reabrir; referência corrigida cria nova
versão, séries separadas; avaliação/histórico+gráfico+portal. Profissional libera
cada gestação desligada por padrão, confirmando registros atuais e futuros;
paciente aceita especificamente, pode revogar. Sem notas internas no portal.
Encerrar bloqueia novos registros/referências, conserva histórico/liberação.
Retirada e nova liberação requerem novo aceite. Escopo de produto fechado;
ratificação detalhada da ficha, incluindo peso habitual, recebida nesta conversa.

## Invariantes para execução

- Revalidar Git/branch/diff e números livres antes de editar; um escritor ativo.
- Fonte offline e autoridade clínica no backend; não duplicar tabela na Web.
- Migration proposta 1068: três tabelas (episódio/referência/consentimento),
  FKs compostas tenant/paciente, FORCE RLS, snapshots/versões imutáveis.
  Contexto clínico cifrado. Nada de vínculo automático de registros antigos.
- Reusar ExecutorTenant/carteira/permissões atuais; não copiar exclusividade
  do encaminhamento. Portal deriva paciente da identidade atual.
- Concorrência: locks em ordem consistente, versão esperada/409, criação com
  UUID/replay durável; referência e condição efetivas preservadas por avaliação.
- Gráfico por episódio+versão; 100 avaliações/página, cursor estável, cobertura
  parcial visível. Não usar janela global das últimas 100/24 avaliações.
- Portal só com liberação+aceite atual por geração/usuário; allowlist sem notas,
  no-store e origem nas mutações. Retirada/revogação revalidadas em cada leitura.
- Reset paciente/episódio e respostas atrasadas em todos os fluxos Web.
- PG real prova RLS, FKs, imutabilidade e corridas no serviço, não mocks.
- Down recusa com dados novos; rollback conserva histórico/schema e bloqueios.
- Nenhuma migration/deploy externo autorizado neste planejamento.

## Evidência e fatos operacionais

CI final PR 312 `38049949959` e pós-merge `38052856367` SUCCESS; scanners
pós-merge SUCCESS. Proprietário informou 1067 aplicada/validada em staging e
produção; não houve consulta direta aos bancos. Não atribuir relato às 1065/1066.
Monitor de produção `38065380981` FAIL: HTTP 503 após três tentativas; endpoint/
causa não identificados. Não atribuir à 312 nem afirmar produção saudável.

Implementação/tests/build/PG locais PASS; revisão R4 independente SKIPPED (sem segundo revisor neste ciclo). Clínica: ratificação recebida do proprietário nesta conversa. Parecer de 10/10/2026 relata
conferência das 31 linhas sem erro de transcrição e declara aprovação final
pendente; não é prova independente executada por este agente nem aceite clínico.
O parecer não conferiu integralmente dataset UFRJ V3; download/checksum da
análise anterior continuam evidência distinta, sem atribuir essa prova ao parecer.
PASS: revisão do diff, `git diff --check` e scanner local de secrets
(`node scripts/scan-secrets.mjs`, nenhum secret identificado pelos padrões). Sem teste de feature no planejamento.

## Modelo

GPT-6.1 Sol médio suficiente e recomendado para implementação completa.
Luna alto suficiente para tarefas delimitadas de UI/fixtures/textos após fechar
contratos R4. Priorizar tokens com tarefas pequenas e testes focados antes da
suíte ampla. Avisar e pausar para qualquer troca manual; nenhuma troca feita.
