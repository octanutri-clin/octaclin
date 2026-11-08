# FOOD06 M01-C2 — revisão de segurança independente

Síntese editorial do coordenador a partir do relatório devolvido pelo revisor; não é transcrição literal.

- Revisor: subagente `tenant-security-reviewer`, instância única. **Pode executar testes existentes e leitura, sem editar.** Não escreveu o código. IDs de instância não preservados.
- Commit avaliado: `05e7f1f825c82f7b11c81d2ccd05aee3b9300a21`. Executou 4 specs de backend (69 testes passando, sobre dados sintéticos) e `typecheck` (sem erro).
- **Não verificou:** specs Web, Playwright, PostgreSQL/Testcontainers, valores de `base_codigo` no banco real (concluiu pelas migrações e importadores), integridade do ciphertext em repouso, rascunhos e dados históricos reais.

## Veredito por pergunta

| Pergunta | Veredito |
| --- | --- |
| 1. Classificação | OK. Fail-closed: só `conhecido` com porção finita `>= 0` conta; negativo, NaN, Infinity, string, ausente, `null` e buraco viram não resolvido ou indisponível; `__proto__` sem efeito (códigos fixos e `Object.hasOwn`) |
| 2. Reconciliação | OK no backend. Achados R4C2-02 e R4C2-04 |
| 3. Origem forjada | **OK, sem caminho de falsa procedência.** O snapshot só é gravado no servidor por `resolverItem`; `fonte` do catálogo vem do banco; manual e personalizado têm `origem` fixa e nunca `fonte`; o DTO não aceita `origem`/`fonte` e o pipe recusa campos extras |
| 4. Vínculo | OK |
| 5. Fail-open no leitor Web | OK |
| 6. Incompatível e indisponível | OK. Subtotal só como `quantidadeConhecida`; `total` só em COMPLETO |

## Achados e tratamento

| ID | Sev. | Resumo | Tratamento |
| --- | --- | --- | --- |
| R4C2-01 | **P1** | A origem exigia `baseCodigo` ∈ {TACO, USDA, IBGE} e versão numérica. A produção grava `cmvcol_taco3`, `foundation-foods`, `sr-legacy`, `pof-2008-2009-composicao` e versões como `taco-4a-cmvcol-taco3-v1`. Com dados reais, todo contribuinte de catálogo cairia em "sem origem documentada". Os testes passavam só porque usavam valores sintéticos. O resumo global do M08 (`resumirFontesRegistro`) tinha o mesmo defeito, anterior a este trabalho | **Confirmado por mim nas migrações e no serviço de catálogos e CORRIGIDO.** Resolvedor único `dominio/fonte-catalogo.ts` por par `codigo` + `baseCodigo` (os 4 pares de `BASES_ESPERADAS`); versão como rótulo seguro de até 64 caracteres; usado pelo resumo por nutriente **e** pelo resumo global M08. Web alinhada. Testes com os pares reais, par incoerente e identificação sintética antiga |
| R4C2-02 | P2 | O resumo histórico só emitia `quantidadeConhecida` em PARCIAL, e o leitor Web exige o valor quando há conhecidos; histórico com INCOMPATIVEL falharia fechado | **CORRIGIDO** e coberto pelo teste de contrato (inclui o resumo histórico, lido pelo leitor Web) |
| R4C2-03 | P3 | Item novo sem micronutrientes era rotulado "Registro antigo sem composição detalhada" | **CORRIGIDO** o rótulo: "Composição de micronutrientes não registrada no item". Não grava `ausente` em todos os nutrientes (mudaria persistência) |
| R4C2-04 | P3 | O leitor Web só conferia a soma das causas, não a categoria de cada uma | **CORRIGIDO**: exige a soma por categoria igual a cada contagem. Testes com respostas adulteradas |
| R4C2-05 | P3 | O tipo vinha de `baseCodigo`, texto livre | **CORRIGIDO** pelo par `codigo`/`baseCodigo` de R4C2-01 |

Lacunas de teste apontadas e fechadas: `micronutrientes: null`, `porcao` ausente em estado conhecido, buraco de array e origem forjada via DTO (o teste confere que a recusa é pelo campo extra).

## Limites que permanecem

- As versões reais de USDA e IBGE no catálogo de produção não foram confirmadas; o formato aceito é o rótulo seguro, e não valores específicos.
- Snapshots históricos congelados com outra identificação de fonte (por exemplo, a identificação sintética antiga) aparecem como "sem origem documentada". É o comportamento honesto, mas não foi medido contra dados reais.
- Nenhuma execução contra o banco de produção ou de staging.
- Leitura estática mais testes sintéticos; não substitui revisão humana de segurança.
