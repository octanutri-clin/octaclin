# Consolidação FOOD06 M07 — etapa B delimitada

| ID | Origem/funcionalidade | Evidência ou hipótese | Solução/complexidade | Arquitetura/segurança | Estado e decisão |
|---|---|---|---|---|---|
| NUX-01 | Profissional, seleção de registros | Colisão de labels reproduzida por teste RED real | Numeração de apresentação nos selects e linhas da lista carregada; baixa | Identidade/valor/key continuam UUID; sem API/banco novo | CORRIGIDO tecnicamente dentro do escopo de clareza aprovado; não é nova ratificação humana |
| NUX-02 | Profissional, recuperação | Hipótese de fricção | Instrução existente manda cancelar e conferir; rematerialização testada | Sem mudar política de confirmação/idempotência | JÁ COBERTO no contrato; avaliar compreensão em futuro teste humano |
| NUX-03 | Profissional, paginação | Hipótese | Seleção informa registros carregados e histórico oferece carregar anteriores | Sem nova carga ou ampliação de acesso | JÁ COBERTO parcialmente; proximidade do botão ao seletor BACKLOG, sem ampliar escopo |
| PUX-N/A | Paciente | Sem alteração no portal ou envio | Nenhuma mudança | Visibilidade preservada | N/A justificado |

Os revisores não viram imagens nem interagiram; B visual pelas personas NÃO EXECUTADO. Houve inspeção de screenshot e navegação automatizada sintética pelo coordenador, além das avaliações independentes textuais. Etapa C integral continua pendente, assim como testes humanos/tecnologia assistiva e R4 integral. Nenhum relatório fecha M07 ou direitos/DRI. Percentual administrativo permanece41,7%.

Teste RED novo: duas options com o mesmo rótulo; o tamanho do conjunto de labels ficou menor que o total. GREEN:8/8 Playwright desktop/mobile, incluindo comparação, revogação, resposta tardia e colisão; lint PASS. Typecheck e CI do novo HEAD registrados separadamente, sem herdar evidências da base. Sem mudança clínica, de persistência ou autorização.
