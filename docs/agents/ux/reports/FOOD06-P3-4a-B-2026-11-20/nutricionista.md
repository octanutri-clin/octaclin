# Parecer NUX — FOOD06 P3-4a, etapa B

Subagente distinto do runtime desta sessão, com o papel `octaclin-nutricionista-ux` (sha256 `6259b40a…af6d`) e o brief como
únicas entradas (2 leituras de arquivo: papel e brief; nenhuma outra ferramenta), sem ver o parecer da outra persona. Transcrição
editorial fiel do parecer entregue; IDs encurtados de `NUX-P34A-0n` para `NUX-0n`.

**Contexto e limitações.** Texto renderizado no celular, dados sintéticos, BFF simulado. Sem interação, screenshot, teclado ou leitor
de tela. Contagens de passos são estimativas. Não reabriu as regras decididas.

**Pontos positivos.** A anterior "continua valendo até a nova estar confirmada", dito em cada passo; progresso claro ("Passo X de 3",
"(feito)", "parou no passo 2…" com onde está a corrigida); reavaliação curta e com consequência; o passo 1 de inativar encaminha
para "Corrigir registro"; botão nomeia o tipo ("Inativar alergia alimentar"); o segundo passo reduz toque errado no celular; aviso
de que não há alerta automático; sucesso explícito sobre cada registro; 409 sem perda de trabalho.

| ID | Prioridade | Achado | Sugestão / aceite |
| --- | --- | --- | --- |
| NUX-01 | P2 | No passo 3 da correção há duas alergias confirmadas a "Amendoim"; a frase serve para as duas | Identificar a anterior (gravidade e data) sem mudar a frase decidida; teste confirma o id inativado |
| NUX-02 | P2 | Sair no passo 3 deixa duas confirmadas sem mensagem; "Voltar" ambíguo | Mensagem de parada do passo 3 dizendo o que falta; rótulo "Parar a correção aqui"; testar Voltar, fechar e erro |
| NUX-03 | P2 | Campos da correção parecem vazios; a observação da equipe parece se perder | Pré-preencher os quatro campos, inclusive a observação |
| NUX-04 | P2 | Passo 1 sem saída rotulada; "Parar" ativo durante "Processando" | Saída rotulada no passo 1; "Parar" desabilitado em envio |
| NUX-05 | P2 | Parada não diz como retomar; 409 vago ("um limite") | Dizer o próximo passo; vincular a pendente à anterior; separar "mudou" de "limite" quando o backend permitir |
| NUX-06 | P3 | O que o passo 3 grava como motivo e justificativa | Mostrar o motivo gravado |
| NUX-07 | P3/P2 | Passo 2 sem o motivo; sem contador; erro da justificativa vazia não visto | Linha com o motivo; contador; erro associado (P2 se ausente) |
| NUX-08 | P3 | "Passo N de 3" lido duas vezes | `aria-current` no passo; evitar leitura dupla (testar com leitor) |
| NUX-09 | P3 | Lembrete de que o paciente não é avisado | Frase só para a equipe (decisão do proprietário) |

**Oportunidades.** Pré-preencher reduz a correção de gravidade a ~1 alteração e 3 cliques (estimativa); vínculo "Corrige registro de
{data}" no card novo e no inativo; rever o atalho "Ir para registrar restrição" depois de corrigir.

**Perguntas.** O que o passo 3 grava; o que "Voltar" faz no passo 3; se os campos vêm preenchidos; como fica o card em reavaliação.

**Conclusão.** Sem P0 nem P1: a anterior sempre continua valendo nos pontos de falha observados. Riscos concentrados no passo 3 da
correção e na retomada; tratar NUX-01 a 05 antes da etapa C.
