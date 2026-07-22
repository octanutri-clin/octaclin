# OctaClin - Status atual do projeto

Atualizado em 2026-07-22.

## Snapshot

- Produto: OctaClin.
- Repositorio: `octanutri-clin/octaclin`.
- Branch principal: `main`.
- Ultima fase concluida: Fase 94 - Preflight de producao.
- Proxima fase planejada: Fase 95 - Perfis e permissoes finas para usuarios administrativos.
- Estado: staging funcional avancado, ainda nao liberado para clientes reais.

## O que esta funcional

- Login unificado por perfil.
- BFF com cookies HttpOnly.
- Roteamento por papel.
- Console operacional.
- Cadastros de pacientes e profissionais.
- Questionarios, modelos, preview, respostas e leitura clinica.
- Portal autenticado do paciente.
- Historico, perfil, LGPD e protocolos no portal do paciente.
- Portal do cliente.
- Resumo real da conta do cliente.
- Gestao de usuarios administrativos do cliente.
- Convites administrativos por email.
- Reenvio e revogacao de convites administrativos.
- Agenda interna com integracao Google Calendar.
- Comunicacoes por email.
- WhatsApp Meta com envio, webhook, status, inbox, associacao e notas.
- Painel operacional LGPD.
- Auditoria e outbox operacional.

## O que ainda falta antes de producao real

- Fase 95: permissoes finas por perfil administrativo.
- Configuracoes da conta do cliente.
- Planos, limites e assinatura.
- Dashboard do profissional.
- Prontuario/linha do tempo clinica do paciente para profissional.
- Evolucoes clinicas e tarefas/materiais.
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

## Risco principal atual

O sistema ja tem muita capacidade funcional, mas ainda precisa de endurecimento de permissoes, observabilidade, billing/limites, QA E2E e producao isolada antes de uso comercial com clientes reais.
