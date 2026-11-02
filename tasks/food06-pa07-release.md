# FOOD06 — regressão PA07: término efetivo da liberação

## Escopo e estado

PR455 Draft, follow-up da ajuda M09 publicada no remotob1c6d839 e local4473d6e7,
árvore idênticaf7293a6b. Delta atual apenas Web, sem backend, migration, schema,
composição, fonte numérica, autorização ou alteração de provider. Risco R4:
coordenação consultiva de edição; CAS/autorização do servidor permanecem obrigatórios.
Sem merge/deploy/DDL externo. Direitos/G06 BLOCKED; FOOD05-MDL não iniciado.

## Evidência e distinção de causalidade

Histórico preservado em food06-interface-ajuda.md: matriz157PASS/1timeout PA07,
isolado6PASS; reexecução PA0761PASS/1FAIL em outra transferência mobile.
Trace desta segunda falha mostrou campo disabled10s na primeira transferência,
antes de salvar/retornar/fastForward. Não comprova falha de restauração nem perda
de dados. Origem histórica dos timeouts não foi comprovada por captura de eventos
lock/canal; não atribuir automaticamente ao código M09.

Investigação independente encontrou lacuna dos testes: release simulado síncrono
versus conclusão assíncrona de locks.request. Prova determinística com barreira
mostrou a fragilidade: confirmar release antes do término de request e publicar
ACK com trava ainda ocupada. TDD RED funcional:67PASS/2FAIL, sem falha de setup.
Isso fundamenta a correção do protocolo; não prova causalidade retrospectiva.
Não reabre A04/A05 FOOD05 por associação.

## Correção

- Contrato de liberação aceita void ou Promise<void>; mocks síncronos preservados.
- Adaptador nativo devolve liberação idempotente que aguarda Promise ORIGINAL de
  locks.request. catch separado evita engolir erro e produzir falso ACK.
- Coordenador aguarda liberação efetiva antes de anunciar liberado; reconfere
  operação/abort após await. Erro vai a reconferir, sem ACK nem edição otimista.
- encerrar continua abortando/cancelando/fechando canal sincronamente, com release
  em background e rejeição capturada. Nenhum retry cego, fila ou steal de Web Locks.
- Reautorização, leitura salva antes de editar, dreno de envio, autosave60s,
  correlação/replay e CAS permanecem. Nenhuma mudança de envelope do BroadcastChannel.
- Envelope v1 preservado: pares antigos continuam compatíveis quanto aos dados,
  mas uma aba com bundle antigo só passa a aguardar release após recarregar.
  Não afirmar correção de temporização em pares que ainda executam código antigo.
  Lock/CAS continuam impedindo edição não autorizada; implantação não executada.
- Sem novo dado em logs, URL, storage ou canal. Instrumentação de teste contém
  somente flags sintéticas no contexto isolado do browser, nunca no runtime.

## Testes

- GREEN final:72/72 no harness test-nutricao-plano.mjs, Node22.23.4, zero skipped.
  Barreiras de solicitação/liberação efetiva, ACK após release, reconferência,
  encerramento durante release, erro do adaptador e erro no coordenador.
- Build webpack/typecheck PASS, código final; lint2libs0erros/0warnings; diff-check.
- Browser controlado:4/4PASS, duas plataformas × relógio real/simulado. A Promise
  pública de locks.request é retida após retorno nativo e antes do ACK; origem
  e destino permanecem bloqueados até abrir barreira, depois destino edita após
  leitura. Zero escrita do plano. Não altera segurança do produto ou timeout.
- Matriz integrada final162/162PASS, zero skipped,5,2min:8M09+12receitasM04+
  12editorM04+26FOOD07+66PA07/FOOD01–04+38tabela/contribuições/PA06. Ambos os
  cenários que falharam anteriormente passaram. Isso não apaga os resultados
  anteriores nem comprova a causa histórica apenas por reexecução.
- R4 independente food06_m09_r4 favorável:71testes próprios no checkpoint
  examinado e diff-check, sem browser/build próprios ou escrita. O72º teste
  negativo do coordenador foi acrescentado pelo implementador depois da leitura
  inicial, conforme recomendação;72PASS são evidência do coordenador.
  Complementação final estática revisou o72ºteste e os2cenários browser: favorável,
  sem testes próprios adicionais, e sem atribuir causa histórica aos timeouts.
- Nenhuma nova prova de banco local: sem delta backend/schema; gate oficial
  PostgreSQL descartável do CI deve ser conferido no HEAD final. Backend do
  remotob1c6d839 foi observado PASS no job125122724794, inclusive migrations
  descartáveis, role sem BYPASSRLS e Testcontainers/RLS; não é CI do novo delta.

## Próxima ação e rollback

Matriz concluída; registrar o CI exato do novo HEAD. Revisão complementar
final já favorável por leitura, com limites acima. Commit/push intencional na mesma branch, mantendo Draft,
com igualdade de árvore/expected_sha, sem reescrever história. O CI de b1c6d839
não valida este delta local. Rollback só de código, sem dados persistidos;
reverter reintroduz fragilidade reproduzida e não é recomendação de liberação.
Depois retomar M07 factual apenas após resolver o gate de regressão.
