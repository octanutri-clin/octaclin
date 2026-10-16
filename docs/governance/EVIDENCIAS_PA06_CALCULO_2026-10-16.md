# PA06 — cálculo combinado: checkpoint backend

## Escopo e base

Autorização do proprietário: “Pode seguir com sol médio”, após D11–D13.
Branch `feat/pos320-pa06-calculo`, worktree `pos320-pa06-calculo`, base
`011ea87d` e planejamento `10ebf9aa`. Risco R4 (leitura clínica, snapshots,
autorização, RLS e concorrência). Nenhum trabalho preexistente sobrescrito.

T08c implementado localmente. UI/BFF T08d ainda pendentes. Uma PR será preparada
com a terceira entrega completa; este checkpoint não autoriza merge/rollout.
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

## Comandos e gates

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

## Próximo checkpoint

Troca manual para **GPT-6 Luna alto**: T08d.1–T08d.4, mesma branch/worktree.
Ler `tasks/plan.md` e `tasks/plan-pos-320-pa06-calculo.md`. Depois voltar ao
Sol médio para integração, revisão R4, gates finais e PR única.
