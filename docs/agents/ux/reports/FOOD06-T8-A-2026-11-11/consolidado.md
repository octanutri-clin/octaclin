# Consolidação — FOOD06 T8, etapa A

Proposta avaliada: `tasks/food06-m11-restricoes-contrato-proposta.md` (base `main` `d84b0f11`). Modalidade: **somente plano**.
Nenhuma tela, protótipo ou código. Não houve P0. Os dois pareceres foram escritos sem que uma persona visse a outra.

| ID | Prio. | Estado | O que foi feito |
| --- | --- | --- | --- |
| NUX-01 | P1 | INCORPORADO NA PROPOSTA | Padrões, busca e confirmação em lote (§14). Medição real na etapa B. |
| NUX-02 | P1 | INCORPORADO NA PROPOSTA | Grupo mais próximo ou "não encontrei" com pendência de curadoria e aviso de que não há alerta automático (§14, D11). |
| NUX-03 | P1 | INCORPORADO NA PROPOSTA | Resposta antiga como sugestão a confirmar; `nenhuma` nunca confirma; aviso por paciente/sessão (§14). |
| NUX-04 | P1 | INCORPORADO NA PROPOSTA + DECISÃO | Troca não bloqueia; reconfirmar na prévia. Quem reconfirma em clínica vira D10. |
| NUX-05 | P1 | DECISÃO DO PROPRIETÁRIO | Exceção por paciente e alérgeno, com motivos pré-definidos: D4 atualizada. |
| NUX-06 | P2 | INCORPORADO NA PROPOSTA | Texto do selo reescrito; teste de leitura com profissionais reais na etapa B. |
| NUX-07 | P2 | INCORPORADO NA PROPOSTA + DECISÃO | Correção do paciente entra como rascunho (D7). |
| NUX-08 | P2 | INCORPORADO NA PROPOSTA | `em_reavaliacao` mantém o conflito ativo. |
| NUX-09 | P2 | INCORPORADO NA PROPOSTA | Conflito por ingrediente e restrição, na prévia de troca. |
| NUX-10 | P3 | INCORPORADO NA PROPOSTA | Gravidade só para natureza `clinica`. |
| PUX-01 | P1 | INCORPORADO NA PROPOSTA + DECISÃO | Dois textos leves de status; D7. Teste de compreensão com pessoas reais pendente. |
| PUX-02 | P1 | INCORPORADO NA PROPOSTA | Nenhum estado do motor vira rótulo ao paciente (§14). Glossário de textos a revisar na implementação. |
| PUX-03 | P2 | INCORPORADO NA PROPOSTA | Contradição do questionário tratada como "informado por você", sem acusar. Texto final pendente. |
| PUX-04 | P2 | BACKLOG (etapa B/C) | Fluxo de correção por teclado e leitor de tela: só se verifica com tela real. |
| PUX-05 | P2 | INCORPORADO NA PROPOSTA | Texto neutro "Ainda não conferimos este item". |
| PUX-06 | P3 | BACKLOG | Nota curta de troca na receita do paciente, quando houver o fluxo. |

## Concordâncias e discordâncias

As personas concordam no essencial: `indeterminado` como padrão, nada de "seguro", marcar em vez de esconder e rascunho
sem confirmação não gerar conflito. Não houve discordância a preservar. Ambas apontam o lado do paciente como o menos
definido (decisão D7) e pedem validação com pessoas reais, que não ocorreu.

## Perguntas de produto que viraram decisões (D4, D7, D10, D11)

Quem confirma e reconfirma em clínica; exceção por item ou por paciente e alérgeno; alvo não classificado só avisa ou
impede; o que o paciente vê e se pode propor correção.

## Limites (declarados)

- **Modalidade real:** duas instâncias distintas do runtime desta sessão, cada uma com o papel de
  `.codex/agents/*.toml` fornecido como prompt e **sem ferramentas** (o runtime reportou uma chamada por instância, só
  a de devolver o relatório). Não são papéis nativos selecionados e **não são independentes do coordenador**, que
  escreveu o brief. A persona paciente chamou a si mesma de "fallback do agente principal"; isso está impreciso e a
  correção consta no manifesto.
- As duas receberam **só o brief**, não o documento da proposta.
- Sem pessoas reais, sem tela, sem teste de teclado ou de leitor de tela. Não é validação clínica, jurídica, de
  privacidade nem revisão R4.
- A lista de alérgenos, o mapeamento, a validade, a regra de conflito e os textos continuam exigindo validação humana
  clínica e decisão do proprietário.
