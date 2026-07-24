# OctaClin - Controle da producao isolada de staging

Este arquivo acompanha a execucao real da Fase 131, seguindo
`RUNBOOK_PRODUCAO_ISOLADA.md`. Nunca registre valores reais de secrets, URLs de
banco/cache com credencial ou dominio privado aqui - apenas status.

## Status atual

Estrutura da fase entregue em 2026-07-23 (runbook, este controle e validador
documental). Provisionamento real dos recursos ainda nao foi executado nesta
sessao: depende de acoes do usuario nos consoles Neon, Upstash e Render.

## Recursos a criar

| Recurso | Status | Data | Observacao |
| --- | --- | --- | --- |
| Banco Neon de producao (projeto/branch proprio) | Pendente | - | Nao reaproveitar o projeto usado como staging. |
| Migrations aplicadas no banco novo (`pnpm --dir octaclin-backend migration:run`) | Pendente | - | Sem `pnpm seed:staging` em producao. |
| Redis Upstash de producao | Pendente | - | Instancia dedicada, nao compartilhada com staging. |
| Render backend de producao | Pendente | - | Servico/environment separado do staging. |
| Render web de producao | Pendente | - | Servico/environment separado do staging. |
| Secrets de producao (`JWT_SEGREDO`, `JWT_REFRESH_SEGREDO`, `CRIPTOGRAFIA_CHAVE_AES_256`, `DATABASE_URL`, `REDIS_URL`) | Pendente | - | Valores exclusivos, nunca copiados de staging. |
| Credenciais de integracao proprias de producao (Gmail/SMTP, Meta WhatsApp, Google Calendar) | Pendente | - | Enquanto pendente, manter integracao correspondente desativada em producao. |
| Primeiro deploy validado (`/health`, `/health/detalhado`, login) | Pendente | - | Ver criterios em `RUNBOOK_PRODUCAO_ISOLADA.md`. |

## Registro de execucao

Use esta lista para registrar cada passo real conforme for executado (data,
o que foi feito, quem confirmou). Nao inclua valores de secrets.

- 2026-07-23: estrutura da fase (runbook, este controle e validador) criada e
  commitada. Nenhum recurso de infraestrutura provisionado ainda.

## Validacoes pendentes antes do aceite

- [ ] Todos os recursos da tabela acima marcados como `Feito`.
- [ ] `curl https://<backend-producao-url>/health` respondendo `status: ok`.
- [ ] `curl https://<backend-producao-url>/health/detalhado` sem alerta critico.
- [ ] Login validado com usuario criado diretamente em producao.
- [ ] Nenhuma variavel/secret de staging presente no ambiente Render de producao.
- [ ] Nenhum dado do tenant `octaclin-staging` presente no banco de producao.
- [ ] `npm run security:secrets` limpo.

## Decisao de aceite

- Status: pendente.
- Decisao: nao aplicavel ainda (aguardando provisionamento real).
- Responsavel pela decisao final: a definir quando os recursos estiverem
  criados.
- Data: -

## Proximo passo

Usuario cria o projeto Neon de producao e informa apenas que foi criado (sem
colar a URL em texto no chat quando possivel; se precisar compartilhar a
`DATABASE_URL` para rodar as migrations, trate como secret e rotacione depois
se ela aparecer em qualquer lugar nao seguro). Depois disso, seguir a ordem de
`RUNBOOK_PRODUCAO_ISOLADA.md` recurso por recurso, atualizando a tabela acima a
cada etapa concluida.
