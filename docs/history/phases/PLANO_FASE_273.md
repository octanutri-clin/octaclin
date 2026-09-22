# Plano da Fase 273 - resumo clinico do paciente (PB-16)

## 1. Estado e decisao de sequencia

Fase iniciada em 2026-09-21, depois do push da Fase 272 (PB-23) nesta mesma
branch (`claude/jolly-turing-1eup7k`). Quinto item da **Onda 3 - devolver
tempo ao profissional**, na ordem definida pelo proprietario: PB-13, PB-14,
PB-15, PB-23, **PB-16**, PB-25 (que depende do PB-16).

## 2. O gap, confirmado no codigo

A aba Resumo do prontuario ja mostra proxima acao, proxima consulta,
contexto operacional, seis contadores e um grafico de evolucao
antropometrica -- mas o DTO do resumo (`ProntuarioPacienteRespostaDto`,
`dtos.ts:377-424`) nao tem nenhuma medida clinica, e `indicadoresRecentes`
se limita a `'adesao' | 'sintomas'` como texto solto. O grafico mostra a
serie, mas quanto mudou desde a ultima avaliacao e desde o inicio fica por
conta do profissional olhar e comparar de cabeca
(`OCTACLIN_PRODUCT_FEATURE_AUDIT.md`, secao 5.3).

## 3. Escopo: o que entra e o que fica de fora, e por que

O audit pede cinco leituras no bloco novo. Leitura do codigo antes de
implementar mostrou que quatro ja tem todo o dado necessario ja autorizado
e buscado (ou facilmente buscavel), e uma tem uma dependencia real ainda
nao construida:

1. **Delta desde a ultima avaliacao**: ja existe como conceito --
   `compararAvaliacoes` (dominio `antropometria.ts`) e usado por
   `listarAvaliacoesAntropometricas` para produzir `deltaUltimas`. O resumo
   passa a buscar as duas avaliacoes mais recentes e aplicar a mesma funcao.
2. **Delta desde o inicio**: mesma funcao `compararAvaliacoes`, comparando a
   primeira avaliacao ja registrada com a mais recente. Busca dedicada
   (`order: avaliadaEm ASC, take: 1`) em vez de reaproveitar a lista
   paginada de 100 registros do endpoint de serie -- assim nao ha limite de
   historico para o calculo "desde o inicio", so mais uma consulta leve e
   indexada.
3. **Objetivo do plano vigente**: `versaoPlanoAtual` ja e buscada por
   inteiro em `obterProntuario` (para montar `planoAtual`), inclusive com
   `objetivosCriptografados` -- so faltava decifrar e expor. Nenhuma query
   nova, mesmo gate de permissao (`planos_alimentares.ler`) ja aplicado a
   `planoAtual`.
4. **Adesao declarada recente**: ja e calculada por
   `extrairIndicadoresRecentes(diarios)` a partir dos mesmos 30 diarios ja
   buscados para o resumo -- ja aparece hoje dentro de `indicadoresRecentes`
   (`{tipo:'adesao', valor:'NN%', ...}`). **Decisao**: o bloco novo no
   frontend reaproveita esse campo existente em vez de duplicar a leitura
   no backend; nao ha necessidade de um segundo campo tipado para o mesmo
   dado.
5. **Exames fora da faixa**: o proprio audit declara essa dependencia
   (secao 5.3, "depende de 5.4 para a parte de exames"). A secao 5.4
   (catalogo de marcadores + faixa de referencia, PB-17) **nao existe
   ainda** -- hoje o nome do marcador e texto livre por coleta
   (`controlador-exames-laboratoriais.ts`), sem campo de faixa nem unidade
   estruturados, entao nao ha "faixa" contra a qual comparar. **Decisao**:
   fora do escopo desta fase, registrado aqui como gap de produto que so
   pode ser fechado depois do PB-17 (Onda 4). Implementar uma versao
   provisoria (ex.: comparar texto livre com outro texto livre) inventaria
   escopo que o proprio audit nao pediu e arriscaria um falso destaque
   clinico sem faixa real por tras.

**Condutas vencendo** nao esta na lista dos cinco itens da secao 5.3, mas
esta explicito na frase da "Melhoria": "... exames fora da faixa e
**condutas vencendo**." A Fase 264.4 ja implementou esse alerta, mas
**para todos os pacientes do profissional no dashboard clinico**
(`ServicoDashboardClinico.montarCondutasVencidas`, metodo privado). Repetir
essa decisao clinica ("vencida" = `validade_fim` estritamente anterior a
hoje no timezone da clinica, zero dias de tolerancia) copiando o codigo
para `ServicoPacientes` criaria dois lugares que podem divergir se a regra
mudar num so. **Decisao**: extrair a logica pura (qual versao esta vigente
por conduta, e se ela esta vencida) e a leitura de "hoje no timezone
clinico" para modulos compartilhados, e usar dos dois lugares -- ver secao 5.

## 4. Achado ao ler `montarCondutasVencidas`: a defesa contra
"versao mais nova ainda substitui a antiga vencida" e redundante, mas nao
incorreta

O codigo atual filtra versoes vencidas primeiro e so depois escolhe o maior
`numero` entre as que sobraram -- o comentario original diz que isso evita
reportar uma conduta como vencida quando ja existe versao mais nova ainda
valida. Na pratica isso nunca acontece: `uq_condutas_terapeuticas_versao_publicada`
e um indice unico parcial em
`(tenant_id, conduta_terapeutica_id) where publicada_em is not null and
descartada_em is null` -- ou seja, o banco ja garante no maximo **uma**
versao publicada-e-nao-descartada por conduta a qualquer momento. A funcao
extraida (secao 5) resolve a versao vigente antes de checar vencimento, o
que e mais direto e correto por construcao (nao depende da ordem de
iteracao), e para todo dado real de producao o resultado e identico ao
codigo anterior -- confirmado com a suite de testes existente do dashboard
antes e depois do refactor.

## 5. Desenho

- **`octaclin-backend/src/infraestrutura/tempo/timezone-clinico.ts`** (novo,
  utilitario puro): `obterTimezoneClinico()` (le `GOOGLE_CALENDAR_TIMEZONE`,
  default `America/Sao_Paulo`) e `dataIsoNoTimezoneClinico(timezone)`.
  Extraido de `ServicoDashboardClinico`, que passa a importar dali; sem
  modulo NestJS novo, e funcao pura, nao precisa de injecao.
- **`octaclin-backend/src/modulos/pacientes/dominio/condutas-vencidas.ts`**
  (novo, dominio puro): `resolverVersaoVigentePorConduta(versoes)` (maior
  `numero` publicado e nao descartado por conduta) e
  `condutaEstaVencida(versao, hojeIso)`. `ServicoDashboardClinico` refatorado
  para usar as duas (mesmo comportamento observavel, suite de testes do
  dashboard roda antes/depois sem alterar expectativas).
- **`ServicoPacientes.obterProntuario`**: estende o `Promise.all` inicial
  com mais quatro buscas (duas avaliacoes antropometricas mais recentes,
  primeira avaliacao ja registrada, condutas + versoes publicadas do
  paciente) e monta `resumo.leituraClinica`:
  ```ts
  leituraClinica: {
    deltaUltimaAvaliacao: DeltaAntropometrico[];
    deltaDesdeInicio: DeltaAntropometrico[];
    objetivoPlanoVigente?: string;
    condutasVencendo: Array<{ condutaId: string; tipo: TipoCondutaTerapeutica; validadeFim: Date }>;
  }
  ```
  Sem migration -- so agrega dado ja modelado e ja autorizado pelas mesmas
  permissoes que protegem o resto do resumo (`pacientes.ler` para tudo,
  `planos_alimentares.ler` especificamente para `objetivoPlanoVigente`,
  mesmo gate ja aplicado a `planoAtual`).
- **Frontend** (`prontuario-paciente.tsx`, aba Resumo): novo bloco
  "Leitura clinica", encaixado logo apos "Contexto operacional" e antes da
  prioridade de acompanhamento -- mostra os dois deltas (peso/IMC, com sinal
  e unidade), objetivo do plano vigente (quando houver permissao e plano
  publicado), e a lista de condutas vencendo (tipo + data). A adesao
  declarada continua saindo de `indicadoresRecentes`, sem duplicar.

## 6. Seguranca

Nenhuma fronteira de autorizacao nova: tudo dentro do mesmo
`obterProntuario`, protegido pelo guard de rota existente
(`pacientes.ler`), com o subcampo de plano ja gated por
`planos_alimentares.ler`. Nenhum dado cifrado passa a viajar em claro alem
do que ja acontece hoje (nome do plano, titulo de tarefa etc. ja sao
decifrados no mesmo metodo).

## 7. Implementacao e evidencia

Implementado nesta branch (`claude/jolly-turing-1eup7k`) em 2026-09-21,
logo apos o push da Fase 272 (PB-23). Sem migration -- unica fase da Onda 3
ate aqui que nao precisou de uma, por desenho (secao 5).

**Backend** (`octaclin-backend`):
- `src/infraestrutura/tempo/timezone-clinico.ts` (novo, utilitario puro):
  `obterTimezoneClinico()` e `dataIsoNoTimezoneClinico(timezone)`, extraidos
  de `ServicoDashboardClinico`.
- `src/modulos/pacientes/dominio/condutas-vencidas.ts` (novo, dominio
  puro): `resolverVersaoVigentePorConduta` e `condutaEstaVencida`,
  extraidos do metodo privado `montarCondutasVencidas` do dashboard.
  `ServicoDashboardClinico` refatorado para importar e delegar as duas
  funcoes -- mesmo comportamento observavel, confirmado pela suite do
  dashboard (23/23) antes e depois do refactor.
- `ServicoPacientes.obterProntuario`: o `Promise.all` inicial ganhou tres
  buscas (duas avaliacoes antropometricas mais recentes, primeira avaliacao
  ja registrada, condutas nao arquivadas do paciente); depois dele, busca
  condicional das versoes publicadas dessas condutas (mesmo padrao de
  `idsQuestionarios.length ? ... : []` ja usado para questionarios). Monta
  `resumo.leituraClinica` com `deltaUltimaAvaliacao`/`deltaDesdeInicio`
  (reaproveitando `compararAvaliacoes`, ja usado por
  `listarAvaliacoesAntropometricas`), `objetivoPlanoVigente` (decifra
  `objetivosCriptografados` de `versaoPlanoAtual`, ja buscada) e
  `condutasVencendo` (usa as duas funcoes extraidas na secao 5).
- `dtos.ts`: `ProntuarioPacienteRespostaDto.resumo` ganhou o campo
  `leituraClinica` com o formato desenhado na secao 5.

**Frontend** (`octaclin-web`):
- `lib/prontuario-api.ts`: `ProntuarioPacienteApi['resumo']` ganhou
  `leituraClinica`, reaproveitando o `DeltaAntropometricoApi` ja existente.
- `components/pacientes/prontuario-paciente.tsx`: novo bloco "Leitura
  clinica" na aba Resumo, logo apos "Contexto operacional". Achado durante
  o gate de acessibilidade: a primeira versao do bloco usava `<div>`
  contendo `<p>` como filho direto do `<dl>`, o que o axe-core reprova
  (`definition-list`) porque o conteudo de um `<dl>` so pode ser grupos
  `<dt>`/`<dd>`, opcionalmente agrupados em `<div>`. Corrigido para seguir
  exatamente o padrao ja usado no bloco "Contexto operacional" (cada item
  e um `<div>` com um `<dt>` e um ou mais `<dd>` dentro).

**Testes novos** (`servico-pacientes.spec.ts`): dois casos dedicados --
um com avaliacoes/condutas/plano completos, verificando os dois deltas, o
objetivo decifrado e a lista de condutas vencendo (uma vencida, uma
vigente, provando que a vigente nao aparece); outro com uma unica
avaliacao registrada, provando que `deltaDesdeInicio` fica vazio em vez de
comparar uma avaliacao consigo mesma. Os ~13 call sites pre-existentes de
`obterProntuario` (inclusive o helper compartilhado do grupo "timeline
canonica" e o benchmark sintetico em
`infraestrutura/performance/benchmark-prontuario.spec.ts`) ganharam mocks
default para `AvaliacaoAntropometricaOrm`/`CondutaTerapeuticaOrm` (as
novas buscas rodam incondicionalmente); o benchmark teve seu orcamento de
consultas atualizado de 11 para 14 chamadas de `getRepository`, refletindo
as tres novas buscas incondicionais.

**Validacoes executadas nesta branch**:
- `pnpm --dir octaclin-backend typecheck` e `build` -- limpos.
- Suite completa do backend: 210 suites, 2015 testes, 0 falhas (3 suites/31
  testes SKIPPED por falta de Docker nesta sandbox -- RLS via
  testcontainers, mesma limitacao ja documentada).
- `node scripts/validar-redacao-auditoria.mjs`,
  `node --test scripts/validar-guardas-controladores.spec.mjs`,
  `node --test scripts/validar-migracoes-fora-de-banda.spec.mjs`,
  `node --test scripts/validar-inventario-security-quality.spec.mjs ... `,
  `node scripts/test-matriz-confiabilidade.mjs` -- limpos.
- `pnpm --dir octaclin-web typecheck`, `lint` (0 erros, mesmos warnings
  pre-existentes da classe `react-hooks/set-state-in-effect`), `build` --
  limpos.
- `pnpm --dir octaclin-web test:authz` -- verde (cadeia completa dos 15
  scripts de BFF, sem par novo nesta fase porque nao ha BFF novo: o campo
  novo viaja dentro do endpoint `prontuario` ja existente).
- Playwright: `console-regression.spec.mjs` + `fase-248-estados-recuperacao.spec.mjs`
  (64/64, desktop e mobile), `fase-249-densidade-responsividade.spec.mjs` +
  `fase-269-duplicar-plano.spec.mjs` + `fase-270-condicao-especial-manual.spec.mjs`
  (9/9, desktop), `acessibilidade.spec.mjs` completo (136/136, desktop,
  incluindo os dois cenarios que exercitam a aba Resumo com o bloco novo).
  Um teste de `console-regression.spec.mjs` (busca de profissionais em
  paralelo) falhou uma vez por erro de rede do proprio Chromium (SSL
  handshake), confirmado como flake ao rodar isolado logo em seguida --
  nao uma regressao desta fase.
- `git diff --check` e `pnpm security:secrets` -- limpos.

**Pendencias**: checks remotos de CI e merge humano.
