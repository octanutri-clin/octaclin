# Brief sintético — FOOD06 P3-6, etapa B

Telas de equipe de restrições, na web: (1) delegação da carteira pelo profissional titular; (2) "Quem acompanha pelo portal",
na equipe do paciente (profissional responsável ou colaborador com a carteira delegada). Base: branch `claude/food06-p3-6-equipe`
sobre `main` com a #560, commit 267b135a mais alterações locais. Dados sintéticos; BFF simulado; flag desligada.

Regras já decididas pelo proprietário (não reabrir por gosto):
- colaborador escolhido pelo e-mail completo, só entre colaboradores ativos da clínica; delegação vale para todos os pacientes do
  titular, inclusive futuros, até remover; colaborador nunca confirma restrição;
- representante achado por e-mail exato; a resposta é a mesma para "não existe" e "não pode ser adicionado"; identificação pelo nome
  da ficha só quando a conta tem ficha na carteira de quem busca, senão e-mail mascarado; há cota de buscas por pessoa e por clínica;
- a entrada no prontuário só aparece com a área ligada na web e no tenant.

Pontos de entrada: atalho "Quem acompanha pelo portal" nas ações rápidas do prontuário; a página de delegação (/conta/delegacao) só
tem atalho a partir da página de representantes, para o titular (não há item no menu).

Evidência dada às personas (texto renderizado no Chromium, dados sintéticos):

## Delegação — estado inicial
Colaboradores na sua carteira

Quem você adicionar aqui pode registrar informações de restrição para conferência e cuidar de quem acompanha pelo portal em todos os seus pacientes, inclusive os futuros, até você remover o acesso. Colaboradores nunca confirmam restrições.

Com acesso agora

carla.sintetica@example.test

Com acesso desde 10/11/2026

Remover acesso
Adicionar colaborador
COLABORADOR DA CLÍNICA
Escolha pelo e-mail
bia.sintetica@example.test
Dar acesso à carteira

## Delegação — confirmação
Dar acesso a bia.sintetica@example.test?

bia.sintetica@example.test poderá registrar informações de restrição para conferência e cuidar de quem acompanha pelo portal em todos os seus pacientes, inclusive os futuros, até você remover o acesso.

Cancelar
Dar acesso

## Delegação — remover
Remover o acesso de carla.sintetica@example.test?

O que já foi registrado continua no histórico.

Manter acesso
Remover acesso

## Representantes — lista
Quem acompanha pelo portal

Pessoas com conta no portal que podem ver as restrições deste paciente e pedir correções em nome dele. Registre só depois de conferir a identidade da pessoa e o vínculo com o paciente.

Acompanham agora

Helena Sintética

Presencial em 10/11/2026

Remover

Conta p***@e***.test

Procuração em 10/11/2026

Remover
Adicionar quem acompanha
E-MAIL DA CONTA DA PESSOA

Use o e-mail exato com que a pessoa entra no portal.

Buscar conta

Voltar ao prontuário

Dar acesso a toda a sua carteira para um colaborador

## Representantes — encontrado
Quem acompanha pelo portal

Pessoas com conta no portal que podem ver as restrições deste paciente e pedir correções em nome dele. Registre só depois de conferir a identidade da pessoa e o vínculo com o paciente.

Acompanham agora

Helena Sintética

Presencial em 10/11/2026

Remover

Conta p***@e***.test

Procuração em 10/11/2026

Remover
Adicionar quem acompanha
E-MAIL DA CONTA DA PESSOA

Use o e-mail exato com que a pessoa entra no portal.

Buscar conta
Conta encontrada: Conta n***@e***.test
COMO VOCÊ CONFERIU A IDENTIDADE E O VÍNCULO?
Escolha uma opção
Documento apresentado
Presencial
Procuração
Outro
Registrar como responsável

Voltar ao prontuário

Dar acesso a toda a sua carteira para um colaborador

## Representantes — remover
Remover Helena Sintética?

A pessoa deixa de ver as informações deste paciente no portal. Pedidos já feitos continuam no histórico.

Manter
Remover

## Representantes — não encontrado (trecho)
Não encontramos uma conta que possa ser adicionada com este e-mail. Confira o endereço ou peça para a pessoa criar o acesso ao portal.
Observação visual do celular (captura não versionada): o cabeçalho do console mostra "QUEM ACOMPANHA PELO PORTAL / Prontuário
do paciente"; o nome do paciente não aparece nesta página. O botão "Registrar como responsável" fica desabilitado até escolher a
verificação.

Limites: sem leitor de tela real, sem pessoas; telas clínicas do profissional (P3-3 a P3-5) ainda não existem.
