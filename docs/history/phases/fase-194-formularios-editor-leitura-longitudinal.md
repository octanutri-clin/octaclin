# Fase 194 - Formularios, editor e leitura longitudinal

Status: concluida e validada localmente em 2026-08-01.

Correcao complementar em 2026-08-01: a recorrencia exibida por padrao
(semanal, segunda-feira, 08:00) passou a ser enviada mesmo sem o usuario
alterar os controles, e a opcao `Novo questionario` passou a limpar o
questionario atual e abrir efetivamente o modo de criacao. Ambos os fluxos
receberam cobertura Playwright em desktop e mobile.

## Ja satisfeito por fases anteriores (sem trabalho novo)

- "Preservar versoes" do checklist: o contador `versao` (inteiro,
  incrementado no backend a cada alteracao estrutural -
  `servico-questionarios.ts`) ja existia e ja era exibido na UI; nao foi
  criado historico de versoes navegavel porque o checklist nao pediu isso,
  so preservacao do numero de versao atual.
- "Leitura clinica, comparacao longitudinal e revisao nas respostas, sem
  duplicar dados do prontuario": os endpoints e a UI de leitura clinica e
  matriz longitudinal ja existiam e ja eram contratos dedicados
  (`RespostaQuestionarioRecebidaApi`/`MatrizLongitudinalRespostasApi`), nunca
  tocando a linha do tempo do prontuario. Apenas realocados para a aba
  Respostas, sem mudanca de logica.
- Reordenacao por teclado das perguntas: `pergunta-ordenavel.tsx` ja usava
  `@dnd-kit/sortable` com `KeyboardSensor` e alca com `aria-label` proprio;
  reaproveitado sem alteracao.

## Entregue nesta fase

- **Divisao do monolito em 5 areas** (`components/questionarios/`): o
  componente `EditorQuestionario`, que tinha 1593 linhas e ~35 `useState`,
  virou um container de ~60 linhas. Todo o estado e os handlers foram
  extraidos para o hook `useWorkspaceQuestionarios`
  (`usar-workspace-questionarios.ts`), e a interface virou 5 componentes de
  area, cada um recebendo o retorno do hook como prop `workspace`:
  `AreaFormularios`, `AreaEditor`, `AreaBiblioteca`, `AreaDistribuicao`,
  `AreaRespostas`.
- **Preview simultaneo no Editor**: a antiga aba "Montagem" tinha um botao
  de alternar (`previewAberto`) que escondia/mostrava o preview do paciente
  acima do layout de 3 colunas. A nova aba "Editor" sempre mostra Perguntas
  | Propriedades | Preview lado a lado em telas largas (`xl:grid-cols-...`,
  preview `sticky`), sem toggle - em telas estreitas o preview aparece
  abaixo das duas colunas, sempre visivel.
- **Recorrencia em linguagem comum** (`seletor-recorrencia.tsx`): o campo de
  texto cru "Cron" (duplicado em dois lugares na versao anterior) foi
  substituido por um seletor de Frequencia (Todos os dias / Toda semana /
  Data especifica) + dia da semana + horario, que traduz a escolha para
  `regraCron` ou `dataFixa` internamente. O contrato do backend
  (`criarAgendamentoQuestionario`) nao mudou - ja aceitava os dois campos.
- **Guarda real de alteracoes nao salvas**: a Fase 193 resolveu esse mesmo
  problema em `prontuario-paciente.tsx`; o padrao (`beforeunload` +
  `window.confirm`) foi replicado aqui. Antes, o aviso "Salve antes de
  trocar de formulario" era so um texto - `selecionarQuestionario` trocava
  de formulario imediatamente, sem checar nada. Agora
  `confirmarTrocaComAlteracoesPendentes()` bloqueia a troca ate o usuario
  confirmar, e fechar/recarregar a aba dispara o aviso nativo do navegador.
- **Eliminacao de duplicacao de UI**: a busca/inclusao de biblioteca
  aparecia duas vezes (aba propria + `<details>` dentro de Montagem); o
  bloco de distribuicao/cron tambem aparecia duas vezes (aba propria +
  sidebar de Montagem). Cada UI agora existe uma unica vez, na sua area
  dedicada.
- **Cobertura Playwright nova** (`tests/visual/questionarios-editor.spec.mjs`,
  zero testes existiam para esta pagina antes): guarda de alteracoes nao
  salvas (confirma e cancela a troca de formulario), recorrencia semanal sem
  a palavra "Cron" em tela e com o corpo POST correto
  (`regraCron: '0 8 * * 1'`), e preview lado a lado em tela larga sem botao
  de alternar - 3 testes x desktop/mobile = 6 cenarios.

## Decisao tecnica registrada

- `usarWorkspaceQuestionarios` teve que virar `useWorkspaceQuestionarios`: o
  lint `react-hooks/rules-of-hooks` reconhece hooks pelo prefixo literal
  em ingles `use` (regex fixo da ferramenta, nao configuravel por
  sinonimos), entao o prefixo do hook ficou em ingles (convencao do React)
  mantendo o resto do nome em portugues, unica excecao a convencao de
  identificadores 100% em portugues do projeto.

## Limites deliberados

- Nao foi criado historico de versoes navegavel (ver secao acima) - fora do
  escopo pedido.
- Nao houve smoke test manual em navegador com backend real: o backend
  local nao estava rodando neste ciclo e subir banco/seed so para essa
  verificacao ficou fora de escopo. Em compensacao, o teste visual
  pre-existente `console-regression.spec.mjs` (`/questionarios renderiza
  sem regressao visual`, desktop e mobile) ja tira screenshot da pagina
  renderizada de ponta a ponta com o mesmo padrao de mock de BFF usado nos
  testes desta fase, e passou.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck
pnpm --dir octaclin-web lint
pnpm --dir octaclin-web run build
pnpm --dir octaclin-web exec playwright test tests/visual/questionarios-editor.spec.mjs --reporter=list
pnpm --dir octaclin-web run test:questionarios-revisao:bff
pnpm --dir octaclin-web run test:questionarios-preview
pnpm --dir octaclin-web run test:authz
pnpm --dir octaclin-web exec playwright test tests/visual/jornadas-criticas.spec.mjs tests/visual/console-regression.spec.mjs tests/visual/acessibilidade.spec.mjs --reporter=list
pnpm security:secrets
```

Resultados: typecheck/lint/build limpos; 6 cenarios novos de
`questionarios-editor.spec.mjs` aprovados; 3 testes de leitura de revisao
BFF aprovados; 3 testes de preview de questionario aprovados; 22
verificacoes de autorizacao/BFF aprovadas; 68 cenarios Playwright de
regressao (jornadas criticas, console, acessibilidade) aprovados, incluindo
`/questionarios renderiza sem regressao visual` sem novas violacoes de
acessibilidade nas 5 abas; scanner de secrets sem achados.

Na correcao complementar, os 2 fluxos corrigidos foram executados em desktop
e mobile, totalizando 4 cenarios adicionais aprovados.

## Proxima fase

Fase 195 - Portal do paciente e jornadas publicas.
