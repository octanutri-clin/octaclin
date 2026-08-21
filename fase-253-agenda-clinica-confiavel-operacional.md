# Fase 253 - Agenda clinica confiavel e operacional

Status: implementacao e migration de producao concluidas em 2026-08-21;
rollout pendente de merge, deploy e smoke.

## Objetivo

Fechar a agenda como fonte operacional independente da Google Agenda e tornar
conflitos, sincronizacao, notificacoes e solicitacoes publicas observaveis,
idempotentes e recuperaveis.

## Entrega

- Criacao, bloqueio, desbloqueio, remarcacao, desfecho e cancelamento agora
  compartilham uma trava transacional por tenant e profissional. Consulta e
  bloqueio manual nao podem ocupar a mesma janela por corrida entre tabelas.
- As visualizacoes semanal e lista preservam a agenda interna; a lista tambem
  permite liberar bloqueio manual, com confirmacao, estado ocupado e feedback.
- Eventos criados no Google usam ID deterministico por consulta. Uma resposta
  `409` so e aceita quando o evento recuperado aponta para a mesma consulta.
- Cancelamento e remarcacao recebidos do Google exigem correspondencia entre o
  evento recebido e o `googleEventId` persistido. Evento externo nao vinculado
  nao altera consulta interna.
- O sync token do Google so avanca quando todos os eventos forem aplicados. Em
  falha, ele e preservado, a contagem fica visivel e a operacao pode ser
  repetida sem perder alteracoes.
- O profissional pode tentar novamente Google, email e WhatsApp sem recriar a
  consulta. Mensagem ja persistida reutiliza o mesmo ID de fila; notificacao de
  cancelamento usa campos proprios e nao e duplicada por repeticao.
- O agendamento publico considera bloqueios manuais, limita abuso primeiro por
  IP global e depois por link, recupera aprovacao abandonada e cria consulta
  com referencia externa deterministica.
- Conflito durante a confirmacao publica atualiza os horarios e preserva os
  dados pessoais digitados. O erro permanece dentro do modal e recebe foco.

## Fronteiras de seguranca

- O endpoint autenticado de reprocessamento exige
  `agenda.consultas.criar`, preserva o escopo do profissional e registra
  auditoria.
- A funcao SQL `resolver_agenda_link_publico` recebe somente o hash SHA-256 do
  token opaco e retorna apenas tenant, profissional e duracao de link ativo.
  Ela usa `SECURITY DEFINER` com `search_path` fixo, sem desligar RLS nem expor
  dados clinicos.
- A tabela `agenda_links_publicos` continua com RLS e FORCE RLS. A funcao e a
  unica ponte publica para resolver um token valido antes de o contexto de
  tenant existir.
- Estado assinado do OAuth, nonce de uso unico e BFF continuam preservados. A
  fase nao declara vinculo novo entre o state OAuth e uma sessao de navegador.
- Nenhuma credencial, token, URL de banco ou dado real entrou no diff, testes ou
  documentacao.

## Migration e rollout

A migration `ProtegerResolucaoAgendaPublica1720000001034` foi registrada no
TypeORM. Um preflight SQL idempotente foi validado somente no projeto Neon
`octaclin-integration-tests`, banco `octaclin_test_fase150b`:

- `SECURITY DEFINER = true`;
- `search_path = public, pg_temp`;
- retorno limitado a `tenant_id`, `profissional_id` e `duracao_minutos`;
- RLS e FORCE RLS preservados em `agenda_links_publicos`;
- hash sintetico inexistente retornou zero linhas.

Em 2026-08-21, com autorizacao humana explicita, o banco
`Octaclin-db-producao` do projeto `royal-tooth-92809187` mostrou somente a
`1034` pendente. A migration foi aplicada com `neondb_owner` e o TypeORM passou
a listar 47/47 migrations executadas. A verificacao direta confirmou
`SECURITY DEFINER`, `search_path=public, pg_temp`, retorno minimo, RLS e FORCE
RLS ativos e zero linha para o hash sintetico. A URL foi removida da sessao no
bloco `finally`; nenhum seed, `migration:revert` ou `down` foi executado.

## Validacoes executadas

```powershell
pnpm --dir octaclin-backend exec jest --runInBand <6 specs da agenda e migration>
pnpm --dir octaclin-backend build
pnpm --dir octaclin-web test:authz
pnpm --dir octaclin-web test:fase253
pnpm --dir octaclin-web exec playwright test tests/visual/acessibilidade.spec.mjs --grep "agenda interna" --project=desktop-chromium
pnpm --dir octaclin-web build
```

Resultados:

- 87/87 testes focados do backend aprovados;
- build backend aprovado e `dist/main.js` validado;
- build web aprovado com 123 rotas, incluindo o novo BFF;
- os sete scripts de `test:authz` foram aprovados;
- 2/2 jornadas Playwright da fase e 1/1 gate de acessibilidade aprovados;
- lint e typecheck web aprovados; os 52 avisos de hooks preexistentes seguem
  fora do escopo;
- Chrome DevTools confirmou alerta acessivel no fluxo publico indisponivel;
- 141/142 suites e 984/985 testes da suite backend completa passaram. A unica
  falha e o teste canonico TACO por `LF/CRLF` no checkout Windows, divida
  ambiental ja documentada e sem arquivo TACO alterado nesta fase;
- varredura do diff nao encontrou padrao de segredo.

## Aceite restante

1. Integrar o PR com o schema de producao ja expandido.
2. Confirmar deploy, `/health/detalhado` sem migration pendente e smoke
   sintetico de agenda interna, link publico e reprocessamento.

## Proxima fase

Fase 254 - Lista e cadastro robusto de pacientes.

- Modelo: GPT-5.6 Sol, raciocinio `high`.
- Skills: `ecc:healthcare-emr-patterns`, `ecc:frontend-patterns`,
  `ecc:database-migrations`, `ecc:frontend-a11y` e
  `codex-security:validation`.
- Ferramentas: Browser, Chrome DevTools e Playwright; Neon somente se houver
  migration explicitamente revisada e banco-alvo confirmado.
