# PA07 — coordenação da edição do plano entre abas

Planejamento em 2026-10-16, autorizado em “Merge feito, siga”. Base
`62a50104379ef3162295a2186169edf3a1da4d05`, merge da PR #422. Branch
`feat/pos320-pa07-planejamento`, worktree dedicada; checkout principal e sua
alteração preexistente em `octaclin-web/next-env.d.ts` preservados.
Checklist: [T00–T07](todo-pos-320-pa07.md). Origem: item10,
[roadmap PA07](../docs/pos-320/04_Roadmap_Ondas_Pos320_OctaClin.md).

## Estado e limites

- PA06 integrada: #420 autosave, #421 ativação, #422 cálculo combinado/micros.
  CI final do HEAD `5eac6eab`, run38934810307, SUCCESS; scanners SUCCESS.
  [Evidências](../docs/governance/EVIDENCIAS_PA06_CALCULO_2026-10-16.md).
- Planejamento concluído e implementação em execução. Design limitado ao editor existente,
  com contrato explícito de concorrência; não é colaboração em tempo real.
  Implementação autorizada pelo proprietário em “Siga”, após D01 e apresentação
  do plano técnico. T02/T03 com Sol6.1 médio; sem troca de modelo nesta etapa.
- Nenhuma migration, dependência, endpoint ou modificação do portal prevista.
  Nenhum banco externo consultado; aplicação de migrations/deploy não inferida
  do merge/CI. Carga TACO v2 continua operação separada e não bloqueia PA07.
- Planejamento original R0 documental. Implementação atual tem risco R4 por integridade
  da edição clínica: testes negativos, regressões e revisão cruzada quando viável.

## Produto — decisão confirmada e recomendações técnicas

Em2026-10-16 o proprietário respondeu: “Segunda aba em consulta, com retomada
explícita (recomendado)”. A pergunta incluía pausar edição/autosave na aba
anterior, preservar alterações em memória e conferir a versão salva na nova aba.
Esse comportamento está confirmado. Detalhes de engenharia abaixo são
recomendações técnicas, sem nova decisão clínica. Implementação técnica autorizada em “Siga”.

| ID | Proposta preferencial | Estado |
| --- | --- | --- |
| D01 | Um editor por plano no mesmo navegador/partição; segunda aba consulta e oferece retomada explícita. A anterior pausa edição/autosave e preserva alterações locais; nova aba confere versão salva | CONFIRMADA pelo proprietário em2026-10-16 |
| P02 | Retomada pausa novas escritas na anterior, preserva alterações em memória e confere servidor antes de editar | Recomendação técnica para D01 |
| P03 | Fechamento/queda da outra aba não salva, não descarta e não retoma escrita automaticamente; permite tentativa explícita de aquisição | Recomendação técnica para D01 |

O escopo da exclusão é edição do rascunho, suas preferências, revisão,
publicação e ações que o substituem. Consulta, expansão de refeições, navegação
protegida, seleção/cálculo PA06 e ON/OFF operacional mantêm seus contratos.
Essas ações independentes continuam com autorização/revisões próprias.
Publicação/revisão não são automáticas. Planos diferentes podem ser editados em
abas diferentes. Novo formulário sem identidade salva não disputa lock global.

## Gaps e evidências do código na base

| Gap | Evidência | Resolução / aceite |
| --- | --- | --- |
| G01 — sem comunicação local | Nenhum uso de BroadcastChannel/Web Locks em `octaclin-web`; coordenador atual só serializa a própria instância | Transporte nativo de metadados, sem documento clínico; duas páginas reais no teste |
| G02 — suspensões sobrepostas | `CoordenadorEdicaoPlano.configurar({suspenso})` e callbacks de cópia/IME no editor | Motivos independentes; fim de IME/cópia nunca devolve posse nem limpa conflito/incerteza |
| G03 — envio em andamento | `encerrar()` aborta fetch, mas isso não prova rollback; ACK exige revisão+1 | Transferência cooperativa drena o envio já iniciado; incerteza exige reconciliação, sem retry cego |
| G04 — reidratação destrutiva | Inicialização/`aplicarPlano` e estado de formulário estão no componente central | Assumir não substitui edição local silenciosamente; estado sujo exige escolha explícita de descarte/releitura, sem rebase automático |
| G05 — escritores indiretos | Cópia, receita/modelo, revisão/publicação e navegação usam callbacks/ref próprios | Guarda central no início de cada ação e antes de enviar; desabilitar inputs não basta |
| G06 — sessão não é chave pronta | `SessaoPublica` tem apiUrl/tenantSlug, email e expiração, sem ID estável de usuário; editor não recebe contexto de sessão | Reusar contexto público BFF e identidade do plano obtido por leitura autorizada; não usar email/token, nem ampliar resposta de sessão sem necessidade |
| G07 — mensagens não são autoridade | Canal é acessível a scripts da mesma origem; pode perder/reordenar eventos | Esquema mínimo validado, geração local, descarte de eventos velhos; aquisição real local por Web Locks e validação real no servidor |
| G08 — outros dispositivos | Serviço já confere ID+`rascunhoRevisaoEsperada`, incrementa revisão e bloqueia writers protegidos sem precondição | Preservar CAS/locks transacionais e provas de corrida; não prometer aviso entre dispositivos |
| G09 — respostas obsoletas | Efeitos assíncronos de plano/paciente/draft podem terminar após troca de contexto | Cleanup, AbortController e guarda de geração/contexto em cada callback; nenhum ACK/mensagem devolve posse antiga |

Entradas principais:
`octaclin-web/lib/coordenador-edicao-plano.ts`,
`octaclin-web/components/pacientes/plano-alimentar-profissional.tsx`,
`octaclin-web/components/pacientes/prontuario-paciente.tsx`,
`octaclin-web/lib/auth-api.ts`, `octaclin-web/app/api/auth/session/route.ts`.
Servidor: `ServicoPlanosAlimentares.conferirRevisaoEdicao`,
`avancarRevisaoEdicao`, save editorial e revisão/publicação no serviço existente.
Não duplicar a fila de saves nem a fonte de verdade do rascunho.

## Alternativas e proposta técnica

1. **Recomendada:** BroadcastChannel nativo para aviso/transferência + Web Locks
   nativo para aquisição exclusiva local. Sem dependência. Evita eleição por
   heartbeat que confunde aba congelada com aba encerrada.
2. Só BroadcastChannel: suficiente para aviso, insuficiente para garantir editor
   único na abertura simultânea ou após throttling. Alternativa descartada para exclusividade de D01. CAS segue obrigatório.
3. R071: biblioteca oferece fallbacks/eleição, inclusive Web Locks; não se
   justifica agora. Fallbacks IndexedDB/localStorage e líderes duplicados têm
   custos e não eliminam CAS. R068/Yjs não será estudado/adicionado: colaboração
   real não está autorizada nesta fase.

### Recursos, privacidade e identidade

- Canal/lock por contexto BFF atual (API/tenant) + plano autorizado. Derivar uma
  chave opaca determinística, versionada, sem incorporar nomes/emails/URLs
  clínicas em texto. Hash é pseudonimização, não anonimização ou autorização.
  Não persistir nem registrar a chave ou os metadados.
- Instância de aba aleatória e efêmera, nova por ciclo de montagem/contexto.
  Mesmo usuário/plano não depende de ID de usuário inexistente no contrato;
  não usar refresh/access token ou expiração para definir identidade do recurso.
- Nenhum conteúdo do formulário, alimentos, quantidades, notas, nomes de
  paciente, ID de paciente ou credencial trafega. Envelope v1 com tipo enum,
  IDs efêmeros de instância/solicitação, geração local e revisão inteira quando
  necessária. Contexto do recurso fica no nome opaco, sem dados redundantes.
- Validar tipos, versão, limites de comprimento, safe integers e destinatário;
  ignorar evento próprio, duplicado, antigo ou de solicitação encerrada. Nunca
  executar fetch para um ID/URL recebido no canal. Sem retransmissão em loop.
- Logout, mudança de clínica/paciente/plano/draft e desmontagem encerram
  transporte, listeners, tentativas pendentes e posse. Invalidar efeitos de
  sessão anterior; a autorização continua sendo do BFF/backend em toda leitura
  e escrita, mesmo se um evento local afirmar que acesso foi concedido.

### Estados e transferência cooperativa

Estados de posse separados de `salvo/alterado/salvando/erro/conflito/incerto`:
`inicializando`, `editando`, `consulta`, `transferindo`, `reconferir`,
`indisponivel`. Não mostrar “Salvo” só porque a posse mudou.

1. Até resolver aquisição local, suspender novas mutações do rascunho. Com
   Web Locks, aquisição exclusiva com `ifAvailable`; **nunca `steal:true`**.
   A posse dura até cleanup/transferência, sem escrita disparada por abertura.
2. Segunda aba em consulta solicita “Editar nesta aba”. A detentora para de
   agendar novos saves/mutações; uma escrita já iniciada pode terminar. Bloquear
   também fila ainda não enviada e encadeamentos de cópia/revisão/publicação.
3. Ao terminar envio, detentora libera lock e fica em consulta com dirty guard
   intacto. ACK de transferência é metadado, não confirmação de commit remoto.
   Sem resposta, timeout só informa indisponibilidade: não autoriza tomar lock.
4. Solicitante precisa adquirir lock de verdade e ler a versão atual autorizada
   do servidor. Sem alterações locais, aplicar leitura; com edição local,
   preservar conteúdo e exigir decisão de descartar/recarregar ou continuar
   consultando. Não atualizar só a revisão para salvar texto antigo sobre novo.
5. Se rede incerta, conflito, revisão/draft divergente ou acesso revogado,
   permanecer sem escrita até reconciliação explícita. Nenhum pacote de
   transferência limpa essas proteções. Sem merge, replay ou rebase automático.
6. Duas solicitações concorrentes não elegem dois donos. Não manter fila de
   aquisição que conceda posse inesperadamente após o usuário sair/desistir.
   Resultado assíncrono sempre confere geração e intenção ainda atual.
7. Ao retornar por BFCache, restaurar visibilidade ou foco após suspensão,
   suspender escrita e revalidar contexto/posse/servidor antes de prosseguir.
   Mudança remota nunca apaga valores locais ou dispara save implícito.

A requisição antiga ainda pode confirmar no servidor depois de falha de rede.
A única proteção contra sobrescrita é CAS transacional: em corridas, uma escrita
com revisão antiga falha. Não prometer ausência absoluta de conflitos pela UI.

### Degradação e interface

- APIs indisponíveis/falhas: aviso acessível de coordenação indisponível; modo
  legado com CAS explícito, sem afirmar exclusividade. Se só houver Web Locks,
  consulta continua possível, mas transferência sem canal aguarda liberação.
  Não acrescentar storage persistente como fallback. Testar feature detection.
- Exibir “Este plano está em edição em outra aba” sem nome de pessoa. Botão
  acessível de retomada, progresso e erro com `role=status`/`alert` apropriados;
  não roubar foco em mensagem de fundo. Preservar teclado, IME, desktop/mobile.
- Conteúdo local não salvo permanece visível à própria aba; saída mantém
  salvar/continuar/descartar, mas salvar sem posse não pode contornar a guarda.
  Orientar assumir/reconferir primeiro; não criar salvamento alternativo.
- ON/OFF e seleção PA06 não transferem posse nem alteram rascunho por inferência.
  Mensagens não alimentam totais nutricionais nem ativam plano/refeição.

## Pontos de integração fechados para o handoff

| Entrada no editor existente | Regra da PA07 |
| --- | --- |
| `atualizar`, `atualizarPreferenciaApresentacao`, `atualizarRefeicao` | Verificar posse atual antes da mutação, incluindo callbacks de filhos |
| `adicionarRefeicao`, `aplicarRefeicoesDeModelo`, `duplicarRefeicaoLocal`, `aplicarRefeicaoCopiada`, `finalizarArrasteRefeicao` | Mesma guarda; operações assíncronas conferem também geração no retorno, sem aplicar resultado após transferência |
| `salvar`, callback `aoRegistrarSalvamentoRascunho`, tick60s | Compartilhar fila/estado existente; nenhuma rota de save contorna consulta/transferência |
| `transicionarVersao` / `executar` | Revisar/publicar ou substituir draft exige posse e revisão vigente; transferência aguarda operação iniciada, sem disparar outra |
| `iniciarCopia` / fim de composição IME | Suspensões independentes; terminar uma não remove a outra nem concede posse |
| `aplicarPlano` / `carregar` e efeitos de inicialização | Separar releitura explícita de ACK; descarte local só após confirmação; guarda de contexto no resultado |
| `alterarVisibilidade*`, cálculo combinado, `alternarRefeicao` | Mantêm comportamento independente; expandir/recolher é visual, não mutação editorial |
| `solicitarCriacao`, seleção/paginação de planos e saída do prontuário | Preservar guard de alterações locais. Criar outro plano não deve adquirir lock do plano anterior |

### Critérios de aceite da transferência

- Aba A tem conteúdo local ainda não salvo; B solicita edição: A pausa sem
  perder esse conteúdo. B só permite digitar após aquisição e leitura autorizada.
- Se A tinha um save em voo, B não inicia outro pelo sinal local de transferência.
  Espera a liberação e reconfere servidor. ACK tardio de A não reativa A.
- Se a própria B contém alterações antigas, adquirir lock não permite enviá-las
  contra revisão nova. Preservar para consulta ou descartar com confirmação;
  não criar “continuar mesmo assim”, merge ou retry automático.
- Cópia/receita iniciada antes da perda de posse não altera formulário depois.
  Mesmo bloqueio vale para submit por teclado e callback de salvar-e-sair.
- Se A travar e continuar detendo lock, B informa que não foi possível assumir.
  Timeout não vira permissão e `steal` não será usado. Pode orientar encerrar a
  outra aba e tentar novamente; CAS continua a proteção entre dispositivos.
- Releitura pode revelar publicação nova, arquivamento, draft substituído ou
  acesso retirado. Invalidar contexto anterior e negar retomada inadequada;
  nunca recriar um rascunho automaticamente só para recuperar a edição local.

## Execução e modelos

| Tarefa | Dependência / arquivos | Aceite objetivo | Modelo suficiente |
| --- | --- | --- | --- |
| T00 base/gaps/fontes | main #422; este plano/checklist/status | Merge/CI conferidos; somente R071 consultado; worktree preservada | Sol6.1 médio |
| T01 fechar comportamento/contratos | D01 confirmada; plano aprovado | Estado, envelope, degradação e transferência acordados; implementação autorizada | Sol6.1 médio |
| T02 núcleo e testes RED/GREEN | T01; novo `lib/coordenacao-abas-plano.ts`, spec e adaptadores pequenos | Aquisição simultânea, transferência, cleanup, evento inválido e timeout determinísticos; relógio/transporte/locks injetáveis, sem React/PHI | Sol6.1 médio |
| T03 integrar fila/guards | T02; coordenador de edição e editor atual | In-flight, fila, IME/cópia, revisão/publicação e navegação respeitam posse; conflito/incerteza preservados; sem reidratação destrutiva | Sol6.1 médio |
| T04 aviso acessível e harness | Contratos T02/T03 fechados; componente pequeno de aviso, spec/fixtures sintéticas | Consulta/retomada, erro, teclado e foco, sem estado clínico no transporte | Luna alto após aviso/pausa e troca manual |
| T05 integração E2E/regressões | T03/T04; spec visual PA07 + runner existente | Duas páginas reais no mesmo browser context; todos cenários abaixo; sem mocks substituindo BroadcastChannel/Web Locks no caso integrado | Sol6.1 médio |
| T06 segurança/gates | T05 | Diff/segredos, lint/typecheck/build, BFF/authz e backend/PG/Redis/CI aplicáveis; revisão cruzada quando viável, limites declarados | Sol6.1 médio |
| T07 PR única e fechamento | T06 | PR PA07 com evidências do HEAD, sem merge/deploy externo; checklist/status atualizados | Sol6.1 médio |

Não duplicar o componente central nem fazer refactor geral. Extrair somente o
coordenador puro/adaptador e aviso necessários. Nenhuma modificação de schema
prevista; se surgir necessidade, reavaliar escopo antes de introduzir migration.
O benefício de trocar apenas T04 para Luna pode ser pequeno: se T04 não for
isolável com handoff curto, manter Sol e evitar custo de reconstruir contexto.
Nunca transicionar modelo sem avisar e pausar para o usuário trocar.

## Matriz mínima de testes (sintéticos; ainda não executados)

| Área | Cenários obrigatórios |
| --- | --- |
| Abertura | Duas abas simultâneas, segunda após primeira; só uma posse quando APIs disponíveis; planos diferentes independentes; abrir não salva |
| Retomada | Limpa, dirty, autosave em voo, fila posterior, duas retomadas concorrentes, desistência e ACK tardio; revisão atual lida antes da edição |
| Falhas | HTTP409/401/403/404/422, timeout/rede incerta, API ausente/lança erro, mensagem inválida/desordenada/duplicada; sem retry ou rebase cego |
| Lifecycle | Fechar/recarregar, foco/background, aba congelada, BFCache, StrictMode, troca paciente/plano/draft/clínica, logout e resposta de sessão antiga |
| Escritores | Digitação, drag/drop, copiar/colar, modelo/receita, preferências, save manual/60s, revisar/publicar/substituir rascunho; callback direto não contorna guarda |
| Independentes | ON/OFF plano/refeição, seleção/cálculo e listagem paginada preservam PA06; portal/PDF preservam PA05/PA06 |
| Segurança | Sem conteúdo clínico/email/token em canal, chave, logs/storage; evento não amplia permissão; revogação e tenant divergente continuam recusados no servidor |
| Servidor | Reusar/ampliar prova PostgreSQL/RLS de duas escritas mesma revisão, save↔revisão/publicação e cliente sem canal; conferir também transição legada protegida |
| UX | Desktop/mobile; alert/status, teclado/foco, IME, saída antes60s e dirty preservado em transferência; paciente/aba anterior nunca recebe descarte implícito |

Executar harness `test:nutricao-plano`/BFF/authz conforme arquivos alterados;
novas specs precisam entrar no runner e CI, não existir só como arquivo solto.
Integração PostgreSQL descartável e CI integral comprovam regressão do CAS/RLS;
nenhum banco externo, teste com dado real ou migration externa autorizado aqui.
Critérios RED antes da implementação e GREEN após correção; não confundir
revisão própria com independente. Evidências devem identificar HEAD/ambiente.

## Referências consultadas — somente PA07

R071 `pubkey/broadcast-channel`, commit
`dc8504ced3a25e1393d43616fb50ea4db56e737b`, package7.4.0. Consulta somente leitura
a `LICENSE`, `package.json`, `README.md` e `.github/README.md`, em2026-10-16.
MIT conferida no commit; sem copiar código, instalar ou executar pacote.
README completo explica Web Locks como primeira opção, fallback por eleição e
possibilidade de líderes duplicados sob CPU/throttling. Isso fundamenta não usar
timeout/heartbeat como garantia de posse. Links imutáveis:

- [README](https://github.com/pubkey/broadcast-channel/blob/dc8504ced3a25e1393d43616fb50ea4db56e737b/.github/README.md)
  SHA256 `9e5425f85ebc07367d81ff8ee048642cd00c8c6c68dbe5853eea126503169225`.
- [LICENSE](https://github.com/pubkey/broadcast-channel/blob/dc8504ced3a25e1393d43616fb50ea4db56e737b/LICENSE).
- [MDN BroadcastChannel](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API): mesma origem/partição; não sincroniza dispositivos.
- [MDN Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) e
  [request](https://developer.mozilla.org/en-US/docs/Web/API/LockManager/request):
  contexto seguro, `ifAvailable`, liberação e risco de `steal` (o código antigo
  pode continuar executando). Documentação técnica, não prova de implementação.

## Gates desta rodada

- PASS: auditoria documental/código da base, referência R071 e merge/CI PA06.
- PASS: D01 e implementação técnica autorizadas pelo proprietário em “Siga”.
- Em execução: testes RED/GREEN de T02/T03. Builds, PostgreSQL, E2E final e
  revisão R4 de código PA07 pendentes; consultar handoff para resultados atuais.
- NA: migration nova, dependência externa, ativação clínica/feature flag.

Rollback futuro: reverter código PA07 via PR, conservando autosave/CAS PA06 e
histórico clínico. Liberação de lock não salva/apaga dados. Sem schema novo,
nada a reverter em banco. Nunca usar rollback para relaxar CAS/autorização.


## Checkpoint T02/T03 — pausa antes de Luna

Núcleo/adaptadores implementados e59 testes PASS; integração inicial do editor,
typecheck, BFF42/42 e Playwright inicial2/2 desktop/mobile PASS. UI de aviso e
retomada ainda não existe; não disponibilizar este checkpoint. T03 tem guardas
implementadas, mas aceite completo depende dos cenários T04/T05. Evidências em
[registro do núcleo](../docs/governance/EVIDENCIAS_PA07_NUCLEO_2026-10-16.md).
Próxima ação: troca manual para Luna alto e somente
[T04](handoff-pos-320-pa07-luna.md). Depois retornar a Sol para T05–T07.
