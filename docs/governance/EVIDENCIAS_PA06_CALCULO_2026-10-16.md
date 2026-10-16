# PA06 — cálculo combinado: evidências por checkpoint

## Escopo e base

Autorização do proprietário: “Pode seguir com sol médio”, após D11–D13.
Branch `feat/pos320-pa06-calculo`, worktree `pos320-pa06-calculo`, base
`011ea87d` e planejamento `10ebf9aa`. Risco R4 (leitura clínica, snapshots,
autorização, RLS e concorrência). Nenhum trabalho preexistente sobrescrito.

T08c e T08d implementados localmente na mesma branch. Uma PR Draft será preparada
com a terceira entrega completa; estes checkpoints não autorizam merge/rollout.
Não há migration nova nem alteração das migrations 1072–1074. Nenhum banco
externo foi acessado. A aplicação real da1074/deploy não foi verificada.

## Implementado

- Whitelist22, códigos/unidades/qualificadores fixos, decimal escala8/half-up,
  soma exata e recusa de overflow. Fonte de unidade é o registro do servidor.
- Adapters USDA (IDs/unidade/LOQ/duplicatas), IBGE (cabeçalhos literais e aliases
  sem acento; ambiguidade negada), TACO v2. IBGE D continua incompatível,
  sem inferir equivalência D2+D3. Estados desconhecidos não viram zero.
- Micros manuais em campo irmão `micronutrientesPor100g`. Documento editorial
  conserva digitação pendente cifrada e não materializa/publica valor inválido.
  Modelos/receitas compartilham o DTO. Catálogo não aceita override de micros.
- Bloco opcional `micronutrientes` no snapshot cifrado: schema1, mapeamento,
  origem/base/por100g/porção e motivos de ausência. Legado sem bloco fica ausente;
  leitura nunca busca catálogo para enriquecer uma publicação antiga.
- Motor usa só porções congeladas dos itens principais; aplica quatro condições
  de inclusão. Cobertura independente por nutriente; parcial não recebe `total`.
- GET seleção mínima e POST cálculo, permissão de leitura existente, escopo/RLS,
  locks paciente→planos ordenados→publicações, revisão/versão exatas, nenhuma
  escrita/evento. Negar o conjunto quando qualquer recurso não for autorizado.
  OFF não dispensa conferir versão, revisão ou vínculo da refeição.
- Limites25 planos/50 refeições/500 identidades/10000 itens/64KiB; campos extras,
  UUIDs/duplicatas/integer revision inválidos recusados. Sem rascunhos, metas,
  histórico, substituições ou consumo na soma. HTTP com `private, no-store`.

## TDD e falhas efetivamente observadas

| Prova RED | Resultado observado | Correção/GREEN |
| --- | --- | --- |
| Precisão/snapshot inicialmente não implementados |11 falhas/17 casos | Registro e cálculo decimal implementados; posteriormente18 casos incluindo overflow |
| Adapters inicialmente vazios |6 falhas/9 casos | Mapeamento explícito, estados e validação isolada por nutriente; depois11 casos |
| Motor combinado ausente |22 falhas/22 casos | Motor puro;16 combinações e oráculo sintético300kcal/P30/C60/G15 |
| Modo TACO v2 ainda devolvia v1 |1 falha | Modo explícito; v1 reproduzida byte a byte |
| Snapshot manual e contrato editorial sem micros |2 falhas/113 casos | Persistência cifrada e conversão editorial aditivas |
| Serviço/DTO/rotas ainda ausentes | Novos casos falharam; rota sem metadados falhou | Projeção mínima, autorização e contrato implementados |
| Cobre da TACO em notação científica |1 falha/11 casos | Parser numérico permite expoente estrito, sem converter marcadores |
| Overflow de porção virava inválido silencioso |1 falha/18 casos | Erro técnico distinto; porção excessiva rejeitada |
| Segundo load TACO v2 em PostgreSQL | Divergência de hash apesar dos mesmos valores | JSONB reordena chaves; canonização determinística somente do bloco novo. Teste unitário RED/GREEN e segunda carga real idempotente |

O primeiro ensaio com logs reduzidos tentou `NODE_ENV=production` na fixture
sem TLS e foi corretamente recusado pelo controle existente. O harness final
usa `NODE_ENV=test`, banco descartável e alvo explícito. Nenhuma proteção de
produção foi relaxada. As falhas dos ensaios não são declaradas PASS.

## Comandos e gates — checkpoint backend histórico

Toolchain final: Node22.21.1/pnpm11.25.0 já disponíveis em `/tmp`; sem alteração
de dependências/lockfile. Primeiros testes focados usaram Node24/pnpm11.19 e
foram seguidos de validação na toolchain declarada.

| Comando/verificação real | Estado e evidência |
| --- | --- |
| `pnpm test --runInBand` no backend após a correção do hash | PASS:337 suítes,3016 testes;6 suítes/123 testes SKIPPED pelos gates próprios. Não é prova de banco externo |
| `pnpm test --runInBand src/modulos/planos-alimentares` no checkpoint final | PASS:23 suítes/339 testes, incluindo dois casos editoriais suplementares |
| Serviço de planos, incluindo dois casos editoriais suplementares | PASS:97 testes em `servico-planos-alimentares.spec.ts` |
| `pnpm typecheck`; `pnpm build` backend | PASS; build validou `dist/main.js` e bloqueios de artefatos da Fase314 |
| `node scripts/test-pa05-postgres-local.cjs --inventario --taco-micros` | PASS:24 testes,29 filtrados;5 novos PA06c, regressões PA04/PA05/PA06, inventário e leitura sem tenant;3 cargas locais verificadas |
| RLS, transferência, cálculo↔toggle e cálculo↔publicação | PASS em PostgreSQL15 real, runtime NOBYPASSRLS e tabelas FORCE RLS. Barreiras confirmam espera no banco. Outra clínica/carteira/versão/identidade negadas |
| TACO v1/v2 no PostgreSQL descartável | PASS:583 alimentos por fonte, V1 preservada, repetição V2 íntegra/idempotente; zero carga externa |
| `RLS_TESTCONTAINERS=true ... --testNamePattern=PA06c` com Timescale HA | SKIPPED: tentativa interrompida por limite de espaço da imagem; substituída pela fixture parcial já existente. Timescale/pgvector/hypertable não são validados por ela; gate integral segue no CI |
| `node --test scripts/validar-guardas-controladores.spec.mjs` | PASS:11 testes |
| `pnpm security:secrets`; `git diff --check` | PASS:scanner local sem secrets identificados e diff sem erro de whitespace; não equivalem a auditoria independente |
| BFF, Web, Playwright/acessibilidade/portal/print da nova interface | SKIPPED: T08d ainda não implementado |
| CI do HEAD final e revisão R4 cruzada | SKIPPED: integração final T09.3, após UI; não houve revisão independente nesta rodada |
| Staging/produção, migrations/carga/ativação externas | SKIPPED: fora da autorização desta rodada |

Os logs detalhados de testes desta sessão ficam em `/tmp/pa06-*.log`; são
transitórios. Os testes, artefato e harness versionados são a evidência
reproduzível. Não conteram pacientes reais: fixtures clínicas sintéticas e
catálogo alimentar público oficial. Não registrar dados clínicos/credenciais
nos documentos, logs de operação ou respostas da aplicação.

## Artefato TACO e limites

- XLSX oficial:SHA-256 `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14`.
- JSON v2:SHA-256 `00b55638a8ab5ef5a78ce86ffd9d3240f0e0fa58b2516d42042f42a51ee31630`.
- Conteúdo normalizado v2:`d22bdaaaff49c17ef1d685fb722a7c6c06bf27756bd967bf6b83cac37862d133`.
- Origem/atribuição/edição2011 preservadas. Micros são números das células XML,
  que podem ter mais casas do que a apresentação da planilha; escala8 não é
  promessa de precisão clínica. Não extrapolar campos inexistentes.
- Carga externa deve identificar banco/branch/role, direitos, hashes, estados,
  idempotência e contagens. Não reutilizar a aprovação fictícia da fixture.
- Não alterar nem apagar fontes/snapshots antigos em rollback. Retirar a nova
  projeção/UI se necessário, mantendo os controles ON/OFF já integrados.

## T08d — BFF e interface de seleção combinada (checkpoint inicial)

Implementação local na mesma branch, sem migration, dependência nova, acesso a
banco externo ou carga de catálogo. O seletor é estado volátil por prontuário;
os dados nutricionais e totais vêm exclusivamente do backend. O portal e a
impressão mantêm os contratos anteriores.

| Comando/verificação real | Resultado |
| --- | --- |
| `node scripts/test-planos-alimentares-bff.mjs` | PASS:42/42, incluindo autenticação/autorização, `no-store`, encoding, conflito e limite de corpo |
| `node scripts/test-copia-refeicoes-plano.mjs` | PASS:8/8 |
| `node scripts/test-nutricao-plano.mjs` | PASS:39/39 |
| `node scripts/test-calculo-combinado-planos.mjs` | PASS:3/3 |
| `pnpm test:authz` | PASS:26 recortes; as saídas de mocks sem contexto de request foram esperadas, sem falha da suíte |
| `pnpm typecheck` | PASS, executado isoladamente após evitar concorrência com geração de tipos do Next |
| `pnpm lint` no Web | PASS, zero erros;71 avisos existentes/distribuídos no repositório, incluindo padrões `setState-in-effect` nos arquivos extensos de editor/prontuário |
| `NEXT_TELEMETRY_DISABLED=1 pnpm build` no Web | PASS; compilação, typecheck do build e186 páginas estáticas |
| Playwright desktop/mobile: `pa06-calculo-combinado`, `pa02-copia-refeicoes`, `fase-320-pa05-apresentacao`, `portal-paciente` | PASS:94/94,47 desktop e47 mobile; Axe incluído no painel da PA06 |
| `pnpm security:secrets`; `pnpm test:security` | PASS; nenhum segredo reconhecido e testes de segurança locais passaram |
| `git diff --check` | PASS; sem erros de whitespace no checkpoint |

O Playwright incluiu seleção em mais de um plano, paginação, exclusão/reativação
de refeições, distinção entre valor zero e ausente/parcial, conflito409 que exige
atualização explícita, teclado, regressões de cópia e apresentação, portal e
impressão. Ambos os projetos de browser finalizaram sem falhas.

| Gate restante | Estado |
| --- | --- |
| Revisão técnica R4 independente do diff T08c/T08d | BLOCKED/PENDING; revisão própria não é independente |
| CI do HEAD corrigido e gates da PR | PENDING, ainda não publicada |
| PostgreSQL integral com Timescale/pgvector/Testcontainers | SKIPPED localmente; evidência parcial PostgreSQL15 descartável descrita acima não cobre extensões/hypertables |
| Banco, migrations, staging/produção e carga de catálogo externos | SKIPPED; não foram consultados nem alterados |
| Merge, deploy e ativação | SKIPPED, não autorizados |

Logs de execução foram temporários e não continham pacientes reais. O build
produziu `.next` ignorado; não faz parte do diff. Um `next-env.d.ts` gerado pelo
servidor Next de desenvolvimento foi restaurado ao conteúdo versionado para
evitar incluir artefato local.

## T09.3 — revisão separada e correções na PR #422

O CI de `bcf0825f` passou, incluindo Backend, Web, Demo local smoke, PR Gate,
governança, imagens, CodeQL, Semgrep e Trivy. Provenance do SBOM ficou SKIPPED
pela condição do workflow. Run principal:
<https://github.com/octanutri-clin/octaclin/actions/runs/38925522704>.
O job Backend comprovou341 suítes/3100 testes PASS (41 SKIPPED nos gates próprios),
Redis real2/2 e Testcontainers85/85 com imagem Timescale HA/pg15, migrations
completas, role NOBYPASSRLS e extensões do schema. Essa é prova de banco
descartável de CI, sem evidência sobre staging/produção.

Revisão somente leitura realizada por outro agente, que não escreveu as mudanças,
sobre `011ea87d → bcf0825f`. Não equivale a revisão humana, clínica ou externa.
Foram encontrados cinco achados iniciais e uma borda adicional na revisão das
correções. Todos tiveram causa identificada e correção examinada pelo revisor.

| Achado | Causa e correção | Prova observada |
| --- | --- | --- |
| P1: catálogo bloqueado no autosave/publicação | UI enviava bloco vazio, ou valores do snapshot, como micros manuais de catálogo. O editor/cópia agora omitem esse campo para catálogo; conversor omite bloco vazio. Override efetivo continua chegando à validação para ser rejeitado | RED:1 caso DTO e2 casos de cópia; GREEN:343 testes do módulo e9/9 de cópia |
| P1: total antigo em409/revalidação revogada | Resultado permanecia ligado à mesma chave local. Recálculo e revalidação invalidam o resultado antes de aguardar rede | RED:4 cenários de409/403/foco/retirada de acesso; GREEN em desktop e repetição móvel |
| P2: ACK/GET tardio restaurava seleção | ACK operava sobre array capturado antes do await; refresh ignorava mudanças durante a leitura. ACK agora usa estado vigente/revisão monotônica; refresh descarta resposta se contexto/seleção mudou; requisições de seleção são abortadas ao desmontar | RED:remoção durante ACK e durante refresh; GREEN nos cenários desktop/mobile |
| P2: arredondamento intermediário da porção | Origem e normalização/100g eram arredondadas antes de aplicar porção. Razão inteira decimal usa origem×porção/base e half-up somente ao final de cada resultado congelado | RED:2 valores sintéticos; GREEN:21 testes de micros incluídos nos343 do módulo. Exemplos independentes:4e-9×10000/100=4e-7;1.234567895×200/100=2.46913579 |
| P3: positivo pequeno exibido como zero | Casas fixas para todos os nutrientes. Apresentação agora segue casas por nutriente e usa `<limiar` para positivo abaixo da resolução | GREEN:4 testes de seleção/apresentação, distinguindo ausência, zero e positivo pequeno; prova inicial acusou export inexistente do novo formatador |
| P2: desmarcar/remarcar antes do debounce | A chave voltava ao valor antigo enquanto o sucesso anterior continuava guardado. `invalidar()` elimina o resultado imediatamente; cancelamento de transporte é separado | RED com relógio controlado:esperado0 ocorrências do total antigo, recebido1; GREEN:debounce/foco4/4 desktop/mobile |

Commits de correção: `ddcea76c` e `2a4e87b0`. A segunda leitura confirmou as
cinco correções em `ddcea76c`; a terceira confirmou a última borda em `2a4e87b0`,
sem bloqueadores técnicos concretos restantes nos deltas examinados. Não houve
repetição dos builds/CI pelo revisor; os testes descritos são execução da autoria,
com provas sintéticas adicionais de precisão/apresentação pelo revisor.

Retestes locais: módulo backend343/343, typecheck/build backend PASS; cópia9/9,
nutrição/edição39/39, helpers/apresentação4/4, lint direcionado sem erros e13
avisos nos arquivos legados do editor/prontuário. Uma primeira execução visual
teve15/16 PASS e timeout móvel antes de carregar o seletor; o caso passou ao ser
repetido isoladamente. Esse ensaio não é contado como suíte integral PASS.

Reteste final no build de produção local (`next start`, porta3100, somente mocks
e dados sintéticos):34/34 PASS,17 desktop/17 mobile. Inclui os9 cenários PA06
de seleção/conflito/concorrência/debounce por projeto, integridade editorial e
regressões de cópia/duplicação/acréscimo. Comando:
`E2E_WEB_URL=http://localhost:3100 E2E_REUSE_EXISTING_SERVER=true pnpm exec playwright test tests/visual/pa06-calculo-combinado.spec.mjs tests/visual/pa02-copia-refeicoes.spec.mjs --project=desktop-chromium --project=mobile-chromium --grep 'PA06|copia uma refeição publicada|acrescenta alimentos|duplica a refeição local'`.
Servidor local encerrado após os testes. Build/typecheck Web PASS; lint do
componente de cálculo/formatador sem avisos/erros. `pnpm test:confiabilidade`
PASS (40 referências críticas); `pnpm security:secrets`/`git diff --check` PASS.

O CI de `bcf0825f` não aprova automaticamente os commits de correção. A PR #422
concentra o estado operacional dos checks do HEAD final e permanece Draft até
sua conclusão. Nenhum acesso a banco externo, migration externa, carga TACO,
merge, deploy ou ativação foi executado nesta rodada.
