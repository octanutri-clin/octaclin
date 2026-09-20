# Plano da Fase 269 - duplicar plano alimentar de outro paciente (PB-13)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-20, depois do fechamento da Onda 2 do audit de
produto (PB-01 -> PB-02 -> PB-03 -> PB-05, ultima entrega na Fase 268, PR
`#275`, merge `306d2ed`).

O proprietario definiu a ordem da **Onda 3 - devolver tempo ao
profissional**: PB-13, PB-14, PB-15, PB-23, PB-16 e PB-25 (este ultimo
depende do PB-16). Esta fase entrega o **PB-13 (duplicar plano alimentar /
salvar como modelo)**, primeiro item da onda.

## 2. Escopo real: metade do PB-13 ja existia

A leitura do codigo antes de implementar mostrou que **"salvar como modelo"
ja esta entregue** e nao tem gap:

- Backend: `ServicoModelosPlanoAlimentar` ja faz criar/listar/obter/arquivar
  modelo, com visibilidade `pessoal`/`clinica`, conteudo cifrado e auditoria.
- Web: o componente `ModelosPlanoAlimentar` (dentro do editor de plano) ja
  salva o rascunho atual como modelo e aplica um modelo salvo ao rascunho.

O que faltava do PB-13 era apenas **"duplicar de outro paciente"**: hoje o
profissional so consegue reaproveitar uma estrutura que alguem lembrou de
salvar como modelo antes; nao consegue partir direto do plano de um paciente
que ja existe.

Decisao de produto do proprietario para esta fase: a origem e escolhida
**buscando por nome entre os proprios pacientes**, e depois escolhendo qual
plano daquele paciente duplicar.

## 3. Por que nao precisou de backend

Os tres passos do fluxo ja tem rota existente e autorizada:

1. Buscar paciente de origem -> `GET /pacientes?busca=` (ja usado por outros
   fluxos; o escopo por profissional e aplicado no backend).
2. Listar os planos do paciente escolhido -> `GET
   /pacientes/:pacienteId/planos-alimentares`, que ja passa por
   `garantirPacienteNoEscopo`.
3. Ler as refeicoes do plano escolhido -> `GET
   /pacientes/:pacienteId/planos-alimentares/:planoId`, que ja passa por
   `obterPlanoNoEscopo` e devolve `current` (versao publicada) e `draft`
   completos, com refeicoes, itens e substituicoes.

Nao foi criada nenhuma rota nova, nenhuma consulta que atravesse pacientes e
nenhuma superficie de leitura nova: cada chamada continua sendo uma leitura
de um paciente especifico, autorizada uma a uma pelo backend exatamente como
ja era. Um profissional so alcanca paciente e plano que ja podia abrir pela
tela do proprio paciente.

## 4. Invariante clinica: so a estrutura de refeicoes e copiada

O rascunho de um plano tem duas naturezas misturadas no mesmo formulario:

- **Reutilizavel entre pacientes**: refeicoes, itens, quantidades,
  substituicoes, horarios e orientacoes. E exatamente o que o `modelo` ja
  guarda (`RefeicaoPlanoAlimentarDto`, o mesmo tipo usado pelo rascunho).
- **Intransferivel**: `avaliacaoAntropometricaId`, formula, fator de
  atividade, distribuicao de macros, objetivo clinico, observacoes e as
  confirmacoes de aplicabilidade/condicao especial. Sao do paciente de
  destino e do calculo dele; copiar isso de outro paciente seria
  inventar um calculo energetico que ninguem fez.

Duplicar copia **somente a primeira natureza**, e a interface diz isso de
forma explicita antes da acao. Essa fronteira nao e nova: e a mesma que o
modelo ja respeita desde que existe.

A conversao reusa deliberadamente o par que a aplicacao de modelo ja usa
(`refeicoesDoModelo(refeicoesParaModelo(formularioDaVersao(versao)))`), em
vez de um segundo caminho de copia. Isso garante, de graca, chaves de
cliente novas (nao reaproveita o id de refeicao do paciente de origem), item
completo com descricao e nutrientes, e um unico comportamento para manter --
dois caminhos de copia divergiriam.

Quando o plano de origem tem versao publicada, ela e a copiada (e o plano
que esta valendo); so na ausencia dela o rascunho e usado.

## 5. Risco, rollout e rollback

R2. Sem migration, sem rota nova, sem alteracao de backend, sem novo dado
persistido. A mudanca e de interface e reusa endpoints e conversores
existentes. Rollback e reversao pura do commit.

Nenhuma acao de producao, seed ou dado real foi usada nesta fase.

## 6. Fora do escopo desta fase

- "Salvar como modelo" e "aplicar modelo": ja entregues, nao foram tocados.
- `PUT` de modelo (editar modelo salvo): item P2 separado na secao 3 do
  audit, nao faz parte do PB-13 nem da Onda 3.
- Copiar calculo, avaliacao antropometrica, objetivo ou confirmacoes entre
  pacientes (ver secao 4 -- e intencional que nao se copie).
- PB-14 (caminho manual para paciente com condicao especial). O gap esta
  confirmado no codigo (`atualizarRascunho` recusa
  `possuiCondicaoEspecial: true` com "o calculo automatico nao e seguro e
  nao esta disponivel nesta fase"), mas e a proxima fase da onda e exige
  decisao de produto propria.

## 7. Gates

- [x] `pnpm --dir octaclin-web typecheck`.
- [x] `pnpm --dir octaclin-web lint` (0 erros; 56 warnings preexistentes,
  nenhum novo e nenhum no arquivo novo).
- [x] `pnpm --dir octaclin-web test:planos-alimentares:bff` (rotas que o
  fluxo consome).
- [x] `pnpm --dir octaclin-web test:authz`.
- [x] Playwright novo: `tests/visual/fase-269-duplicar-plano.spec.mjs`,
  6/6 (3 casos x desktop e mobile). Entra automaticamente no
  `smoke:visual` do CI, que roda o diretorio inteiro.
- [x] `pnpm security:secrets`, `pnpm test:confiabilidade`.
- [x] `git diff --check`.
- [ ] `pnpm --dir octaclin-backend test` -- `NA`: nenhum arquivo de backend
  foi alterado nesta fase.
- [ ] `pnpm validate:docs` -- `SKIPPED`: `powershell` indisponivel neste
  sandbox Linux (mesma limitacao de ambiente das fases anteriores);
  substituido manualmente por `git status --short`.
- [ ] Checks remotos de CI e revisao humana da PR -- pendentes.

## 8. Evidencia local

- `PASS` - `pnpm --dir octaclin-web typecheck`.
- `PASS` - `pnpm --dir octaclin-web lint`: 0 erros, 56 warnings
  preexistentes (mesma contagem das fases anteriores), nenhum no
  `duplicar-plano-de-outro-paciente.tsx`.
- `PASS` - `pnpm --dir octaclin-web test:planos-alimentares:bff`: 20/20.
- `PASS` - `pnpm --dir octaclin-web test:authz`.
- `PASS` - `tests/visual/fase-269-duplicar-plano.spec.mjs` (novo): 6/6 em
  desktop e mobile. Cobre a interacao inteira (buscar -> escolher paciente
  -> escolher plano -> duplicar), a invariante clinica (objetivo do destino
  intacto, objetivo da origem nunca aparece) e o estado vazio da busca,
  incluindo o filtro que tira o proprio paciente da lista de origens.
- `PASS` - `console-regression.spec.mjs` (regressao do prontuario, que
  monta o mesmo editor).
- `PASS` - `pnpm security:secrets` e `pnpm test:confiabilidade`.
- `PASS` - `git diff --check`.

### Dois defeitos encontrados pelo teste antes do commit

1. **`<form>` aninhado**: a primeira versao do bloco usava um `<form>`
   proprio para a busca, mas ele vive dentro do `<form>` do rascunho. Alem
   de HTML invalido (o React reclama em runtime), o Enter na busca
   submeteria o formulario do plano. Corrigido trocando por `<div>` +
   botao `type="button"`, com o Enter tratado no proprio campo
   (`onKeyDown` com `preventDefault`).
2. **Regiao sem nome acessivel**: o `<select>` "Plano" do bloco colidia com
   a aba "Plano" do prontuario. A correcao foi dar nome acessivel a secao
   (`aria-labelledby` apontando para o proprio titulo), o que resolve a
   ambiguidade para leitor de tela tambem, e nao so para o teste.
- `NA` - backend, migration, banco, staging, producao e providers: nenhum
  arquivo de backend alterado; nenhuma rota nova.

### Terceiro defeito: achado so depois do push, pelo CI (PR #277)

O job "Demo local smoke" da PR falhou de forma intermitente em
`fase-269-duplicar-plano.spec.mjs`, com `expect(locator).toBeVisible()`
estourando o timeout ao procurar a regiao "Duplicar de outro paciente"
logo apos `page.goto`. A primeira hipotese (carga do CI, 654 testes em
sequencia num worker so) levou a um ajuste especulativo de timeout, que foi
descartado depois: reproduzir o teste localmente, isolado e sem qualquer
carga de CI, repetiu a mesma falha intermitente (cerca de 1 em cada 4 a 9
execucoes), o que descartou "e so lentidao do CI" como causa.

A causa real, isolada pelo stack trace de uma das execucoes locais que
falhou: `TypeError: Cannot read properties of undefined (reading 'slice')`
em `components/pacientes/resumo-antropometrico.tsx`, dentro de
`formatarData()`. O mock de
`/api/pacientes/:id/avaliacoes-antropometricas` usado por
`prepararSessao()` tinha um formato que nao corresponde ao tipo real
`AvaliacaoAntropometricaApi` (`lib/prontuario-api.ts`): usava
`registradaEm` em vez de `avaliadaEm`, aninhava `idadeAnos`/`sexoBiologico`
dentro de `medidas` em vez de os manter no nivel raiz, e faltavam os campos
obrigatorios `protocolo`, `resultado` e `criadoEm`. Como `avaliadaEm`
chegava `undefined`, `formatarData` quebrava em runtime; o boundary de erro
do Next (`app/error.tsx`) substituia a pagina inteira por uma tela de erro,
o que explica por que a regiao nunca aparecia -- nao era lentidao, era a
pagina genuinamente quebrada, de forma intermitente conforme o timing de
render/hidratacao.

Este teste nao exercita antropometria, entao a correcao foi trocar o mock
por uma resposta vazia (`{ avaliacoes: [], deltaUltimas: [] }`), o mesmo
padrao ja usado por `prepararAvaliacoesAntropometricas` em
`acessibilidade.spec.mjs`. O ajuste especulativo de timeout foi revertido
depois de confirmada a causa real, para nao carregar no teste uma margem
que nao resolve nada.

Verificacao: `tests/visual/fase-269-duplicar-plano.spec.mjs` rodado 8 vezes
em sequencia apos a correcao, 48/48 (6 testes x 8 execucoes), sem nenhuma
falha -- consistente com a natureza intermitente do bug original, que so
uma unica execucao verde nao provaria ter sido corrigido.

Licao: fixture de teste que nao segue o tipo real da API pode quebrar a
pagina em runtime de forma silenciosa e intermitente, sem que o teste em si
aponte a causa raiz (o sintoma visivel foi um timeout de visibilidade, nao
o erro de tipo). Isso so foi pego pelo CI, nao pelas 6 execucoes locais
originais antes do push -- reforca que uma execucao local isolada nao basta
para provar ausencia de comportamento intermitente.

- `PASS` - `pnpm --dir octaclin-web typecheck` (repetido apos a correcao).
- `PASS` - `pnpm --dir octaclin-web lint` (repetido apos a correcao): 0
  erros, 56 warnings preexistentes, mesma contagem de antes.
- `PASS` - `tests/visual/fase-269-duplicar-plano.spec.mjs`: 48/48 em 8
  execucoes locais consecutivas apos a correcao.
