# FOOD06 M05/M07 — fonte de versão salva e confirmação operacional

> Checkpoint histórico da fonte DB, preservado. Continuidade:
> [API/BFF de registros factuais](food06-api-registros-factuais.md).
> CI deste incremento no remoto c6dd0a3d posteriormente concluído com sucesso
> (run41725726612 e scanners). Não valida o novo delta da API/BFF.

## Estado e limites

PR455 Draft, branch docs/food06-contratos-fontes. Base local7fd70c24/remota2de6462b,
árvore7513641f. No início desta rodada, Backend/Web/scanners dessa base estavam
SUCCESS e Demo/CI global ainda em execução; não transferir esse resultado para o
delta novo. M05/M07 permanecem PARCIAIS; **37,5% administrativos**,1concluída,
7parciais e4pendentes. DRI/direitos/G06 BLOCKED. Sem qualquer operação externa.

Implementado: `registrarVersao` carrega fonte real das tabelas de planos/versões,
refeições/estados/vínculos e snapshots cifrados de itens, na MESMA transação do
registro. Não é endpoint nem API/BFF/UI; não está ativado para usuários reais.
Não há nova migration ou dependência. Contexto clínico/timezone ainda não é
integrado nesta entrada: omissão fica explícita, sem presumir elegibilidade.

## Contrato interno e segurança

Comando estruturado por allowlist: registro com chave/identidade exata da origem,
mais seleção com revisão operacional esperada e identidades de refeições.
UUIDs são normalizados; arrays densos, até50IDs únicos; sem campos extras,
accessors, coerção ou hashes/totais/snapshots livres do navegador.

O método valida e copia a intenção antes de aguardar I/O, depois usa o registrador
existente com callback exclusivamente server-side. Esse callback não deve ser
exposto como parâmetro HTTP; o futuro controlador invocará registrarVersao com DTO
próprio. A confirmação operacional cifrada também é derivada pelo servidor, não
recebida como token, capability ou hash arbitrário.

Ordem neste fluxo: Professional ativo FOR SHARE → paciente ativo da carteira
FOR SHARE → advisory da chave → plano FOR SHARE → versão FOR SHARE. Tenant e
permissões ler/gerenciar revalidados; sem exceção para SuperAdmin/outros papéis.
Plano exige tenant/paciente corretos e não arquivado, seguindo o contrato legado.
Acesso histórico por registros já existentes continua independente do arquivamento
do plano, conforme leitor autorizado já entregue.

### Revisão exata e fatos

- Plano/versão por UUIDs, número e estado exatos; nunca “última versão”. Publicação
  anterior autorizada pode ser usada, sem trocar pelo ponteiro atual ou somar ambas.
- Rascunho exige revisão esperada positiva exata. Conferência sob lock antes de
  qualquer escrita do registro; não há UPDATE na origem. Não declarar um CAS de
  edição de plano: é precondição exata protegida para o append factual.
- Reutiliza `lerEstadoEdicaoPersistida`, extraído literalmente da regra privada
  do editor. O serviço legado delega ao helper sem alterar sua semântica. Edição
  pendente, indisponível ou cifrada inválida409; não usa a materialização antiga
  como se fosse a revisão atual, nem materializa automaticamente.
- Legado sem snapshot/proteção continua nos critérios anteriores; não inventa
  uma revisão ou identidade editorial para fazê-lo parecer novo.
- Revisão de ativação deve coincidir. IDs operacionais precisam corresponder
  exatamente às refeições físicas da versão; vínculos ausentes, extras ou
  ambíguos409. Não usar posição/nome como identidade.
- Só consulta itens efetivamente incluídos: plano ON, refeição ON e selecionada.
  OFF/seleção vazia preservam o estado, com itens excluídos vazios; não abrem
  suas composições. Não soma alternativas disponíveis ao alimento principal.
- Apenas porção em gramas e snapshot computacional cifrado; sem nomes/orientações,
  descrições, dados de cadastro ou consulta ao catálogo vivo. Construtor/PA06
  existentes fazem cálculo e minimização. Zero e desconhecidos permanecem distintos.
- Limites50refeições e10.000itens efetivos; exceder422 sem gravar. Composição que
  não pode ser decifrada/parseada também422, sem converter corrupção em zero.
  Consulta factual legada não foi alterada por essa recusa de registro.

### Tempo e estado operacional

`origem.registradaEm` é estável para replay: instante de publicação, ou criação da
versão no rascunho, acompanhado da revisão explícita. Não significa instante da
última edição. `criadoEm` do registro vem do banco e identifica a captura da análise.
Não usar now em cada retry, nem atualizadoEm alterável por apresentação, como
identidade semântica. Não tratar esse instante UTC de auditoria como data clínica.

Flags ON/OFF e seleção representam o estado operacional **considerado na captura**,
não uma inferência de como o plano estava ativo na data de uma publicação antiga.
A confirmação cifrada registra essa revisão operacional. Comparar registros antigos
usa suas flags congeladas, sem substituir pelas flags atuais ou consultar catálogo.
A interface futura deve distinguir esses tempos e bases, conforme M07.

## Idempotência e envelope protegido v2

Lacuna reproduzida: após OFF→ON, revisão0→2, fatos iguais retornavam o ACK anterior
para a mesma chave com nova precondição. RED funcional1FAIL/35SKIPPED. A revisão
stale original já era recusada; faltava vincular também a nova confirmação.

Fonte real grava wrapper **v2**: body factual/motorv1 inalterado, binding completo
à linha e confirmação canônica de origem/revisão operacional/IDs ordenados, tudo
cifrado. Idempotência exige body E confirmação idênticos. Revisão/seleção/intenção
diferentes com mesma chave409; quatro chamadas iguais geram1registro/1auditoria.

Callback legado continua gravando v1. Leitor aceita v1/v2 explicitamente, valida
schema/tipo correspondentes; v1 proíbe confirmação, v2 exige string limitada.
Não converter registros anteriores, expor a confirmação, retirar o binding para
reutilizar chave ou misturar v1/v2 silenciosamente. Ler o registro não retorna o
wrapper ou a confirmação. Auditoria mínima e registro continuam na mesma transação;
falha de auditoria desfaz registro/chave, sem retry cego.

## Compatibilidade e rollback

Sem DDL ou edição de migrations existentes. O conteúdo bytea atual comporta ambos
os wrappers; os leitores desta branch reconhecem os dois. Leitores ANTERIORES não
leem v2 e falham fechados. Portanto, **rollback para código sem suporte v2 não é
compatível depois de novas gravações v2**. Não basta reverter deploy. Gate operacional
futuro deve garantir leitores compatíveis em todos os processos antes de ativar
writers, e aprovar rollback/backport de leitor, backup/restore e preservação dos
snapshots. Nenhum desses passos externos foi executado ou autorizado aqui.

Fonte pura de snapshots não incorpora referências DRI numéricas, novas bases ou
licenças. Não inicia FOOD05-MDL/D18, nem altera FOOD04/FOOD05/FOOD07 ou direitos.

## Evidências reproduzíveis — Node22.23.4

| Verificação | Resultado / limite |
| --- | --- |
| TDD fonte |2RED funcionais em PG inicializado, stub compilado →25PGPASS iniciais |
| Confirmação após OFF→ON |1RED funcional com fatos idênticos → corrigido e incluído no foco final |
| Foco final |170/170PASS:37PG+3schema+9helper+50leitor+32construtor+39comparador |
| PostgreSQL regressões |60/60PASS em3suítes FOOD04/receitas/1081, zero skipped |
| Concorrência real |Espera observada em pg_stat_activity com snapshot renovado; revisão/ativação409 e transferência404; zero append stale; nova revisão materializada pode ser confirmada |
| Persistência/rollback |Quatro requisições iguais, uma identidade/auditoria; falha da auditoria sem registro e nova tentativa válida |
| Autorização |Tenant/paciente/carteira, plano arquivado, versão descartada, payload manipulado/getters/arrays e vínculos inválidos, sem decifrar fontes excluídas |
| v1/v2 |Ambos legíveis; schema/tipo/confirm inválidos422; chave source não reutilizável pelo callback legado com body idêntico |
| Backend completo final |4.064PASS/217SKIPPED;385suítesPASS/10SKIPPED. Skips não representam provas de banco/provider;37PG foram executados separadamente |
| Typecheck |PASS Node22 final |
| Build |Primeira execução ENOSPC no executor; Nest padrão reexecutado depois de terminarem os containers descartáveis: PASS, artefato PASS. Nenhuma configuração ou dependência alterada |
| Governança |37/37PASS, auditoria/migrations fora de banda; diff/segredos conferidos antes de publicar |
| R4 independente |food06_source_r4:39testes próprios inicialmente, depois46/46 (37PG+9helper) e re-revisão do v2 favorável; nenhuma edição, não é R4 integral FOOD06/CI/produção |
| CI do novo delta |PENDING até publicação/consulta do HEAD exato |
| Web/Playwright/UX B/C novos |N/A neste incremento sem interface; continuam gates para uma jornada utilizável |

A fixture PG usa relações representativas reais com RLS forçada, runtime sem
owner/bypass e migration1081 real. Não é cópia integral de produção nem prova local
de toda a cadeia de migrations; esse gate continua no CI oficial. Dados e banco
food06_registry_test são sintéticos/descartáveis; nenhuma consulta externa.

Comandos no backend (Node22 explícito no PATH):

```sh
FOOD06_REGISTRO_TESTCONTAINERS=true node node_modules/jest/bin/jest.js --runInBand src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.integracao.spec.ts src/infraestrutura/banco-dados/migracoes/1720000001081-RegistrosAnalisesFactuais.spec.ts src/modulos/planos-alimentares/aplicacao/estado-edicao-persistida.spec.ts src/modulos/planos-alimentares/aplicacao/leitor-registro-analise-factual.spec.ts src/modulos/planos-alimentares/aplicacao/construtor-analise-factual.spec.ts src/modulos/planos-alimentares/dominio/comparacao-versoes-factuais.spec.ts
node node_modules/jest/bin/jest.js --runInBand
node node_modules/typescript/bin/tsc --noEmit
node node_modules/@nestjs/cli/bin/nest.js build
node scripts/verificar-artefato-producao.mjs
```

Logs sintéticos locais: /tmp/food06-fonte-{red,idempotencia-red,final,backend-final,
pg-regressoes,typecheck-final,build-recuperado,governanca}.log. Build parcial com
main.js existente não foi chamado build aprovado; somente a reexecução exit0 conta.
Sem reset/clean/rebase/descartes; alteração preexistente main next-env.d.ts preservada.

## Continuidade

1. Conferir CI/scanners/migrations completas do HEAD a publicar e corrigir falhas.
2. API/BFF de registro/leitura/comparação, com projeções por allowlist, validação de
   payload, erros seguros, no-store e reautorização. Não serializar registro interno.
3. Contexto confirmado/timezone canônico via fontes reais autorizadas, sem aceitar
   nascimento arbitrário ou transformar instantes em data clínica por inferência.
4. UI, seleção exata e prévia/confirmar/cancelar, UX B/C, acessibilidade desktop/mobile,
   revisão stale e erros, paginação e cobertura. M05/M07 não fecham só com esse serviço.
5. Direitos/DRI/G06 separados, nenhuma operação externa ou ativação automática.

Descrição anterior da PR preservada em docs/history/phases/PR455_DESCRICAO_2DE6462B.md.
A descrição corrente será resumida com link para esse histórico, evitando limite
GitHub e estados antigos rotulados como atuais. Nenhum requisito foi removido.
