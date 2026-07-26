# SLA de suporte - proposta operacional

## Status

Esta e uma proposta operacional. Os tempos abaixo nao constituem garantia
contratual ate aprovacao comercial e juridica, incorporacao ao contrato e
definicao de horario/canal oficial.

## Canais e escopo

- Canal oficial: `[email ou portal de suporte]`.
- Horario padrao: `[dias e horario em America/Sao_Paulo]`.
- O suporte atende acesso, convite, agenda, comunicacoes, incidentes e uso da
  plataforma; nao fornece orientacao clinica, juridica ou acesso sem autorizacao.
- A evidencia minima e definida em `RUNBOOK_SUPORTE.md` e deve ser sanitizada.

## Severidades propostas

| Nivel | Exemplo | Primeiro retorno | Atualizacao |
| --- | --- | --- | --- |
| P1 | indisponibilidade geral, risco de vazamento ou perda de dados | ate 1 hora no horario acordado | a cada 2 horas enquanto ativo |
| P2 | funcionalidade critica indisponivel para um tenant sem alternativa | ate 4 horas uteis | diaria em dias uteis |
| P3 | defeito com alternativa operacional ou degradacao limitada | ate 1 dia util | a cada 3 dias uteis |
| P4 | duvida, melhoria ou ajuste sem impacto operacional | ate 3 dias uteis | conforme priorizacao |

## Regras

- O primeiro retorno confirma recebimento e classificacao; nao e prazo de resolucao.
- Incidentes de seguranca seguem contrato/anexo de privacidade aprovado.
- Nenhum atendente deve solicitar senhas, tokens ou dados clinicos desnecessarios.
