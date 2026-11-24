# QPRO-09 — categorias de respostas sob demanda

## Escopo e base

Branch `feat/qst-distribuicao-completa`, base main
`989f4d5c3f02a79565034dd2cdad9093095f4ad0` (merge #574).
Autorização: continuidade das pequenas melhorias profissionais e nova PR, em
23/11/2026. Não incorpora #575, não toca FOOD06 nem inicia FOOD08.
Risco R2: apresentação local, preservando fronteiras de leitura existentes.

## Diagnóstico e contrato

`ServicoQuestionarios.montarDistribuicao` agrega e ordena as categorias; a API
`leitura-clinica` já as retorna em `perguntas[].distribuicao`. `AreaRespostas`
limitava a apresentação a `slice(0,4)`, sem informar outras categorias.
Não há novo endpoint, soma, agregação, ordenação ou autorização.

O componente `DistribuicaoRespostas` reutiliza o DTO do workspace, `Botao`,
estilos e estados React locais. Mostra quatro categorias inicialmente e, se
houver mais, informa “4 de N categorias recebidas”. Cada acionamento revela
até 20 adicionais; recolhimento disponível também antes de chegar ao fim.
Exemplo de 25 categorias: 4 → 24 → 25 → 4. Contagem de categorias recebidas,
não de pacientes, respostas, cobertura científica ou histórico completo.
Não acrescenta percentuais ou interpretação clínica.

- Estado independente por pergunta, paciente e questionário.
- Nova distribuição recebida reinicia expansão, inclusive com os mesmos IDs.
- Mesma ordem/valores/contagens, inclusive zero e texto parecido com HTML.
- Lista semântica e status textual; botões com aria-controls/expanded.
- Foco preservado no controle principal ao concluir/recolher.
- Sem requisições, persistência ou mudança de filtros ao expandir/recolher.
- Até quatro categorias: sem controles desnecessários; vazio mantém o fluxo anterior.
- Fonte e valores de respostas antigas, busca e CSV permanecem intactos.

## Arquivos

- `octaclin-web/components/questionarios/distribuicao-respostas.tsx`: apresentação delimitada.
- `octaclin-web/components/questionarios/area-respostas.tsx`: integração no card existente.
- `octaclin-web/tests/visual/questionarios-respostas.spec.mjs`: quatro cenários em desktop/mobile, reutilizando fixtures existentes.

## Evidências

- RED funcional: ausência de indicador “4 de 6 categorias recebidas” no fluxo
  real Next/Chromium com BFF sintético; não falha de instalação ou compilação.
- GREEN inicial: 8/8 cenários novos PASS (36,4 s).
- Regressão final após reforçar filtro não vazio e caso sem categorias:
  **94/94 PASS** (4,5 min): 76 de leitura de respostas + 18 de acessibilidade,
  desktop/mobile. Os oito cenários novos estão incluídos nos94; não somar reruns.
- Typecheck Node 22.21.1, lint dos componentes alterados e gate de linguagem: PASS.
- Revisão própria do diff, scanner local de segredos e `git diff --check`: PASS.
- Revisão técnica independente estática `/root/auth2_r4`: **favorável**, sem
  achados bloqueantes, sem autoria ou execução própria. Conferiu reset/identidade,
  foco, slice sem mutação, React texto e ausência de rede/storage no componente.
- UX A/D profissional favorável com critérios de foco/escopo/conservação dos
  valores; B/C e limitações no relatório vinculado abaixo. Paciente N/A,
  apresentação exclusiva do console sem alteração do conteúdo entregue.

Dependências locais reutilizadas: Next 16.3.8, manifesto ^16.4.5; sem instalação,
lockfile ou engine alterados. CI canônico do novo HEAD permanece necessário.
Os testes usam BFF/cookies sintéticos, não provam autenticação/RLS de banco.
PostgreSQL/RLS, build completo local, leitor de tela manual e aparelho físico:
SKIPPED por ausência de mudança nessas fronteiras; teclado/axe/reflow automatizados
são evidências específicas, não validação assistiva completa.

## Aceite e limites

Critérios QPRO-09 deste incremento: categorias ocultas consultáveis, alcance
explícito, ordem/contagens preservadas, expansão delimitada, recolhimento/teclado,
isolamento/reinício do estado, ausência de escrita e regressões do console.
Não altera a política de acesso da API nem resolve paginação QPRO-03,
completude por versão QPRO-10 ou português dinâmico QPRO-15 restante.

Relatório [UX](../docs/agents/ux/reports/QPRO-09-ABC-2026-11-23/consolidado.md).
PR Draft própria, um push após validação local. Sem merge/deploy/migrations,
infraestrutura, configurações, dados reais ou trabalho em outras worktrees.
Rollback de código da PR, sem migração de dados.
