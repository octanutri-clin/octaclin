# OctaClin - Status atual do projeto

Atualizado em 2026-07-26.

## Snapshot

- Produto: OctaClin.
- Repositorio: `octanutri-clin/octaclin`.
- Branch principal: `main`.
- Ultima fase concluida: Fase 133 - Checklist juridico/comercial para clientes (pacote documental entregue em 2026-07-26; revisao juridica externa ainda obrigatoria antes do go-live).
- Fase em andamento: Fase 131 - Producao isolada de staging. Banco Neon, Redis Upstash e servicos Render de producao estao em live; health, Redis, banco e login foram validados em 2026-07-26. Faltam rotacao de credenciais expostas, conferencia formal de isolamento e aceite operacional conforme `PRODUCAO_ISOLADA_CONTROLE.md`.
- Proxima fase preparada: Fase 132 - Dominio, SSL e identidade de envio. A configuracao tecnica de DNS permanece pendente ate a definicao do dominio oficial.
- Estado: producao tecnica acessivel, mas ainda nao liberada para clientes reais.

## O que esta funcional

- Login unificado por perfil.
- Permissoes finas para Client, Professional e Collaborator.
- BFF com cookies HttpOnly.
- Roteamento por papel.
- Console operacional.
- Dashboard inicial do profissional.
- Cadastros de pacientes e profissionais.
- Prontuario/linha do tempo do paciente para profissional.
- Evolucoes/anotacoes clinicas privadas no prontuario.
- Planos de acompanhamento com tarefas/metas/check-ins prescritos no prontuario.
- Biblioteca de materiais educativos e envio de materiais ao paciente pelo prontuario.
- Questionarios, modelos, preview, respostas e leitura clinica.
- Portal autenticado do paciente.
- Historico, perfil, LGPD e protocolos no portal do paciente.
- Portal do cliente.
- Resumo real da conta do cliente.
- Configuracoes da conta do cliente.
- Perfil fiscal da empresa/consultoria do cliente.
- Gestao de usuarios administrativos do cliente.
- Convites administrativos por email.
- Reenvio e revogacao de convites administrativos.
- Historico e exportacao CSV de convites administrativos.
- Modelo de planos SaaS por tenant.
- Calculo de uso, limites e alertas de assinatura no portal do cliente.
- Solicitacao comercial manual de upgrade/revisao de limite no portal do cliente.
- Controle manual administrativo de assinatura no painel operacional.
- Bloqueios suaves de assinatura/limite para novas criacoes de usuarios administrativos e pacientes.
- Agenda interna com integracao Google Calendar.
- Agenda com conflito local por profissional, remarcacao e cancelamento sincronizados com Google Calendar quando configurado.
- Comunicacoes por email.
- WhatsApp Meta com envio, webhook, status, inbox, associacao e notas.
- Painel operacional LGPD.
- Auditoria e outbox operacional.
- Runbooks de producao, backup/restore, rotacao de secrets e suporte.
- Suite Playwright de jornadas criticas com contratos BFF mockados.
- Massa ficticia de staging aplicada e validada no Neon staging (tenant `octaclin-staging`).
- Piloto interno controlado: runbook, controle de acompanhamento, validador documental e rodada 1 aprovada em 2026-07-23.
- Escopo de dados por profissional responsavel (`pacientes_responsaveis`) aplicado e testado em pacientes, agenda, gamificacao, profissionais, questionarios, materiais, comunicacoes e automacoes.
- Producao isolada de staging: banco Neon, Redis Upstash e servicos Render de producao provisionados; a validacao final de runtime, secrets exclusivos e aceite operacional seguem pendentes na Fase 131.
- Sincronizacao em tempo real com a Google Agenda pessoal do profissional (Fase 136, 2026-07-25): conexao OAuth individual por profissional, notificacao push do Google, eventos externos viram bloqueio de horario, mudancas feitas direto no Google aplicam automaticamente na consulta correspondente.
- CI do GitHub verde em `701ed6b` (2026-07-26): backend, web, mobile, IA e demo local smoke, incluindo UI, BFF e Playwright.

## O que ainda falta antes de producao real

- Gateway de pagamento definitivo, se a operacao manual deixar de ser suficiente.
- Recorrencia avancada e importacao inbound do Google Calendar por `syncToken`.
- Restore real em banco dedicado antes do go-live.
- Producao isolada de staging.
- Dominio, SSL e identidade de envio.
- Checklist juridico/comercial.
- Go-live assistido.

## Ambientes e provedores

- GitHub privado como fonte de verdade.
- Render para hospedagem.
- Neon PostgreSQL para banco.
- Upstash Redis para Redis/fila/cache.
- Gmail SMTP/Gmail API para email.
- Meta WhatsApp Cloud API para WhatsApp.
- Google Calendar para agenda.

## Arquivos essenciais

- `AGENTS.md`: guia para agentes de IA.
- `RESUMO_FASES_CONCLUIDAS.md`: retrospectiva.
- `CHECKLIST_FASES_FUTURAS_PRODUCAO.md`: roadmap vivo.
- `PREFLIGHT_PRODUCAO.md`: prontidao por area e gates de fase.
- `HANDOFF-TECNICO-OCTACLIN.md`: handoff tecnico.
- `DECISOES_ARQUITETURA.md`: decisoes.
- `MAPA_ROTAS_PERMISSOES.md`: rotas e permissoes.
- `TESTES_E_VALIDACOES.md`: comandos de validacao.
- `RUNBOOK_PRODUCAO.md`: operacao.
- `RUNBOOK_BACKUP_RESTORE.md`: backup PostgreSQL/Neon e restore de teste.
- `RUNBOOK_SUPORTE.md`: suporte para login, convites, senha, WhatsApp, email e agenda.
- `RUNBOOK_STAGING_DADOS.md`: massa ficticia de staging para demonstracao e QA.
- `RUNBOOK_PILOTO_INTERNO.md`: processo do piloto interno controlado antes da producao real.
- `PILOTO_INTERNO_CONTROLE.md`: acompanhamento vivo da rodada atual do piloto interno.
- `RUNBOOK_PRODUCAO_ISOLADA.md`: como criar banco, Redis e servicos Render de producao separados de staging.
- `PRODUCAO_ISOLADA_CONTROLE.md`: acompanhamento vivo do provisionamento de producao isolada.
- `VARIAVEIS_AMBIENTE.md`: env vars sem secrets.
- `CHECKLIST_GO_LIVE.md`: liberacao para clientes reais.
- `ONBOARDING_DESENVOLVEDOR.md`: entrada de novos desenvolvedores/agentes.
- `COORDENACAO_DESENVOLVIMENTO_IA.md`: regras para trabalho alternado entre pessoas e IAs.
- `PACOTE_PROXIMAS_FASES_DESENVOLVEDOR.md`: pacote multifase para o desenvolvedor seguir enquanto outros agentes ficam pausados.
- `MENSAGEM_HANDOFF_DESENVOLVEDOR.md`: texto pronto para repassar o contexto do projeto.
- `FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md`: ferramentas, plugins e acessos recomendados.
- `DEVELOPMENT_LOG.md`: diario curto de fases concluidas por desenvolvedores/agentes.
- `RETORNO_APOS_DESENVOLVEDOR.md`: checklist para retomada apos trabalho externo.

## Risco principal atual

O sistema ja tem muita capacidade funcional e o piloto interno controlado foi executado e aprovado, mas ainda precisa de restore real em banco dedicado e do provisionamento real da producao isolada de staging (Neon, Upstash e Render de producao) antes de uso comercial com clientes reais.
