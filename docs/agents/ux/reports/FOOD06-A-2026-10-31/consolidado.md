# FOOD06 — consolidação UX A

Duas instâncias separadas, sem herdar conversa ou consultar o relatório da outra,
avaliaram a mesma síntese factual do [brief](brief.md). Relatórios persistidos são
sínteses editoriais do coordenador; retornos originais constam da trilha do runtime.
Ponte textual dos papéis #451/`0d3382b6`, não seleção nativa de TOML comprovada.
Sem ferramentas observadas/reportadas pelos revisores, telas ou testes de usuários.
Não se alega sandbox técnico isolado por instrução de persona.

| Sugestão | Origem | Funcionalidade/problema | Evidência | Prioridade | Solução/aceite relacionado | Complexidade | Arquitetura/segurança | Estado recomendado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NUX01/PUX01 | Ambas | M01: zero/ausência e subtotal | Hipótese em cenário1 | P1/P2 | Cobertura junto ao valor, localizar lacuna; M01-C1–C3 | Média | Motivos por nutriente, sem falso percentual | JÁ COBERTO no escopo; teste pendente |
| NUX02/PUX04 | Ambas | M02: porção/rendimento | Risco/hipótese cenário4 | P1/P2 | Quantidade/denominador explícitos e snapshot uma vez; M02-C1 | Média | Reusar FOOD07/PA06 | JÁ COBERTO |
| NUX03 | Profissional | M03: causa sem ação clara | Hipótese textual | P2 | Mensagem+ação real; M03-C1 | Baixa/média | Backend autoritativo, erro minimizado | JÁ COBERTO |
| NUX04/PUX03 | Ambas | M04/M12: prévia stale | Risco cenário3 | P1 | Invalidar e reconferir, cancelamento sem gravação; M04-C2/M12-C3 | Alta | CAS/PA07/authz/rollback | JÁ COBERTO |
| NUX05 | Profissional | M05: excesso/ocultação de fonte | Hipótese cenário6 | P2 | Identificação curta+detalhe histórico; M05-C1/C2 | Média | Referência/conjunto imutáveis | JÁ COBERTO |
| NUX06 | Profissional | M06: filtro oculta universo | Risco de proposta | P2 | Mostrar filtros/contagem/limpar; M06-C1/C2 | Média | Sem confundir ausente com zero | JÁ COBERTO; detalhe reversível de UI |
| NUX07/PUX02 | Ambas | M07: dias alternados | Risco cenário2 | P1/P2 | Identificar seleção/dia; sem percentual diário não confirmado | Média | Não remover totais factuais autorizados | JÁ COBERTO com esclarecimento abaixo |
| NUX08/PUX08 | Ambas | M08: PDF/mobile e ressalvas | Hipótese, sem artefato | P2 | PDF real legível, ordem/texto/cabeçalhos/limites; M08-C1–C3 | Alta | Backend auth, sem entrega automática | JÁ COBERTO |
| NUX09/PUX06 | Ambas | M09: siglas/julgamento/diagnóstico | Hipótese | P1/P2 | Texto descritivo+detalhe e C condicional; M09-C1/C2 | Média | Não altera ratificação | JÁ COBERTO |
| NUX10/PUX07 | Ambas | M07/M10: linha contínua falsa | Risco cenário6 | P1/P2 | Quebras e causas em gráfico/tabela; M07-C2/M10-C2 | Alta | Sem recálculo histórico | JÁ COBERTO |
| NUX11/PUX05 | Ambas | M11: ranking/compatibilidade | Risco, gap técnico comprovado apenas nesta inspeção | P1 | Porção/preparo/base/verificação; M11-C1–C3 | Alta | Não inferir alergia nem segurança de texto livre | AVALIAR contrato de restrições; requisito obrigatório |
| NUX12 | Profissional | M12: retomar cenário correto | Hipótese cenários3/6 | P1 | Nome/resumo/estado, duração temporária clara; M12-C1–C3 | Alta | Fingerprint interno, sem persistência automática | JÁ COBERTO |

“JÁ COBERTO” significa requisito aprovado mapeado, **não código entregue ou teste
aprovado**. Não houve nova autorização clínica pelas personas. Recomendações que
introduzirem decisão relevante adicional voltarão ao proprietário antes de código.

## Argumentos preservados e decisões do coordenador

- PUX02 pede que planos alternados não produzam “soma diária”. O proprietário
  autorizou totais factuais sem confirmação. Preservar esses totais como **total
  da seleção**, não “total diário”; apenas percentuais diários ficam bloqueados.
  Não remover a soma factual por interpretação da persona.
- As duas personas divergem na prioridade de algumas fricções, por público.
  Manter ambas as classificações; não fabricar consenso ou promover hipótese a P0.
- Perguntas sobre duração de cenários, identificação e contexto são resolvidas por
  estado em memória, identificação de versão/alteração e reconferência nas mudanças,
  sem prometer recuperação ou persistência. Essas soluções já estão em M04/M05/M12.
- PDF permanece profissional e autorizado. Nenhum novo relatório/portal para
  paciente foi inferido; a análise paciente de navegação de portal é N/A.
- Fonte/ranking não comprova compatibilidade clínica. Fechar gap M11 antes do
  caminho personalizado; não marcar melhora opcional nem mudar o protocolo.

## Acompanhamento B/C/D

B exige interface/documento real com provas de teclado/mobile/zoom e artefato PDF
quando aplicável. C confere cada hipótese/critério após testes e R4; D reutiliza
esses IDs/decisões para evitar repetir problemas. Nesta rodada B/C e validação
com usuários reais não foram executadas. Backlog adicional sem requisito novo:
medir tempo/cliques em consulta e pesquisar compreensão com usuários reais, sob
planejamento/consentimento próprios; sem inventar resultados.
