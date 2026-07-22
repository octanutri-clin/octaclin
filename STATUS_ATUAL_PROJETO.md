# OctaClin - Status atual do projeto

Atualizado em 2026-07-22.

## Snapshot

- Produto: OctaClin.
- Repositorio: `octanutri-clin/octaclin`.
- Branch principal: `main`.
- Ultima fase concluida: Fase 105 - Evolucoes/anotacoes clinicas.
- Proxima fase planejada: Fase 106 - Planos de acompanhamento e tarefas do paciente.
- Estado: staging funcional avancado, ainda nao liberado para clientes reais.

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
- Comunicacoes por email.
- WhatsApp Meta com envio, webhook, status, inbox, associacao e notas.
- Painel operacional LGPD.
- Auditoria e outbox operacional.

## O que ainda falta antes de producao real

- Gateway de pagamento definitivo, se a operacao manual deixar de ser suficiente.
- Tarefas/materiais.
- Agenda de producao com remarcacao, cancelamento e conflitos maduros.
- Templates WhatsApp aprovados mapeados no OctaClin.
- Automacoes de lembrete/confirmacao.
- Politicas, termos e consentimentos versionados.
- Hardening de secrets, rate limiting e revisao multi-tenant.
- Monitoramento, backups, restore e alertas.
- Producao isolada de staging.
- QA E2E das jornadas criticas.
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
- `VARIAVEIS_AMBIENTE.md`: env vars sem secrets.
- `CHECKLIST_GO_LIVE.md`: liberacao para clientes reais.
- `ONBOARDING_DESENVOLVEDOR.md`: entrada de novos desenvolvedores/agentes.
- `COORDENACAO_DESENVOLVIMENTO_IA.md`: regras para trabalho alternado entre pessoas e IAs.
- `FERRAMENTAS_E_PLUGINS_RECOMENDADOS.md`: ferramentas, plugins e acessos recomendados.

## Risco principal atual

O sistema ja tem muita capacidade funcional, mas ainda precisa de revisao multi-tenant ampla, observabilidade, tarefas/materiais, QA E2E e producao isolada antes de uso comercial com clientes reais.
