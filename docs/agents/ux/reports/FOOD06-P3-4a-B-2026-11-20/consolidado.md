# Consolidado — FOOD06 P3-4a, etapa B (2026-11-20)

Ações protegidas sobre restrição confirmada: reavaliar, inativar em dois passos e "Corrigir registro" (NUX-01 da etapa A).
Entrada: `brief.md` (texto renderizado no celular com dados sintéticos). Modalidade: dois subagentes distintos do runtime, cada um
com só o próprio papel e o brief; não independentes do coordenador; sem pessoas, sem leitor de tela real. Não é validação clínica
nem R4 (a R4 está na PR).

## Sem P0 nem P1

## Corrigido nesta PR (com teste Playwright desktop e mobile)

| Achados | O que mudou | Prova |
| --- | --- | --- |
| NUX-01 | O passo 3 da correção mostra "Anterior: gravidade grave, registrada em 10/11/2026." abaixo da frase decidida; a inativação usa o id da anterior | spec "corrigir registro (NUX-01)" (ordem e id dos pedidos) |
| NUX-02 | Cancelar no passo 3 se chama "Parar a correção aqui" e anuncia "parou no passo 3 … Para concluir, inative a anterior." | spec "parar no passo 3" |
| NUX-03 | Já atendido: os quatro campos vêm da anterior, inclusive a observação (o brief não mostra valores de campos; a observação ausente na lista era do cenário simulado) | spec confere o corpo do registro com a observação |
| NUX-04 | Passo 1 ganhou "Parar a correção aqui"; ele e o fechamento ficam bloqueados enquanto o registro é enviado (também R4 BAIXA 3). "Parar" já ficava desabilitado em "Processando" | código + specs |
| NUX-05 (parte) | Mensagens de parada dizem como concluir | specs de parada |
| NUX-06, NUX-07 (parte) | O passo 2 mostra "Motivo: …"; o erro de justificativa vazia já existia ("Escreva a justificativa.") | spec "inativar em dois passos" |
| NUX-09, PUX-01 | Passo 2 da inativação: "O paciente deixa de ver esta restrição no portal e não recebe aviso automático. Combine como avisá-lo."; passo 3 da correção: texto equivalente para a troca | spec da correção |

## Verificado no código (respostas às perguntas do PUX)

Projeção do portal (`projecao-portal-restricoes.ts`, backend): inativas ficam fora; "em reavaliação" aparece como restrição
registrada, sem o estado; motivo, justificativa, origem e observação nunca vão ao portal; a gravidade é descartada pela projeção web
do portal (Q-E). Logo PUX-02 e PUX-04 não se aplicam hoje. PUX-03: uma pendente criada pela equipe aparece no portal com "Anotado
por quem faz seu acompanhamento; ainda será conferido", então uma correção parada no passo 2 mostra o alimento duas vezes até a
equipe concluir; registrado como BACKLOG (a mensagem de parada já orienta concluir).

## BACKLOG

NUX-05 (vínculo "correção de" na pendente e separar "mudou" de "limite": exigem backend, F6), NUX-07 (contador de caracteres),
NUX-08 (leitura dupla do passo: verificar com leitor de tela, ATV-7), oportunidade de rever o atalho depois de corrigir, PUX-03
(duplicidade temporária no portal), PUX-05 (autoria do relato original, entrada para a P3-5) e operação atômica de "substituir" no
backend (fecha a janela residual da R4 MÉDIA).

## N/A e limites

Paciente: tela da equipe; avaliado o impacto indireto. Leitor de tela real e pessoas: SKIPPED (ATV-7).
