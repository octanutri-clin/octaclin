# FOOD06 — coleta documental reproduzível

Utilitário Python 3, somente biblioteca padrão, para obter metadados, hashes e
datas das fontes oficiais candidatas. Não contém classificador, tabelas de
valores clínicos, dados de pacientes ou dependências novas do produto.

```sh
python -m unittest discover -s research/food06 -p 'test_*.py' -v
python research/food06/coletar_fontes.py --saida /tmp/manifesto-food06.json
```

Execute da raiz. O segundo comando faz GET público de cinco URLs fixas e salva
somente o manifesto no caminho informado. Não usa credenciais; não lê `.env` nem
consulta Neon/Render. Falha de rede, recurso inesperado, tamanho excessivo ou HTML
sem conteúdo principal interrompem a coleta; não grava manifesto parcial.

`sha256Bytes` permite identificar os bytes obtidos. `sha256TextoPrincipal`
normaliza espaços e exclui script/style fora do conteúdo; não é um hash de tabela
normalizada ou prova de equivalência clínica. Mudanças de números/notas ainda
precisam de investigação. A data da página e a data de metadados não são versões
científicas de cada nutriente.

O manifesto versionado é evidência da execução de 2026-10-30. O HTML completo
foi lido temporariamente e não é distribuído com o produto. A licença do recurso
foi identificada como OGL-Canada; direitos de terceiros e alcance às páginas
atuais permanecem em conferência. O script nunca concede aprovação de uso.

Oito testes usam HTML/JSON sintéticos ou falha de rede simulada. Resultado desta
rodada: PASS 8/8. São testes do coletor, não RED/GREEN de domínio clínico nem
validação científica independente. Nenhuma comparação clínica é ativada.

## Extração e quadro de conferência

O checkpoint posterior acrescentou 11 testes do extrator (19 no total), com
RED/GREEN funcional. Células são vinculadas por `headers` literais; cabeçalhos
duplicados, ausentes, incompatíveis e células repetidas falham. Notas de
sobrescrito são conservadas como vínculos, sem virar parte do número. ND não é zero.

```sh
python research/food06/extrair_tabelas.py --vitaminas /tmp/food06-fontes/vitaminas.html --elementos /tmp/food06-fontes/elementos.html --saida /tmp/food06-valores-candidatos.json
python research/food06/gerar_quadro.py --entrada /tmp/food06-valores-candidatos.json --vitaminas /tmp/food06-fontes/vitaminas.html --elementos /tmp/food06-fontes/elementos.html --saida /tmp/quadro-food06.md
```

Os HTMLs são entradas temporárias obtidas das URLs fixas, não versionados.
O quadro candidato registra os hashes exatos dessas entradas. Para reproduzir,
obter as fontes, comparar os hashes e investigar alterações antes de aceitar os
resultados. A data/hashes do manifesto são de outra obtenção e não devem ser
atribuídos aos arquivos da extração. Não converter JSON de pesquisa em dataset
runtime sem gates de ciência/direitos e ratificação.

O workflow isolado `.github/workflows/food06-research.yml` executa somente a suíte
sintética em PRs afetadas, sem consultas aos sites oficiais. O primeiro resultado
deve ser conferido no HEAD enviado; teste local não comprova CI.
