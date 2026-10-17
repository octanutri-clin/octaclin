# PA07 — integração final e revisão técnica

Base `62a50104` (main/#422), branch `feat/pos320-pa07-planejamento`.
Desenvolvimento autorizado pelo proprietário; D01 preservada. Implementação
R4 por integridade do rascunho clínico. Este relatório complementa os checkpoints
[núcleo](EVIDENCIAS_PA07_NUCLEO_2026-10-16.md) e [T04](EVIDENCIAS_PA07_UI_2026-10-16.md),
que permanecem como histórico de cobertura parcial.

## Comportamento entregue

Segunda aba em consulta, com retomada explícita. A detentora suspende edição e
autosave antes de drenar o envio já iniciado. A solicitante precisa adquirir o
Web Lock e reler a versão autorizada antes de editar. Conteúdo antigo local
permanece em memória; divergência exige confirmação de descarte/releitura e uma
nova retomada explícita. Fechamento não salva nem concede posse automaticamente.

ON/OFF, seleção/cálculo, navegação protegida, expansão, histórico, portal e
impressão conservam seus contratos. Não houve alteração de backend, endpoint,
schema, migrations, dependências ou configuração externa. R071 foi consultado
como referência de decisão, sem copiar código nem instalar o pacote.

## Achados corrigidos em T05

| Achado | Evidência RED | Correção e critério GREEN |
| --- | --- | --- |
| Recarga bem-sucedida deixava o estado entre abas em `reconferir`, sem botão de retomada | Browser aguardou `Editar nesta aba` após confirmar recarga; timeout com campos ainda desabilitados | Pausar/invalidar a coordenação anterior antes de recarregar; reiniciar em consulta somente após leitura bem-sucedida no mesmo contexto; nova retomada lê o servidor |
| Aviso/retomada ausente em plano publicado sem rascunho | Segunda aba tinha `Criar nova versão` desabilitado e nenhum `Editar nesta aba` | Aviso fica no nível do plano, incluindo plano publicado e edição indisponível |
| Cópia em voo utilizava o callback mais recente após perder e retomar posse | Cenário de duas abas não recusava a resposta da cópia da geração antiga | Capturar o callback/geração no início da cópia; ele usa o formulário vigente dentro da mesma geração e recusa geração anterior, mesmo após retorno da posse |

As primeiras execuções de dois casos exigiram correção das fixtures: aguardar
a posse inicial, usar o nome acessível do combobox e responder corretamente à
leitura de versão publicada. Esses erros de harness não são classificados como
RED de produto. Os RED comportamentais acima foram observados depois deles.

## Revisão de segurança e integridade

Revisão própria do diff e caminhos relacionados; não equivale a revisão
independente. Superfícies verificadas:

- Envelope BroadcastChannel v1 estrito: somente tipo/instâncias/pedido/destino;
  nenhum documento clínico, credencial ou identidade cadastral. Eventos não
  escolhem URLs/recursos de fetch e não concedem autorização.
- Web Locks sem `steal`, fila de aquisição ou retomada por timeout. Cleanup
  cancela espera, libera lock e invalida ACKs anteriores. Falha de APIs é
  declarada; CAS continua obrigatório no modo sem coordenação.
- Fila de save: posse independente de IME/cópia; perda da posse cancela somente
  solicitações ainda não iniciadas. Envio iniciado é drenado, sem flush de
  edição posterior nem alegação de rollback de rede.
- Writers do editor: campos, preferências, refeições, arraste, modelos,
  receitas/cópia, manual/60s, revisão/publicação, arquivo e nova versão usam a
  guarda de posse. Captura de callback da cópia impede sua revalidação por ABA.
- Leituras de retomada/foco revalidam sessão e recurso. Conflito, incerteza,
  arquivamento ou acesso recusado não reativam save. Descarte explícito pausa a
  instância anterior antes da rede; falha na recarga mantém o bloqueio.
- Nenhum novo storage/cache/log clínico ou projeção de entidade foi criado.
  BFF e servidor existentes conservam sessão, tenant, carteira, criptografia,
  snapshots, CAS e FORCE RLS. A trava local não sincroniza outros dispositivos.

Revisão cruzada independente: **SKIPPED nesta execução**, sem novo revisor
separado da autoria. Manter essa pendência explícita na PR; scanners e testes
automatizados não substituem essa revisão.

## Verificações deste ciclo

| Prova | Resultado |
| --- | --- |
| Playwright PA07 no servidor webpack dev, duas páginas reais e APIs nativas | PASS 16/16 desktop/mobile; consulta, retomada por teclado, falha/recarga, publicação sem rascunho, retorno dirty, envio em voo, leitura pendente e cópia ABA; Axe no aviso |
| Playwright sobre build de produção local, PA02–PA07/portal/impressão e lifecycle adicional | Últimos resultados PASS em todos os casos cobertos. Rodada inicial: 89/92, 3 falhas de harness. Retestes: portal/restauração 4 PASS; revogação 2/2 finais PASS. Detalhes abaixo, sem apresentar a rodada inicial como 92/92 |
| Backend Jest `--testPathPatterns=modulos/planos-alimentares` | PASS 23 suítes / 343 testes |
| Backend `tsc --noEmit`, Nest build e verificação `dist/main.js` | PASS |
| Web `next build --webpack` | PASS, incluindo TypeScript; avisos existentes de middleware/Edge de dependência Next |
| Web `tsc --noEmit` e lint integral | PASS (exit 0); lint 0 erros / 70 avisos no projeto, sem corrigir warnings alheios à PA07 |
| Web autorização de rotas, BFF de planos, nutrição/coordenação e cálculo combinado | PASS 30 + 42 + 59 + 4 testes |
| `pnpm test:authz` integral local | Interrompido deliberadamente após correlação 57/57; compilação repetida de toda UI por scripts legados. Recortes afetados acima executados; gate integral continua exigido no CI |
| PostgreSQL 15 real descartável `node scripts/test-pa05-postgres-local.cjs --inventario` | PASS 24; 29 filtrados. FORCE RLS/runtime NOBYPASSRLS, NULL tenant, carteira/transferência/revogação, cifra, CAS save/save/revisão/publicação e regressões PA04–PA06 |
| PostgreSQL integral Timescale/pgvector | SKIPPED local: limite de disco para imagem HA. Fixture parcial não valida extensões/hypertables; CI integral obrigatório |
| Scanner local de secrets e matriz de confiabilidade | PASS; 40 referências. Nenhuma garantia absoluta de ausência de vulnerabilidade |
| `git diff --check` | PASS |
| CI/scanners do HEAD final | Pendente na PR, sem herdar o CI da PA06 |

A rodada de produção falhou inicialmente em `goto(..., waitUntil:load)` do
portal sob compiladores concorrentes e no seletor não único de “Arquivar” do
novo teste de revogação. O portal passou a aguardar DOMContentLoaded e os
elementos funcionais já exigidos; o teste de revogação confere todos os botões
encontrados. Um reteste ainda esperava a mensagem bruta sintética de HTTP403,
mas o produto corretamente expunha a mensagem de permissão sanitizada. Essa
expectativa foi corrigida; os dois casos de revogação passaram na execução final.
Não houve mudança de runtime para contornar essas falhas.

Os dois casos adicionais de `pagehide/pageshow` com `persisted:true` passaram
no browser com APIs de coordenação reais: mantêm texto local, param autosave e
exigem retomada. Esses eventos são injetados pelo teste; não representam uma
prova de navegação BFCache real/aba congelada em todos os navegadores.

Comandos de navegador, no diretório Web, com Node22 e servidor local3317:

```sh
E2E_WEB_URL=http://localhost:3317 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/pa07-coordenacao-abas.spec.mjs --reporter=line --timeout=90000
E2E_WEB_URL=http://localhost:3317 E2E_REUSE_EXISTING_SERVER=true node node_modules/@playwright/test/cli.js test tests/visual/pa07-coordenacao-abas.spec.mjs tests/visual/pa02-copia-refeicoes.spec.mjs tests/visual/fase-320-pa05-apresentacao.spec.mjs tests/visual/fase-320-pa06-ativacao.spec.mjs --reporter=line --timeout=90000
```

Todos os dados são sintéticos. Banco local `octaclin_pa05_descartavel`: owner
somente para preparar migrations; testes com runtime DML sem BYPASSRLS. O
container é descartado pelo script. Nenhum banco remoto, dado real, migration
externa, ativação, merge ou deploy foi executado. Node_modules foi reutilizado
por symlink após conferir igualdade dos lockfiles, sem instalação de dependência
nova. Somente caches gerados pela própria PA07 foram limpos para liberar espaço.

## Rollback e operação

Reverter o código PA07 por PR conserva payloads/histórico/CAS da PA06; sem schema
ou backfill novo. Encerrar uma aba não confirma salvamento. Não executar
`migration:revert` para esse rollback. A publicação do editor depende de merge e
deploy próprios após os gates da PR; testes locais não provam produção.

Pendências operacionais: CI do HEAD final, revisão cruzada quando disponível e
decisão de merge/publicação pelo proprietário. A próxima fase do roadmap deve
ser planejada somente após conferir a integração desta entrega.
