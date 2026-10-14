# Handoff — Onda 0/FND02: proteção de alterações não salvas

**Estado:** implementação iniciada nesta PR após autorização explícita do
proprietário, 2026-10-14.
**Objetivo:** consolidar em uma primitive reutilizável a proteção `beforeunload`
que já existia nos fluxos cobertos, sem alterar confirmação de navegação interna.

## Escopo desta PR

- Primitive pequena e testável para registrar/remover `beforeunload`.
- Hook React que habilita/desabilita a primitive por `dirty`.
- Migrar os três fluxos com listener repetido: prontuário, plano alimentar e
  workspace de questionários.
- Preservar guardas e confirmações de navegação internas existentes.
- Incluir testes unitários e step específico no CI.

## Fora de escopo

Autosave, trava entre abas, novas superfícies de edição, alterações de backend,
persistência, migrations ou bibliotecas externas. Os demais IDs das ondas
pós-320 não estão autorizados por este handoff.

## Critérios de aceite e verificações

1. Estado limpo não registra listener; estado sujo bloqueia a saída do browser.
2. Cleanup remove o listener ao salvar/desmontar; mudanças de estado não deixam
   listener stale ou duplicado.
3. Os três fluxos usam o hook e mantêm as confirmações internas atuais.
4. Teste focado, typecheck, lint proporcional, CI e `git diff --check` passam.
5. Sem dependência nova, alteração de dados, migration ou persistência de PHI.

**Evidências locais desta revisão:** TDD RED confirmou a ausência inicial da
primitive; os 4 testes focados passaram após a implementação. Typecheck passou.
ESLint passou sem erros, com 8 avisos `set-state-in-effect` preexistentes nos
dois componentes de prontuário/plano. `pnpm security:secrets` passou. Os comandos
rodaram com Node 24.19.0/pnpm 11.19.0, fora do intervalo de engine do pacote
(Node >=22 <23 e pnpm 11.25); revalidar no CI com a toolchain suportada. Build,
smoke visual e CI remoto ainda pendentes.

## Sequência posterior

Não iniciar PA01 ou outra sugestão automaticamente. Após concluir esta PR,
reconciliar o próximo ID com a `main`, demonstrar lacuna residual e seguir uma
PR individual mediante solicitação/decisão correspondente.
