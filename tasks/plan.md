# Handoff — Fase 311: planejamento concluído → implementação

## Branch, base e objetivo

- Branch: `feature/fase-311-ativacao-conteudo`.
- Worktree: `/workspace/octaclin/.worktrees/feature-fase-311-ativacao-conteudo`.
- Base: `eb7f2aad`, Fase 310/PR #388 MERGED, confirmada no GitHub em 2026-10-10.
- PR da Fase 311 ainda não aberta; o próximo PR reúne este plano e implementação.
- Objetivo: kit genérico selecionável/incremental para clínicas existentes e
  diagnóstico somente leitura das cargas globais TACO/USDA/IBGE.
- Plano completo e contratos: [PLANO_FASE_311.md](../docs/history/phases/PLANO_FASE_311.md).
- Sequência executável: [todo-fase-311.md](todo-fase-311.md).

## Decisões confirmadas pelo proprietário

1. Client instala na própria clínica; SuperAdmin pode instalar em uma clínica
   escolhida, com confirmação que basta para opt-in, sem aprovação do gestor.
2. Selecionar materiais e estruturas; permitir complementar depois.
3. Itens instalados não são recriados, reativados ou removidos pelo instalador,
   mesmo se o material foi adaptado ou desativado.
4. Catálogos ausentes/indisponíveis são visíveis ao SuperAdmin e não bloqueiam kit.
5. Estruturas seguem sem alimentos; nenhum envio ao paciente decorre da instalação.

Não há pergunta de produto pendente.

## Contrato que o implementador deve preservar

- Cinco chaves estáveis: `material:plano-no-portal`, `material:registro-habitos`,
  `material:duvidas-consulta`, `estrutura:tres-refeicoes`, `estrutura:cinco-refeicoes`.
- POST: `{ confirmacao: true, versao: 2, itens: [chaves...] }`, de 1–5 únicas.
  Nenhum conteúdo/autor/tenant no body. Client usa `/cliente/kit-inicial`;
  SuperAdmin usa `/operacoes/tenants/:id/kit-inicial`; ambos também têm GET.
- Marcador 1 legado = kit completo, sem escrita/backfill. Marcador 2 = união
  incremental das chaves; formatos desconhecidos/inválidos bloqueiam instalação.
- Um parser e um helper em Tenancy, usados por provisionamento/Client/SuperAdmin.
  Lock advisory por tenant antes da leitura; criar só a diferença; materiais,
  marcador e auditoria na mesma transação. Retry puro não escreve nem reaudita.
- Validar autor no tenant da identidade; Client não troca alvo. SuperAdmin
  autorizado troca contexto RLS no manager transacional e usa sua própria autoria.
  Não dar BYPASSRLS/owner ao runtime nem atribuir ação ao Client por procuração.
- ModuloTenancy exporta serviço compartilhado; ModuloClientes/Operacoes já o usam.
  Não criar dependência Operacoes → Clientes ou import circular de módulos.
- Listagem de modelos: legado1 libera ambas estruturas; marcador 2 somente as
  escolhidas; inválido nenhuma. Total de modelos pessoais continua factual.
- UI Client na aba Ativação de `/cliente`; UI SuperAdmin no onboarding de
  Operações para um alvo por ação. Mesma seleção, confirmação e estados.
- Quatro bases de catálogo verificadas separadamente: TACO, USDA Foundation,
  USDA SR Legacy e IBGE POF. Estado depende de edição ativa/direito/importação
  consistente nas identidades e contagens/alimento utilizável; erro SQL não é ausência.
- API global `/operacoes/catalogos-alimentares/disponibilidade`, SuperAdmin com
  `operacoes.tenants.gerenciar`, SELECT-only, DTO sanitizado/no-store. Dez edições
  por base na projeção; resumo considera todas; falha de atualização não invalida
  edição anterior válida. Nenhuma carga, seed ou reativação de fonte pela tela.
- Nenhuma migration nova prevista. Rollback preserva dados: versão antiga oculta
  estruturas de marcador 2; nunca converter marcador 2 para1 para contornar o limite.

## Mapa inicial de arquivos

Existentes a reler/modificar:
- Backend: `tenancy/kit-inicial-clinica.ts`, helper de `operacoes/aplicacao`,
  `servico-ciclo-vida-tenant`, `servico-modelos-plano-alimentar` e respectivos
  specs; `modulo-tenancy`, controladores Client/Operacoes e DI.
- Catálogos: entidades globais, migrations 1028–1030, importadores 299 e
  `ServicoPlanosAlimentares.buscarAlimentos`; não utilizar busca como diagnóstico.
- Web: `components/cliente/areas-visao-assinatura.tsx`,
  `components/operacoes/area-onboarding.tsx`, lib/cliente-api e
  lib/onboarding-operacoes-api; wrappers de sessão/BFF e segurança de origem.
- Provas: harness RLS/Testcontainers existente, `test:authz`, Playwright
  `portal-cliente.spec.mjs`, mock `octaclin-backend/scripts/api-demo-local.mjs`.

Novos previstos (ainda não existem): helper/parser/DTO/serviço compartilhados
sob Tenancy, serviço de disponibilidade sob Operacoes, três rotas BFF,
componente selecionável, harnesses de testes e Playwright da Fase 311.
O checklist contém dependências e cenários positivos/negativos por entrega.

## Estado observado e validações

- PASS — PRs 386/388 MERGED (`34d186ec`/`eb7f2aad`), consultadas neste ciclo.
- PASS — CI da PR 388 `38014957842`, incluindo Governança, Backend, Web,
  Demo local smoke e PR Gate; step de RLS/Testcontainers do Backend aprovado.
- PASS — CI principal pós-merge 309 `38000687212`; scanners pós-merge 310
  Semgrep `38016413577`, Trivy `38016413549`, CodeQL `38016413585` aprovados.
- PENDENTE — CI principal pós-merge 310 `38016413569` estava em andamento,
  com Demo local smoke ainda rodando. Consultar esse ID antes de implementar.
- SKIPPED — Provenance do SBOM na PR 388. Não contar como PASS.
- PASS — `git diff --check`, `pnpm security:secrets` e verificador documental
  da matriz (`node scripts/test-matriz-confiabilidade.mjs`, 40 referências).
  Links relativos, blocos Markdown, cinco chaves e versão 2 revisados;
  todas as alterações deste planejamento são Markdown.
- SKIPPED — preflight documental em PowerShell: `pwsh` não está disponível.
  As verificações proporcionais acima passaram, sem equivaler ao preflight completo.
- Ambiente observado: Node 24.19.0/pnpm 11.19.0; usar Node 22/pnpm 11.25.0
  na implementação, conforme os manifests. O scanner de segredos passou com aviso.
- FAIL de integração do tooling — AI DevKit lint/lint da feature assume
  `docs/ai/*` ausente e outra convenção de branch. Não executar init;
  documentos OctaClin acima são canônicos. Sem bloqueio de produto por isso.
- SKIPPED — testes/build da implementação 311 e prova PostgreSQL; nenhum
  código executável da 311 foi escrito durante o planejamento.
- SKIPPED — banco operacional, migrations 1065/1066, configuração de canais,
  envios reais, deploy/produção; não foram consultados/executados.
- Revisão R4 formal GitHub: nenhuma entrada encontrada nas PRs 386/388;
  isso não comprova revisão externa independente. Requerir revisão específica
  da 311 quando viável e não declarar rollout baseado apenas no merge.

## Concluído e arquivos deste planejamento

- [x] Análise de gaps/código, decisões, contrato de seleção/legado/catálogos.
- [x] Branch/worktree dedicada e plano/checklist para implementação Luna.
- [x] Reconciliação factual dos documentos 309/310 e preservação do handoff 309.
- [x] Validação documental proporcional final; evidências e limites acima.
- [x] Planejamento preparado para commit na branch dedicada; consultar o
  histórico Git para o identificador, sem iniciar implementação nesta etapa.

Alterados: plano 311, `tasks/plan.md`, `tasks/todo.md`, checklist 311,
status/checklist/roadmap/resumo/matriz e notas de integração dos históricos
309/310. Handoff antigo 309 preservado em `tasks/plan-fase-309.md` e
`tasks/todo-fase-309.md`; tarefas históricas não são reabertas por estes textos.

## Próxima ação exata / troca de modelo

Planejamento com GPT-6.1 Sol médio; implementação recomendada com GPT-6 Luna
alto para economizar tokens com o contrato fechado. O usuário exige aviso e
pausa na troca manual. Não começar código neste turno de planejamento.

Depois de o usuário trocar: entrar nesta worktree, reconfirmar Git/CI e ler
este handoff + plano/checklist; começar pelo passo 1 do checklist, em TDD,
no runtime suportado. Manter a branch e uma futura PR única para a fase.
Handoff antigo de 309/310 não define a tarefa corrente.
