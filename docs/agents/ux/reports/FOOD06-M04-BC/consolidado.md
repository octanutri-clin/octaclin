# FOOD06 M04 — UX B/C

Ponte textual dos papéis PR451/0d3382b6, instâncias independentes:
/root/m04_nutricionista_ux_final e /root/m04_paciente_ux_final. Sem ferramentas,
imagens próprias, interação ou usuários reais; receberam descrição do código/UI
e provas do coordenador. Não seleção nativa TOML, R4 ou validação clínica.
O coordenador inspecionou captura mobile real. Reteste50browser ainda pendente
no brief recebido; nenhum parecer atribui PASS a esse reteste.

| ID | Origem | Cenário / evidência ou hipótese | Prioridade | Proposta / aceite | Estado |
|---|---|---|---|---|---|
| NUX-M04-01/PUX-M04-03 | Ambas | Tabela26linhas/confirmar abaixo exige memória da troca; hipótese de fricção | P2 | Repetir origem→proposta junto da ação final; não alterar dados | BACKLOG |
| NUX-M04-02 | Profissional | Bloqueio por mudanças não salvas pode confundir; hipótese | P2 | Motivo e ação visíveis junto ao botão | JÁ COBERTO |
| NUX-M04-03 | Profissional | Transcrição da comparação na consulta; oportunidade | P3 | Cópia textual com fontes/ressalvas, sem dado indevido | BACKLOG; não autorizado como novo recurso |
| PUX-M04-01 | Paciente indireto | Planejado confundido com consumido; hipótese | P2 | Ressalva visível junto aos resultados | JÁ COBERTO |
| PUX-M04-02 | Paciente indireto | Confirmar confundido com enviar; hipótese | P2 | Ação explicita rascunho e sucesso explica publicação separada | JÁ COBERTO |
| PUX-M04-04 | Paciente indireto | Label Operação teve defeito descrito em teste | P2 | Label explícito e reteste, sem enfraquecer assert | CORRIGIDO; prova no teste M04 |
| PUX-M04-05 | Paciente indireto | Mudança de fonte parece mudança da dieta; hipótese | P3 | Aviso da revalidação, sem inferir diagnóstico | JÁ COBERTO parcialmente; distinção detalhada futura |

Nutricionista: positivos porção atual, fonte/preparo, zero/ausência e separação
calcular/confirmar/publicar; principal fricção provável é extensão da tabela no
celular. Paciente: portal N/A direto, avaliação apenas das consequências futuras
de uma alteração explicitamente publicada; não criar acesso para justificar persona.
Sem novo defeito comprovado pelas personas, sem consenso clínico fabricado.
