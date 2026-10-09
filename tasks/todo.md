# Fase 308 — Checklist de implementação

Plano/contrato: `docs/history/phases/PLANO_FASE_308.md`.
As decisões do proprietário já estão fechadas. Não iniciar implementação
durante o turno de planejamento nem antes da troca manual para Luna Alto.
Cada tarefa começa pelo teste comportamental RED e termina com GREEN; somente
marcar concluída com a evidência da execução. Não atualizar status de produção.

## Preparação

- [ ] Reconfirmar branch `feature/fase-308-resumo-exames`, Git/diff/main/PR.
- [x] Node 22.23.2/pnpm 11.25.0 conferidos e install congelado dos dois pacotes
  concluído no planejamento, sem mudança de lockfiles/engines.
- [ ] Ler instruções/plano e usar o wrapper do handoff em cada comando; se o
  ambiente mudou, reconfirmar runtime e instalação congelada.
- [ ] Confirmar autorização de implementação após troca manual de modelo.

## Tarefa 1 — Regra única para resultado e faixa (S)

**Descrição:** extrair regra/tipos de PB-17 para domínio e conservar o contrato
dos resultados existentes, com leitura defensiva de limites inválidos.
**Dependências:** preparação.
**Arquivos:** novo `octaclin-backend/src/modulos/pacientes/dominio/resultado-exame-laboratorial.ts`
e sua `.spec.ts`; `aplicacao/servico-exames-laboratoriais.ts` e sua `.spec.ts`.

**Aceite:**
- [ ] Um helper compartilhado para faixa; nenhum cálculo copiado no resumo.
- [ ] Limites inclusivos/unilaterais, vírgula e não classificação seguem plano.
- [ ] Leituras/escritas válidas de PB-17 conservam o comportamento.

**Verificação:** Jest `resultado-exame-laboratorial.spec.ts` e
`servico-exames-laboratoriais.spec.ts`; backend typecheck.

## Tarefa 2 — Leitor mínimo e agrupamento do resumo (M)

**Descrição:** selecionar 100 coletas, decifrar resultados mínimos, escolher
última coleta por grupo, detectar duplicados e retornar até 10 destaques.
**Dependências:** 1.
**Arquivos:** novos `octaclin-backend/src/modulos/pacientes/aplicacao/leitura-exames-resumo.ts`
e `.spec.ts`; `aplicacao/dtos.ts` (tipos/campo, atualizar comentário PB-16).

**Aceite:**
- [ ] Tenant/paciente/soft-delete/projeções/limites/ordenação explícitos; não
  decifrar cabeçalhos nem 101ª coleta; usar o manager fornecido.
- [ ] Último grupo determinado antes do filtro, livre/catálogo separados,
  duplicados sem escolha, cobertura e contagens coerentes.
- [ ] Allowlist do DTO; crypto/malformed/overflow retorna somente indisponível,
  nunca dados parciais; erro SQL propaga, sem engolir transação abortada.

**Verificação:** Jest `leitura-exames-resumo.spec.ts` + typecheck; aplicar os
casos de agrupamento, consulta, erro e privacidade da matriz do plano.

## Checkpoint A — Domínio e leitor

- [ ] RED/GREEN registrado, specs de 1–2 e PB-17 aprovadas.
- [ ] Revisar DTO, limites e recência contra decisões confirmadas.
- [ ] Sem acesso a banco externo, migration ou dependency injection nova.

## Tarefa 3 — Integração no prontuário com autorização (M)

**Descrição:** chamar leitor na transação de `obterProntuario`, após a
verificação de paciente e somente com papel/permissão/tenant autorizados.
**Dependências:** 2.
**Arquivos:** `octaclin-backend/src/modulos/pacientes/aplicacao/servico-pacientes.ts`
e `.spec.ts`; `octaclin-web/lib/prontuario-api.ts` (espelho do DTO).

**Aceite:**
- [ ] Paciente próprio Professional, SuperAdmin e Collaborator positivos;
  nova seção omitida sem autorização, sem leitura/decifragem de exame.
- [ ] Outra carteira/tenant, profissional sem vínculo e paciente arquivado
  negados antes de ler exames; testes verificam ordem e filtros reais.
- [ ] Expectativa exata antiga de resumo ajustada quando autorizado, mantendo
  fixtures mínimas sem permissão fora do segmento novo.

**Verificação:** Jest focado `servico-pacientes.spec.ts`, specs de 1–2,
backend typecheck/build; conferir serviço sem nova dependência circular.

## Tarefa 4 — BFF sem cache e cobertura do resumo (M)

**Descrição:** acrescentar no-store e exercitar a rota existente no harness.
**Dependências:** 3.
**Arquivos:** `octaclin-web/app/api/pacientes/[id]/prontuario/route.ts`,
`octaclin-web/scripts/prontuario-timeline-bff.spec.ts`,
`octaclin-web/scripts/test-prontuario-timeline-bff.mjs`.

**Aceite:**
- [ ] Wrapper, sessão e params Promise preservados; no-store em sucesso/erro.
- [ ] 401 sem fetch; 403/404 preservados; corpo/rota codificada testados;
  tenant/query arbitrários não encaminhados.
- [ ] Harness compila/importa a rota de resumo junto às existentes.

**Verificação:** documentação Next instalada lida antes da alteração;
`pnpm --dir octaclin-web exec node scripts/test-prontuario-timeline-bff.mjs`
e `pnpm --dir octaclin-web test:authz`, em sequência.

## Checkpoint B — Contrato protegido

- [ ] Testes positivos/negativos do backend e BFF aprovados.
- [ ] Payload/auditoria sem campos excedentes ou logs clínicos.
- [ ] RLS existente mantida; registrar gate real do CI. SQL/alteração de RLS
  exigem adicionalmente PostgreSQL descartável, sem inferir a prova de mocks.

## Tarefa 5 — Bloco de exames na Leitura clínica (M)

**Descrição:** exibir dados factuais, referências, origem e estados conforme o
contrato, navegando para Exames pelo fluxo atual de troca de aba.
**Dependências:** 3–4.
**Arquivos:** novo `octaclin-web/components/pacientes/resumo-exames-fora-faixa.tsx`;
`octaclin-web/components/pacientes/prontuario-paciente.tsx`.

**Aceite:**
- [ ] Lista legível com resultado/unidade/referência/data/origem; texto livre
  separado do catálogo; sem classificação no cliente.
- [ ] Vazio, ausente, indisponível, sem classificação, duplicado, truncamento
  e acesso insuficiente distintos; retry e botão Exames funcionam.
- [ ] Responsividade, foco/texto acessível e dia civil preservados.

**Verificação:** Web lint/typecheck/build sequenciais e cenários da Tarefa 6.

## Tarefa 6 — Regressão de browser e fixtures (M)

**Descrição:** atualizar helper sintético do prontuário e cobrir a nova seção
em desktop/mobile, além das regressões PB-17/resumo já existentes.
**Dependências:** 5.
**Arquivos:** `octaclin-web/tests/visual/console-regression.spec.mjs`;
`octaclin-web/tests/visual/acessibilidade.spec.mjs` somente se necessário para
garantir que a nova seção é visitada com dados no teste de a11y.

**Aceite:**
- [ ] Testes “Fase 308” cobrem a matriz de UI/recuperação/permissão do plano.
- [ ] Fixture base tem contrato vazio explícito; teste backend antigo remove
  campo deliberadamente; validar retry mudando indisponível para disponível.
- [ ] Seletores escopados à seção, dados sintéticos, sem duplicidades de nome
  causando strict-mode; navegação e ausência de overflow comprovadas.

**Verificação:** Playwright no grep do plano em ambos os projetos;
`pnpm --dir octaclin-web test:a11y` com cobertura real da seção.

## Checkpoint C — Fluxo pronto para revisão

- [ ] Checkpoints A/B + browser/a11y/lint/typecheck/build aprovados.
- [ ] Backend full Jest uma vez após a integração; não repetir sem razão nova.
- [ ] Revisar diff contra decisões e contrato, inclusive antes de classificar.

## Tarefa 7 — Documentação de estado e risco (M)

**Descrição:** atualizar somente o estado observado e a matriz de
confiabilidade com a leitura nova e seus gates reais.
**Dependências:** 6 e checkpoints.
**Arquivos:** `STATUS_ATUAL_PROJETO.md`, `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`,
`RESUMO_FASES_CONCLUIDAS.md`, `docs/product/ROADMAP_POS_AUDITORIA_FASES_302_320.md`,
`MATRIZ_CONFIABILIDADE_TESTES.md` (linha própria do novo leitor e gates).

**Aceite:**
- [ ] Docs descrevem resultado real, risco R4/rollback e nenhum aceite de
  produção; não marcar fase integrada antes do merge confirmado.
- [ ] Matriz contém leitor, testes de isolamento e gates efetivamente usados.
- [ ] Roadmap/checklist/status/resumo coerentes, sem reabrir histórico.

**Verificação:** revisão dos cinco documentos e `git diff --check`.

## Tarefa 8 — Fechamento e PR (S)

**Descrição:** registrar execução no plano/handoff e abrir uma PR da mesma
branch com plano e código. Modelo segue Luna Alto se escopo fechado.
**Dependências:** 7 e checkpoints.
**Arquivos:** `docs/history/phases/PLANO_FASE_308.md`, `tasks/plan.md`,
`tasks/todo.md`; PR como artefato remoto.

**Aceite:**
- [ ] Documentos de transferência apontam execução, pendências e próxima ação.
- [ ] `git diff --check` e `pnpm security:secrets` PASS antes de push;
  dependências/lockfiles sem alteração alheia; PR da mesma branch.
- [ ] Checks por run ID acompanhados, PASS/FAIL/NA/SKIPPED explícitos; revisão
  independente solicitada quando viável, sem declarar autorrevisão independente.

**Verificação:** comandos do plano e CI aplicável. Demo local smoke e
Governança devem passar; inventário vencido requer captura nova e triagem real,
não ajuste manual de data. Monitor produção é trilha separada e não prova de
erro da fase. Registrar PR, SHA, evidência e próxima ação no handoff.

## Encerramento

- [ ] Entrega revisável ao proprietário, sem pendência técnica ocultada.
- [ ] Pausar antes de qualquer mudança de modelo e informar modelo/etapa.
- [ ] Merge, migration e deploy ficam para autorização/ambiente identificados.
