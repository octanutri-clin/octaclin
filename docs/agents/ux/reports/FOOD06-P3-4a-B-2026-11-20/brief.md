# Brief sintético — FOOD06 P3-4a, etapa B

Ações protegidas sobre restrição **confirmada** na aba "Restrições" do prontuário, para a equipe. Base: branch
`claude/food06-p3-4-acoes-protegidas` sobre `main` (commit `cd9783cc` + mudanças não commitadas desta etapa). Dados sintéticos; BFF
simulado; flag desligada.

Regras já decididas (não reabrir por gosto):
- Só o profissional com a permissão clínica vê estas ações; o backend decide sob lock.
- Inativar é em dois passos (Q3): motivo e justificativa, depois a frase "Você está inativando {tipo} confirmada: {alimento}. O
  histórico é preservado." e o botão "Inativar {tipo}". Não exige nova senha.
- A justificativa de inativar tem até 1000 caracteres, sem quebra de linha (regra do backend); quebras viram espaço.
- "Corrigir registro" (NUX-01, Q-I): registrar a corrigida → confirmar a corrigida → só então inativar a anterior. Cada passo é um
  clique; se um passo falha, a anterior continua valendo e a tela diz onde parou.
- Reavaliar: "Marcar para reavaliação" deixa a restrição valendo; "Manter como confirmada" encerra a reavaliação.
- Restrição inativa não aparece no portal do paciente (comportamento do backend, já existente). O paciente não é avisado
  automaticamente.
- Reconfirmação de 180 dias fica para a P3-4b; solicitações do paciente, para a P3-5.

Evidência: texto renderizado no Chromium, celular Pixel 5, dados sintéticos.

## Aba com restrições confirmadas (ações protegidas)

Confirmadas (2)

Amendoim

Alergia alimentar · Gravidade: Grave

Confirmada · Registrada por colaborador · Registrada em 10/11/2026

Observação da equipe: Reação relatada na infância (sintético)

Marcar para reavaliação
Corrigir registro
Inativar

Carne vermelha

Escolha alimentar

Confirmada · Registrada por profissional · Registrada em 10/11/2026

Marcar para reavaliação
Corrigir registro
Inativar

## Diálogo: marcar para reavaliação

Marcar alergia alimentar: Amendoim para reavaliação?

A restrição continua valendo enquanto é reavaliada.

Voltar
Marcar para reavaliação

## Inativar, passo 1 (enviado vazio)

Inativar alergia alimentar: Amendoim?

Use quando a restrição deixou de valer. Para trocar tipo, alimento ou gravidade, prefira "Corrigir registro".

MOTIVO
Escolha o motivo
Registro incorreto
Informação clínica revisada
Solicitação fundamentada do paciente
Outro

Escolha o motivo.

JUSTIFICATIVA (SÓ A EQUIPE VÊ)

Escreva a justificativa. Obrigatória. Até 1000 caracteres. Quebras de linha viram espaço.

Voltar
Continuar

## Inativar, passo 2

Inativar alergia alimentar: Amendoim?

Você está inativando alergia alimentar confirmada: Amendoim. O histórico é preservado.

Voltar
Inativar alergia alimentar

## Corrigir registro, passo 1

Corrigir alergia alimentar: Amendoim

A restrição atual continua valendo até a nova estar confirmada. São três passos: registrar a nova, confirmá-la e inativar a atual.

Passo 1 de 3: Registrar a restrição corrigida
Passo 2 de 3: Confirmar a restrição corrigida
Passo 3 de 3: Inativar a restrição anterior
Passo 1 de 3: Registrar a restrição corrigida

O registro fica para conferência; confirmar é um passo separado.

TIPO
Escolha o tipo
Alergia alimentar
Intolerância alimentar
Doença ou condição com restrição (ex.: doença celíaca)
Outra restrição clínica
Escolha alimentar
ALIMENTO OU ITEM

Até 200 caracteres.

GRAVIDADE
Não informada
Leve
Moderada
Grave
OBSERVAÇÃO (OPCIONAL, SÓ A EQUIPE VÊ)

Até 1000 caracteres. Quebras de linha viram espaço.

Registrar a corrigida

## Corrigir registro, passo 2

Corrigir alergia alimentar: Amendoim

A restrição atual continua valendo até a nova estar confirmada. São três passos: registrar a nova, confirmá-la e inativar a atual.

Passo 1 de 3: Registrar a restrição corrigida (feito)
Passo 2 de 3: Confirmar a restrição corrigida
Passo 3 de 3: Inativar a restrição anterior
Passo 2 de 3: Confirmar a restrição corrigida

A restrição corrigida foi registrada. Confirme-a para seguir.

Parar a correção aqui
Confirmar a corrigida

## Corrigir registro, passo 3

Corrigir alergia alimentar: Amendoim

A restrição atual continua valendo até a nova estar confirmada. São três passos: registrar a nova, confirmá-la e inativar a atual.

Passo 1 de 3: Registrar a restrição corrigida (feito)
Passo 2 de 3: Confirmar a restrição corrigida
Passo 3 de 3: Inativar a restrição anterior
Passo 2 de 3: Confirmar a restrição corrigida

A restrição corrigida foi registrada. Confirme-a para seguir.

Parar a correção aqui
Processando

## Corrigir registro, passo 3 (confirmação)

Corrigir alergia alimentar: Amendoim

A restrição atual continua valendo até a nova estar confirmada. São três passos: registrar a nova, confirmá-la e inativar a atual.

Passo 1 de 3: Registrar a restrição corrigida (feito)
Passo 2 de 3: Confirmar a restrição corrigida (feito)
Passo 3 de 3: Inativar a restrição anterior
Passo 3 de 3: Inativar a restrição anterior

A restrição corrigida foi confirmada. Agora inative a anterior.

Você está inativando alergia alimentar confirmada: Amendoim. O histórico é preservado.

Voltar
Inativar alergia alimentar

## Depois da correção (aviso e lista)

Restrições alimentares

Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever.

Correção concluída: a restrição anterior (alergia alimentar: Amendoim) foi inativada e a corrigida está confirmada.

Ir para registrar restrição

Conferência geral das restrições

1 registro ainda aguarda conferência.

A conferência geral das restrições deste paciente ainda não foi iniciada.

Iniciar não confere nenhuma restrição: só abre o registro usado para reconfirmar as restrições com o paciente.

Iniciar conferência
Para conferir (1)

Leite

Tipo não informado pelo paciente

Pendente de conferência · Informada pelo paciente ou responsável · Registrada em 10/11/2026

Confirmar
Rejeitar
Confirmadas (2)

Carne vermelha

Escolha alimentar

Confirmada · Registrada por profissional · Registrada em 10/11/2026

Marcar para reavaliação
Corrigir registro
Inativar

Amendoim

Alergia alimentar · Gravidade: Moderada

Confirmada · Registrada por profissional · Registrada em 20/11/2026

Marcar para reavaliação
Corrigir registro
Inativar
Inativas e rejeitadas (2)
Registrar restrição

O registro fica para conferência; confirmar é um passo separado.

TIPO
Escolha o tipo
Alergia alimentar
Intolerância alimentar
Doença ou condição com restrição (ex.: doença celíaca)
Outra restrição clínica
Escolha alimentar
ALIMENTO OU ITEM

Até 200 caracteres.

OBSERVAÇÃO (OPCIONAL, SÓ A EQUIPE VÊ)

Até 1000 caracteres. Quebras de linha viram espaço.

Registrar para conferência

## Corrigir registro: falha (409) ao confirmar a corrigida

Corrigir alergia alimentar: Amendoim

A restrição atual continua valendo até a nova estar confirmada. São três passos: registrar a nova, confirmá-la e inativar a atual.

Passo 1 de 3: Registrar a restrição corrigida (feito)
Passo 2 de 3: Confirmar a restrição corrigida
Passo 3 de 3: Inativar a restrição anterior
Passo 2 de 3: Confirmar a restrição corrigida

A restrição corrigida foi registrada. Confirme-a para seguir.

A correção parou no passo 2. A corrigida está em "Para conferir" e a restrição antiga continua valendo. Esta informação mudou ou um limite foi atingido. A lista foi recarregada; confira antes de tentar de novo.

Parar a correção aqui
Confirmar a corrigida

## Depois de parar a correção

A correção parou no passo 2. A corrigida está em "Para conferir" e a restrição antiga continua valendo.
