# FOOD06 M09 — ajuda de interpretação

## Estado e escopo

PR455 Draft, branch docs/food06-contratos-fontes. Base localc5c20ad3 e remota
c949821b com árvore idêntica53af3cdd; históricos preservados. O CI da base foi
consultado neste ciclo: run41357758927 SUCCESS, incluindo Backend, Web, Mobile,
AI, Demo e PRGate; research/dependency/CodeQL/Semgrep/Trivy SUCCESS. Isso não
comprova o delta M09. Provenance SBOM não foi revalidada individualmente aqui.

Risco R4 por integração em respostas clínicas existentes; mudança aditiva de
metadados próprios, sem alteração de autorização, persistência, lock, schema,
composição, referência numérica ou provider. M09 parcial até gates do novo HEAD.
Direitos/DRI/G06 BLOCKED.29,2% administrativos,0/12 melhorias integralmente
encerradas. Não é encerramento da FOOD06 nem autorização assistencial.

## Implementado e preservado

- Projector server-side puro e versionado food06-ajuda-v1 reutiliza o catálogo
  próprio de explicações do domínio. Sete tópicos: RDA, AI, UL, planejado versus
  consumido, dados parciais, indisponibilidade e limites de interpretação.
- Tabela factual e prévias de quantidade/troca/receita recebem a mesma ajuda.
  O conteúdo não contém contexto de paciente nem tabela de valores DRI. Nenhum
  endpoint novo. comparacoesHabilitadas:false permanece obrigatório.
- Metadados são acrescentados depois do cálculo do fingerprint da prévia:
  alteração apenas de redação não modifica matemática, revisão ou confirmação.
  Não são gravados em planos/snapshots. História/publicação permanecem intactas.
- Parser Web projeta por allowlist, limita strings/arrays/tópicos/versão,
  rejeita getters, propriedades especiais, fonte/data/URL inválidas. Sem HTML
  arbitrário. Ajuda inválida fica indisponível, sem apagar valores factuais.
  Respostas legadas sem ajuda continuam válidas, sem inventar textos.
- Componente compartilhado usa details/summary nativos e teclado; guia fechado
  inicialmente. A fonte externa só abre por clique, com noopener/noreferrer e
  no-referrer. Não envia contexto clínico nem faz chamadas externas automáticas.
- Zero conhecido e subtotais parciais permanecem distintos. Tabela já informa
  planejamento≠consumo e total real desconhecido junto ao valor parcial.
  Não há segundo motor, percentual de adequação, diagnóstico ou meta automática.

## Fonte científica e direitos

[NIH ODS — Nutrient Recommendations](https://ods.od.nih.gov/HealthInformation/nutrientrecommendations.aspx),
URL pública identificada no projector.
Consulta HTTPS em2026-11-02 HTTP200,113.828bytes; SHA256 do HTML observado:
2136d6525bc8c8f34e17ee1bb7ffa25a7c58afa79e0d683ac00b58446728ac3d.
Definições RDA/AI/UL conferidas contra o catálogo próprio existente. HTML não
incorporado ao produto. Textos próprios/paráfrases, sem importação de tabelas.
A citação não comprova direitos comerciais de outros artefatos DRI nem encerra
PARECER_FONTES_DRI_FOOD06.md. CL01–CL08 ratificadas permanecem nos seus limites.

## TDD e validações

- RED funcional Backend: ausência da projeção em duas respostas; testes legados
  continuaram passando. GREEN focado inicial164/164. Acrescentado teste isolando
  título da ajuda: fingerprint e comparação idênticos; spy restaurado em finally.
- RED Web:12falhas funcionais nos novos contratos (ajuda ausente/inválida),
 48testes anteriores PASS. GREEN final61/61, zero skipped; dados desconhecidos,
 zero, fonte/URL/versão/data/tópicos/getters e fingerprint preservados.
- RED browser: guia ausente na build anterior, com modal e dados carregados.
  Erros iniciais de diretório/setup não foram usados como RED funcional.
- Backend completo:3.931PASS,180SKIPPED,380suítesPASS/9SKIPPED. Skips preservados;
  não equivalem a aprovação de PostgreSQL ou providers. Build e artefato PASS.
- Web build webpack/typecheck Node22.23.4 PASS. Uma invocação sem --webpack
  tentou Turbopack e falhou no symlink de node_modules; não foi falha funcional
  nem corrigida alterando dependências/segurança. Reutilizado build webpack
  suportado pelo projeto. Microcopy PASS; lint6arquivos runtime0erros/0warnings.
- Primeira matriz browser158/158PASS (8M09+150regressões). Fixture foi depois
  alinhada integralmente à saída real do projector próprio, sem importação
  runtime entre pacotes. Matriz final:157PASS/1FAIL por timeout30s no teste
  PA07 aquisição aguarda leitura autorizada sem habilitação otimista, desktop.
  O trace mostrou atividade de polling no relógio simulado; causa não comprovada.
  Os8casos M09 passaram nos dois projetos, incluindo axe/teclado/fonte200%.
  O cenário PA07 isolado foi repetido3vezes por projeto:6/6PASS, sem mudanças de
  código/assert/timeout. Reexecução da suíte PA07 completa:61PASS/1FAIL, agora no cenário mobile
  retorno com texto antigo exige descarte e nova leitura antes de salvar
  (campo continua disabled após assumir). Trace sintético preservado localmente
  em /tmp/food06-m09-pa07-retorno-trace.zip; análise independente solicitada.
  Não há causa comprovada; PA07/coordenadores não foram alterados pelo delta.
  Não converter a falha da matriz em PASS irrestrito; CI do novo HEAD é gate.
- Reexecução com URL127.0.0.1 foi interrompida (exit130): cookies sintéticos
  das fixtures são limitados a localhost, portanto redirecionava ao login.
  Corrigido somente o endereço do runner para localhost; não houve mudança
  de autenticação/cookies do produto, timeout ou dependências. Não é PASS.
- Não executada nova prova PostgreSQL local: sem mudança de banco; CI deve
  repetir gate oficial descartável. As141provas da API receita são históricas,
  não uma nova execução M09. Sem testes externos/staging/produção.

## Revisão e UX

R4 independente delimitada por food06_m09_r4: favorável, sem achado bloqueador.
Primeira revisão executou150testes Backend e60Web próprios e diff-check;
complementação final somente estática, examinou novos testes, fixture e mensagem.
Não executou browser/build/DB nem validação clínica humana. Não é R4 integral
FOOD06. Revisor não escreveu código.

UX B/C: duas instâncias independentes com papéis explícitos PR451/0d3382b6,
sem seleção TOML nativa comprovada. Os papéis proíbem ferramentas às personas:
receberam brief sintético e observações do coordenador, sem ferramentas,
inspeção visual própria ou interação. Portal direto N/A; efeitos indiretos
avaliados. Relatório em docs/agents/ux/reports/FOOD06-M09-BC/consolidado.md.
Sugestões P2 não ampliam escopo; refinamento da mensagem de falha incorporado,
distinções de parcial/planejado já cobertas, descoberta do tópico em backlog.
Sem usuários reais ou execução humana de tecnologia assistiva.

## Achado de regressão PA07 — investigação separada do cálculo M09

A análise independente adicional food06_m09_r4 confirmou a falha de transferência
no trace: campo disabled10s já na primeira aquisição pela segunda aba, antes de
salvar, retornar ou executar fastForward. O nome do cenário não demonstra defeito
na restauração do texto antigo. Os arquivos PA07 não têm delta contra a base.
Não há evidência de perda de dados, quebra de CAS/autorização ou causalidade M09.

Lacuna comprovada: a trava sintética dos testes libera sincronamente; o adaptador
nativo resolve a Promise do callback Web Locks, mas a interface liberar retorna
void. O coordenador envia liberado sem aguardar término efetivo de locks.request;
o destino tenta ifAvailable uma vez. Corrida é hipótese compatível, não causa
confirmada: trace não registra eventos de lock/canal e não exclui foco/fixture.

Próxima prova determinística: separar liberação solicitada/efetiva com barreira,
entregar mensagem antes da liberação e verificar estados. Complementar browser
instrumentado somente com eventos sintéticos, relógio real e simulado. Não
corrigir por retry cego, ampliar timeout, enfraquecer CAS ou habilitar edição
antes de leitura autorizada. A análise adicional foi estática, sem testes ou
escrita próprios. Não reabre A04/A05 FOOD05 por associação.

## Ambiente e reprodução

Executor recuperado, delta preservado. Node padrão24 fora de engines; utilizado
Node22.23.4 oficial, tarball verificado por SHASUMS SHA256
1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce.
Sem reinstalação de dependências. Destinos temporários dos symlinks de build e
artefatos de teste foram recriados após reinício, sem mudar links/configuração.

No pacote Backend: Node22 executa Jest --runInBand e build/checagem de artefatos
conforme scripts existentes. No Web: Node22 executa scripts/test-calculo-combinado-planos.mjs
(harness de prévia, fatos, seleção PA06 e contribuições), next build --webpack,
ESLint nos6arquivos runtime e scripts/test-linguagem-interface.mjs.

Servidor Next compilado isolado em127.0.0.1:3100; E2E_WEB_URL=http://localhost:3100 e
E2E_REUSE_EXISTING_SERVER=true. CLI Playwright com os sete specs:
food06-ajuda, food06-receita-previa, food06-previa-editor,
food07-metadados-receitas, pa07-coordenacao-abas, food06-tabela-factual,
pa06-calculo-combinado. Ambos projetos Chromium, sem aumento de timeout,
remoção de asserts ou execução simultânea no mesmo outputDir.

## Próxima ação e rollback

Matriz e capturas registradas com as falhas acima, diff/segredos PASS. Commit apenas do delta
intencional e publicar na branch existente por Git Data API com igualdade de
árvore e expected_sha/fast-forward, sem reset/rebase/force. Validar CI do novo
HEAD e registrar SHA remoto/local. Compatibilidade de rollout: leitores antigos
ignoram metadados, novos aceitam resposta legada; rollback só de código, sem
migration ou alteração de snapshots. Nenhuma permissão/flag clínica nova.
Prioridade seguinte: diagnosticar de forma determinística as falhas PA07 e
confrontar com o CI do novo HEAD, sem modificar timeouts ou liberar edição
otimista. Depois seguir M07 factual, reutilizando snapshots autorizados e
preservando as lacunas; referências clínicas continuam bloqueadas.
