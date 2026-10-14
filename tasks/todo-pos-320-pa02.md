# PA02 — checklist de execução

Contrato: [plan-pos-320-pa02.md](plan-pos-320-pa02.md).
Planejamento autorizado em 2026-10-14; implementação ainda não autorizada.

## T00 — base, referências e decisões

- [x] Auditar main2d2edcf, FND02/#411 e PA01/#414 integradas.
- [x] Confirmar PA02 residual e as78 referências do catálogo; nenhuma
  candidata externa para PA02; decisão REUTILIZAR código interno.
- [x] Auditar GET de versão e PUT de destino, chaves, snapshots e limites.
- [ ] Receber respostas D01–D03 e registrar sem presumir aceite.
- [ ] Receber autorização de implementação após troca manual de modelo.
- [ ] Reconfirmar main/status e preservar documentação no mesmo checkout/PR.

## T01 — cópia local isolada (depende de T00)

Arquivos: helper puro, spec e runner/script web; integração mínima no editor.

- [ ] RED comprova necessidade de novas chaves e isolamento da árvore.
- [ ] Duplicar mantém todos os valores editáveis, gera chaves únicas inclusive
  em alternativas e não copia campos de plano/paciente/cálculo.
- [ ] Editar original/cópia não altera a outra; ausência opcional não vira zero.
- [ ] Limites50/100/20 sem truncamento ou aplicação parcial.
- [ ] Comando insere após origem, marca dirty e preserva PA01/FND02.

Checkpoint: unitários GREEN, lint/typecheck e interação local desktop/mobile.

## T02 — selecionar origem salva (depende de T01 e D01/D03)

Arquivos: seletor de cópia, editor, fixtures/spec visual.

- [ ] Paciente atual + outros autorizados conforme D01; paginação de planos
  explícita, seleção de versão/refeição, estados vazio/erro/carregamento.
- [ ] Publicada por padrão, rascunho salvo explícito conforme D03;
  origem dirty orienta salvar; descartada nunca aceita.
- [ ] Buffer só de referências em memória; limpa por paciente/identidade/saída.
- [ ] GET autorizado por versão exata a cada colagem, com abort e geração local.
- [ ] Rascunho alterado/ID ausente pede nova cópia; não busca por nome/posição.

Checkpoint: teste negativo de acesso revogado/404, resposta tardia, seleção
concorrente e troca de contexto; rascunho destino permanece intacto na falha.

## T03 — colar no destino e persistir (depende de T02 e D02)

Arquivos: editor, helper, spec Playwright e teste BFF existente quando necessário.

- [ ] Nova refeição ao final ou itens acrescentados conforme D02;
  cabeçalho e conteúdo anterior do destino preservados.
- [ ] Novas chaves por gesto; duplo clique durante leitura não duplica.
- [ ] Não leva IDs de origem, metas/objetivos/revisão nem consentimentos ao PUT.
- [ ] Salvar/recarregar confirma conteúdo/ordem e IDs persistidos novos;
  publicada e origem não mudam. Não salvar/publicar/avisar automaticamente.
- [ ] Prévia mantém snapshot, save recalcula catálogo; fonte indisponível falha
  sem conversão manual automática. Aviso de revisão acessível.
- [ ] Versão publicada sem draft orienta criar versão pelo fluxo existente,
  sem criação implícita; foco retorna ao destino em sucesso/erro.

Checkpoint: unitário/integração de UI GREEN; alternativa de teclado, axe,
desktop/mobile e ausência de overflow; dados sintéticos exclusivamente.

## T04 — regressões e segurança (depende de T03)

- [ ] Fase269, modelos298, biblioteca310, PA01 e FND02 preservadas.
- [ ] BFF planos/negativos de sessão/permissão e serviço de escopo passam.
- [ ] Outra clínica, outro responsável, paciente/plano arquivado e destino sem
  permissão não alcançam conteúdo/persistência; não basta esconder controles.
- [ ] Source read e target save tratados como operações independentes;
  nenhuma promessa de proveniência/CAS/idempotência atômica inexistente.
- [ ] Typecheck/lint/build/secrets/diff passam na toolchain suportada.
- [ ] CI do HEAD/PR passa; PostgreSQL/RLS executado ou SKIPPED com motivo.
- [ ] Revisão R4 registrada; se própria, não declarar independente.

## T05 — entrega única e handoff (depende de T04)

- [ ] Documentação canônica reconciliada, resultados reais registrados.
- [ ] Uma PR PA02, com decisão de referências, validações e rollback.
- [ ] Sem merge/deploy/migration externa/ativação executados pelo agente.
- [ ] Avisar/pausar para Sol médio se revisão exigir novo contrato de segurança.

## Evidências desta análise

PASS: baseGit/merges, leitura do catálogo/mapa, auditoria de contratos.
SKIPPED: todos os testes de implementação, navegador, CI e PostgreSQL PA02.
PASS documental em2026-10-14:15 links locais existentes, diff--check sem erro e
scanner local de secrets sem achado. Nenhum teste de implementação executado.
