# SLA de suporte - operacao assistida

## Status

Este documento define o atendimento operacional usado no onboarding assistido
e nos pilotos. Os tempos so se tornam garantia contratual depois de aprovacao
comercial e juridica e incorporacao ao contrato do cliente.

## Canais e escopo

- Canal temporario oficial: `octaclinsys@gmail.com`, ate a ativacao do dominio
  proprio e do portal de suporte previstos na Fase 225.
- Horario padrao: segunda a sexta-feira, das 09:00 as 18:00, no fuso
  `America/Sao_Paulo`, exceto feriados nacionais.
- Responsavel primario: funcao `Responsavel operacional OctaClin`. A escala
  deve indicar uma pessoa titular e uma substituta sem registrar telefone ou
  credencial neste repositorio.
- O suporte atende acesso, convite, agenda, comunicacoes, incidentes e uso da
  plataforma; nao fornece orientacao clinica, juridica ou acesso sem autorizacao.
- A evidencia minima e definida em `RUNBOOK_SUPORTE.md` e deve ser sanitizada.

## Severidades propostas

| Nivel | Exemplo | Primeira resposta | Atualizacao |
| --- | --- | --- | --- |
| P0 | indisponibilidade geral, suspeita de vazamento ou perda de dados | ate 1 hora util | a cada 2 horas enquanto ativo |
| P1 | funcionalidade critica indisponivel para um tenant sem alternativa | ate 4 horas uteis | diaria em dias uteis |
| P2 | defeito com alternativa operacional ou degradacao limitada | ate 1 dia util | a cada 3 dias uteis |
| P3 | duvida, melhoria ou ajuste sem impacto operacional | ate 3 dias uteis | conforme priorizacao |

## Regras

- O primeiro retorno confirma recebimento e classificacao; nao e prazo de resolucao.
- Incidentes de seguranca seguem contrato/anexo de privacidade aprovado.
- Nenhum atendente deve solicitar senhas, tokens ou dados clinicos desnecessarios.
- P0 e encaminhado imediatamente ao responsavel tecnico e ao responsavel de
  privacidade; nenhuma alteracao manual em producao e feita sem runbook.
- P1 e escalonado ao responsavel tecnico apos a triagem inicial, ou antes se nao
  houver alternativa operacional segura.
- P2 e P3 entram no backlog com evidencia sanitizada e responsavel definido.
- Fora do horario padrao, o recebimento e registrado e o prazo inicia na proxima
  janela util, salvo escala extraordinaria acordada por escrito.
