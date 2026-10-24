# FOOD04 — revisao cruzada de seguranca e isolamento

## Autoria e escopo

Revisor: agente `food04_security_cross_review`, contexto separado, somente
leitura, sem autoria no codigo e sem subdelegacao. Autor/coordenador: `/root`.
E uma revisao cruzada entre agentes, nao uma avaliacao humana externa.
Primeiro intervalo: `9e1984a2..d3157af0`, PR #441.

O revisor leu os caminhos de CRUD, fontes, administracao, dominio/DTOs,
projecoes, migration1078/RLS, BFF, aplicacao/editor/biblioteca, snapshots,
capacidade profissional, carteira e persistencia dos planos. Tambem conferiu
override Zod, allowlist/backports, snapshot original/hash e cobertura do
inventario. Nao executou suites de banco/browser; os resultados do autor e do
CI sao evidencias separadas. Nao avaliou producao ou aplicou migrations.

Nenhum bypass tenant/admin, Critical ou P1 foi confirmado nessa leitura. A
correcao anterior A/B foi confirmada no fonte: alvo/revisao imutaveis,
navegacao bloqueada e confirmacoes invalidadas ao trocar/fechar selecao.

## Achados e correcoes

### R4-F01 — P2: catalogo mutavel em aplicacoes existentes

O save preservava a intencao/proveniencia, mas validava novamente a fonte e
relia os nutrientes atuais. O teste antes da correcao demonstrou alteracao de
50 para 499,5 kcal ao mudar energia100 para999 por100g, e dois saves recusados
apos desativacao da fonte (incluindo rascunho incompleto). Tres RED.

A correcao captura a composicao/fonte completa na primeira aplicacao, depois
de autorizacao/canonicalizacao do grupo. Persiste esse contexto no envelope
interno cifrado `schemaSnapshotEdicao:2` do campo existente
`edicaoSnapshotCriptografado`; nao cria coluna/migration. Documentos schema1
sem esse contexto continuam legiveis. O DTO editorial continua schema1 e nao
aceita o envelope interno do cliente.

O reaproveitamento exige mesmo tenant/versao autorizada, chave de alternativa,
pai, alimento e tupla grupo/revisao/entrada/aplicacao. Uma nova aplicacao volta
ao resolver autorizado; nao transforma snapshot antigo em capability nova.
Na versao clonada, a recuperacao usa somente filhos materializados da versao
atual ja autorizada. Dados incompletos tambem preservam o contexto cifrado;
nenhuma consulta mutavel a fonte ocorre para fatos ja aplicados.

Porcoes novas sao calculadas sobre os fatos preservados, usando o motor
existente e a base original dos micronutrientes. Fonte, descricao, ausencia de
nutrientes e proveniencia permanecem. A projecao devolve somente o documento
permitido e os snapshots clinicos existentes; o mapa interno nao sai na API.
Contexto interno divergente fica indisponivel em vez de virar dado confiavel.

GREEN observado: suite do servico113/113, incluindo os tres cenarios,
reabertura de versao clonada, rejeicao de nova aplicacao desautorizada e
contexto adulterado; helper de envelope7/7 com compatibilidade schema1,
schema2, identidade/pai/versao divergentes e rejeicao do envelope como DTO.

### R4-F02 — P2: cancelamento durante save em voo

A confirmacao aguardava um envio do editor. Cancelar fechava apenas a leitura
da previa, permitindo que o ACK anterior acrescentasse alternativas depois.
O teste de navegador reproduziu sucesso indevido apos Cancelar em desktop e
mobile; dois RED. A tentativa desktop atingiu tambem o timeout global30s,
com o sucesso indevido observado; mobile concluiu a assercao negativa falha.

Um AbortSignal agora liga a operacao da previa ao callback do editor. Cancelar,
desmontar ou mudar contexto invalidam a operacao; o editor confere o signal
depois de aguardar o save e antes de alterar o formulario. A resposta tardia
nao publica sucesso/erro em contexto cancelado. O autosave que ja estava em
voo continua sendo concluido normalmente, preservando as edicoes anteriores.

GREEN observado: novo cenario desktop/mobile2/2, sem mensagem de aplicacao e
sem alternativas no segundo payload salvo apos o cancelamento.

## Limites e rollback

Nao houve alteracao de auth/RLS/permissoes, schema SQL ou migration1078.
Os testes e checks finais precisam cobrir o HEAD corretivo.

O novo codigo le formatos editorial1 e envelope2. Depois que envelopes2 forem
gravados, nao fazer downgrade para um writer que desconheca esse formato:
suspender edicao e aplicar uma correcao adiante que preserve o ciphertext.
O dado cifrado e os snapshots materializados nao devem ser apagados nem
recalculados para permitir rollback. Nenhum envelope foi gravado externamente
nesta tarefa; a PR continua sem merge/deploy autorizado.

A observacao de detalhes que podem reabrir apos Fechar durante uma mutacao da
biblioteca nao foi classificada como bypass: o alvo da mutacao e capturado e
a lista fica bloqueada durante o envio. Nenhum write cruzado foi demonstrado.
Os riscos residuais de dependencias ficam no inventario, sem declaracao SQ4.

## Gate final

Revisao cruzada do delta `d3157af0..c0247662`: PASS na leitura de fonte.
O mesmo revisor independente da autoria reavaliou ambos os achados e seus
caminhos relacionados: R4-F01/R4-F02 resolvidos; nenhum novo Critical/P1/P2
confirmado. Conferiu identidade/pai/origem, nova aplicacao reautorizada,
compatibilidade schema1, envelope2 interno, clone de filhos autorizados e
cancelamento depois do await antes da mutacao. Nao executou suites nem CI;
nao equivale a auditoria humana externa ou aprovacao operacional.

O CI do checkpoint `d3157af0` concluiu SUCCESS: run40074420091, alem de
CodeQL40074420062, Semgrep40074420103, Trivy40074420036 e Dependency
Review40074420148. Essa evidencia fecha Governanca/Mobile daquele checkpoint,
mas nao substitui as regressoes e o CI do HEAD corretivo final, ainda pendentes.


## Regressoes locais do codigo corretivo

Node22.23.4, fixtures sinteticas. Backend completo: 362 suites PASS,
3244 testes PASS, 8 suites/142 testes SKIPPED (condicionais de integracao);
370 suites/3386 testes no total, 431,333s. Esse comando nao habilitou os
runners PostgreSQL: nao inferir PASS de RLS/concorrrencia dos skips.
FOOD04 Playwright: 20/20 PASS em desktop/mobile, 7,1min, incluindo cancelamento
aguardando ACK, snapshots editoriais e as regressoes da biblioteca.
Backend typecheck/build/artefato de producao e Web typecheck PASS;
ESLint dos arquivos Web: zero erros e oito avisos preexistentes.
Scan local de segredos e diff-check PASS. Logs/artefatos temporarios em
`/tmp/food04-r4-fixes`; servidor encerrado e symlinks locais restaurados.

CI com PostgreSQL/RLS/Testcontainers e scanners do HEAD final ainda PENDING;
nenhum resultado do checkpoint anterior e promovido ao novo codigo.
