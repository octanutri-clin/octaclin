# FOOD06 — API factual de prévia e confirmação M04

## Estado e limites

Incremento da PR #455 Draft, sobre53835d72; não encerra M04 ou FOOD06.
Risco R4: leitura e escrita clínica autorizadas no rascunho. Sem migration,
novo motor nutricional, dependência, chamada externa ou alteração produtiva.
Direitos DRI e G06 continuam BLOCKED. FOOD05-MDL/D18 não foi iniciada.
Progresso administrativo permanece29,2% (7parciais/5pendentes),0/12 encerradas.

CI da base53835d72/run41289402544: Backend/Web/PG/RLS/scanners passaram,
mas resultado global FAIL em Demo local smoke, etapa Linguagem e microcopy.
O script local reproduziu o canário de teste `CANARIO_NAO_EXIBIR` em
`food06-tabela-factual.spec.mjs`; marcador e assert foram renomeados juntos para
`CANARIO_PRIVADO`, preservando o teste negativo. Script de linguagem PASS depois
sem waiver, redução de asserts ou alteração da regra. O novo CI tem gate próprio.

## Contrato e reuso

POST `.../planos-alimentares/:planoId/rascunho/previa-micronutrientes`
e POST no mesmo caminho com `/confirmar`. BFF correspondente em `app/api`,
corpo streaming limitado a8KiB e wrapper de sessão existente. Respostas
`private, no-store`, sem novo acesso pelo portal, URL clínica ou cache persistente.

Somente Professional responsável atual, com `planos_alimentares.gerenciar`;
SuperAdmin não assume confirmação neste fluxo novo. Demais fluxos legados
mantêm seus papéis. Tenant vem da credencial; serviço revalida papel, permissão,
carteira, paciente, plano e rascunho antes de decifrar. Controller usa guardas,
UUID pipes e DTO class-validator; serviço também valida whitelist integral.

Entrada: `rascunhoIdEsperado`, `rascunhoRevisaoEsperada`,
`ativacaoRevisaoEsperada` e operação discriminada. Confirmação acrescenta
`fingerprintEsperado` SHA256 hexadecimal. Operações iniciais:

- `definir_porcao_manual`: quantidade, unidade e gramas explícitos, sem inferir
  medida caseira. O vínculo atual de medida é removido por intenção `null`.
- `substituir_catalogo`: os mesmos campos e ID de catálogo; fonte é resolvida no
  servidor. Encerra explicitamente a aplicação custom do alvo com `null`, sem
  converter alternativas ou modificar os snapshots históricos.

Quantidade/gramas positivos de0,001a10.000 com até3casas, sem coerção, NaN ou
Infinity. Campos extras, nutrição/contexto/tenant enviados pelo cliente, objetos
não simples, getters e chaves especiais são rejeitados. Chaves editoriais da
refeição/item precisam pertencer ao documento salvo da revisão exata; não são
índices de array nem capabilities de acesso.

Rascunho deve estar salvo e materializado. Legado, pendente, corrupção ou
identidades ambíguas exigem reconferência; não são promovidos a totais completos.
O antes usa snapshots cifrados da própria materialização; o depois reutiliza a
preparação do writer editorial, os resolvedores FOOD01/02/04 e `resolverEstrutura`.
PA06, cobertura e o núcleo M04 já testado produzem os dois resultados/deltas.
Nenhuma soma nova no BFF, ausência como zero ou principal somado à alternativa.
Planos/refeições OFF são excluídos conforme o estado operacional; o escopo
retornado é `rascunho_refeicoes_ativas`, não ingestão real nem publicação.

A preparação de edição foi extraída do writer existente, preservando seu fluxo
legado de rascunhos parciais. Prévia não chama a preparação persistente de
identidades, não salva versão/filhos/auditoria nem cria recibo. Confirmação usa
o mesmo writer em uma transação, com materialização obrigatória; falha reverte
a operação. Snapshot publicado não é refeito e publicação não é automática.

## Concorrência e rastreabilidade

Locks seguem paciente→plano→rascunho: read na prévia, write na confirmação,
como nos writers atuais. Fontes e referências são revalidadas na mesma transação.
Fingerprint determinístico inclui usuário/escopo, versão/revisões editorial,
de apresentação e de ativação, operação, fatos/deltas e projeção nutricional
mínima das fontes resolvidas, inclusive alternativas. Não inclui texto clínico,
contexto cifrado, proveniência clínica ou notas; não substitui autorização.

Confirmação refaz a prévia sob os locks e recusa fingerprint/revisão obsoletos.
Novo autosave, troca operacional, fonte indisponível ou acesso perdido exigem
nova conferência. CAS rejeita replay com409 e evita reaplicar; **não há recibo
idempotente persistido nem reprodução do ACK anterior**. Cliente futuro deve
reler o rascunho após perda de resposta e não fazer retries cegos.

A resolução do depois é a mesma do salvamento: fontes de catálogo de outros
itens também podem ser revalidadas. O aviso estruturado
`fontes_resolvidas_como_no_salvamento` impede atribuir por contrato todos os
deltas exclusivamente à troca dietética. Fontes ativas têm controles de
imutabilidade no banco; alteração da fixture em memória não prova autorização
para atualizar catálogo real. Composições custom/grupos congeladas seguem o
writer, sem sincronização retroativa com bibliotecas.

## TDD e revisão independente

- DTO: RED3 funcionais contra stub→GREEN39; há whitelist, nested shape,
  limites, protótipos/getters e validação pelo pipe real.
- Serviço: RED5 funcionais contra stubs→GREEN; casos ampliados de zero/ausente,
  catálogo alterado/inativo, OFF, revisão/ativação/carteira, flags legítimas,
  comando adulterado e replay. Extração inicial preservou127testes existentes.
- Controller: RED2 por rotas ausentes→GREEN; papéis, permissão, no-store,
  caminhos e encaminhamento de contexto. Não é HTTP autenticado real.
- BFF: RED4 funcionais por destino/permissão/limite incorretos→GREEN80/80.
  Harness Node com sessão/fetch simulados, não teste de navegador ou backend real.
- Preferências: RED1 funcional ao confirmar prévia anterior à alteração da
  apresentação→fingerprint com revisão de apresentação e usuário→GREEN.
- R4 independente `/root/food06_m04_api_r4`, sem edição/coautoria: achados
  reproduzidos custom→catálogo e medida→manual por omissão legada. RED2 no
  serviço→intenções `null` e GREEN. Rótulo antigo do documento após troca também
  corrigido pela descrição autorizada do snapshot, reobtendo alvo após clone.
- Revisor executou254/254 em6suítes backend,80/80 BFF e22casos adversariais
  adicionais transitórios/não versionados (nenhum getter executado), diff-check PASS. Parecer delimitado
  favorável, sem achado reproduzível pendente no delta. Não é R4 integral FOOD06.
- Último focado próprio:200/200 nas3suítes serviço/DTO/controller, Node22.23.4.

## Verificações locais finais antes do envio

- Backend completo:3906PASS/177SKIPPED,379suítesPASS/9SKIPPED; cinco novos casos
  PG estão entre os skipped, não aprovados. Typecheck e build Nest/verificador PASS.
- Web: typecheck e build webpack194páginas PASS. Dois BFFs novos validados no
  harness80/80; ESLint dos arquivos Web afetados, microcopy e APIs dinâmicas164
  arquivos PASS; matriz de autorização de rotas30/30 PASS.
- Playwright oficial:38/38 desktop/mobile nas specs FOOD06 factual e PA06
  combinado, contra build local otimizado e fixtures sintéticas. Inclui o canário
  renomeado, modal de origem, teclado/axe, largura e invalidação. **Não testa uma
  interface M04 nova**, ainda inexistente neste incremento, nem backend real.
- O conjunto completo27scripts de `test:authz` está EM EXECUÇÃO no checkpoint
  deste commit, invocado sequencialmente por Node22 a partir do próprio package
  script. Resultado final e CI devem ser conferidos na PR/HEAD correspondente.
- `git diff --check` e scanner local de segredos PASS. Sem artefatos temporários,
  novas dependências ou lockfile. Alteração preexistente next-env da worktree
  principal preservada, não pertence a este commit.

Limitações de setup (não RED funcional): comando pnpm local tentou bootstrap
sob Node24 e foi recusado sem reinstalação; os27scripts foram retomados por
Node22 diretamente, sem mudar engines. Primeiro build Web falhou na resolução
`next-server` por `.next` realocado em/tmp; repetição com `NODE_PATH` para os
módulos locais já instalados PASS. Nenhuma alteração de configuração do produto,
segurança ou dependências para acomodar o ambiente. Scripts finais reprodutíveis:
Jest `--runInBand`, `tsc --noEmit`, Nest build/verificador, Next `build --webpack`,
ESLint afetado, `scripts/test-planos-alimentares-bff.mjs`, `test:authz` (conteúdo
Node sequencial), linguagem/APIs dinâmicas, Playwright oficial com servidor3100
reutilizado e `scripts/scan-secrets.mjs`, todos com Node22.23.4.

## Banco e gates ainda em validação

Cinco cenários novos na suíte oficial PostgreSQL descartável/runtime/FORCE RLS:

1. Prévia sem escrita, confirmação materializada, zero/ausente, negativos de
   papel/tenant, replay e preservação da publicação histórica.
2. Duas confirmações controladamente concorrentes: um ACK, um CAS409, sem dupla
   materialização; prova espera por lock real via helper existente.
3. Autosave e OFF concorrentes invalidam prévia/revisão anteriores.
4. Transferência de carteira concorrente impede confirmação do profissional antigo.
5. Falha injetada no save de item após remoção dos filhos: rollback de versões,
   refeições, itens, vínculos e estados de identidades.

NOT RUN local: imagem oficial `timescale/timescaledb-ha:pg15` ausente e filesystem
do daemon com cerca de133MiB livres. Não substituída por Postgres sem extensões,
não alterados daemon/storage e não houve pull grande. Novos cenários permanecem
pendentes até execução efetiva no CI. Nenhuma prova em memória é prova RLS/rollback.

## Continuidade obrigatória

- Conferir CI do novo HEAD, especialmente cinco cenários PG e Demo/microcopy.
- Integrar interface antes/depois/confirmação ao editor com posse PA07, ACK,
  autosave60s, cancelamento, respostas tardias e reidratação após conflito.
- UX B/C da interface M04, desktop/mobile/teclado/axe: ainda NÃO EXECUTADOS.
  Revisão de API não equivale a experiência de usuário ou teste visual.
- Completar operações de receita/porção/preparo, alternativas custom e grupos,
  conforme contratos existentes e sem motor paralelo. As duas operações iniciais
  não retiram nenhum requisito aprovado de M04 ou M01–M12.
- Comparações DRI continuam indisponíveis; direitos/contexto/rastreabilidade,
  M07/M08/M10/M11/M12 e validação integral permanecem abertos.

Rollback deste incremento: reverter código antes de disponibilização; não há
schema novo. Gravações confirmadas são rascunhos pelo envelope atual, compatíveis
com leitores existentes; histórico/snapshots anteriores não são reescritos.
Sem merge/deploy/migration externa, produção ou mudança operacional nesta execução.
