# Pequenas melhorias profissionais paralelas à FOOD06

## Escopo e estado

Preparação autorizada pelo proprietário em 21/11/2026: pequenas melhorias para
o profissional, sem iniciar FOOD08 e sem interferir na FOOD06 do Claude.
Este incremento entrega planejamento; não contém implementação funcional.

Base inspecionada: `main` em `60bbe01f944d3c14a3dd30210bb4843b4187e356`.
Branch própria: `docs/melhorias-profissionais-20261121`.
Worktree própria: `.worktrees/melhorias-profissionais`, com checkout esparso.

Fontes: [roadmap pós-320](../docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md),
seções QST01, OPS03 e OPS01; código dessa base e
[revisão UX A](../docs/agents/ux/reports/PROFISSIONAL-QST01-A-2026-11-21/consolidado.md).
Não foi consultado repositório externo: nenhum é necessário a este preparo.

## Sequência recomendada

| Ordem | Entrega | Evidência observada | Preparação/limite |
| --- | --- | --- | --- |
| 1 | QST01 — expandir/recolher respostas | `components/questionarios/area-respostas.tsx:146–169` renderiza todos os detalhes diretamente em `dl`; não há controles nesse trecho | Pronta para implementação delimitada após reconferir exclusividade dos arquivos |
| 2 | OPS03 — ocultar valores financeiros | `components/agenda/painel-agenda.tsx:953` e `pacotes-sessao.tsx:147` mostram valores; dashboard clínico inspecionado não comprova existência de cards financeiros | Auditar cada superfície antes de afirmar cobertura; definir alcance da preferência com o proprietário |
| 3 | OPS01 — busca rápida na agenda | `lib/agenda-api.ts:370–371` lista consultas sem parâmetros; backend `servico-agenda.ts:125–137` limita a 200 a partir de 30 dias anteriores | Planejar busca server-side e paginação; não simular busca completa filtrando apenas esses 200 itens |

Os caminhos de componentes/lib acima são relativos a `octaclin-web/`.
O serviço da agenda fica em `octaclin-backend/src/modulos/agenda/aplicacao/`.
As observações são localizadas: não provam ausência de implementações alternativas
em todo o produto nem resultados de testes.

### 1. QST01 — primeiro incremento recomendado

**Objetivo:** reduzir a rolagem durante a leitura profissional de questionários,
preservando o conteúdo, a pesquisa e a identificação de cada envio respondido.

**Comportamento proposto:**

- Manter os envios inicialmente expandidos, preservando a leitura atual.
- Expandir/recolher cada envio respondido por identidade `respostaId`.
- Preservar paciente, finalização e quantidade de respostas no cabeçalho.
- Oferecer `Expandir tudo` / `Recolher tudo`, com alcance indicado como resultados
  exibidos; não oferecer ação ativa sem resultados.
- Manter a busca existente também sobre respostas recolhidas. Expandir deve
  permitir conferir o resultado encontrado, sem nova requisição.
- Guardar somente estado visual em memória; não usar armazenamento persistente,
  URL, logs ou telemetria para conteúdo ou identificadores clínicos.
- Ao trocar paciente/questionário, reiniciar a apresentação expandida. Mudanças
  apenas da busca não devem mudar filtros, conteúdo ou ordenação.
- Usar controles nativos acessíveis, estado expandido anunciado e associação
  estável ao conteúdo; manter foco visível, inclusive em ações coletivas.

**Contratos preservados:** workspace e formatação atuais; API/BFF; autorização;
conteúdo e médias; matriz longitudinal; CSV; envios; portal e respostas do paciente.
O recolhimento é organização visual, não proteção de acesso ou remoção dos dados
já carregados. Não introduzir permissões, migrations ou dependências.

**Arquivos potencialmente afetados na execução futura:**

1. `octaclin-web/components/questionarios/area-respostas.tsx`;
2. teste dedicado no padrão vigente de `octaclin-web/tests/visual/`;
3. eventual helper local e teste unitário somente se a lógica de estado justificar;
4. handoff próprio e relatórios UX B/C.

Não alterar `usar-workspace-questionarios.ts` ou componente UI compartilhado por
conveniência; justificar qualquer necessidade antes de expandir a lista.

**Validação futura:**

| Critério | Prova mínima |
| --- | --- |
| Estado inicial e individual | RED/GREEN funcional: dois envios sintéticos; recolher um preserva o outro e o resumo |
| Ações coletivas | Somente os resultados exibidos; lista vazia; preservação de conteúdo/ordem |
| Busca e contexto | Busca por termo escondido, filtros, retorno ao contexto e atualização dos resultados |
| Teclado/foco | Tab, Enter, Espaço, nomes acessíveis, estado anunciado e foco visível |
| Responsividade | Desktop/mobile e texto ampliado sem perder conteúdo ou ações |
| Ausência de efeitos colaterais | Expandir/recolher não dispara fetch/gravação nem persistência local |
| Regressão | Leitura, médias, matriz e exportação existentes preservadas; lint/typecheck afetados |
| UX | B com interface utilizável e C após testes; não confundir revisão estática com teste visual |

Risco estimado R2 para apresentação; elevar se a execução cruzar autorização,
PHI persistida, projeção ou fronteira de acesso. Testes exclusivamente sintéticos.
Rollback previsto: reverter somente o incremento de interface, sem dados a migrar.

### 2. OPS03 — preparação posterior

Ocultar valores visualmente durante o uso do console, sem alterar permissões ou
expor valores a usuários sem acesso. Não mascarar apenas com cor ou CSS deixando
o valor disponível para tecnologia assistiva na apresentação recolhida.

Antes de implementar: mapear leituras financeiras reais no dashboard, agenda,
pacotes e prontuário; separar campos de edição, documentos e exportações.
Não tocar no contêiner do prontuário enquanto houver trabalho concorrente.

Decisão de produto a consolidar: alcance e duração da preferência (sessão ou
persistente por usuário). A preferência jamais deve guardar valores financeiros,
identificadores clínicos ou servir como barreira de segurança.
Não prometer que documentos/exports serão mascarados pelo mesmo controle.

### 3. OPS01 — manter para entrega própria

O limite observado de 200 consultas impede tratar uma filtragem em memória como
busca completa. Reutilizar serviço, DTOs, autorização e BFF existentes; propor
contrato server-side com período e paginação antes de alterar código.
Profissional/equipe só podem pesquisar a carteira e os dados já autorizados.
Exige testes negativos de autorização e respostas tardias; isolamento PostgreSQL/RLS
quando houver mudança relevante nas consultas. É menos isolada que QST01.

## Proteção do trabalho paralelo

- Na inspeção local, as worktrees FOOD06 presentes estavam limpas; isso não prova
  ausência de trabalho do Claude em outro executor. Reconferir antes de implementar.
- O checkout raiz tem alteração preexistente em `octaclin-web/next-env.d.ts`;
  preservada integralmente. Nenhuma worktree de terceiro foi editada.
- Não editar FOOD06, planos alimentares, restrições, prontuário compartilhado,
  auth, migrations, lockfiles, workflows, documentos centrais de status ou providers.
- Antes de cada implementação: atualizar a leitura da main/PRs, verificar os paths
  contra mudanças concorrentes e reservar uma branch/PR Draft por incremento.
- Se o Claude estiver no mesmo arquivo ou contrato, pausar só esse item e escolher
  outro escopo após nova conferência. Não integrar branches automaticamente.
- Evitar testes/builds pesados simultâneos e pushes documentais desnecessários.

FOOD08 e FOOD05-MDL não fazem parte deste preparo. Sem merge, deploy, migrations
externas ou alterações no Neon/Render.

## Evidências desta preparação

- PASS: inspeção Git/base, PRs abertas e trechos de código referenciados.
- PASS: revisão UX A por subagente com papel explícito; somente planejamento.
- N/A paciente: nenhuma alteração no portal, preenchimento, envios ou documentos.
- N/A testes funcionais/build/Playwright: não houve mudança funcional; continuam
  obrigatórios na execução futura. Não há aceite funcional ou CI novo implícito.
- PASS: scanner local `scripts/scan-secrets.mjs` sob Node 22.21.1, sem achados
  pelos padrões locais; não equivale a scanner remoto de CI.
- Verificações finais: diff staged e integridade dos links/manifesta, antes do
  commit documental. O SHA do commit é informado na entrega.

**Próxima ação única:** executar QST01 nesse escopo, após confirmar a exclusividade
dos arquivos e registrar os detalhes de produto como decisão do proprietário.
As demais melhorias permanecem preparadas, não iniciadas.
