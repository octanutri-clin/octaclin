# FOOD06 — consolidação UX B/C do incremento factual

| ID | Origem | Função/problema | Evidência/tipo | Prioridade | Solução/aceite | Complexidade | Arquitetura/segurança | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NUX-B01 | Nutricionista | Descoberta do detalhe após28 cartões | Posição observada; risco de fricção | P2 | Botão antes dos cartões, fetch só ao abrir; bounding-box testado | Baixa | Mesma seleção, sem nova concessão | JÁ COBERTO por M06; corrigido |
| NUX-B02 | Nutricionista |409 sem atualização direta | Defeito no caminho descrito | P2 | Reusar atualização PA06, só repetir após sucesso; RED/GREEN | Baixa | Permissões/CAS existentes, sem writes | JÁ COBERTO por recuperação aprovada; corrigido |
| NUX-B03 | Nutricionista | Confundir cobertura com adequação | Hipótese de compreensão | P2 | Dados completos/parciais + contagem contextual | Baixa | Sem decisão clínica/percentual | JÁ COBERTO por M01; refinado |
| NUX-C01 | Nutricionista | Rolagem horizontal pode dificultar leitura móvel | Hipótese sem falha observada | P3 | Pesquisar uso real antes de novo layout | A avaliar | Acessibilidade; sem efeito em cálculo | BACKLOG |
| PUX-B01/C01 | Paciente | Não há jornada direta neste escopo | N/A justificado | N/A | Preservar console, sem criar portal/envio | N/A | Minimização e escopo preservados | JÁ COBERTO |

B01–B03 refinam requisitos já aprovados de acesso rápido/recuperação/clareza;
não criam nova decisão clínica, uso de dados ou funcionalidade. Personas não
ratificaram escopo. Não foi incorporada nenhuma recomendação nova além desses
ajustes proporcionais. Sem nova pergunta de produto bloqueante neste incremento.

R4 é processo separado: achado P2 de dado factual retido após foco/revogação,
reproduzido e corrigido com revisão monotônica/gate/abort. Fechamento pelo revisor
com execução independente consta na execução técnica; não é parecer de persona.

Imagens são evidências sintéticas observadas pelo coordenador, não validação com
usuários. Não chamar B/C deste incremento de conclusão UX de toda FOOD06.
