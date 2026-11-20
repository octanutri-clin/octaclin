# Brief sintético — FOOD06 P3-3, etapa B

Aba "Restrições" do prontuário (área "Plano"), para a equipe. Base: branch `claude/food06-p3-3-aba-restricoes` sobre `main`
com a #561, commit `9dd39aa`. Dados sintéticos; BFF simulado; flag desligada; primeira tela clínica do profissional na FOOD06.

Regras já decididas (não reabrir por gosto): registrar e confirmar são passos separados (Q-I); o colaborador nunca confirma e vê
só o que registrou; profissional sem a permissão clínica também só vê os próprios registros; sem catálogo de alimentos nesta fase
(o alimento é texto livre); gravidade não aparece ao paciente; "Não sei dizer" do paciente aparece como "Tipo não informado pelo
paciente"; os registros ainda não geram alerta automático no plano alimentar. Reavaliar, inativar em dois passos, "corrigir
registro" e reconfirmação ficam para a P3-4; solicitações do paciente, para a P3-5.

Evidência (texto renderizado no Chromium, celular Pixel 5, dados sintéticos):

## Profissional com permissão clínica — aba aberta (recolhidas expandidas)
Restrições alimentares

Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever.

Conferência geral das restrições

A conferência geral das restrições deste paciente ainda não foi iniciada.

Iniciar cria o registro que permite reconfirmar as restrições com o paciente depois.

Iniciar conferência
Para conferir (2)

Amendoim

Alergia alimentar · Gravidade: Grave

Pendente de conferência · Registrada por colaborador · Registrada em 10/11/2026

Observação da equipe: Reação relatada na infância (sintético)

Confirmar
Rejeitar

Leite

Outra restrição clínica · Gravidade: Não informada

Tipo não informado pelo paciente

Pendente de conferência · Informada pelo paciente ou responsável · Registrada em 10/11/2026

Confirmar
Rejeitar
Confirmadas (1)

Carne vermelha

Escolha alimentar

Confirmada · Registrada por profissional · Registrada em 10/11/2026

Inativas e rejeitadas (1)

Lactose

Intolerância alimentar · Gravidade: Leve

Inativa · Registrada por profissional · Registrada em 10/11/2026

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

## Diálogo de confirmar
Confirmar alergia alimentar: Amendoim?

A restrição passa a valer como confirmada no acompanhamento deste paciente.

Voltar
Confirmar

## Diálogo de rejeitar (enviado vazio)
Rejeitar outra restrição clínica: Leite?
JUSTIFICATIVA (SÓ A EQUIPE VÊ)

Escreva a justificativa. Obrigatória. Até 4000 caracteres.

Voltar
Rejeitar registro

## Formulário de registro (tipo escolhido, alimento vazio, enviado)
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

Informe o alimento ou item. Até 200 caracteres.

GRAVIDADE
Não informada
Leve
Moderada
Grave
OBSERVAÇÃO (OPCIONAL, SÓ A EQUIPE VÊ)

Até 1000 caracteres. Quebras de linha viram espaço.

Registrar para conferência

## Colaborador (escopo de autoria, com um registro próprio)
Restrições alimentares

Estes registros ainda não geram alerta automático no plano alimentar. Confira antes de prescrever.

Você vê apenas os registros que fez. Outros registros podem existir.

Para conferir (1)

Amendoim

Alergia alimentar · Gravidade: Grave

Pendente de conferência · Registrada por colaborador · Registrada em 10/11/2026

Observação da equipe: Reação relatada na infância (sintético)

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
Observação visual do celular (captura não versionada): a aba aparece rolando a fileira de subabas da área "Plano"; os botões
"Confirmar" (primário) e "Rejeitar" (secundário) ficam lado a lado em cada item pendente; "Inativas e rejeitadas" é um bloco
recolhível; o formulário de registro fica no fim da aba, depois da lista.

Outros estados testados: 409 ("Esta informação mudou ou um limite foi atingido. A lista foi recarregada; confira antes de tentar de
novo."), resultado incerto no registro (mesma chave ao repetir, sem duplicar), conferência geral iniciada e com datas ("Restrições
conferidas em 10/11/2026. Reconferir até 09/05/2027."), área desligada (a aba não existe).

Limites: sem leitor de tela real, sem pessoas; reavaliação, inativação e reconfirmação ainda não existem.
