# PA02 — checklist de execução

Contrato: [plan-pos-320-pa02.md](plan-pos-320-pa02.md).
Implementação autorizada em 2026-10-14; PR #415 aberta como Draft.

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

Checkpoint parcial: Playwright comprova acesso revogado, versão alterada,
paginação que limpa a origem e destino intacto nas falhas. AbortController,
sequência e limpeza ao desmontar/contextualizar estão implementados, mas não há
teste visual específico de resposta tardia após troca de paciente. Acrescentar
esse cenário se uma revisão independente identificar risco que o teste atual
não deixe coberto.

## T03 — colar no destino e persistir (depende de T02 e D02)

Arquivos: editor, helper, spec Playwright e teste BFF existente quando necessário.

- [x] Nova refeição ao final ou itens acrescentados conforme D02;
  cabeçalho e conteúdo anterior do destino preservados.
- [x] Novas chaves por gesto; duplo clique durante leitura não duplica.
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

- [x] Fase269, modelos298, PA01 (reordenação por botões) e FND02 preservadas;
  biblioteca310 não foi alterada.
- [x] BFF planos (26), serviço/controlador de planos NestJS (56) e testes da
  proteção FND02 (4) passaram.
- [ ] Outra clínica, outro responsável, paciente/plano arquivado e destino sem
  permissão não alcançam conteúdo/persistência; não basta esconder controles.
- [ ] Source read e target save tratados como operações independentes;
  nenhuma promessa de proveniência/CAS/idempotência atômica inexistente.
- [x] Typecheck, lint (0 erros; 65 avisos preexistentes), build, secrets e
  `git diff --check` passaram localmente.
- [ ] CI do HEAD atualizado passa. Dependency Review passou no SHA inicial;
  outros checks estavam em execução. PostgreSQL/RLS: SKIPPED; não houve mudanças de
  backend, autorização ou schema; a evidência local não é prova de banco.
- [ ] Revisão R4 independente registrada; nenhuma revisão independente foi
  simulada nesta execução.

## T05 — entrega única e handoff (depende de T04)

- [x] Documentação canônica de status e handoff atualizada com resultados reais.
- [x] Uma PR PA02 aberta como Draft (#415), com decisão de referências,
  validações e rollback.
- [ ] Sem merge/deploy/migration externa/ativação executados pelo agente.
- [ ] Avisar/pausar para Sol médio se revisão exigir novo contrato de segurança.

## Evidências desta implementação

PASS: base Git/merges e catálogo PA02; unitários PA02 6/6; BFF planos 26/26;
NestJS serviço/controlador 56/56; proteção FND02 4/4; nutrição web 13/13;
typecheck; lint (0 erros, 65 avisos no repo); build Web; Playwright 22/22
desktop/mobile no conjunto anterior e cenário tardio de troca de paciente 2/2;
scanner de secrets; `git diff --check`.
`test:security` passou. `test:workflows-seguros`: 7 testes passaram e 1 falhou
por indisponibilidade do PowerShell neste container, pré-requisito explícito do
teste de fail-closed do preflight; os testes de injeção nos workflows passaram.
SKIPPED: PostgreSQL/RLS específico PA02 (sem alteração backend/schema) e revisão
R4 independente. CI do commit inicial tinha Dependency Review PASS e demais
checks ainda em execução; validar o HEAD após push. Nenhum merge, deploy ou
migration externa executados.
