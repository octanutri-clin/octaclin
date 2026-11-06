# FOOD06 M11 — seleção factual e prévia M04 no editor

## Estado e contrato

Base f9c35427, PR455 Draft. CI da base consultado nesta rodada:22checksSUCCESS/1SKIPPED (Provenance do SBOM), incluindo Backend, Web e Demo. JobWeb128137826205 confirmou etapa pnpm test:authz SUCCESS. Não comprova o delta posterior. A tentativa local agregada anterior parou sem marcador final, com processo indisponível (Unknown process id), portanto INCONCLUSIVA; logs preservados, não PASS. Não atribuir causa funcional/infraestrutural sem prova.

No modal Simular alteração alimentar, operação Trocar por alimento do catálogo, a consulta M11 agora oferece ação explícita Usar X g na prévia. Seleção preenche apenas alimento/quantidade/peso/unidade no formulário:75g resulta quantidade75, unidadeg e peso75g. Não calcula ou grava automaticamente. Nenhum novo endpoint, motor, schema, migration, dependência ou persistência paralela.

Resumo transitório identifica nutriente consultado, porção, fonte/versão, destino e preparo. Não representa equivalência nutricional ou verificação de alergias; a fonte é resolvida novamente ao calcular/confirmar. Não é proveniência clínica persistida: snapshots e histórico continuam no writer cifrado existente. Não há remoção ou transporte de proveniência FOOD05, e D17/modelos permanecem intactos.

Escolha assistida exige estado conhecido do nutriente; ausente/traço/incompatível não habilitam a ação, sem inventar zero. Zero conhecido continua permitido. A busca manual existente permanece disponível para escolha independente; não há declaração de adequação ao paciente ou inferência de restrições.

O profissional ainda executa Calcular prévia e Confirmar alteração no rascunho. M04 existente revalida acesso/carteira, revisão, ativação, composição, fingerprint/CAS e PA07; conserva publicação separada e autosave60s após ACK. Alimentos sem dados suficientes para materializar o rascunho podem retornar422: não afrouxar esse contrato. Constraint de ativação1028 exige situaçãoativa com direito aprovado e metadados; inspeção de código, não ensaio ou aplicação da migration e não parecer jurídico.

## Segurança de interação

- Callback opcional de seleção não existe na consulta isolada do painel combinado. No editor, guarda estado conhecido, permissão de edição, bloqueio, operação e conferirBase antes de preencher.
- Lookup mantém abort/geração; key de contexto/rascunho/revisão/permissão/operação; fechar modal ou perder posse desmonta e invalida a consulta. Não reanima resposta antiga.
- Preencher apaga a prévia anterior; editar peso/quantidade/unidade apaga identificação da consulta e exige nova prévia. Cancelar a consulta não altera destino já escolhido; cancelar o modal não grava.
- Submit do formulário em portal React agora interrompe propagação. O RED da integração mostrava lookup fechado após consultar porque o evento alcançava o formulário do editor. Trace examinada mostrou consultas, não gravação clínica; não afirmar que houve persistência acidental. Novo fluxo Enter e ausência de saves antes de confirmar estão cobertos.
- Botão selecionado desaparece quando resultados são limpos; RED de foco recebeu inactive. Campo de peso existente recebe foco síncrono após as guardas. Sem timer/RAF capaz de roubar foco após troca de contexto.

## RED/GREEN e regressões

1. RED funcional: modal carregado, ação de consulta ainda ausente; implementação inicial expôs propagação do submit; stopPropagation levou cancelar/axe a GREEN.
2. RED ação de nutrienteausente habilitada; disabled+guard no filho/pai corrigidos, sem corte clínico arbitrário ou bloqueio do zero conhecido.
3. RED de foco após seleção; foco no peso corrigido. Matriz final após a correção46/46PASS,0skip (14novos+20consulta+12M04), incluindo foco nos dois projetos.
4. Primeira matriz antes do ajuste de foco:46/46PASS (14novos+20consulta+12M04),0skip. Inclui seleção75g, cancelar, confirmação, edição,409/422, tardio e perda PA07. Não substituir o resultado final por esta evidência anterior.
5. Regressão backend existente reexecutada:180/180PASS. Inclui troca de catálogo/identidade, composição atualizada ou fonte inativa invalidando fingerprint sem alterar prévia antiga, snapshots e flags legítimas preservados. Testes de serviço com repositórios simulados, não PostgreSQL real.
6. BFF150/150PASS; lint integral0erros/71avisos e typecheckPASS. Gate de linguagem falhou no canário COMPOSICAO do teste; corrigido para COMPOSIÇÃO, sem exceção. Varredura completa e8testes de linguagemPASS; cenário422retestado2/2PASS. Esses resultados não são testes novos de banco.

Comandos reproduzíveis em Node22.21.1: Playwright com food06-consulta-previa.spec.mjs, food06-previa-editor.spec.mjs, food06-consulta-teor.spec.mjs, projetos desktop/mobile e servidor Nextdevwebpack local; scripts/test-planos-alimentares-bff.mjs, eslint integral/afetados, tsc --noEmit, scripts/test-linguagem-interface.mjs e linguagem-interface-lib.spec.mjs. Backend: Jest --config octaclin-backend/package.json --runInBand --runTestsByPath servico-planos-alimentares.spec.ts.

Captura de screenshots teve uma tentativa que não iniciou webServer após desconexão do executor; NOT RUN/setup. Ambiente consultado como connected/running e rechecado git/diff sem descarte. Servidor local reiniciado com webpack já suportado, sem dependências/configurações de segurança novas. Reteste de captura2/2PASS. Imagens sintéticas reproduzíveis pelo spec, sem pacientes reais.

## Revisões e limites

R4 independente /root/food06_contexto_fundamento_r4: leitura estática do delta e testes, favorável após guarda de conhecido e foco síncrono; não executou testes/PG. Não é R4 integral FOOD06. Revisão UX A/B delimitada por /root/food06_contexto_ux_a, persona fictícia, texto e evidências do coordenador; não interagiu ou viu imagens diretamente. C delimitada favorável após matriz final; C global e a11y humana pendentes. PacienteN/A, sem novo portal/envio/documento.

Build/typecheck final Node22.21.1PASS em cópia descartável gitarchive da base+5inputs de delta conferidos por SHA256 contra worktree,196páginas e BUILD_ID presente. Avisos existentes middleware/Edge Runtime mantidos. PostgreSQL/RLS não reexecutado neste incremento sem backend alterado; provas da base/CI têm seus commits próprios. Não presumir autorização, fonte atual ou direitos por mocks browser/consenso de agentes.

## Aceite e próximo passo

M11 permanece PARCIAL,50%administrativos pelo método fixo. Seleção/prévia agora integradas ao rascunho; critérios globais, individualização com restrições confiáveis e direitos/DRI/G06 continuam bloqueados/pendentes. M12 permanece pendente: esta integração reutiliza a comparação existente e não entrega a biblioteca de cenários múltiplos. Próximo: conferir novoCI e implementar os cenários temporários aprovados, reutilizando este fluxo sem gravação automática.

Rollback do delta: retirar callback/coluna opcional e integração do modal; consulta isolada/API/BFF e writer M04 existentes preservados. Sem alterações persistidas fora do writer já existente, sem reescrita histórica. Nenhum merge/deploy/migration externa/Render/Neon ou ativação realizada.

[Relatórios UX e manifesto](../docs/agents/ux/reports/FOOD06-M11-PREVIA-C-2026-11-06/consolidado.md). Backlog de teste humano com tecnologia assistiva e reconsulta sem seleção, sem ampliar implementação. CI do novo delta pendente; não herdar PASS da base.
