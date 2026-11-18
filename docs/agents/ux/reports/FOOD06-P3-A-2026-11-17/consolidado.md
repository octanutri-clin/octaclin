# Consolidação — FOOD06 P3, etapa A (com D)

Plano avaliado: telas web de restrições (P3), base `main` `91241b1`, 2026-11-17. Modalidade: **somente plano**; duas instâncias
distintas do runtime com o papel fornecido como prompt, sem ferramentas, cada uma só com o `brief.md`, sem ver o parecer da outra.
Não são independentes do coordenador (mesmo modelo, que escreveu o brief). Sem tela, teclado, leitor de tela ou pessoas reais. Sem P0.
APROVAR abaixo é recomendação; a coluna "Decisão" registra o que o proprietário decidiu nesta sessão.

| ID | Prio. | Estado | Tratamento | Decisão do proprietário (2026-11-17) |
| --- | --- | --- | --- | --- |
| NUX-01 | P1 | APROVAR | "Corrigir registro": registrar a nova, confirmar a nova e só então inativar a antiga; falha em qualquer passo deixa a antiga ativa e a tela diz onde parou (P3-4) | ACEITA ("Registrar e confirmar" numa ação só foi rejeitado; cada passo é explícito) |
| NUX-02 | P1 | APROVAR | Vazio próprio do colaborador (P3-3) | ACEITA com o plano |
| NUX-03 | P1 | APROVAR | Campos "O paciente verá" × "Somente equipe" com prévia (P3-5) | ACEITA com o plano |
| NUX-04 | P2 | APROVAR | Ida e volta guiada da solicitação para a operação (P3-5) | ACEITA com o plano |
| NUX-05 / PUX-05 | P2 | APROVAR em parte | Texto digitado preservado só em memória; o 409 da API não distingue conflito de limite, então só o limite antecipado pela UI tem texto próprio | ACEITA com o plano |
| NUX-06 | P2 | APROVAR | Contadores e botão desabilitado no limite (P3-6) | ACEITA com o plano |
| NUX-07 | P2 | BACKLOG | Aviso de duplicata por texto normalizado; reavaliar na etapa B | ADIADA |
| NUX-08 | P2 | BACKLOG | Indicador no cabeçalho da ficha; reavaliar na etapa B | ADIADA |
| NUX-09 | P2 | APROVAR | Opção desabilitada com motivo acessível (P3-4) | ACEITA com o plano |
| NUX-10 | P2 | APROVAR | "Não decididas" primeiro e aviso no limite de 100 (P3-5) | ACEITA com o plano |
| NUX-11, NUX-12 | P3 | APROVAR | "Não informada" explícita; colar com quebra vira espaço com aviso | ACEITA com o plano |
| PUX-01 | P1 | AVALIAR | Texto proposto "Em caso de dúvida ou sintomas, fale com quem faz seu acompanhamento"; validação clínica e de compreensão (ATV-1, ATV-7) antes de ativar | PENDENTE de validação clínica |
| PUX-02 | P2 | APROVAR | Nome da pessoa no lugar de "você" para representante | ACEITA com o plano |
| PUX-03 | P2 | APROVAR | Selo neutro; pedido alheio com texto próprio | ACEITA: selo "Informação enviada pelo portal; ainda será conferida" |
| PUX-04 | P2 | APROVAR | Ajuda por opção e "Não sei dizer" | ACEITA: "Não sei dizer" grava `outra_restricao_clinica` |
| PUX-06 | P2 | APROVAR | "Sim, cancelar pedido" / "Não, manter pedido", foco no que não destrói | ACEITA com o plano |
| PUX-07 | P2 | AVALIAR | Selos curtos com legenda; conflita com os textos do proprietário | Mantidos os textos de selo decididos; legenda e ordem (confirmados primeiro) ficam para a etapa B |
| PUX-08 | P3 | APROVAR | "Você acompanha como responsável" | ACEITA com o plano |
| Pergunta gravidade | — | — | — | Não mostrar no portal |
| Pergunta "equipe" | — | — | — | "Quem faz seu acompanhamento" em todo o portal |
| Pergunta aviso de decisão | — | BACKLOG | Fora do escopo da P3 | ADIADA |
| Pergunta histórico de revogados | — | BACKLOG | Sem rota paginada na P3 | ADIADA |

## Concordâncias e tensões

As duas personas convergem em: não atribuir a uma pessoa o que ela não fez; não sugerir ausência de risco; preservar texto em erro;
identificar sempre a pessoa ou o item afetado. Tensão: selos curtos (PUX-07) × textos decididos pelo proprietário; mantidos os
textos, com a legenda avaliada na etapa B. Nenhuma recomendação autoriza ativação, merge ou escopo fora da P3.
