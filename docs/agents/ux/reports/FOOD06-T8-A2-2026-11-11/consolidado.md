# Consolidação — FOOD06 T8, etapa A (segunda rodada, contrato v2)

Documento avaliado: `tasks/food06-m11-restricoes-contrato-v2.md` (base `main` `d84b0f11`). Modalidade: **somente plano**. Sem P0. As personas receberam **só o brief** e
não viram o parecer uma da outra. Os achados continuam a numeração da primeira rodada (NUX e PUX a partir de 11).

| ID | Prio. | Estado | Tratamento |
| --- | --- | --- | --- |
| NUX-11 | P1 | INCORPORADO NO CONTRATO + DECISÃO (Q9) | Saída operacional do bloqueio (`PedidoCuradoria`), inativar separado (§9.1, §4.1). |
| NUX-12 | P2 | INCORPORADO + DECISÃO (Q10) | Reconfirmar na prévia, um aviso por sessão. |
| NUX-13 | P2 | INCORPORADO | Entrada rápida, categoria por item sem padrão. |
| NUX-14 | P2 | INCORPORADO | Lote exclui ambíguos e sem alvo da seleção padrão. |
| NUX-15 | P1 | INCORPORADO | Promoção sem categoria padrão, "não avaliado" visível. |
| NUX-16 | P2 | INCORPORADO | Fila de pendências do portal, remoção priorizada. |
| NUX-17 | P2 | INCORPORADO | Revisão por receita, composição reaproveitada marcada. |
| NUX-18 | P1 | INCORPORADO + MEDIÇÃO NO PILOTO | Três ações distintas, revisão uma vez por alvo por sessão. |
| NUX-19 | P1 | INCORPORADO | Selo em plano, consulta e prévia, mais lista de registros sem alerta. |
| NUX-20 | P2 | INCORPORADO | Mostrar o que mudou e preservar o rascunho. |
| PUX-11 | P2 | INCORPORADO | "Pedir correção" com tela de confirmação. |
| PUX-12 | P2 | INCORPORADO + DECISÃO (Q11) | Desfechos visíveis com data. |
| PUX-13 | P2 | DECISÃO DO PROPRIETÁRIO (D7-a) | Trocar "Correção solicitada" por "Você pediu uma correção": altera um texto decidido. |
| PUX-14 | P2 | DECISÃO (Q11) | Origem em linguagem simples ("anotado pela clínica"). |
| PUX-15 | P2 | INCORPORADO | Portal não repete o selo de engenharia. |
| PUX-16 | P3 (P2 se o paciente vir) | DECISÃO (Q11) | Texto acolhedor se o paciente for avisado. |
| PUX-17 | P2 | INCORPORADO | Sem mensagem automática ao paciente por causa do bloqueio; teste de contrato. |
| PUX-18 | P2 | BACKLOG (etapa B/C) | Só se verifica com leitor de tela e teclado reais. |
| PUX-19 | P2 | INCORPORADO | Agrupamento por tipo com rótulos familiares. |
| PUX-20 | P3 | INCORPORADO | Apoio sem pressão; sem justificativa clínica ao paciente. |
| PUX-21 | P3 | BACKLOG | Resumo a um toque do plano. |

## Concordâncias e tensões

As duas personas concordam que o bloqueio protege e que ocultar os estados internos do paciente é correto. A tensão que importa vem da nutricionista: **o bloqueio sem
ignorar só é viável se houver uma saída rápida** (NUX-11), e a fase sem regras validadas pode gerar **fadiga de revisão** (NUX-18). A persona paciente trata o bloqueio como invisível
e pede que continue assim (PUX-17). Não há discordância a preservar entre elas.

## Limites (declarados)

- **Modalidade real:** duas instâncias distintas do runtime desta sessão, cada uma com o papel de `.codex/agents/*.toml` fornecido como prompt e **sem ferramentas** (uma chamada
  por instância, a de devolver o relatório). Não são papéis nativos selecionados e **não são independentes do coordenador**, que escreveu o brief. A persona paciente descreveu a si
  mesma como "simulação por um único agente"; isso está impreciso e a modalidade real consta no manifesto.
- As duas receberam **só o brief**, não o documento do contrato.
- Sem pessoas reais, tela, teclado ou leitor de tela. Não é validação clínica, jurídica, de privacidade nem revisão R4.
- Os percentuais, passos e contagens citados pelas personas são **estimativas**, não medições.
