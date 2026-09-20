# Plano da Fase 270 - caminho manual para condicao especial (PB-14)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-20, depois do merge da Fase 269 (PB-13, PR `#277`,
merge `4e36bda`).

Segundo item da **Onda 3 - devolver tempo ao profissional**, na ordem
definida pelo proprietario: PB-13, **PB-14**, PB-15, PB-23, PB-16, PB-25.

## 2. O gap: a trava estava certa, faltava a saida

O audit ja registrava o diagnostico e ele se confirmou no codigo:
`possuiCondicaoEspecial: true` fazia `atualizarRascunho` recusar o calculo
com "o calculo automatico nao e seguro e nao esta disponivel nesta fase".

**Essa trava e deliberada e correta, e nao foi removida.** Aplicar equacao
populacional (Mifflin, Harris-Benedict, FAO/OMS) em paciente com condicao
especial produz numero que ninguem deveria usar.

O problema era nao existir alternativa. Na pratica era pior do que o audit
descrevia: `validarFormulario` empurrava um erro incondicional
(`plano-alimentar-profissional.tsx`), entao o profissional **nao conseguia
nem salvar o rascunho**, e a interface mandava "use uma conduta individual
fora deste fluxo" -- ou seja, sair do produto.

## 3. Decisao de produto do proprietario

1. **Entrada manual com metodo escolhido por paciente**: o profissional
   escolhe expressar os macronutrientes em **percentual** da meta energetica
   ou em **g/kg** de peso.
2. **Publica normalmente**: o rastro clinico e a justificativa obrigatoria
   mais o registro explicito de que a meta foi manual. Exigir um portao extra
   recriaria parcialmente o beco sem saida que o PB-14 existe para resolver.

## 4. Desenho: so a etapa da formula e substituida

`calcularMetasMacronutrientes(metaEnergeticaKcal, distribuicao)` nao depende
da formula -- recebe kcal e distribuicao. O mesmo vale para
`avaliarDivergenciasNutricionais`, que compara metas com o total das
refeicoes. Entao o caminho manual **pula apenas a estimativa energetica**; o
motor de macros e os alertas de divergencia continuam identicos.

- **Percentual**: o profissional digita a meta em kcal; os gramas saem do
  mesmo motor do caminho automatico.
- **g/kg**: o profissional digita g/kg por macro; os gramas saem de
  `g/kg x peso da avaliacao vinculada` e a **energia e derivada deles**
  (4/4/9). Nao ha kcal digitada em paralelo, que seria uma segunda fonte de
  verdade capaz de divergir dos gramas prescritos.

O peso usado em g/kg e o da avaliacao antropometrica ja vinculada ao plano.
Limitacao conhecida e registrada: nao ha como prescrever sobre peso seco ou
peso ideal nesta fase; quem precisar disso usa o metodo percentual.

## 5. Invariante clinica: condicao especial <-> meta manual

O servico exige que as duas coisas andem juntas, nos dois sentidos:

- condicao especial com `origemMeta: 'formula'` -> recusado (a trava).
- `origemMeta: 'manual'` sem condicao especial -> recusado, para a meta
  manual nao virar atalho de quem quer pular a formula.

A checagem e repetida em `garantirRascunhoCompleto`, que roda em `revisar` e
`publicar`, lendo o snapshot: um rascunho nao pode ser publicado violando a
invariante, mesmo que tenha sido gravado por outro caminho.

## 6. Defeito de seguranca clinica encontrado no caminho (fora do PB-14)

Ao reescrever `atualizarRascunho` apareceu um problema **mais grave que o
proprio PB-14**, pre-existente e invisivel:

`atualizarRascunho` fazia `rascunho.revisadaEm = undefined` para invalidar a
revisao depois de uma edicao. O TypeORM **ignora propriedade `undefined` no
`save()`** -- verificado na fonte da versao instalada
(`persistence/SubjectChangedColumnsComputer.js`): `// we don't perform
operation over undefined properties (but we DO need null properties!)`.

Consequencia: a coluna `revisada_em` mantinha o valor antigo no banco. Como
`publicar` exige `revisadaEm`, era possivel **revisar, editar o plano e
publicar sem nova revisao** -- exatamente o que o portao de revisao existe
para impedir.

Era invisivel por dois motivos: `montarVersao` responde a partir do objeto em
memoria (que tinha `undefined`, parecendo correto), e os testes usam
repositorio falso, onde atribuir `undefined` de fato limpa.

Corrigido junto porque sao as mesmas linhas que esta fase reescreve: deixar
um controle de seguranca quebrado em codigo que estou editando seria pior do
que o escopo extra. `revisadaEm`, `revisadaPorUsuarioId` e `hashConteudo`
passam a receber `null`, e os tipos do ORM foram alargados para `| null`. O
teste que "provava" a invalidacao passou a exigir `toBeNull()`.

Mesma razao vale para `formulaCodigo`/`formulaVersao` no caminho manual: um
rascunho que comecou pela formula e virou manual nao pode manter o codigo da
formula antiga no banco.

## 7. Risco, rollout e rollback

R4 (dado clinico e controle de seguranca clinica), sem migration e sem
mudanca de schema -- as colunas ja eram nullable. Rollback e reversao pura do
commit. Nenhuma acao de producao, seed ou dado real foi usada.

## 8. Fora do escopo desta fase

- Remover ou afrouxar o bloqueio do calculo automatico (intencional).
- Peso seco / peso ideal como base do g/kg (ver secao 4).
- Revisao cruzada por segundo profissional: hoje `revisar` e do mesmo
  profissional, entao nao seria revisao independente de verdade.
- PB-15 (template de evolucao clinica), proximo item da onda.

## 9. Gates

- [x] `pnpm --dir octaclin-backend typecheck`.
- [x] `pnpm --dir octaclin-backend test` -- 1960 testes, 203 suites, 0 falhas.
- [x] `pnpm --dir octaclin-backend build` -- artefato de producao validado.
- [x] `pnpm --dir octaclin-web typecheck`.
- [x] `pnpm --dir octaclin-web build`.
- [x] `pnpm --dir octaclin-web lint` (0 erros; 56 warnings preexistentes,
  nenhum novo).
- [x] `pnpm --dir octaclin-web test:planos-alimentares:bff` -- 20/20.
- [x] `pnpm --dir octaclin-web test:authz`.
- [x] `pnpm --dir octaclin-web test:linguagem`.
- [x] Playwright novo: `tests/visual/fase-270-condicao-especial-manual.spec.mjs`,
  6/6 (3 casos x desktop e mobile), estavel em 3 execucoes consecutivas.
- [x] `console-regression.spec.mjs` -- 114/114 (monta o mesmo editor).
- [x] `pnpm security:secrets`, `pnpm test:confiabilidade`.
- [x] `git diff --check`.
- [ ] `pnpm validate:docs` -- `SKIPPED`: `powershell` indisponivel neste
  sandbox Linux (mesma limitacao das fases anteriores); substituido por
  `git status --short`.
- [ ] Checks remotos de CI e revisao humana da PR -- pendentes.

## 10. Evidencia local

- `PASS` - backend: typecheck e suite completa (1960 testes) apos a mudanca
  de ORM, servico e portao de publicacao.
- `PASS` - 5 testes novos no backend cobrindo positivo e negativo: manual em
  percentual, manual em g/kg (240/48/80 g a partir de 80 kg), recusa de
  manual sem condicao especial, exigencia de justificativa, e revisar +
  publicar pelo caminho manual.
- `PASS` - web: typecheck, lint (0 erros), linguagem, BFF de planos (20/20),
  authz.
- `PASS` - Playwright novo 6/6 em desktop e mobile; `console-regression`
  114/114.
- `PASS` - `pnpm security:secrets`, `pnpm test:confiabilidade`,
  `git diff --check`.
- `NA` - migration, banco, staging, producao e providers: nenhuma migration;
  as colunas afetadas ja eram nullable.

### Defeitos que os testes pegaram antes do commit

1. **Tipo alargado revelou consumidores que assumiam formula sempre
   presente**: tornar `estimativa` e `distribuicaoMacros` opcionais quebrou o
   typecheck em 8 pontos do editor. Todos eram telas que, num plano manual,
   quebrariam em runtime. Corrigidos exibindo "Meta definida manualmente",
   o metodo de macros e a justificativa no lugar de repouso/GET/formula.
2. **Fixture de teste fora do formato real** (mesma licao da Fase 269): o
   plano sintetico omitia `historico` (obrigatorio em `PlanoAlimentarApi`) e
   punha os nutrientes fora de `composicaoSnapshot.nutrientesPor100g`. O
   primeiro derrubava a pagina no error boundary; o segundo deixava campos
   `required` vazios, e a validacao HTML5 bloqueava o submit **em silencio** --
   nenhum alerta na tela, nenhuma requisicao na rede. Diagnosticado
   perguntando ao navegador quem estava invalido
   (`document.querySelectorAll(':invalid')`), nao por tentativa e erro.
3. **Endpoints nao mockados devolvendo 401** (`prioridade-acompanhamento`,
   `escolhas-paciente`, `notificacoes`) disparavam "sua sessao expirou", que
   abortava o submit antes da requisicao do rascunho.
