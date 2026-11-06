# FOOD06 M07 — UX A complementar

## Método e limites

Papéis PR451/0d3382b6, por brief textual sintético e duas instâncias independentes
reutilizadas: food06_m09_nutricionista_ux e food06_m09_paciente_ux. Sem ferramentas,
leitura de arquivos, imagens, interação ou teste com usuários reais. Não seleção
TOML nativa comprovada, validação clínica ou R4. Esta etapa detalha a UX A geral
FOOD06 de2026-10-31; não substitui B/C da futura interface. Nenhuma sugestão muda
escopo aprovado automaticamente.

## Nutricionista

Pontos positivos: reuso factual com ressalvas, revisão exata e preservação das
lacunas. Riscos de uso: rascunhos com mesmo número, delta com composição parcial,
períodos distintos, fonte alterada confundida com causa e legado sem documentação.
Todos são riscos do contrato proposto, não defeitos observados em tela.

## Paciente

Portal direto N/A. Riscos indiretos: número maior ser comunicado como melhora de
saúde, parcial antigo parecer falha do paciente ou dias alternados virarem consumo
de um dia. Nenhum P0/P1 demonstrado pelo brief; não houve interação/mobile próprio.

## Consolidação

| ID | Origem | Cenário / natureza / evidência | Prioridade | Proposta e aceite | Complexidade e segurança | Estado |
|---|---|---|---|---|---|---|
| NUX-M07-01 | Nutricionista | Dois rascunhos mesmo número; risco por proposta | P1 | Revisão ausente rejeita, revisões diferentes preservadas | Baixa no núcleo; API exige CAS/auth próprios | JÁ COBERTO no domínio, integração pendente |
| NUX-M07-02 | Nutricionista | Ferro parcial2→3; risco de precisão aparente | P1 | Sem delta completo se um lado parcial, preservar conhecidos | Reuso PA06/M04; não inventar zero | JÁ COBERTO no núcleo |
| NUX-M07-03 / PUX-M07-03 | Ambas | Dias alternados; risco de comparação temporal indevida | P1/P2 | Identificar cada total; não somar ou afirmar equivalência diária | Sem nova inferência temporal; contexto/registro futuros | JÁ COBERTO: escopo total de cada versão separadamente; UI futura deve manter ressalva |
| NUX-M07-04 / PUX-M07-01 | Ambas | Fonte alterada ou ferro maior interpretado como causa/melhora; hipótese | P2 | Separar delta/dimensão documentada/causa; nenhum melhorou/piorou | Sem diagnóstico; marcadores internos não comprovam causa | JÁ COBERTO: causalidade não estabelecida |
| NUX-M07-05 / PUX-M07-02 | Ambas | Legado incompleto entendido como equivalente ou falta anterior; risco | P2 | Duas ausências não significam igualdade; incompatível≠ausente | Não projetar contexto bruto; não fabricar desempenho | JÁ COBERTO no contrato, UI e registro ainda pendentes |

A recomendação sobre períodos não cancela a decisão do proprietário de permitir
totais factuais sem confirmação diária. Núcleo não soma dias, não normaliza
períodos nem compara com referências diárias. UI futura precisa explicitar o
alcance, e API obter confirmações/contextos reais antes de comparação clínica.
Não foi criada nova política temporal por inferência das personas.

## Aprendizados para etapa D

Ao construir API/UI, conferir identidade e revisão nos dois lados, nomes de
versões/datas/seleções e avisos próximos dos deltas. Não chamar marcador igual de
prova de conteúdo igual. Não apresentar correlação como causa, dieta prescrita
como consumo ou soma de versões como dia. Consultar este relatório e a UX A
original antes das etapas B/C. Não considerar este parecer validação de tela.
