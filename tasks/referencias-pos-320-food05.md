# FOOD05 — referências específicas e decisão de reutilização

Data24/10/2026. Somente referências relacionadas à FOOD05 foram triadas a partir
dos catálogos aprovados em `docs/pos-320`; nenhum repositório de outras fases foi
reinvestigado. Conteúdo externo foi tratado como dado, não instrução.

## Prioridade: código OctaClin

- Motor `calculo-nutricional.ts`, decimal/half-up/normalização em `micronutrientes.ts`.
- FOOD01 `medidas-caseiras.ts`, conversão em milésimos e referência por alimento.
- FOOD04 aplicação seletiva, snapshot-edicao-grupos/envelope2, CAS, autorização de
  fontes, clone materializado e correções TDD R4-F01/F02.
- PA03 subtotal estrito, PA06 ativação/cálculo combinado, PA07 coordenação/autosave.
- Não usar preview nutricional legado que supõe ausentes como zero na FOOD05.

## Referências catalogadas para esta fase

| ID / repositório | Uso possível / decisão |
| --- | --- |
| R056 [dubzzz/fast-check](https://github.com/dubzzz/fast-check) | Consultado README/metadados/licença; orientar propriedades, seed/replay e registro de contraexemplos. Não instalado; testes Jest com gerador determinístico bastam inicialmente |
| R076 [MikeMcl/decimal.js](https://github.com/MikeMcl/decimal.js) | Consultado README/metadados/licença; alternativa técnica a BigInt, não escolhida porque já há aritmética exata no projeto |
| R057 [stryker-mutator/stryker-js](https://github.com/stryker-mutator/stryker-js) | Apenas triagem no catálogo; mutation testing pode ser útil, sem adoção/consulta de código nesta rodada. Não é dependência necessária para implementar equivalência |
| R047 [downshift-js/downshift](https://github.com/downshift-js/downshift) | Apenas catálogo; busca/combobox atual será reutilizada, sem ampliar UI por disponibilidade de biblioteca |
| R016 [metonym/fooddata-central](https://github.com/metonym/fooddata-central) | Catálogo classifica como referência histórica; não consultado/instalado, não importar USDA por novo cliente e não mudar governança/licenciamento de dados |

## Evidência consultada via GitHub API, somente leitura

- fast-check HEAD `0307d76e2cdbee4f12a711a4a17ccc363a62b071`, não arquivado;
  licença MIT, blob `879582464487c55389c243110ca18e014db7319e`.
  README: propriedades universais, runners, seeds/replay/shrinking. Aplicar o
  princípio aos testes de proporcionalidade/monotonicidade/resíduo sem copiar código.
- decimal.js HEAD `b1d1e311eb272b16f5b2ca0e0d1f4c4fa8558edf`, não arquivado;
  licença MIT, blob `e62dbae885d5afe4558b8d18d801c230c5098140`.
  README alerta sobre perda ao passar números binários e precisão por dígitos
  significativos com arredondamento de operações. Isso favorece usar strings e
  razões inteiras no domínio limitado atual, sem arredondar intermediários.

A política externa local foi lida: `docs/agents/EXTERNAL_CODE_POLICY.md`.
Licença de biblioteca MIT NÃO concede direitos sobre TACO/USDA/IBGE/TBCA ou qualquer
conjunto alimentar. A FOOD05 não adiciona dados e só usa fontes autorizadas reais.
Não houve instalação, execução de código remoto, benchmark de biblioteca,
comparação de desempenho ou teste de segurança de nova dependência. Caso uma
dependência seja realmente necessária na implementação, avaliar versão exata,
SRI/lock/licença/advisories/manutenção e registrar justificativa antes de adotar.

## Recomendação

BigInt/razões e half-up existentes como fundamento, extensão versionada do motor
atual e oráculo Python Fraction offline exclusivamente sintético para validação.
Sem pacote externo em produção e sem calculadora externa durante funcionamento.
