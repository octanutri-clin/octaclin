# PA02 — checklist de execução

Contrato: [plan-pos-320-pa02.md](plan-pos-320-pa02.md).
Implementação autorizada em 2026-10-14; PR #415 mergeada pelo proprietário.
Correções de revisão integradas pela PR #416, merge `5b47fb1`, branch `fix/pa02-copia-revisao-r4`.

## T00 — base, referências e decisões

- [x] Auditar main2d2edcf, FND02/#411 e PA01/#414 integradas.
- [x] Confirmar PA02 residual e as78 referências do catálogo; nenhuma
  candidata externa para PA02; decisão REUTILIZAR código interno.
- [x] Auditar GET de versão e PUT de destino, chaves, snapshots e limites.
- [x] D01–D03 confirmadas pelo proprietário em2026-10-14 e registradas.
- [x] Receber autorização de implementação após troca manual de modelo
  (2026-10-14).
- [x] Reconfirmar main/status e preservar documentação no mesmo checkout/PR.

## T01 — cópia local isolada (depende de T00)

Arquivos: helper puro, spec e runner/script web; integração mínima no editor.

- [x] RED inicial falhou com o helper ausente; após implementação, os 6 testes
  unitários passaram incluindo chaves novas e isolamento da árvore.
- [x] Duplicar mantém os valores editáveis, gera chaves únicas inclusive
  em alternativas e não copia campos de plano/paciente/cálculo.
- [x] Editar original/cópia não altera a outra; ausência opcional não vira zero.
- [x] Limites50/100/20 sem truncamento ou aplicação parcial.
- [x] Comando insere após origem, marca dirty e preserva PA01/FND02.

Checkpoint: unitários GREEN, lint/typecheck e interação local desktop/mobile.

## T02 — selecionar origem salva (depende de T01 e D01/D03)

Arquivos: seletor de cópia, editor, fixtures/spec visual.

- [x] Paciente atual + outros autorizados conforme D01; paginação de planos
  explícita, seleção de versão/refeição, estados vazio/erro/carregamento.
- [x] Publicada por padrão, rascunho salvo explícito conforme D03;
  origem dirty orienta salvar; descartada nunca aceita.
- [x] Buffer só de referências em memória; desmontagem aborta e invalida
  respostas por geração local; troca de paciente/plano limpa a origem.
- [x] Playwright com resposta da origem anterior atrasada enquanto o prontuário
  muda de paciente; desktop/mobile 2/2. A resposta obsoleta não aparece nem
  substitui a origem carregada no novo contexto.
- [x] GET autorizado por versão exata ao carregar e a cada colagem, com abort
  e geração local.
- [x] Rascunho alterado/ID ausente pede nova cópia; não busca por nome/posição.

Checkpoint: Playwright cobre acesso revogado, versão alterada, paginação que
limpa a origem e resposta atrasada durante navegação SPA entre pacientes, com
marcador em window para comprovar que o documento não foi descarregado.

## T03 — colar no destino e persistir (depende de T02 e D02)

Arquivos: editor, helper, spec Playwright e teste BFF existente quando necessário.

- [x] Nova refeição ao final ou itens acrescentados conforme D02;
  cabeçalho e conteúdo anterior do destino preservados.
- [x] Novas chaves por gesto; duplo clique durante leitura não duplica.
- [x] Callback propaga erro de aplicação; alvo removido e limite de 50 não
  anunciam sucesso, não limpam origem e não aplicam parcialmente.
- [x] Trava síncrona impede salvar/revisar/publicar durante colagem; releaser
  tokenizado não libera uma operação posterior. requestSubmit com formulário
  válido não envia PUT enquanto pendente; após concluir, save inclui a cópia.
- [x] Não leva IDs de origem, metas/objetivos/revisão nem consentimentos ao PUT.
- [x] Salvar confirma conteúdo e ordem no payload do rascunho; o Playwright
  verificou que só o destino é salvo e que a origem permanece intacta.
  publicada e origem não mudam. Não salvar/publicar/avisar automaticamente.
- [x] Prévia mantém snapshot, save recalcula catálogo; fonte indisponível falha
  sem conversão manual automática. Aviso de revisão acessível.
- [x] Versão publicada sem draft orienta criar versão pelo fluxo existente,
  sem criação implícita; foco retorna ao destino em sucesso/erro.

Checkpoint: unitário/integração de UI GREEN; alternativa de teclado, axe,
desktop/mobile e ausência de overflow; dados sintéticos exclusivamente.

## T04 — regressões e segurança (depende de T03)

- [x] Fase269, modelos298, PA01 (alça DnD por teclado e botões) e FND02 preservadas;
  biblioteca310 não foi alterada.
- [x] BFF planos (26), serviço/controlador de planos NestJS (56) e testes da
  proteção FND02 (4) passaram.
- [x] Revisão dos filtros autoritativos de tenant/carteira/arquivamento e de
  permissões do GET/PUT existentes; testes de serviço e BFF preservados.
  Prova PostgreSQL/RLS específica PA02: SKIPPED, sem novo backend/schema.
- [x] Source read e target save tratados como operações independentes;
  nenhuma promessa de proveniência/CAS/idempotência atômica inexistente.
- [x] Typecheck, lint (0 erros; 65 avisos preexistentes), build, secrets e
  `git diff --check` passaram localmente.
- [x] CI do HEAD corrigido `38c3596` aprovado: cinco workflows SUCCESS;
  todos os jobs do CI `38583138559` SUCCESS, conferidos em 2026-10-14.
- [x] Revisão cruzada R4 pelo agente `/root/review_pa02_r4`, que não escreveu
  o código: FAIL inicial em dois P2; correções PASS com digest no
  [relatório](../docs/governance/REVISAO_R4_PA02_PR415_2026-10-14.md).

## T05 — entrega única e handoff (depende de T04)

- [x] Documentação canônica de status e handoff atualizada com resultados reais.
- [x] PA02 integrada na PR #415. Correções da revisão integradas pela #416 porque o
  merge da original já havia ocorrido; digest revisado preservado após
  cherry-pick sobre main `50a9590`. Sem dividir a implementação original.
- [x] Sem merge/deploy/migration externa/ativação executados pelo agente.
- [x] Correções de revisão mantêm contratos de autorização/persistência
  existentes; nova coordenação apenas na interface.

## Evidências desta implementação

Evidência histórica da implementação inicial: unitários PA02 6/6, BFF 26/26,
NestJS serviço/controlador 56/56, FND02 4/4, nutrição Web 13/13, typecheck,
build, lint (0 erros / 65 avisos), Playwright 22/22 e teste tardio adicional 2/2.
A primeira prova tardia usava navegação completa; a versão final comprova SPA.

Nesta retomada: revisão cruzada inicial FAIL em dois P2; correções de runtime
PASS pelo agente revisor com digest registrado; RED/GREEN dos dois cenários
4/4; visual final 30/30 desktop/mobile; unitários PA02 6/6 em Node 22.21.1 /
pnpm 11.25.0; typecheck e lint focado (0 erros / 3 avisos existentes).
Uma compilação BFF paralela ao Next dev falhou por tipos gerados inconsistentes;
nova execução sequencial após regeneração de tipos passou: BFF 26/26, FND02
4/4, typegen, typecheck e build de produção Web. Scanner de secrets e diff
check também passaram.

CI de `f94ea94`: todos os workflows e jobs PASS, inclusive
`test:workflows-seguros` que não tinha PowerShell local na execução inicial.
Os jobs Backend executaram migrations e RLS em PostgreSQL descartável.
CI do HEAD corrigido `38c3596` conferido em 2026-10-14: SUCCESS em
Dependency Review `38583138681`, Semgrep `38583138090`, CodeQL `38583138583`,
Trivy `38583138183` e OctaClin CI `38583138559` (todos os jobs SUCCESS).
Merge #416 `5b47fb1` tem conteúdo idêntico ao HEAD aprovado. Isso não comprova
deploy ou operação produtiva.

SKIPPED: prova local PostgreSQL/RLS específica PA02 e scan automatizado da skill
(cujos auxiliares/preflight não estão disponíveis neste host). A revisão cruzada
por outro agente foi realizada; nenhum merge, deploy ou migration externa.

Relatório: [REVISAO_R4_PA02_PR415_2026-10-14.md](../docs/governance/REVISAO_R4_PA02_PR415_2026-10-14.md).
