# OctaClin - Checklist de go-live

Este checklist deve ser concluido antes de incluir clientes reais de consultoria em producao.

## Produto

- [ ] Fluxo de cliente SaaS validado: login, portal do cliente, usuarios, convites, configuracoes e assinatura.
- [ ] Fluxo de profissional validado: agenda, pacientes, formularios, comunicacoes e acompanhamento.
- [ ] Fluxo de paciente validado: primeiro acesso, portal, perfil, formularios, historico, LGPD e materiais.
- [ ] UX revisada em desktop e mobile.
- [ ] Textos de erro e estados vazios revisados.

## Seguranca

- [x] Secrets de staging e producao separados (Fase 131).
- [x] Nenhum secret rastreado no GitHub na varredura documental corrente (Fase 223).
- [x] `OCTACLIN_COOKIE_SECURE=true` em producao (Fase 229, validacao
  fail-closed e smoke sintetico no build publicado).
- [x] `OCTACLIN_API_ORIGENS_PERMITIDAS` restrito ao backend oficial (Fase 229,
  rota publica rejeita origem externa e ausencia de `Origin`).
- [x] CSP, HSTS, `nosniff`, bloqueio de frames, Referrer Policy e Permissions
  Policy ativos globalmente na web de producao (Fase 229).
- [ ] JWT e refresh secrets fortes e exclusivos.
- [ ] Chave AES forte e exclusiva.
- [x] Rate limiting em login, recuperacao, convites e webhooks sensiveis.
- [ ] Chaves de API e webhooks de aceite revogados; consumidores reais usam
  escopo minimo, cofre de secrets e validacao HMAC em tempo constante.
- [x] Testes negativos multi-tenant nas rotas criticas revisadas.
- [x] Permissoes por papel revisadas, incluindo smoke de quatro papeis (Fase 221).

## LGPD e juridico

- [ ] Politica de privacidade revisada.
- [ ] Termos de uso revisados.
- [ ] Consentimentos versionados.
- [ ] Processo de exportacao de dados testado.
- [ ] Processo de exclusao/anonimizacao definido.
- [ ] Canal de suporte/privacidade definido.
- [ ] Contrato comercial ou termo de consultoria pronto.

Referencia: a Fase 133 entregou minutas e checklists em
`PACOTE_JURIDICO_COMERCIAL.md`; todos os itens desta secao continuam pendentes
ate revisao juridica, dados empresariais finais e publicacao controlada.

## Infraestrutura

Processo de provisionamento em `RUNBOOK_PRODUCAO_ISOLADA.md`, acompanhamento em
`PRODUCAO_ISOLADA_CONTROLE.md` (estrutura entregue em 2026-07-23; recursos
ainda pendentes).

- [x] Producao separada de staging (Fase 131).
- [x] Banco Neon de producao criado.
- [x] Redis Upstash de producao criado.
- [x] Render services de producao configurados.
- [ ] Dominio oficial configurado.
- [ ] SSL ativo.
- [x] Backups configurados conforme `RUNBOOK_BACKUP_RESTORE.md` (Fase 219):
  B2 privado, retencao, checksum, AES256, restore semanal e cron ativo. A Fase
  240 revalidou o fluxo completo no run `31713397791`, incluindo o canario da
  migration `1026` e RLS forcada nas tabelas recentes.
- [x] Restore real testado em banco dedicado (Fase 158, 2026-07-29): dump custom validado, restauracao no Neon dedicado e comparacao de tabelas, RLS e usuarios autenticaveis aprovadas.
- [x] Logs e alertas configurados: logs correlacionados, alertas internos e
  monitor externo de saude/backup da Fase 220 ativos.
- [ ] Runbooks revisados.
- [ ] Suporte treinado com `RUNBOOK_SUPORTE.md`.
- [x] Bucket privado de anexos separado por ambiente, sem acesso publico (Fase 200).
- [x] CORS do bucket exige `if-none-match` e lifecycle de 1 dia cobre apenas `pendentes/`.
- [x] Upload, confirmacao, leitura e exclusao de anexo sintetico validados em producao.

## Integracoes

- [x] Gmail API validada em producao com OAuth renovado e envio controlado.
- [x] Google Calendar validado em producao com `syncToken` e espelhamento inbound.
- [ ] Meta WhatsApp token permanente configurado.
- [ ] Webhook WhatsApp validado.
- [ ] Templates WhatsApp aprovados e mapeados.
- [ ] Envio de lembrete de consulta validado.
- [ ] Recebimento de mensagem WhatsApp validado.
- [ ] Outbox e reprocessamento validados.

## Billing e limites

- [x] Planos definidos.
- [x] Limites por plano aplicados.
- [x] Status de assinatura por tenant.
- [x] Processo manual de pagamento e controle administrativo definido.
- [x] Bloqueios suaves por limite/inadimplencia testados.

## QA

- [x] Suite backend completa passando (122 suites, 829 testes em 2026-08-13) e
  configurada como gate do CI.
- [x] Typecheck backend passando.
- [x] Typecheck web passando.
- [x] Build web passando.
- [x] Testes de autorizacao web passando.
- [x] Playwright visual por areas aprovado nas Fases 198 e 203.
- [x] E2E de jornada critica passando (`pnpm test:e2e:criticas`, 6/6).
- [x] Jornadas E2E mutaveis aprovadas em branch Neon descartavel, com dois
  tenants, role runtime, RLS forcada, Redis/MinIO efemeros e sem envio externo
  (Fase 231, execucao `31731167549`).
- [x] Teste manual com usuario cliente realista.
- [x] Teste manual com profissional realista.
- [x] Smoke autenticado somente leitura do papel `Professional` em producao
  (Fase 221, 2026-08-10).
- [x] Smoke autenticado somente leitura do papel `Client` em producao (Fase
  221, 2026-08-10).
- [x] Smokes autenticados somente leitura dos papeis `SuperAdmin` e `Patient`
  em producao (Fase 221).
- [x] Teste manual com paciente realista.
- [x] Massa ficticia de staging aplicada conforme `RUNBOOK_STAGING_DADOS.md`.

## Operacao

- [ ] Processo de onboarding de novo cliente definido.
- [ ] Processo de suporte de login/convite definido.
- [ ] Processo de falha de email definido.
- [ ] Processo de falha de WhatsApp definido.
- [ ] Processo de falha de agenda definido.
- [ ] Pessoa responsavel por monitoramento definida.
- [ ] Janela de go-live definida.

## Piloto interno

- [x] Piloto interno controlado executado conforme `RUNBOOK_PILOTO_INTERNO.md` (rodada 1, 2026-07-23).
- [x] Todas as jornadas obrigatorias do piloto marcadas em `PILOTO_INTERNO_CONTROLE.md`.
- [x] Nenhum bug P0/P1 aberto ao final do piloto.
- [x] Aceite do piloto registrado em `PILOTO_INTERNO_CONTROLE.md` (aprovado em 2026-07-23).

## Go-live assistido

- [ ] Primeiro cliente piloto selecionado.
- [ ] Dados iniciais revisados.
- [ ] Consentimento/contrato coletado.
- [ ] Convites enviados.
- [ ] Primeira consulta/agendamento testado.
- [ ] Comunicacoes confirmadas.
- [ ] Monitoramento reforcado nas primeiras 48 horas.
- [ ] Feedback coletado e priorizado.
