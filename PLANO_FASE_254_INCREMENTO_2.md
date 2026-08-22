# Fase 254 - Incremento 2: rotas e formulario proprio

## Objetivo

Separar lista, criacao e edicao de pacientes sem alterar schema ou contratos
clinicos. O cadastro deixa o modal, ganha rotas autorizadas e preserva rascunho
temporario em `sessionStorage` por tenant e por alvo.

## Tarefas

- [x] Tornar rotas especificas parte do catalogo canonico de navegacao.
- [x] Exigir `pacientes.gerenciar` em `/pacientes/novo` e
  `/pacientes/[id]/editar`, antes da renderizacao.
- [x] Criar BFF de leitura do paciente para a pagina de edicao.
- [x] Extrair filtros, formulario e lixeira do componente de lista.
- [x] Criar paginas proprias para novo cadastro e edicao.
- [x] Trocar atalhos, paleta e acoes da lista para navegacao real.
- [x] Preservar rascunho por tenant/alvo apenas na sessao da aba e remove-lo
  somente depois de sucesso confirmado.
- [x] Atualizar testes de autorizacao, navegacao e jornadas Playwright.
- [x] Validar lint, typecheck, build, authz e fluxo desktop/mobile.

## Evidencias locais

- `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test:authz` e
  `pnpm test:base-visual` aprovados.
- `pnpm test:fase254`: 4/4 em desktop e mobile.
- Jornada de recuperacao da Fase 248 e jornada critica de criacao/agendamento
  aprovadas isoladamente.
- Varredura do diff confirma ausencia de `localStorage`; rascunho usa somente
  `sessionStorage` e e removido depois da resposta de sucesso.

## Fronteiras

- Sem migration e sem campo novo.
- `sessionStorage`, nunca `localStorage`, porque o rascunho contem PII.
- Collaborator sem `pacientes.gerenciar` nao renderiza o formulario.
- O formulario de edicao carrega o paciente no escopo pelo backend autenticado.
- O Incremento 3 continua responsavel por filtros salvos e duplicidade na UI.
