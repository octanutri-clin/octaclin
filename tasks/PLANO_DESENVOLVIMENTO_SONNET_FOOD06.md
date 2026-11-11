# Plano de desenvolvimento para execução pelo Sonnet 5.5

Escrito em 2026-11-09 com o proprietário ausente (viagem). Este documento é o
ponto de partida de cada sessão de desenvolvimento. Ele não substitui o
`AGENTS.md`, o `docs/agents/REGRAS.md` nem os documentos especializados: em caso
de conflito, eles vencem.

## 0. Como usar este plano

1. Leia `AGENTS.md`, `CLAUDE.md`, `STATUS_ATUAL_PROJETO.md` e este plano.
2. Confira `git status`, a `main` atual e as PRs abertas antes de escrever.
3. Pegue **a próxima tarefa não concluída** da seção 2, na ordem. Uma tarefa por
   branch e por PR. Não misture tarefas.
4. Para cada tarefa: teste vermelho antes do código, depois verde; rode os gates
   da seção 3; abra a PR com o template; registre PASS/FAIL/NA/SKIPPED com motivo.
5. Mudança com impacto no usuário: rode antes a etapa A de UX
   (`docs/agents/ux/PROCEDIMENTO.md`, persona `octaclin-nutricionista-ux`;
   paciente N/A com justificativa quando não houver tela do paciente).
6. Ao terminar uma tarefa com risco R4 (migration, RLS, authz, crypto, PHI),
   peça revisão independente a um subagente **Opus com esforço alto**, somente
   leitura, e registre que não substitui revisão humana.
7. **Não faça merge da própria PR.** Merges seguem o gerente de merges (seção 5).
8. Atualize o checkbox da tarefa neste arquivo na mesma PR.

Modelo: implementação e testes em **Sonnet 5.5**. Revisão R4 e decisões de
arquitetura difíceis em **Opus 5.5** (subagente). Se uma tarefa exigir decisão
clínica, jurídica ou de produto nova, pare só aquele item e registre a pergunta.

## 1. Estado de partida (2026-11-09, verificado)

- `main` contém FOOD06 #455 (M01–M11 parciais), correções R4 #478, M01 #470.
- Direitos de uso: todas as fontes, **exceto Tucunduva** (sem direito; não
  importar nem citar). Registro: `docs/product/PARECER_FONTES_DRI_FOOD06.md`.
- Referências DRI adultas (19 nutrientes) ratificadas (CL01–CL08 em
  `docs/product/FICHA_VALIDACAO_CLINICA_FOOD06.md`) e reconferidas contra as
  tabelas Health Canada de 2025-11-19: `docs/product/VALORES_CANDIDATOS_DRI_FOOD06.md`.
- Contexto clínico já resolvido em domínio:
  `octaclin-backend/src/modulos/planos-alimentares/dominio/contexto-dietetico.ts`
  (adulto 19+, população confirmada, sem gestação/lactação, aplicabilidade,
  mesmo dia planejado, tabagismo). Carregamento autorizado em
  `aplicacao/contexto-confirmado-registro.ts`.
- Hoje as comparações retornam `{ estado: 'indisponivel', motivo: 'referencias_nao_habilitadas' }`
  (`aplicacao/contrato-analise-micronutrientes.ts` e projeções do registro).
- **`main` com o build da imagem do serviço de IA quebrado** desde a #481
  (Python 3.15): `httptools` 0.8.0 do lock não tem wheel cp315 e a imagem não tem
  compilador. Correção: #485 (`httptools` 0.9.0, que tem wheel cp315). Prioridade
  do gerente de merges. `watchfiles` usa wheel abi3 e `pyyaml` cai para Python puro.
- Operação (G06): migrations **1081 e 1082 aplicadas em staging e produção em
  2026-11-09**, com autorização do proprietário, ponto de restauração e conferência
  (evidência em `tasks/food06-g06-diagnostico-2026-11-09.md`). Qualquer migration
  nova continua exigindo autorização própria: **não aplique migrations**.

## 2. Tarefas, em ordem

### T1 — Conjunto versionado de referências DRI adultas (domínio puro) [x]

- **Objetivo:** módulo `dominio/referencias-dri.ts` com os 19 nutrientes do
  quadro ratificado, por sexo de referência e faixa (19–30, 31–50, 51–70, 71+),
  tipo (RDA/AI), unidade, UL e unidade/abrangência do UL, versão
  (`dri-hc-2025-11-19-adulto-v1`), fonte e licença (Health Canada, OGL-Canada).
- **Regras:** ND nunca vira zero; três códigos PA06 sem referência (retinol, RE,
  niacina sem NE) ficam sem entrada; vitamina E com UL indisponível (CL08);
  vitamina C com acréscimo de 35 mg só na RDA e só com tabagismo confirmado (CL07);
  UL de magnésio, niacina e folato restrito às formas abrangidas (CL05): para o
  total alimentar, UL **indisponível** com motivo.
- **Testes RED primeiro:** congelar cada célula do quadro (oráculo é o arquivo
  Markdown ratificado, lido por um teste que compara com o módulo); transições
  de idade nos limites exatos (18/19, 50/51, 70/71); sexo não confirmado → sem
  referência; versão imutável (mudança de valor exige nova versão).
- **Fora de escopo:** crianças, gestação, lactação (exigem nova ratificação).
- **Pronto quando:** módulo + testes, sem API/UI, typecheck e suíte do backend.

### T2 — Comparador por nutriente (domínio puro) [x]

- **Objetivo:** `dominio/comparacao-referencias.ts` que recebe a análise factual
  (total, cobertura por nutriente) e o contexto resolvido e devolve, por nutriente:
  `percentualReferencia` (razão decimal, sem arredondar a decisão), `ul`
  (`abaixo` / `acima` / `igual` / `indisponivel` + motivo), motivos de
  indisponibilidade.
- **Regras ratificadas:** só com contexto elegível e mesmo dia planejado
  confirmado (CL01–CL03); só com cobertura **completa** e unidade compatível
  (CL04); sem classificar deficiência ou toxicidade, sem cor/semáforo (CL06);
  zero conhecido é valor válido.
- **Testes RED:** cobertura parcial → indisponível; unidade incompatível
  (mcg × mg) → indisponível ou conversão explícita testada; borda do UL (igual);
  vitamina C fumante sim/não/desconhecido; contexto não elegível → todos
  indisponíveis com o motivo do contexto.
- **Pronto quando:** domínio + testes com oráculo decimal independente.

### T3 — Integração nas saídas (backend) [x] — R4 se tocar registro persistido

- **Objetivo:** substituir `referencias_nao_habilitadas` pela comparação de T2
  na análise ao vivo, na projeção do registro factual, no histórico e no
  relatório formato 2.
- **Compatibilidade obrigatória:** o leitor Web atual rejeita chaves
  desconhecidas. Entregar por **opt-in** (`incluirReferencias`), como
  `incluirOrigem` (M01): sem a flag, a resposta não muda. Backend antes da Web.
- **Registro imutável:** registros antigos não têm referência versionada. A
  projeção de um registro usa o contexto e a versão gravados no próprio registro;
  sem eles, comparação indisponível com motivo. Nunca recalcular com a versão
  atual silenciosamente. Se for preciso gravar a versão da referência no registro
  novo, é mudança de envelope (R4): versionar o `schemaVersao` e manter leitura
  de v1/v2.
- **Testes:** contrato backend↔Web por fixture; negativos de opt-in; PostgreSQL
  da suíte 1081/1082 (ver seção 4 para rodar sem Docker).
- **Divisão:** a T3 entra em duas PRs.
  - **T3a [x]** — análise ao vivo (`POST analise-micronutrientes`): opt-in
    `incluirReferencias` + as 7 confirmações do registro; nascimento e data da
    análise resolvidos no servidor depois da autorização da carteira, na mesma
    transação. Sem envelope novo; sem a flag, resposta idêntica.
  - **T3b [x]** — R4: envelope v2 do registro com a versão da referência, leitura
    v1/v2, projeção/histórico/relatório formato 2 por opt-in; registros v1 ficam
    "indisponível com motivo". Exige revisão independente.
  - A fixture de contrato Web da forma `calculado` entra com o leitor na T4.

### T4 — Interface: percentual e UL na tabela, detalhes e relatório (M06/M08) [ ]

- **Divisão:** T4a [x] tabela da análise ao vivo, detalhes por linha, bloco "Comparar com
  referências DRI" e estado compartilhado com o registro (só depende da T3a). T4b [x] relatório
  formato 2 (comparação só por escolha explícita, desligada por padrão), "Como ler" impresso,
  PDF real com `FOOD06_PDF_REAL=true` (depende da T3b, já integrada). O indicador no histórico
  (NUX-15) não entrou: é decisão futura do proprietário.
- **Etapa A de UX:** `docs/agents/ux/reports/FOOD06-T4-A-2026-11-10`. Decisões do proprietário:
  confirmações do paciente só na memória da tela (reconfirma só o "dia completo" ao mudar a
  seleção); relatório só por escolha explícita; texto factual reforçado, centralizado em
  `lib/textos-referencias-dieteticas.ts`.

- **Antes:** etapa A de UX (nutricionista). Linguagem factual: "x% da RDA", "UL
  não comparável: motivo". Sem cores de diagnóstico.
- **Web:** pedir `incluirReferencias`, mostrar coluna e legenda, motivo por
  célula indisponível, desktop e mobile, teclado e axe.
- **Testes:** Playwright desktop/mobile, `test:a11y` relevante, PDF real com
  `FOOD06_PDF_REAL=true`.

### T5 — M12 cenários: núcleo de domínio [x]

- **Escopo** em `tasks/especificacao-pos-320-food06-melhorias.md` (seção M12).
- Núcleo em memória que reaproveita PA06 e a prévia M04: original × troca,
  receita/porção, refeição/dia. Compara macros, micros, cobertura e (com T2)
  referências. Nada gravado; sem somar alternativas excludentes.
- Depois, em PRs separadas: API/BFF (sem persistência), interface com aviso de
  descarte, aplicação via fluxo M04 existente (CAS/fingerprint/PA07).

### T6 — M03-C2: consistência entre saídas e canários de log [x]

- Teste que monta uma análise sintética e confere que tabela, detalhes e
  relatório mostram os mesmos números e motivos; canários sintéticos em logs,
  erros e projeções (nada clínico vaza).

### T7 — M02/M04: matriz global com oráculo [ ]

- Matriz de combinações (receita, porção, troca, estados de cobertura) contra um
  oráculo decimal independente do motor.

### T8 — Proposta de contrato de restrições alimentares (M11 individualizada) [x] proposta v1 e **contrato v2 com D1 a D11** entregues em 2026-11-11; contrato **não validado** clínica, jurídica nem tecnicamente (Q1 a Q11)

- **Só documento**, para aprovação do proprietário: quais dados estruturados,
  quem preenche, como mapeiam para alimentos, negativos. Não implementar.

### T9 — Inventário Security & Quality (recorrente, prazo duro) [x] rodada de 2026-11-11; recorrente

- **Prazo (atualizado em 2026-11-11):** a causa com `revisarEm` mais próximo é a
  `SQ-2026-004`, em **2026-11-20**; a partir de 2026-11-21 o check
  `Governanca de repositorio` reprova todas as PRs, salvo decisão do proprietário.
- **Procedimento:** disparar o workflow `inventario-security-quality.yml` na
  `main`; remontar o JSON do eco em base64 do log do job (hash e número de partes
  declarados no próprio log); triar alertas em causas (aposentar as sem alerta
  aberto); atualizar `scripts/validar-inventario-security-quality.spec.mjs` e a
  evidência em `docs/governance/evidencias/<data>/`. Modelo:
  `docs/governance/REVISAO_SECURITY_QUALITY_2026-11-09.md`.

## 3. Gates por tipo de mudança

- Backend: `pnpm --dir octaclin-backend build` e `pnpm --dir octaclin-backend test`.
- Web: `typecheck`, `lint` (0 erros), `build`, `test:authz` quando tocar BFF,
  Playwright proporcional (desktop e mobile).
- Raiz: `pnpm test:inventario-security-quality`, `pnpm test:migracoes-fora-de-banda`
  quando houver migration, `git diff --check`, `pnpm security:secrets`.
- Nunca declarar PASS sem execução. SKIPPED/NA com motivo.

## 4. Ambiente da sessão (lições desta rodada)

- **PostgreSQL sem Docker:** há binários do PostgreSQL 16 em `/usr/lib/postgresql/16/bin`.
  Suba um cluster descartável em `/tmp` (usuário `postgres`, porta 55432) e rode as
  suítes `*.integracao.spec.ts` com a flag da suíte (`FOOD06_REGISTRO_TESTCONTAINERS=true`
  etc.) e `--moduleNameMapper='{"^testcontainers$":"<abs>/octaclin-backend/scripts/testcontainers-pg-local-shim.cjs"}'`
  (shim versionado; cria role/banco do `POSTGRES_USER/DB` pedido). Subir o cluster:
  `mkdir -p /tmp/pgdesc && chown postgres /tmp/pgdesc && su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/pgdesc/data -A trust -U postgres && /usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgdesc/data -o '-p 55432 -k /tmp' -l /tmp/pgdesc/log -w start"`.
  Apague o cluster ao final (`pg_ctl ... stop` e `rm -rf /tmp/pgdesc`).
  O CI usa PostgreSQL 15 com Testcontainers e continua sendo a prova oficial.
- **Playwright:** o navegador pré-instalado corresponde ao Playwright 1.63. Com
  1.64, aponte `executablePath` para `/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`
  numa config temporária (não versionar). Não rode `playwright install`.
- **CodeQL local:** o bundle 2.27.4 pode ser baixado do GitHub releases; rodar só a
  regra em questão reproduz alerta e linha sem esperar o CI.
- Extração de tabelas por IA (Firecrawl JSON/LLM) **inventa valores**; use a tabela
  crua.
- `next dev` reescreve `octaclin-web/AGENTS.md` e `next-env.d.ts`: descarte essas
  mudanças antes de commitar.

## 5. Gerente de merges e operação

- Merges: subagente Sonnet com lista permitida explícita, squash, só com todos os
  checks verdes; branch atrás → atualizar; Dependabot → `@dependabot rebase`.
- **Aguardando o proprietário (não fazer sem autorização):** conferir commit dos
  serviços no Render e smoke do backend novo; carregar TACO no
  staging; decidir os 189 alertas Debian do serviço de IA; #490 (`dotenv` 18,
  depois das migrations).
