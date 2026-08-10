# Fase 220 - Observabilidade e alertas externos de producao

Status: em validacao operacional em 2026-08-09.

## Objetivo

Detectar indisponibilidade da producao e falha do backup sem depender de uma
pessoa autenticada no console OctaClin. A fase complementa os healthchecks,
logs estruturados e alertas internos existentes; nao altera banco, runtime ou
codigo de produto.

## Entrega tecnica

- workflow `.github/workflows/monitor-producao.yml`, manual e a cada 30 minutos;
- cron bloqueado ate `OCTACLIN_MONITOR_AUTOMATICO_HABILITADO=true`;
- tres tentativas com prazo de 70 segundos e espera progressiva, tolerando o
  cold start do Render sem mascarar indisponibilidade persistente;
- verificacao de `/health/pronto`, `/health/detalhado` e da identidade da tela
  `/login`;
- contrato detalhado exige backend, banco, migrations, Redis, email, WhatsApp e
  Google Calendar saudaveis;
- falha abre uma GitHub Issue deduplicada e recuperacao fecha o incidente;
- conclusao do workflow `Backup producao` abre ou fecha incidente proprio;
- permissoes do workflow limitadas a leitura do repositorio e escrita em
  issues.

## Privacidade e custo

- issues registram somente categoria, URL da execucao e estado de recuperacao;
  payloads, stack traces, connection strings e dados clinicos nao sao copiados;
- URLs monitoradas sao variaveis publicas do repositorio, nunca secrets;
- o monitor nao autentica nem usa conta de paciente/profissional;
- intervalo de 30 minutos evita manter continuamente a instancia gratuita do
  Render acordada e permanece dentro do orcamento mensal esperado do GitHub
  Actions para repositorio privado;
- o monitor externo nao substitui logs Render nem os alertas internos de filas
  e integracoes em `/operacoes`.

## Resposta a incidente

1. Abrir o link da execucao informado na issue.
2. Consultar `/health/detalhado` e os logs Render pelo horario da falha.
3. Para backup, seguir `RUNBOOK_BACKUP_RESTORE.md` e nao repetir com URLs
   ambiguas.
4. Nao fechar a issue manualmente antes de confirmar a recuperacao; o proximo
   monitor saudavel faz o fechamento automatico.

## Aceite

- [x] Contratos locais, formato e varredura de secrets aprovados.
- [ ] Variaveis publicas de producao configuradas no GitHub.
- [ ] Execucao manual real aprovada sem criar incidente.
- [ ] Cron ativado somente depois do teste manual.
- [ ] Falha do backup acompanhada por incidente deduplicado.

Nao ha migration nesta fase. Quando houver dominio oficial, as duas variaveis
de URL e a allowlist do validador devem ser atualizadas no mesmo rollout.
