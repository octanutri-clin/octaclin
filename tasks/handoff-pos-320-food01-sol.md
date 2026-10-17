# FOOD01 — handoff recebido por Sol médio: revisão e T07–T08

Checkpoint anterior à integração final; os itens abaixo documentam o estado
recebido. Conclusão e gates atualizados no checklist e no relatório final FOOD01.

## Estado confirmado

Worktree `/workspace/octaclin/.worktrees/pos320-food01-planejamento`, branch
`feat/pos320-food01-planejamento`, base PA07 `d36b12e7`. T02–T05 backend foram
implementados anteriormente nesta mesma branch; T06 Web foi implementado agora.
No recebimento, T06 ainda não tinha commit/PR; o backend já estava em `8dd30123`.
Não houve merge ou mudança operacional externa. O checkout principal tem uma
alteração preexistente em `octaclin-web/next-env.d.ts`: preservá-la e não copiar
o arquivo gerado pelo Next desta worktree.

Leia `tasks/plan-pos-320-food01.md`, `tasks/todo-pos-320-food01.md`, o handoff
anterior `tasks/handoff-pos-320-food01-luna.md`, este diff Web e:

- `docs/governance/EVIDENCIAS_FOOD01_BACKEND_2026-10-17.md`
- `docs/governance/EVIDENCIAS_FOOD01_WEB_2026-10-17.md`

## T06 entregue

- BFF collection GET/POST e detail PATCH: paginação allowlist, UUID, corpo até
  4 KiB, permissões existentes, sem-store e respostas sanitizadas.
- API client/tipos Web e componente de biblioteca com lista paginada, CRUD,
  escopo pessoal/clínica, aplicação explícita e stale-context guard por `key`.
- O editor conserva a identidade de aplicação separada dos fatos e do snapshot;
  quantidade recalcula gramas com aritmética `BigInt`, sem arredondar para dentro
  dos limites. Editar/desativar biblioteca não altera seleções já aplicadas.
- Atualização concorrente 409 não tenta repetir: encerra edição stale e atualiza
  a lista. Criação sempre volta à página 1 após sucesso.
- Testes locais documentados na evidência Web. `next-env.d.ts` gerado durante
  `next dev` foi restaurado; confirmar que não aparece no diff.

## T07–T08 ainda necessários

1. Revisar o diff completo backend + Web contra contratos FOOD01, especialmente
   compatibilidade dos DTOs, transformações de cópias/modelos/novas versões,
   persistência de `medidasCaseirasAplicadas` no rascunho e projeções portal/PDF.
2. Fazer revisão de segurança do BFF, permissão clínica, snapshots, nonce,
   retry/idempotência, contexto de paciente/plano/aba e ausência de payload
   sensível em logs/cache/URL. Não se declarar como revisor independente.
3. Completar regressões focadas PA02–PA07 e executar os gates disponíveis do
   repositório; revisar build/CI e registrar falhas com contexto real.
4. Acrescentar cobertura visual para conflito stale 409, escopos disponíveis,
   paginação e troca rápida de alimento/paciente. Verificar portal/PDF sem
   campos FOOD01 adicionais.
5. Executar `git diff --check` e scanner de segredos no diff final. Manter a
   alteração preexistente de outro checkout intocada.
6. Atualizar checklist/evidências e preparar uma PR única somente após gates
   locais. Não fazer merge, deploy, ativação nem aplicar migration externa.

## Resultado de validação T06

T06 local está marcado concluído no checklist, mas isto não é aprovação de PR,
revisão independente nem prontidão de produção. Consulte a tabela e os limites
em `EVIDENCIAS_FOOD01_WEB_2026-10-17.md`. O lint amplo dos arquivos tocados
terminou sem erros, com avisos preexistentes de hooks/refs na parte extensa do
editor profissional; o lint focado nos novos helpers/componente passou limpo.
