# OctaClin - Controle do piloto interno controlado

Este arquivo acompanha a execucao do piloto interno descrito em `RUNBOOK_PILOTO_INTERNO.md`. Atualize-o a cada rodada real do piloto. Nao registre dados reais de clientes/pacientes nem secrets aqui.

## Status atual

- Status: nao iniciado.
- Rodada: nenhuma ate o momento.
- Data de inicio: pendente.
- Data de encerramento: pendente.
- Ambiente: staging, tenant `octaclin-staging`.

## Participantes

| Perfil | Responsavel | Contato interno |
| --- | --- | --- |
| Responsavel tecnico | pendente | pendente |
| Cliente | pendente | pendente |
| Profissional | pendente | pendente |
| Paciente | pendente | pendente |
| Suporte/operador | pendente | pendente |

## Checklist de jornadas executadas

- [ ] Cliente convida usuario administrativo e usuario ativa convite.
- [ ] Cliente revisa configuracoes, perfil fiscal e assinatura/uso.
- [ ] Profissional cadastra paciente e registra evolucao clinica.
- [ ] Profissional prescreve plano de acompanhamento e envia material.
- [ ] Profissional agenda consulta com email/WhatsApp/Google Calendar.
- [ ] Profissional remarca e cancela consulta sincronizada.
- [ ] Paciente acessa portal, responde formulario e registra check-in.
- [ ] Paciente consulta notificacoes/tarefas e exporta dados LGPD.
- [ ] Suporte/operador revisa console operacional e central de falhas.
- [ ] Suporte/operador simula atendimento de login/convite.
- [ ] `pnpm test:e2e:criticas` executado nesta rodada.

## Registro de bugs

| ID | Data | Perfil/jornada | Severidade | Descricao | Status |
| --- | --- | --- | --- | --- | --- |
| - | - | - | - | Nenhum bug registrado ainda. | - |

## Decisao de aceite

- Status: pendente.
- Criterios de sucesso atendidos: pendente de avaliacao.
- Criterios de bloqueio observados: nenhum ate o momento.
- Decisao: pendente (aprovado / aprovado com ressalvas / reprovado).
- Aprovado por: pendente.
- Data da decisao: pendente.

## Proximo passo

Preparar a primeira rodada real do piloto: definir participantes, aplicar a massa de staging (`RUNBOOK_STAGING_DADOS.md`) e agendar a execucao das jornadas listadas acima.
