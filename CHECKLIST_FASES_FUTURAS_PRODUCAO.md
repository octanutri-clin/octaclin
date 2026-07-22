# OctaClin - Checklist vivo de fases futuras ate producao

Atualizado apos a Fase 93.

Este arquivo deve guiar Codex, Claude Code ou qualquer outro agente de IA. Ele deve ser atualizado a cada fase concluida.

## Regras obrigatorias de manutencao

- Ao iniciar uma nova fase, manter o numero da fase e trabalhar em ordem, salvo decisao explicita do usuario.
- Ao concluir uma fase, marcar o item como concluido, registrar commit, data e principais validacoes.
- Ao criar uma fase nova no meio do caminho, inserir aqui antes ou junto do commit da implementacao.
- Ao terminar uma fase, atualizar tambem `RESUMO_FASES_CONCLUIDAS.md` quando a fase virar capacidade consolidada.
- Nao remover itens pendentes sem registrar justificativa.
- Se outro agente assumir, ele deve ler este arquivo, `RESUMO_FASES_CONCLUIDAS.md`, os arquivos `fase-*.md` recentes e o `git log`.

## Definicao de pronto para producao

O OctaClin pode comecar a receber clientes reais de consultoria quando todos os blocos criticos abaixo estiverem concluidos:

- Autenticacao, autorizacao e permissoes finas testadas por papel.
- Portal do cliente capaz de gerenciar conta, usuarios, convites e dados basicos.
- Portal do profissional com rotinas essenciais validadas.
- Portal do paciente com onboarding, formularios, historico e LGPD funcionando.
- Agenda, email e WhatsApp com fluxos confiaveis, observaveis e reprocessaveis.
- Billing/assinatura e limites de plano definidos.
- Monitoramento, backups, logs, alertas e runbooks operacionais ativos.
- Politicas LGPD, seguranca e termos de uso revisados.
- QA E2E de jornadas reais em staging.
- Deploy de producao com dominio, SSL, variaveis e banco separados de staging.

## Proximas fases propostas

### Bloco A - Portal do cliente e administracao SaaS

- [ ] Fase 94 - Perfis e permissoes finas para usuarios administrativos.
  - Separar capacidades de `Client`, `Professional` e `Collaborator`.
  - Criar matriz operacional clara para cliente, profissional, recepcao/assistente e admin interno.
  - Validar rotas backend/BFF/frontend por permissao, nao apenas por papel.
  - Saida esperada: testes de permissao e UI escondendo acoes indevidas.

- [ ] Fase 95 - Configuracoes da conta do cliente.
  - Permitir editar nome da clinica, dados basicos, timezone, idioma e canais padrao.
  - Preparar configuracoes de marca simples: nome exibido, email remetente e identidade visual basica.
  - Saida esperada: tela `Configuracoes` no portal do cliente e endpoint seguro.

- [ ] Fase 96 - Perfil da empresa/consultoria e dados fiscais.
  - Adicionar dados de pessoa juridica/fisica, responsavel, endereco e contatos.
  - Preparar base para notas/recibos futuros, mesmo sem gateway fiscal imediato.
  - Saida esperada: dados persistidos por tenant e auditados.

- [ ] Fase 97 - Convite, reenvio e revogacao com auditoria operacional completa.
  - Evoluir payload atual para tela de historico completo.
  - Exibir quem convidou, quem reenviou, quem revogou e quando.
  - Saida esperada: historico de convites por usuario e exportacao simples.

### Bloco B - Assinaturas, planos e limites

- [ ] Fase 98 - Modelo de planos e limites SaaS.
  - Definir planos: gratuito/teste, profissional, clinica, enterprise.
  - Limites: usuarios, pacientes, envios WhatsApp/email, formularios, armazenamento.
  - Saida esperada: entidade/configuracao de plano por tenant e checagens no backend.

- [ ] Fase 99 - Tela de assinatura e uso no portal do cliente.
  - Mostrar plano atual, consumo, limites e alertas.
  - Preparar CTAs de upgrade sem necessariamente cobrar ainda.
  - Saida esperada: cliente entende seu plano e limites.

- [ ] Fase 100 - Integracao de pagamento sem custo inicial ou gateway definitivo.
  - Escolher estrategia: Stripe, Mercado Pago, Asaas ou controle manual inicial.
  - Para MVP, permitir assinatura manual administrativa se gateway atrasar.
  - Saida esperada: status de assinatura confiavel por tenant.

- [ ] Fase 101 - Bloqueios suaves por inadimplencia/limite.
  - Alertas antes de bloquear.
  - Bloqueio de novas acoes sem impedir acesso a dados essenciais.
  - Saida esperada: regras de negocio testadas e mensagens claras.

### Bloco C - Jornada do profissional e rotina clinica

- [ ] Fase 102 - Dashboard inicial do profissional.
  - Resumo de agenda, pacientes recentes, formularios pendentes e mensagens.
  - Saida esperada: primeira tela util para atendimento diario.

- [ ] Fase 103 - Prontuario/linha do tempo do paciente para profissional.
  - Consolidar dados do paciente, formularios, respostas, mensagens e agenda.
  - Saida esperada: visao longitudinal para consultoria.

- [ ] Fase 104 - Evolucoes/anotacoes clinicas.
  - Criar notas privadas do profissional com historico e auditoria.
  - Saida esperada: registro de consulta e acompanhamento.

- [ ] Fase 105 - Planos de acompanhamento e tarefas do paciente.
  - Metas, tarefas, materiais e check-ins.
  - Saida esperada: profissional consegue prescrever acompanhamento entre consultas.

- [ ] Fase 106 - Biblioteca de materiais e envio ao paciente.
  - PDFs, links, orientacoes e materiais por categoria.
  - Saida esperada: materiais reutilizaveis e visiveis no portal do paciente.

### Bloco D - Agenda, comunicacoes e automacoes

- [ ] Fase 107 - Agenda de producao.
  - Conflitos, remarcacao, cancelamento, recorrencia e disponibilidade.
  - Sincronizacao bidirecional minima com Google Calendar.
  - Saida esperada: agenda confiavel para uso real.

- [ ] Fase 108 - Templates aprovados e mapeamento Meta WhatsApp.
  - Mapear templates aprovados manualmente na Meta.
  - Criar configuracao no OctaClin para usar templates corretos por evento.
  - Saida esperada: lembrete de consulta e comunicacoes transacionais por WhatsApp.

- [ ] Fase 109 - Automacoes de lembrete e confirmacao de consulta.
  - Lembretes por email/WhatsApp.
  - Confirmacao, cancelamento e reagendamento.
  - Saida esperada: automacao operacional com logs e reprocessamento.

- [ ] Fase 110 - Preferencias de comunicacao por paciente.
  - Opt-in/opt-out, canal preferido e horarios.
  - Saida esperada: comunicacoes respeitam consentimento e preferencia.

- [ ] Fase 111 - Central de falhas de comunicacao.
  - Reprocessar falhas de email, WhatsApp, calendario e outbox.
  - Saida esperada: painel operacional para suporte.

### Bloco E - Portal do paciente pronto para clientes reais

- [ ] Fase 112 - UX final do primeiro acesso do paciente.
  - Melhorar copy, telas de erro, expiracao de convite e recuperacao.
  - Saida esperada: paciente consegue entrar sem suporte manual.

- [ ] Fase 113 - Area de tarefas e materiais no portal do paciente.
  - Tarefas, metas, materiais enviados e status.
  - Saida esperada: paciente acompanha o plano entre consultas.

- [ ] Fase 114 - Check-ins e diario rapido de acompanhamento.
  - Check-ins simples, humor, adesao, sintomas e observacoes.
  - Saida esperada: dados acionaveis para o profissional.

- [ ] Fase 115 - Notificacoes do paciente.
  - Historico de notificacoes recebidas e pendentes.
  - Saida esperada: transparencia e reducao de mensagens perdidas.

### Bloco F - LGPD, seguranca e compliance

- [ ] Fase 116 - Politicas, termos e consentimentos versionados.
  - Termos de uso, politica de privacidade e consentimentos por versao.
  - Saida esperada: aceite rastreavel por perfil.

- [ ] Fase 117 - Retencao e exclusao programada de dados.
  - Politicas de retencao por tipo de dado.
  - Saida esperada: base para governanca LGPD real.

- [ ] Fase 118 - Exportacao LGPD completa por titular.
  - Consolidar dados de paciente/usuario em pacote exportavel.
  - Saida esperada: exportacao robusta e auditavel.

- [ ] Fase 119 - Hardening de secrets e variaveis.
  - Conferir que nenhuma chave foi commitada.
  - Documentar rotacao de tokens Meta, Gmail, OpenAI e banco.
  - Saida esperada: checklist de seguranca operacional.

- [ ] Fase 120 - Rate limiting, lockout e protecoes anti-abuso.
  - Login, recuperacao de senha, convites e APIs sensiveis.
  - Saida esperada: protecao basica contra abuso.

- [ ] Fase 121 - Revisao de autorizacao multi-tenant.
  - Testes negativos para vazamento cross-tenant.
  - Saida esperada: suite de seguranca tenant-aware.

### Bloco G - Observabilidade, operacao e suporte

- [ ] Fase 122 - Monitoramento e healthchecks de producao.
  - Health detalhado para backend, banco, Redis, email, WhatsApp e Calendar.
  - Saida esperada: painel/check automatizavel.

- [ ] Fase 123 - Logs estruturados e correlacao.
  - Request ID, tenant ID seguro, usuario e acao.
  - Saida esperada: diagnostico mais rapido sem expor PII.

- [ ] Fase 124 - Alertas operacionais.
  - Alertas para falha de deploy, queda de servico, filas paradas e falhas de integracao.
  - Saida esperada: notificacao proativa.

- [ ] Fase 125 - Backups e restore testado.
  - Politica Neon/Postgres, periodicidade e teste real de restore.
  - Saida esperada: runbook de recuperacao.

- [ ] Fase 126 - Runbooks de suporte.
  - Login, convite, falha WhatsApp, falha email, falha agenda, recuperacao de senha.
  - Saida esperada: manual operacional para atendimento.

### Bloco H - QA, dados reais e go-live

- [ ] Fase 127 - Suite E2E de jornadas criticas.
  - Cliente cria usuario, profissional cria paciente, paciente acessa portal, consulta agenda e comunicacao dispara.
  - Saida esperada: Playwright/API cobrindo jornada real.

- [ ] Fase 128 - Staging com dados realistas.
  - Criar massa de dados sem PII real.
  - Saida esperada: ambiente para demonstracao e QA.

- [ ] Fase 129 - Piloto interno controlado.
  - Usar com poucos clientes ficticios/reais autorizados.
  - Registrar problemas e ajustar.
  - Saida esperada: lista de bugs de piloto zerada ou aceita.

- [ ] Fase 130 - Producao isolada de staging.
  - Banco, Redis, Render service/env, dominio e secrets separados.
  - Saida esperada: ambiente de producao independente.

- [ ] Fase 131 - Dominio, SSL e identidade de envio.
  - Dominio oficial, remetente, SPF/DKIM/DMARC quando aplicavel.
  - Saida esperada: comunicacoes confiaveis e marca consistente.

- [ ] Fase 132 - Checklist juridico/comercial para clientes.
  - Termos, politica, contrato de consultoria, suporte e SLA basico.
  - Saida esperada: pronto para convidar clientes de consultoria.

- [ ] Fase 133 - Go-live assistido.
  - Ativar primeiros clientes reais.
  - Monitorar logs, mensagens, agenda e suporte diariamente.
  - Saida esperada: OctaClin em producao acompanhada.

- [ ] Fase 134 - Pos-go-live e melhoria continua.
  - Coletar feedback, priorizar bugs, acompanhar custos e performance.
  - Saida esperada: backlog de evolucao pos-producao.

## Backlog pos-producao

- App mobile real ou PWA avancado.
- IA clinica com guardrails e revisao humana.
- Relatorios financeiros e de performance por cliente.
- Marketplace de modelos de questionarios.
- White-label por clinica.
- Multi-unidade por tenant.
- Integracoes adicionais: Outlook Calendar, meios de pagamento locais, CRM e BI.

## Registro de conclusao de fases futuras

Use o formato abaixo ao concluir uma fase:

```text
Fase XXX - Nome:
- Status: concluida
- Commit: <hash>
- Data: YYYY-MM-DD
- Validacoes: <comandos principais>
- Observacoes: <decisoes ou pendencias>
```
