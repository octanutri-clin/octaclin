# OctaClin - Runbook de piloto interno controlado

Este runbook descreve como conduzir o piloto interno do OctaClin antes de qualquer cliente real de consultoria. O piloto usa apenas contas ficticias/autorizadas em staging, nunca dados reais de pacientes ou clientes.

## Objetivo

Validar as jornadas criticas do produto com pessoas internas simulando cada perfil, registrar problemas encontrados e decidir formalmente se o OctaClin esta pronto para avancar para producao isolada (Fase 131) ou se precisa de correcoes antes disso.

## Quem participa

- Um responsavel tecnico que acompanha o piloto ponta a ponta e decide o aceite final.
- Pelo menos uma pessoa por perfil simulado: cliente, profissional, paciente e suporte/operador. A mesma pessoa pode assumir mais de um perfil se a equipe for pequena.
- Nenhum cliente real de consultoria participa desta fase.
- Todos os participantes devem usar apenas contas ficticias do tenant `octaclin-staging` (ver `RUNBOOK_STAGING_DADOS.md`) ou contas internas criadas exclusivamente para o piloto.

## Perfis a testar

- **Cliente**: portal do cliente, usuarios administrativos, convites, configuracoes, perfil fiscal e assinatura/uso.
- **Profissional**: dashboard, pacientes, prontuario, evolucoes clinicas, planos de acompanhamento, materiais, agenda e comunicacoes.
- **Paciente**: primeiro acesso, portal autenticado, formularios, tarefas/materiais, check-ins, notificacoes e LGPD.
- **Suporte/operador**: console operacional, alertas, central de falhas de comunicacao e LGPD operacional, usando `RUNBOOK_SUPORTE.md` como guia de atendimento.

## Ambiente e dados

- O piloto roda inteiramente em staging, nunca em producao.
- Aplique a massa ficticia antes de comecar, seguindo `RUNBOOK_STAGING_DADOS.md`:

```powershell
$env:DATABASE_URL='<url do Neon staging>'
pnpm seed:staging
```

- Confirme saude do ambiente antes de iniciar:

```powershell
curl https://<backend-staging-url>/health
curl https://<backend-staging-url>/health/detalhado
```

## Jornadas a executar

No minimo, execute manualmente cada jornada abaixo com o perfil correspondente, alem de rodar a suite automatizada:

```powershell
pnpm test:e2e:criticas
```

Jornadas manuais obrigatorias:

1. Cliente convida um novo usuario administrativo e o usuario ativa o convite.
2. Cliente revisa configuracoes da conta, perfil fiscal e resumo de assinatura/uso.
3. Profissional cadastra um paciente e registra evolucao clinica no prontuario.
4. Profissional prescreve tarefa/plano de acompanhamento e envia material educativo.
5. Profissional agenda uma consulta e confirma disparo de email/WhatsApp e sincronizacao com Google Calendar.
6. Profissional remarca e cancela uma consulta e confirma atualizacao no Google Calendar.
7. Paciente acessa o portal pela primeira vez, revisa historico, responde formulario e registra check-in.
8. Paciente consulta notificacoes, tarefas/materiais e realiza exportacao LGPD dos proprios dados.
9. Suporte/operador usa o console operacional para revisar alertas e a central de falhas de comunicacao.
10. Suporte/operador simula um atendimento de login/convite seguindo `RUNBOOK_SUPORTE.md`.

## Como registrar bugs

Registre todo problema encontrado em `PILOTO_INTERNO_CONTROLE.md`, na tabela de bugs, com:

- data e horario;
- perfil e jornada afetados;
- severidade (mesma escala do `RUNBOOK_SUPORTE.md`: P0, P1, P2, P3);
- descricao objetiva do problema;
- evidencia sanitizada (`requestId`, log ou print sem dado sensivel);
- status (aberto, em correcao, corrigido, aceito com ressalva).

Nao registre senha, token, refresh token, chave de API ou dado clinico completo em nenhum registro de bug. Se um secret aparecer durante o piloto, siga `RUNBOOK_ROTACAO_SECRETS.md` antes de continuar.

## Criterios de sucesso

- Todas as jornadas manuais listadas foram executadas ao menos uma vez por perfil.
- `pnpm test:e2e:criticas` passou na mesma rodada do piloto.
- Nenhum bug com severidade P0 ou P1 permanece aberto ao final do periodo do piloto.
- Bugs P2 remanescentes tem plano de correcao ou aceite explicito de risco.
- Console operacional nao mostra alerta critico nao tratado ao encerrar o piloto.

## Criterios de bloqueio

O piloto deve ser interrompido e a Fase 131 nao deve iniciar se ocorrer qualquer um dos itens abaixo:

- Vazamento ou acesso cross-tenant a dados de outro tenant.
- Exposicao de secret, token, senha ou credencial em log, chamado ou commit.
- Perda de dados sem backup/restore disponivel.
- Falha de autenticacao/autorizacao que permita acesso indevido a perfil diferente do esperado.
- Qualquer bug aberto com severidade P0 sem mitigacao imediata.

Se um criterio de bloqueio ocorrer, pause o piloto, registre o incidente em `PILOTO_INTERNO_CONTROLE.md` e siga o runbook relacionado (`RUNBOOK_ROTACAO_SECRETS.md`, `RUNBOOK_BACKUP_RESTORE.md` ou `RUNBOOK_SUPORTE.md`, conforme o caso) antes de retomar.

## Como decidir aceite do piloto

1. Revisar a tabela de bugs em `PILOTO_INTERNO_CONTROLE.md` e confirmar que os criterios de sucesso foram atingidos.
2. Confirmar que nenhum criterio de bloqueio ficou em aberto.
3. O responsavel tecnico registra a decisao final em `PILOTO_INTERNO_CONTROLE.md`: aprovado, aprovado com ressalvas ou reprovado.
4. Se aprovado, atualizar `CHECKLIST_GO_LIVE.md`, `PREFLIGHT_PRODUCAO.md` e `STATUS_ATUAL_PROJETO.md` e liberar o inicio da Fase 131 - Producao isolada de staging.
5. Se reprovado, listar as pendencias bloqueantes e manter o projeto na Fase 130 ate a proxima rodada do piloto.

## Runbooks relacionados

- `RUNBOOK_STAGING_DADOS.md` para preparar o ambiente e os dados ficticios.
- `RUNBOOK_SUPORTE.md` para o perfil de suporte/operador.
- `RUNBOOK_BACKUP_RESTORE.md` para incidentes de dados durante o piloto.
- `RUNBOOK_ROTACAO_SECRETS.md` para qualquer exposicao de credencial.
- `CHECKLIST_GO_LIVE.md` para a liberacao final de clientes reais.
- `PILOTO_INTERNO_CONTROLE.md` para o acompanhamento vivo desta rodada de piloto.
