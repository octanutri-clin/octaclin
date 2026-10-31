# FOOD06 — interface factual (incremento M01/M03/M06)

Branch `feat/food06-tabela-factual`, base6317a0c0/#457, PR Draft própria.
Escopo: tabela factual sob demanda sobre a mesma seleção PA06. Sem cálculos
científicos, persistência clínica, portal ou integração nova de catálogo.

Reutilizar seleção em memória, revisões/abort/chaves da PA06,22 códigos e
formatação nutricional. Filtros por grupo/cobertura, ordenação determinística,
quantidades conhecidas versus total desconhecido, detalhes de causas/contagens.
Ordenação por quantidade agrupa unidades explicitamente, sem ranking clínico.
Referências e percentuais permanecem indisponíveis; não simular RDA/AI/UL.

TDD: projeção/validação da resposta e filtros; cliente no-store/AbortSignal e
revisões; Playwright desktop/mobile, ausência de requisição antes de abrir,
zero/ausência/parcial, teclado/axe, conflito409, resposta tardia e troca de seleção.
UX B/C com duas instâncias independentes e interface real ou limitação declarada.
Revisão independente, lint/typecheck/build/gates proporcionais. Nenhuma onda ou
M01–M12 integralmente concluída por esta tabela parcial.

Sem merge/deploy/migrations externas/infra. Direitos, M11 e G06 preservados.

## Implementação e contratos preservados

- `MicronutrientesFactuais`: detalhe sob demanda no mesmo painel PA06, antes dos
  cartões legados.22 linhas, grupo vitaminas/minerais, cinco estados de cobertura,
  ordenação por nome/cobertura/quantidade agrupada por unidade, limpar filtros,
  detalhes por nutriente e área tabular focável com rolagem horizontal.
- Cliente faz POST apenas de seleções/revisões; no-store e AbortSignal. Não envia
  valores nutricionais, fonte ou elegibilidade arbitrários. API/BFF/backend da
  #457 permanecem inalterados.
- Projeção de resposta valida schema, publicações/revisões/canonização de IDs,
  unidade/código, contagens/causas/estados e valores finitos não negativos. Só
  campos usados pela tabela são copiados. Dado desconhecido não ganha zero;
  payload incoerente falha fechado com mensagem segura.
- Não há soma nutricional nova no navegador: apenas validação de contrato,
  filtro/ordem/apresentação. Os valores permanecem os do motor PA06 autorizado.
-403/409, revalidação por foco/online/recálculo ou alteração da seleção invalidam
  a apresentação. Revisão monotônica do pai compõe a chave da filha; gate
  derivado dos estados PA06 oculta e aborta durante revalidação/conflito/erro.
  Resposta antiga não restaura conteúdo. Troca de paciente remonta a filha.
-409 oferece Atualizar seleção usando a rotina PA06, que informa sucesso/falha;
  apenas sucesso permite nova consulta. A atualização não escreve plano.
- Nenhum Cache Storage/localStorage/telemetria clínica novo. O resultado continua
  PHI derivada e é mantido somente em memória autorizada; não é informação pública.
- Referências/percentuais ficam indisponíveis, conforme backend; o cliente não
  aceita resposta que habilite comparação científica inesperada neste contrato.

## TDD e verificações executadas

| Ciclo | RED observado | GREEN/resultado |
| --- | --- | --- |
| Modelo de apresentação |2 falhas/17 testes contra stub |17/17 |
| Cliente fetch |2 falhas/19 testes |19/19 |
| Publicação duplicada com caixa diferente |1 falha/20 testes |20/20 |
| Causas contraditórias/omitidas |1 falha/21 testes |21/21 |
| Estados incompatível/indisponível incoerentes |1 falha/22 testes |22/22 |
| Regressões de ordem/publicações | Caracterização, não novo RED |24/24 no harness final, incluindo seleção PA06 |
| Primeira UI | Botão inexistente após PA06 carregada; teste funcional falhou |6/6 desktop/mobile |
| Refinamentos UX B |2 falhas: posição e ação409 |24/24 FOOD06+PA06 após ajuste |
| Finding R4: foco/revogação | Subtotal permanecia após invalidação; RED browser |30/30 com foco/online/recálculo desktop/mobile |
| Matriz final ampliada | Três crashes Chromium antes da funcionalidade em rodada concorrente:11 PASS/3 FAIL de ambiente | Repetição completa sem outro runner browser:32/32 PASS, mesmos asserts/timeouts |
| Typecheck/Lint | Não se aplica RED funcional |PASS Web e arquivos alterados |
| Build Web | Sem ajuste de dependência ou config de produto |PASS: compilação e194 páginas estáticas |
| Autorização Web | Cadeia test:authz executada diretamente |27/27 scripts PASS, Node22, concorrência2 |

32 Playwright =14 casos FOOD06 e18 regressões PA06 nos dois projetos. Incluem
pedido só ao abrir, zero/parcial/ausência, filtros/limpar, Enter, ArrowRight na
área tabular, ampliação CSS200% sem overflow do documento, axe sem violações,
409, resposta tardia, revogação no foco/online/recálculo e payload inválido sem
expor erro interno. Nenhum leitor de tela humano foi utilizado.

Não classificar os crashes iniciais como PASS: ocorreram antes da factual e
ficaram nos logs de execução. Havia compiladores concorrentes e contadores OOM
observáveis no ambiente; sem baseline não atribuir causalidade exclusiva. Após
cessar o outro runner browser, a execução completa passou sem mudar assert,
timeout, dependência, segurança ou código para mascarar a falha.

## Revisão independente R4 do incremento

Revisor `/root/food06_ui_r4`, somente leitura, sem coautoria. Identificou P2:
PA06 invalidava o resultado principal mas a filha mantinha22 linhas após403 no
foco. Reproduziu independentemente; após correção, fechou o achado por releitura
mais prova browser retendo resposta factual durante revalidação pendente e403:
nenhum conteúdo restaurado. Não é bypass de autorização no backend.

Executou22 testes do modelo/cliente;12 Playwright tiveram11 PASS e um timeout de
setup aguardando select, antes da factual. O caso isolado passou1/1 depois que o
runner do coordenador terminou; sem alteração de timeout. Prova adicional de
resposta tardia/revalidação/revogação PASS. Sem novos findings bloqueadores no
delta revisado. Não é revisão integral de todas as ondas FOOD06.

## UX B/C e limites funcionais

Duas instâncias independentes com papéis por referência explícita #451/0d3382b6,
sem seleção TOML nativa comprovada. B apontou posição tardia, recuperação409 e
rótulos de cobertura; corrigidos dentro do escopo já aprovado, sem nova decisão
clínica ou concessão. C encerrou os três achados. Paciente direto N/A, preservando
console e ausência de efeitos no portal/plano. Relatórios/manifesto/PNGs sintéticos:
`docs/agents/ux/reports/FOOD06-BC-2026-10-31/`. Personas avaliaram DOM e observações
do coordenador, não interagiram nem viram imagens diretamente; não são pesquisa
com usuários reais, validação clínica ou R4.

M01 continua parcial por fontes por nutriente e saídas futuras. M03/M09 completos
e M05 científicos não concluídos. M06 não conclui filtros/percentuais RDA/AI/UL,
que dependem dos gates de referência; não os retirar do escopo aprovado. M02,
M04 e M07–M12 seguem nos incrementos planejados, M11 com contrato de restrições
pendente. Os32 testes desta tabela não aprovam indiscriminadamente esses itens.

## Ambiente e comandos

Node22.23.4, Next16.3.8 em cache. Sem instalar dependências de produto ou alterar
lockfile/engines. Browser Chromium da dependência Playwright já declarada foi
obtido como artefato de teste em `/tmp`, com TLS/CA mantidos. Artefatos `.next`
ficam em `/tmp` por symlink ignorado para não esgotar o overlay. `NODE_PATH`
apenas na invocação local permite resolver os módulos em cache dos artefatos
fora da worktree, sem mudar Next config ou opções de segurança. Isso não apaga
a falha de build local histórica da #457, ocorrida sem essa resolução local.

Servidor Next dev webpack próprio na porta3100 foi encerrado após as provas
browser para executar build, sem afetar serviços externos. `next-env.d.ts`
foi regenerado pelo Next e retornou ao conteúdo da base, sem delta versionado;
a alteração preexistente da worktree principal permanece preservada.

Com Node22 no PATH:

```bash
node octaclin-web/scripts/test-calculo-combinado-planos.mjs
node octaclin-web/scripts/test-planos-alimentares-bff.mjs
```

O segundo está incluído nos27 scripts da cadeia `test:authz`, executados sem o
wrapper pnpm que tentava reinstalar módulos no ambiente anterior. Cada script
teve exit0. Não desativadas políticas de instalação ou auditoria.

Playwright: `E2E_WEB_URL=http://localhost:3100`,
`E2E_REUSE_EXISTING_SERVER=true`, browser no `/tmp/food06-playwright-browsers`,
`node octaclin-web/node_modules/@playwright/test/cli.js test --config
 octaclin-web/playwright.config.mjs food06-tabela-factual pa06-calculo-combinado`.
Lint/typecheck/build por executáveis dos pacotes com Node22; build usa
`next build --webpack`, não deploy. Nenhum argumento de timeout foi ampliado.

## Handoff/gates

Branch `feat/food06-tabela-factual`, base6317a0c0/#457, PR própria Draft.
Concluídos controles de apresentação, cliente, TDD, regressões locais, UX B/C
neste incremento e revisão independente delimitada. Não há alteração backend,
DDL, migration ou reader/escritor de snapshots por esta branch.

CI do novo HEAD: PENDENTE até executar; não herdar aprovação do parent. Na #457
6317a0c0, Backend/Web/Demo/scanners PASS, Mobile/PR Gate FAIL, SBOM provenance
SKIPPED. Auditoria Mobile deve ser corrigida em fluxo separado, sem waiver.
Direitos das tabelas e G06 operacional BLOCKED. FOOD05-MDL/D18 fora do escopo.
Sem merge/deploy/migrations externas/infra/cobrança ou ativação assistencial.

Rollback deste incremento: reversão aditiva da UI/cliente, mantendo o endpoint
PA06 e snapshots intactos. Próximo incremento pode avançar na contribuição
hierárquica M02 sobre projeções autorizadas, sem habilitar comparações bloqueadas.
