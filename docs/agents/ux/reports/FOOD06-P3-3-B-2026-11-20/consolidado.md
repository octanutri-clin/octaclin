# Consolidado — FOOD06 P3-3, etapa B (2026-11-20)

Aba "Restrições" do prontuário (área "Plano"). Base `9dd39aa` + correções desta etapa. Entrada: `brief.md` (texto renderizado no
celular com dados sintéticos e observação visual). Modalidade: duas instâncias distintas do runtime com o papel como prompt, sem
ferramentas; não independentes do coordenador; sem pessoas, sem leitor de tela real. Não é validação clínica nem R4.

## Sem P0

## Corrigido nesta PR (com teste Playwright desktop e mobile)

| Achados | O que mudou | Prova |
| --- | --- | --- |
| NUX-01 (P1) | Item com "Não sei dizer" mostra "Tipo não informado pelo paciente" no lugar do rótulo do tipo, no cartão, no botão e no diálogo ("restrição de tipo não informado"); o diálogo diz que tipo e gravidade continuam não informados e que a correção chega na P3-4 | spec "UX B: item Não sei dizer" |
| NUX-02 | Diálogo de confirmar repete gravidade, origem e observação da equipe | mesmo spec |
| NUX-03 (P1) | O bloco de conferência geral mostra "N registros ainda aguardam conferência"; a ajuda de "Iniciar" diz que iniciar não confere nada. (Iniciar grava a situação "não informado", que a tela mostra como "ainda não conferidas") | spec "UX B: conferência geral" |
| NUX-05 | Atalho "Ir para registrar restrição" no topo, com foco no campo Tipo | mesmo spec |
| NUX-07 (P1) | Em 409 ou incerto ao rejeitar, a lista é recarregada e, se o item ainda está para conferir, o diálogo continua aberto com a versão atual e o texto digitado (só em memória); senão fecha e anuncia. O formulário de registro já mantinha o texto e a chave em falha | spec "UX B: 409 ao rejeitar" |
| NUX-08 | Já atendido: com tipo não clínico a tela envia gravidade vazia e o BFF recusa escolha com gravidade | `scripts/restricoes-prontuario.spec.ts` |
| PUX-01 (parte da equipe) | O diálogo de rejeitar avisa que o paciente não é avisado automaticamente e que a informação some do portal dele | spec "UX B: conferência geral" |

## Decisão do proprietário

- **PUX-01/PUX-05 (P1, portal)**: hoje uma informação rejeitada simplesmente some do resumo do portal, sem sinal ao paciente nem ao
  responsável. Opções: (a) estado neutro no portal ("Revisada por quem faz seu acompanhamento; converse na próxima consulta"), sem
  motivo interno, exige leitura nova no backend; (b) manter como está e confiar na orientação à equipe (já entregue).
- **PUX-03 (P1, portal, texto clínico)**: deixar claro no portal que registrar uma restrição não altera o plano automaticamente.
  Texto clínico: passa pela validação de ATV-1/ATV-7.

## BACKLOG

NUX-04 (aviso de duplicata; já no backlog da etapa A como NUX-07), NUX-06 (contagem de pendentes na aba: custaria um endpoint no
orçamento do prontuário), NUX-07 parte "separar mudou de limite" (o backend responde 409 único, F6), NUX-09 (quem confirmou e autor:
a leitura não devolve, por decisão de allowlist), NUX-10 (alvo de toque: botões `sm` passam no mínimo de 24 px da WCAG 2.2 AA;
44 px é melhoria), NUX-11 (motivo da rejeição/inativação: a API não devolve), oportunidades de resumo e ordem por gravidade,
PUX-02 (o que acontece depois de informar, no portal) e PUX-04 (estados em texto: já são texto; verificar com leitor de tela, ATV-7).

## Respostas às perguntas

- Iniciar a conferência com pendentes é permitido e grava só a situação "não informado" (sem confirmar nada).
- O colaborador vê a situação dos próprios registros (pendente, confirmada, rejeitada) na própria lista; não vê justificativas.
- No 409 e no incerto o texto digitado é mantido (rejeição e registro).

## N/A e limites

Paciente: tela da equipe; avaliado o impacto indireto. Leitor de tela real e pessoas: SKIPPED (ATV-7).
