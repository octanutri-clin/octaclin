# PA07 — checkpoint do núcleo e integração inicial

Base `62a50104`, branch `feat/pos320-pa07-planejamento`. Desenvolvimento
autorizado pelo proprietário em “Siga”, após D01 e apresentação do plano.
Este é um checkpoint para troca manual de modelo, não uma entrega pronta.
Sem PR, merge, deploy, migration, dependência nova ou consulta a banco externo.

## Implementado

- Coordenador puro de posse/consulta/transferência, mensagens mínimas validadas,
  correlação, descarte de replay, limite de emissores e limpeza de contexto.
- BroadcastChannel e Web Locks nativos: `ifAvailable`, sem fila nem `steal`.
  Cancelamento antes/dentro do callback, sem passar `signal` junto a
  `ifAvailable` (combinação recusada pela plataforma real).
- Chave local SHA256 de contexto BFF/recurso; não anonimiza dados nem autoriza
  acesso. Nenhum documento, nome, email, credencial ou medida no canal/storage.
- Fila de save tem posse independente de IME/cópia. Perda de posse cancela
  solicitações não iniciadas e permite drenar envio iniciado, sem flush/rollback
  fictício; conflito/incerteza/acesso negado não são limpos ao devolver posse.
- Hook integra sessão BFF, leitura autorizada, geração de callbacks, foco,
  visibilidade e restauração BFCache em consulta. Editor protege mutações,
  cópias, manual/automático e revisão/publicação; operações iniciadas são drenadas.
- Releitura de mesma base preserva formulário e ciclo de60s. Dirty sobre outra
  revisão ou estado bloqueado exige reconferência explícita, sem rebase.

## RED/GREEN observado

| Prova | RED observado | GREEN |
| --- | --- | --- |
| Perda de posse na fila | Fim de IME liberava1 request indevido; fila após ACK enviava2 em vez de1 | Núcleo/edição no harness abaixo |
| Coordenação nova |9 casos comportamentais falharam contra o esqueleto da API | Mesma suíte após implementação |
| Reentrada e replay |2 casos falharam: retomada repetida invalidava aquisição; pedido antigo suspendia novo dono | Mesma suíte após serialização/correlação |
| Adaptadores |4 falhas comportamentais: chave, exclusividade, cancelamento e transporte | Mesma suíte após adaptadores nativos |
| BFCache | Estado editável em vez de consulta na restauração | Mesma suíte após opção explícita |
| Opções Web Locks | Prova de navegador revelou combinação `signal/ifAvailable`; teste específico reproduziu o contrato inválido | Adaptador corrigido; teste e navegador PASS |
| Editor em duas abas | Campo da segunda continuava habilitado; falha `toBeDisabled`, em execução com fixture correta |2/2 desktop/mobile no checkpoint, sem escrita em120s simulados na segunda |

Primeiras tentativas do E2E não foram RED de produto: Turbopack recusou symlink
externo de dependências; fixture de prioridade estava incompleta; locator de
label foi corrigido para o nome acessível do textbox. Essas falhas foram
resolvidas antes de observar o RED comportamental da segunda aba.

## Verificações realmente executadas

| Comando / escopo | Resultado observado |
| --- | --- |
| `node octaclin-web/scripts/test-nutricao-plano.mjs` (Node22.21.1) | PASS59/59; inclui novos arquivos no runner já encadeado pelo CI |
| `node scripts/test-planos-alimentares-bff.mjs` no Web | PASS42/42 |
| `node node_modules/typescript/bin/tsc --noEmit` no Web | PASS, código de saída0 |
| ESLint direcionado aos3 núcleos/hook/editor/specs | PASS sem erros;8 avisos no editor existente; arquivos novos sem avisos |
| Playwright `pa07-coordenacao-abas.spec.mjs`, desktop e mobile | PASS2/2; duas páginas reais do mesmo contexto, BroadcastChannel/Web Locks reais, API clínica sintética |
| `git diff --check`, scanner de secrets, matriz de confiabilidade | PASS;40 referências na matriz |

Reteste intermediário de navegador teve timeout de10s ao carregar a segunda
página durante typecheck paralelo:1 FAIL desktop/1 PASS mobile. Snapshot ainda
estava em “Carregando prontuário”. Expectativa de prontidão explícita passou a30s
nesta spec; novo reteste sem typecheck concorrente PASS2/2 (27,1s). Não mudou o
timeout da transferência (8s) nem o ciclo de autosave (60s).

Logs locais do checkpoint: `/tmp/pa07-final-unit.log`,
`/tmp/pa07-final-typecheck.log`, `/tmp/pa07-lint.log`, `/tmp/pa07-bff.log`,
`/tmp/pa07-checkpoint-browser.log`. São arquivos temporários, não artefatos
duráveis da PR; este registro conserva resultados/limites e os comandos são
reproduzíveis. Scans locais não comprovam ausência de vulnerabilidades.

## Ambiente e limites

Worktree isolada; dependências reutilizadas por symlink de node_modules da
PA06, sem mudar manifest/lockfile. Webpack dev local em localhost3317 por causa
da limitação do Turbopack com symlink; esse modo não prova build de produção.
Espaço livre aproximado699MiB ao fim do teste; não instalar/buildar tudo sem
reavaliar espaço. Servidor de teste deve ser encerrado ao pausar. next-env
gerado nesta worktree fica fora do commit; alteração preexistente do usuário
no checkout principal preservada.

PENDING/SKIPPED neste checkpoint: interface de aviso/retomada ainda ausente,
transferência E2E pelo botão, rede incerta/cópia em voo na integração, regressões
completas PA02–PA06, backend/PostgreSQL/RLS/Redis da PA07, build de produção,
acessibilidade final, revisão cruzada R4 e CI do HEAD. Backend/CAS/schema não
alterados. CI PASS da PA06 não comprova esses gates para PA07.

Não disponibilizar este checkpoint: campos da segunda aba já ficam em consulta,
mas falta o aviso e o botão de retomada. Próxima entrega limitada ao T04 em
[handoff Luna](../../tasks/handoff-pos-320-pa07-luna.md); depois retornar ao Sol
para T05–T07 e revisão de concorrência/integridade.
