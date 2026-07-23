# OctaClin - Checklist de go-live

Este checklist deve ser concluido antes de incluir clientes reais de consultoria em producao.

## Produto

- [ ] Fluxo de cliente SaaS validado: login, portal do cliente, usuarios, convites, configuracoes e assinatura.
- [ ] Fluxo de profissional validado: agenda, pacientes, formularios, comunicacoes e acompanhamento.
- [ ] Fluxo de paciente validado: primeiro acesso, portal, perfil, formularios, historico, LGPD e materiais.
- [ ] UX revisada em desktop e mobile.
- [ ] Textos de erro e estados vazios revisados.

## Seguranca

- [ ] Secrets de staging e producao separados.
- [ ] Nenhum secret no GitHub.
- [ ] `OCTACLIN_COOKIE_SECURE=true` em producao.
- [ ] `OCTACLIN_API_ORIGENS_PERMITIDAS` restrito ao backend oficial.
- [ ] JWT e refresh secrets fortes e exclusivos.
- [ ] Chave AES forte e exclusiva.
- [ ] Rate limiting em login, recuperacao, convites e webhooks sensiveis.
- [ ] Testes negativos multi-tenant.
- [ ] Permissoes por papel revisadas.

## LGPD e juridico

- [ ] Politica de privacidade revisada.
- [ ] Termos de uso revisados.
- [ ] Consentimentos versionados.
- [ ] Processo de exportacao de dados testado.
- [ ] Processo de exclusao/anonimizacao definido.
- [ ] Canal de suporte/privacidade definido.
- [ ] Contrato comercial ou termo de consultoria pronto.

## Infraestrutura

- [ ] Producao separada de staging.
- [ ] Banco Neon de producao criado.
- [ ] Redis Upstash de producao criado.
- [ ] Render services de producao configurados.
- [ ] Dominio oficial configurado.
- [ ] SSL ativo.
- [ ] Backups configurados conforme `RUNBOOK_BACKUP_RESTORE.md`.
- [ ] Restore testado em banco dedicado com `validar-backup-restore.ps1 -RestoreTeste`.
- [ ] Logs e alertas configurados.
- [ ] Runbooks revisados.
- [ ] Suporte treinado com `RUNBOOK_SUPORTE.md`.

## Integracoes

- [ ] Gmail/SMTP ou Gmail API validado em producao.
- [ ] Google Calendar validado em producao.
- [ ] Meta WhatsApp token permanente configurado.
- [ ] Webhook WhatsApp validado.
- [ ] Templates WhatsApp aprovados e mapeados.
- [ ] Envio de lembrete de consulta validado.
- [ ] Recebimento de mensagem WhatsApp validado.
- [ ] Outbox e reprocessamento validados.

## Billing e limites

- [ ] Planos definidos.
- [ ] Limites por plano aplicados.
- [ ] Status de assinatura por tenant.
- [ ] Processo de pagamento ou controle manual definido.
- [ ] Bloqueios suaves por limite/inadimplencia testados.

## QA

- [ ] Suite backend focada passando.
- [ ] Typecheck backend passando.
- [ ] Typecheck web passando.
- [ ] Build web passando.
- [ ] Testes de autorizacao web passando.
- [ ] Playwright visual passando.
- [ ] E2E de jornada critica passando.
- [ ] Teste manual com usuario cliente realista.
- [ ] Teste manual com profissional realista.
- [ ] Teste manual com paciente realista.
- [ ] Massa ficticia de staging aplicada conforme `RUNBOOK_STAGING_DADOS.md`.

## Operacao

- [ ] Processo de onboarding de novo cliente definido.
- [ ] Processo de suporte de login/convite definido.
- [ ] Processo de falha de email definido.
- [ ] Processo de falha de WhatsApp definido.
- [ ] Processo de falha de agenda definido.
- [ ] Pessoa responsavel por monitoramento definida.
- [ ] Janela de go-live definida.

## Go-live assistido

- [ ] Primeiro cliente piloto selecionado.
- [ ] Dados iniciais revisados.
- [ ] Consentimento/contrato coletado.
- [ ] Convites enviados.
- [ ] Primeira consulta/agendamento testado.
- [ ] Comunicacoes confirmadas.
- [ ] Monitoramento reforcado nas primeiras 48 horas.
- [ ] Feedback coletado e priorizado.
