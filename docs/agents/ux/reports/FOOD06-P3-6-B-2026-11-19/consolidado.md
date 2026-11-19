# Consolidado — FOOD06 P3-6, etapa B (2026-11-19)

Telas de equipe: delegação da carteira (`/conta/delegacao`) e "Quem acompanha pelo portal" (`/pacientes/[id]/representantes`).
Base: `claude/food06-p3-6-equipe`, commit `feee832` + correções desta etapa. Entrada das personas: `brief.md` (texto renderizado no
Chromium com dados sintéticos e observação visual do celular). Modalidade: duas instâncias distintas do runtime com o papel como
prompt, sem ferramentas; não independentes do coordenador; sem pessoas, sem leitor de tela real. Não é validação clínica nem R4.

## Sem P0

## Corrigido nesta PR (com teste Playwright desktop e mobile)

| Achados | O que mudou | Prova |
| --- | --- | --- |
| NUX-01 (P1) | "Paciente: {nome}" no topo e "Registrar como responsável de {nome}" | `food06-restricoes-equipe.spec.mjs` (lista e registro) |
| NUX-02, PUX-02 (P1) | "Você buscou: {e-mail digitado}. Confira com a pessoa antes de registrar." O valor vem do campo, não do servidor; a resposta continua igual para "não existe" e "não pode" | spec, registro |
| NUX-03 | Confirmação de remoção mostra verificação e data | spec, remoção |
| NUX-05 | 429 diz "cerca de 15 minutos" (bloqueio da cota) e o e-mail fica no campo | spec, 429 |
| NUX-07, PUX-07 (parte) | Motivo do botão desabilitado visível e ligado por `aria-describedby`; resultado da busca em região viva; foco do diálogo já coberto | spec (`toHaveAccessibleDescription`) |
| PUX-01 | Orientação na tela: avisar o paciente e a pessoa ao registrar ou remover (sem notificação automática) | texto |
| PUX-04 | "restrições alimentares (como alergias e intolerâncias)" | texto |
| PUX-05 | Remoção explica que os pedidos ficam com a equipe, que segue analisando os abertos, e que a pessoa não os vê mais (o backend só encerra o vínculo; não cancela pedidos) | texto |

## Decisão do proprietário

- **NUX-08**: onde fica a entrada da delegação. Hoje só pela página de representantes, para o titular. Opção recomendada: item
  "Colaboradores na sua carteira" no menu da conta (onde está "Sessões e segurança"), visível só ao titular com a área ligada.
- **Pergunta 2 da NUX**: a delegação também cobre registrar pendências; deve aparecer mesmo com o portal desligado? Hoje segue a
  mesma flag (web e tenant).

## BACKLOG

NUX-04 (separar 409 de versão e de limite: o backend responde 409 único, F6), NUX-06 (complemento de "Outro": exige campo novo no
backend), NUX-09 (contar pendências da colaboradora na remoção: exige leitura nova), NUX-10 (busca dentro de select longo; o vazio e o
sucesso já existem e são testados), PUX-01 completo (notificar paciente e representante), PUX-03 (nome acessível para conta
mascarada sem soletrar asteriscos), PUX-06 (termo "responsável" para procurador de adulto: risco registrado, decisão mantida),
oportunidade NUX (titular ver quem da equipe adicionou cada representante: exige autor na leitura).

## N/A e limites

Paciente: as telas são da equipe; a persona avaliou o impacto indireto. Leitor de tela real e pessoas: SKIPPED (ATV-7).
