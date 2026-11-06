# FOOD06 M04 — prévia de inserção de receita

## Estado e escopo

Evidência posterior: setup corrigido no remoto373c1ddf/local39257f78; Backend do
CI41355886047 PASS com4.041testes/65skip e gate descartável141PASS/0skip, inclusive
as3provas novas. O FAIL anterior abaixo é histórico, sem descarte de evidência.
A [integração Web](food06-interface-previa-receitas.md) tem gates próprios.

Checkpoint histórico: remoto4c1e2317/local3efe6588. CI41349977153 FAIL Backend e
PR Gate; Web/Demo/Mobile/scanners PASS. Os3novos casos de banco falharam no setup:
EntityMetadataNotFoundError para ReceitaNutricionalOrm, ausente apenas na lista
explícita de entidades do DataSource runtime do teste (o runtime do produto já a
registra). Corrigido o registro do harness, sem alterar schema/permissões ou os
asserts. Reexecução real desses casos continua pendente; erro de setup não é RED
funcional nem prova de vulnerabilidade do produto. Nenhum PASS de banco presumido.


Incremento R4 da mesma PR455 Draft. Base publicada c8389ebc (árvore local
9111b625) com CI41338861846 COMPLETED/SUCCESS: Backend, Web, Mobile, Demo,
PR Gate, pesquisa e scanners aprovados, consultados nesta retomada. Isso não
valida automaticamente este delta. Direitos DRI/G06 BLOCKED;29,2% administrativos,
0/12 melhorias encerradas. A interface de receitas ainda não usa a nova operação.

## Contrato e reuso

A API M04 existente aceita uma terceira intenção discriminada, inserir_receita:
refeicaoChave, receitaId, receitaVersaoEsperada e porcoesDesejadas. As precondições
editoriais/ativação e o fingerprint da confirmação continuam obrigatórios. Não
aceita ingredientes, composição, quantidades já ajustadas ou campos das outras
variantes no payload. Porções de0,001a1.000, até3casas; versão positiva e UUID.
Limite BFF8KiB e DTO/serviço estritos preservados. Nenhuma nova rota/migration.

ServicoPorcionamentoReceita.preverNaTransacao reutiliza FOOD07 dentro do manager
tenant-aware existente; o reader da biblioteca reautoriza receita pessoal ou da
clínica e exige estado ativo. Fontes de catálogo exigem situação ativa e direitos
aprovados. Receitas legadas sem base não são inferidas; requerem conferência.
A receita original é a fonte a cada chamada, nunca a prévia arredondada anterior.
Bases receita_inteira/por_porcao seguem a mesma regra racional já testada.

O antes lê os snapshots materializados antes de expandir a receita. O depois
acrescenta os ingredientes à refeição escolhida, preserva os demais e reutiliza
preparação, resolvedores, composição PA06 e cobertura do writer. Alternativas
não são somadas aos principais. Ausências não viram zero. Nenhum diagnóstico,
comparação DRI, alteração da biblioteca, publicação ou envio ao portal.

Chaves novas determinísticas por comando/revisão e posição interna, sem usá-las
como autorização. Colisão é rejeitada; revalidação editorial aplica unicidade,
limites de100itens/refeição,20alternativas e96KiB ao documento expandido. Novas
alternativas começam não liberadas/não preferidas. Dados existentes não são
redefinidos em massa. O servidor não transporta equivalências por modelos (D17).

## Concorrência e persistência

Ordem paciente→plano→rascunho→receita read; recipe writer não adquire locks do
paciente/plano. Uma transação, sem execução aninhada. Fingerprint M04 inclui a
operação e fingerprint FOOD07 além dos fatos/revisões existentes. Confirmação
refaz resolução e compara; alteração de versão, receita arquivada, composição
mudada, fonte indisponível ou novo autosave exige nova conferência.

Confirmação passa pelo mesmo writer/CAS e snapshots cifrados. Replay409, sem
retry cego nem recibo idempotente de ACK. Perda de resposta exige releitura.
Operação cancelada antes de confirmar não grava. Falha de persistência deve
reverter expansão/filhos/identidades/revisão na transação. Snapshots publicados
anteriores e biblioteca não são reescritos. Não há nova persistência de análise
científica; M05 de histórico de análises permanece pendente.

## Evidências executadas

- RED funcional:4falhas em DTO/serviço,188PASS; intenção de receita ainda ausente.
  Uma tentativa anterior com caminho incorreto não alterou os arquivos e não é
  RED. GREEN192/192 após implementação. Casos adicionais de regressão escritos
  depois não são apresentados como ciclos RED próprios.
- Bateria focada ampliada:431/431 PASS em5suítes. Inclui porções1/1,5/2,5,
  bases equivalentes, fonte original após outra prévia, cobertura desconhecida,
  flags novas fechadas, preservação da biblioteca, versão stale, acesso pessoal
  alheio/clínica/cross-tenant, arquivamento, payload adulterado e limite expandido.
- Backend completo final:3.926PASS/180SKIPPED,379suítes PASS/9SKIPPED. Não houve
  execução de PostgreSQL/RLS real local. A primeira execução teve erro de tipo no
  assert de snapshot opcional do novo teste PG; assert estrutural corrigido, sem
  reduzir sua exigência. Execução completa seguinte PASS nos testes executados.
- Typecheck e build/artefato backend PASS Node22.23.4. Sem alteração de engines.
- Revisão independente food06_m04_editor_r4, sem edição/coautoria:431/431 testes
  próprios, leitura do delta e parecer favorável sem achado bloqueante. Sem banco,
  navegador, build ou CI próprios; não é R4 integral FOOD06. Hashes examinados:
  DTO f430ca91be2ea5195072cba7772b6aaeaa2c1075fc15f7c1d320f90d19da699c;
  serviço26a0e29d6422176535a58537377dc00f2735644a79f45c850cda2d24084d12f2.
- BFF82/82 PASS, incluindo2novos casos da operação de receita: encaminhamento
  e revisão409 sem retry. Sessão/fetch simulados, não HTTP autenticado real.

## Gate de banco e continuidade

Três casos PostgreSQL/RLS adicionados à suíte oficial, ainda NOT RUN neste
checkpoint: prévia sem gravação/materialização/histórico/flags/replay/tenant;
arquivamento após prévia sem alteração no destino; concorrência CAS e rollback
após remoção de filhos. Imagem exigida timescale/timescaledb-ha:pg15 ausente
(confirmado por docker image inspect); overlay com133MiB livres. Não houve pull,
mudança de infraestrutura ou tentativa de banco externo para contornar isso.
Executar no gate oficial Testcontainers do novo CI; skipped não recebe PASS.

Diff-check e scanner local de segredos PASS. Próximo: commit/push deste delta
e conferir CI/PG.
Depois integrar a prévia factual à biblioteca de receitas na Web, com confirmação
PA07/ACK/autosave existente e UX B/C; tipo/preparo permanecem como registros do
catálogo, sem inventar fatores de cocção ou novos nutrientes. UX deste incremento
backend: nenhuma interface nova; avaliações B/C da interface anterior permanecem
delimitadas em docs/agents/ux/reports/FOOD06-M04-BC. M04 não está encerrada.
Rollback deste incremento é de código, sem migration. Sem merge, deploy,
migrations externas, alterações de Neon/Render/quota ou FOOD05-MDL.

## Reprodução

Na pasta octaclin-backend, com Node22 e dependências já disponíveis:

```sh
node node_modules/jest/bin/jest.js --runInBand src/modulos/planos-alimentares/aplicacao/dtos-previa-micronutrientes.spec.ts src/modulos/planos-alimentares/aplicacao/servico-planos-alimentares.spec.ts src/modulos/planos-alimentares/aplicacao/servico-receitas-nutricionais.spec.ts src/modulos/planos-alimentares/aplicacao/servico-porcionamento-receita.spec.ts src/modulos/planos-alimentares/dominio/porcionamento-receita.spec.ts
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
```

Somente no executor descartável com imagem e configuração oficial, usar o gate
scripts/test-rls-testcontainers.mjs. Não utilizar conexões externas/reais. Logs
transitórios em /tmp/food06-m04-receita-{red,green,focados,backend-final,typecheck-final,build,bff}.log;
os testes e resultados resumidos permanecem versionados.
